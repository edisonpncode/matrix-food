import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, tenantProcedure } from "../trpc";
import {
  getDb,
  cashRegisterSessions,
  cashRegisterTransactions,
  orders,
  eq,
  and,
  or,
  not,
  gte,
  lte,
  desc,
  sql,
  inArray,
} from "@matrix-food/database";
import { emitMorpheuEvent, getTenantName } from "../services/morpheu";

/** Formata string decimal em BRL ex: '150.00' -> '150,00'. */
function brl(v: string | number): string {
  const n = typeof v === "number" ? v : parseFloat(v);
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type MethodKey = "cash" | "creditCard" | "debitCard" | "pix";

const BREAKDOWN_ZERO: Record<MethodKey, number> = {
  cash: 0,
  creditCard: 0,
  debitCard: 0,
  pix: 0,
};

function paymentMethodToKey(method: string | null | undefined): MethodKey | null {
  switch (method) {
    case "CASH":
      return "cash";
    case "CREDIT_CARD":
      return "creditCard";
    case "DEBIT_CARD":
      return "debitCard";
    case "PIX":
      return "pix";
    default:
      return null;
  }
}

const countedSchema = z.object({
  cash: z.string().default("0"),
  creditCard: z.string().default("0"),
  debitCard: z.string().default("0"),
  pix: z.string().default("0"),
});

export const cashRegisterRouter = createTRPCRouter({
  /**
   * Abre uma nova sessão de caixa.
   */
  openSession: tenantProcedure
    .input(
      z.object({
        openingBalance: z.string().default("0"),
        notes: z.string().optional(),
        /** Nome do operador (staff) que está abrindo o caixa, vindo do
         *  selector de usuário ativo no frontend. Se ausente, cai no
         *  usuário Firebase autenticado (normalmente o dono). */
        openedByName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const [existingSession] = await db
        .select()
        .from(cashRegisterSessions)
        .where(
          and(
            eq(cashRegisterSessions.tenantId, ctx.tenantId),
            eq(cashRegisterSessions.status, "OPEN")
          )
        )
        .limit(1);

      if (existingSession) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Já existe um caixa aberto. Feche-o antes de abrir outro.",
        });
      }

      const openerName =
        input.openedByName?.trim() ||
        ctx.user.name ||
        ctx.user.email ||
        "Funcionário";

      const [session] = await db
        .insert(cashRegisterSessions)
        .values({
          tenantId: ctx.tenantId,
          openedBy: openerName,
          openingBalance: input.openingBalance,
          notes: input.notes,
        })
        .returning();

      // Morpheu: notifica abertura de caixa (fire-and-forget)
      void (async () => {
        const tenantName = await getTenantName(ctx.tenantId);
        await emitMorpheuEvent(ctx.tenantId, "CASH_OPEN", {
          tenantName,
          cashierName: openerName,
          initialAmount: brl(input.openingBalance),
        });
      })().catch(() => {});

      return session;
    }),

  /**
   * Fecha a sessão de caixa com contagem separada por método de pagamento.
   * O servidor calcula o breakdown esperado e persiste junto do informado.
   */
  closeSession: tenantProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        counted: countedSchema,
        notes: z.string().optional(),
        /** Nome do operador (staff) que está fechando — usado para validar
         *  se ele é a mesma pessoa que abriu o caixa. */
        closedByName: z.string().optional(),
        /** Papel do operador ativo. OWNER e MANAGER podem fechar qualquer
         *  caixa; outros papéis só podem fechar o caixa que eles abriram. */
        closedByRole: z
          .enum(["OWNER", "MANAGER", "CASHIER", "DELIVERY"])
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const [session] = await db
        .select()
        .from(cashRegisterSessions)
        .where(
          and(
            eq(cashRegisterSessions.id, input.sessionId),
            eq(cashRegisterSessions.tenantId, ctx.tenantId),
            eq(cashRegisterSessions.status, "OPEN")
          )
        )
        .limit(1);

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sessão de caixa não encontrada ou já fechada.",
        });
      }

      const closerName =
        input.closedByName?.trim() ||
        ctx.user.name ||
        ctx.user.email ||
        "Funcionário";
      const closerRole = input.closedByRole ?? ctx.user.role ?? null;
      const isPrivileged = closerRole === "OWNER" || closerRole === "MANAGER";
      const isOpener = closerName === session.openedBy;
      if (!isPrivileged && !isOpener) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Apenas quem abriu o caixa, o gerente ou o proprietário podem fechá-lo.",
        });
      }

      // Não permite fechar o caixa se houver pedidos em andamento — garante
      // que nenhuma venda fique "órfã" sem uma sessão onde registrar.
      const [pendingCount] = await db
        .select({
          count: sql<string>`COUNT(*)::text`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, ctx.tenantId),
            sql`${orders.status} NOT IN ('DELIVERED', 'PICKED_UP', 'CANCELLED')`
          )
        );

      const pending = parseInt(pendingCount?.count ?? "0", 10);
      if (pending > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Existem ${pending} pedido(s) em aberto. Finalize ou cancele todos antes de fechar o caixa.`,
        });
      }

      // Vendas líquidas (SALE + REFUND) agrupadas por método de pagamento do pedido.
      const salesByMethodRows = await db
        .select({
          method: orders.paymentMethod,
          total: sql<string>`COALESCE(SUM(${cashRegisterTransactions.amount}::numeric), 0)`,
        })
        .from(cashRegisterTransactions)
        .leftJoin(orders, eq(cashRegisterTransactions.orderId, orders.id))
        .where(
          and(
            eq(cashRegisterTransactions.sessionId, input.sessionId),
            inArray(cashRegisterTransactions.type, ["SALE", "REFUND"])
          )
        )
        .groupBy(orders.paymentMethod);

      const salesByMethod: Record<MethodKey, number> = { ...BREAKDOWN_ZERO };
      for (const row of salesByMethodRows) {
        const key = paymentMethodToKey(row.method);
        if (!key) continue;
        salesByMethod[key] += parseFloat(row.total ?? "0");
      }

      // Totais agregados (para saldo esperado de caixa).
      const [txSums] = await db
        .select({
          totalSalesNet: sql<string>`COALESCE(SUM(CASE WHEN ${cashRegisterTransactions.type} IN ('SALE','REFUND') THEN ${cashRegisterTransactions.amount}::numeric ELSE 0 END), 0)`,
          totalDeposits: sql<string>`COALESCE(SUM(CASE WHEN ${cashRegisterTransactions.type} = 'DEPOSIT' THEN ${cashRegisterTransactions.amount}::numeric ELSE 0 END), 0)`,
          totalWithdrawals: sql<string>`COALESCE(SUM(CASE WHEN ${cashRegisterTransactions.type} = 'WITHDRAWAL' THEN ${cashRegisterTransactions.amount}::numeric ELSE 0 END), 0)`,
          totalAdjustments: sql<string>`COALESCE(SUM(CASE WHEN ${cashRegisterTransactions.type} = 'ADJUSTMENT' THEN ${cashRegisterTransactions.amount}::numeric ELSE 0 END), 0)`,
        })
        .from(cashRegisterTransactions)
        .where(eq(cashRegisterTransactions.sessionId, input.sessionId));

      const openingBalance = parseFloat(session.openingBalance);
      const salesNet = parseFloat(txSums?.totalSalesNet ?? "0");
      const deposits = parseFloat(txSums?.totalDeposits ?? "0");
      const withdrawals = parseFloat(txSums?.totalWithdrawals ?? "0");
      const adjustments = parseFloat(txSums?.totalAdjustments ?? "0");

      // Soma dos descontos (promo + manual) aplicados nos pedidos da sessão.
      // Usa a mesma janela de pedidos do getSessionSummary (criados na sessão
      // OU com SALE/REFUND lançados nela), exceto cancelados.
      const closeSessionEnd = new Date();
      const discountRows = await db
        .selectDistinct({
          id: orders.id,
          discount: orders.discount,
        })
        .from(orders)
        .leftJoin(
          cashRegisterTransactions,
          eq(cashRegisterTransactions.orderId, orders.id)
        )
        .where(
          and(
            eq(orders.tenantId, ctx.tenantId),
            not(eq(orders.status, "CANCELLED")),
            or(
              and(
                gte(orders.createdAt, session.openedAt),
                lte(orders.createdAt, closeSessionEnd)
              ),
              and(
                eq(cashRegisterTransactions.sessionId, input.sessionId),
                inArray(cashRegisterTransactions.type, ["SALE", "REFUND"])
              )
            )
          )
        );
      const totalDiscounts = discountRows.reduce(
        (sum, row) => sum + parseFloat(row.discount ?? "0"),
        0
      );

      // O caixa físico (dinheiro) recebe: abertura + vendas em dinheiro + depósitos - retiradas + ajustes.
      // Cartões/PIX são "esperados" apenas como valores de controle (o que foi registrado no sistema).
      const expectedCash =
        openingBalance +
        salesByMethod.cash +
        deposits -
        withdrawals +
        adjustments;

      const expectedBreakdown: Record<MethodKey, string> = {
        cash: expectedCash.toFixed(2),
        creditCard: salesByMethod.creditCard.toFixed(2),
        debitCard: salesByMethod.debitCard.toFixed(2),
        pix: salesByMethod.pix.toFixed(2),
      };

      const countedBreakdown: Record<MethodKey, string> = {
        cash: parseFloat(input.counted.cash || "0").toFixed(2),
        creditCard: parseFloat(input.counted.creditCard || "0").toFixed(2),
        debitCard: parseFloat(input.counted.debitCard || "0").toFixed(2),
        pix: parseFloat(input.counted.pix || "0").toFixed(2),
      };

      const closingBalance =
        parseFloat(countedBreakdown.cash) +
        parseFloat(countedBreakdown.creditCard) +
        parseFloat(countedBreakdown.debitCard) +
        parseFloat(countedBreakdown.pix);

      const expectedBalanceTotal =
        expectedCash +
        salesByMethod.creditCard +
        salesByMethod.debitCard +
        salesByMethod.pix;

      const [updated] = await db
        .update(cashRegisterSessions)
        .set({
          status: "CLOSED",
          closedBy: closerName,
          closingBalance: closingBalance.toFixed(2),
          expectedBalance: expectedBalanceTotal.toFixed(2),
          countedBreakdown,
          expectedBreakdown,
          closedAt: new Date(),
          notes: input.notes ?? session.notes,
        })
        .where(eq(cashRegisterSessions.id, input.sessionId))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao fechar a sessão.",
        });
      }

      // Morpheu: notifica fechamento de caixa com relatório detalhado
      void (async () => {
        const tenantName = await getTenantName(ctx.tenantId);

        // Top 5 categorias vendidas durante a sessão (por valor)
        const { orderItems, products, categories } = await import(
          "@matrix-food/database"
        );
        const categoryRows = await db
          .select({
            categoryName: categories.name,
            qty: sql<number>`COALESCE(SUM(${orderItems.quantity}),0)::int`,
            revenue: sql<number>`COALESCE(SUM(${orderItems.totalPrice}::numeric),0)::numeric`,
          })
          .from(cashRegisterTransactions)
          .innerJoin(orders, eq(orders.id, cashRegisterTransactions.orderId))
          .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
          .leftJoin(products, eq(products.id, orderItems.productId))
          .leftJoin(categories, eq(categories.id, products.categoryId))
          .where(
            and(
              eq(cashRegisterTransactions.sessionId, input.sessionId),
              eq(cashRegisterTransactions.type, "SALE")
            )
          )
          .groupBy(categories.id, categories.name)
          .orderBy(
            desc(sql`COALESCE(SUM(${orderItems.totalPrice}::numeric),0)`)
          )
          .limit(5);

        const lines: string[] = [];
        lines.push(`🧾 *Fechamento de caixa — ${tenantName}*`);
        lines.push(`Fechado por: ${closerName}`);
        lines.push("");
        lines.push(`*Vendas por forma de pagamento:*`);
        lines.push(`• Dinheiro: R$ ${brl(salesByMethod.cash)}`);
        lines.push(`• Crédito: R$ ${brl(salesByMethod.creditCard)}`);
        lines.push(`• Débito: R$ ${brl(salesByMethod.debitCard)}`);
        lines.push(`• PIX: R$ ${brl(salesByMethod.pix)}`);
        lines.push("");
        lines.push(`*Total vendido:* R$ ${brl(salesNet)}`);
        if (totalDiscounts > 0.005) {
          lines.push(`*Total de descontos:* R$ ${brl(totalDiscounts)}`);
        }
        lines.push(`*Em caixa (contado):* R$ ${brl(closingBalance)}`);
        lines.push(
          `*Esperado em caixa:* R$ ${brl(expectedBalanceTotal)}`
        );
        const diff = closingBalance - expectedBalanceTotal;
        if (Math.abs(diff) > 0.005) {
          lines.push(
            `*Diferença:* ${diff >= 0 ? "+" : ""}R$ ${brl(Math.abs(diff))}`
          );
        }
        if (categoryRows.length > 0) {
          lines.push("");
          lines.push(`*Top categorias:*`);
          for (const c of categoryRows) {
            lines.push(
              `• ${c.categoryName ?? "Sem categoria"}: ${c.qty} itens — R$ ${brl(Number(c.revenue))}`
            );
          }
        }
        const detailMessage = lines.join("\n");

        await emitMorpheuEvent(ctx.tenantId, "CASH_CLOSE", {
          tenantName,
          cashierName: closerName,
          totalSold: brl(salesNet),
          totalInCash: brl(closingBalance),
          cashRegisterId: updated.id,
          detailMessage,
        });
      })().catch(() => {});

      // Devolve breakdown para que a UI exiba a tela de diferenças.
      return {
        session: updated,
        expectedBreakdown,
        countedBreakdown,
        totalDiscounts,
      };
    }),

  /**
   * Conta pedidos em aberto (não DELIVERED/PICKED_UP/CANCELLED). Usado pela
   * UI para bloquear o fechamento do caixa antes de pedir a contagem.
   */
  countPendingOrders: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();

    const [row] = await db
      .select({ count: sql<string>`COUNT(*)::text` })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, ctx.tenantId),
          sql`${orders.status} NOT IN ('DELIVERED', 'PICKED_UP', 'CANCELLED')`
        )
      );

    return { count: parseInt(row?.count ?? "0", 10) };
  }),

  /**
   * Retorna a sessão de caixa aberta (ou null).
   */
  getActiveSession: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();

    const [session] = await db
      .select()
      .from(cashRegisterSessions)
      .where(
        and(
          eq(cashRegisterSessions.tenantId, ctx.tenantId),
          eq(cashRegisterSessions.status, "OPEN")
        )
      )
      .limit(1);

    return session ?? null;
  }),

  /**
   * Registra uma movimentação no caixa.
   */
  addTransaction: tenantProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        type: z.enum(["SALE", "WITHDRAWAL", "DEPOSIT", "ADJUSTMENT", "REFUND"]),
        amount: z.string(),
        description: z.string().optional(),
        orderId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const [session] = await db
        .select()
        .from(cashRegisterSessions)
        .where(
          and(
            eq(cashRegisterSessions.id, input.sessionId),
            eq(cashRegisterSessions.tenantId, ctx.tenantId),
            eq(cashRegisterSessions.status, "OPEN")
          )
        )
        .limit(1);

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sessão de caixa não encontrada ou fechada.",
        });
      }

      const [transaction] = await db
        .insert(cashRegisterTransactions)
        .values({
          sessionId: input.sessionId,
          tenantId: ctx.tenantId,
          type: input.type,
          amount: input.amount,
          description: input.description,
          orderId: input.orderId,
          createdBy: ctx.user.name ?? ctx.user.email ?? "Funcionário",
        })
        .returning();

      // Morpheu: notifica depósito / retirada (fire-and-forget)
      if (input.type === "DEPOSIT" || input.type === "WITHDRAWAL") {
        const event =
          input.type === "DEPOSIT" ? "CASH_DEPOSIT" : "CASH_WITHDRAW";
        void (async () => {
          const tenantName = await getTenantName(ctx.tenantId);
          await emitMorpheuEvent(ctx.tenantId, event, {
            tenantName,
            cashierName:
              ctx.user.name ?? ctx.user.email ?? "Funcionário",
            amount: brl(input.amount),
            description: input.description ?? "Sem descrição",
          });
        })().catch(() => {});
      }

      return transaction;
    }),

  /**
   * Resumo da sessão. Por padrão esconde o breakdown esperado para forçar
   * contagem cega no fechamento; passe revealExpected=true para exibi-lo
   * (ex.: em telas de histórico de sessões fechadas).
   */
  getSessionSummary: tenantProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        revealExpected: z.boolean().optional().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const [session] = await db
        .select()
        .from(cashRegisterSessions)
        .where(
          and(
            eq(cashRegisterSessions.id, input.sessionId),
            eq(cashRegisterSessions.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sessão não encontrada.",
        });
      }

      const transactions = await db
        .select()
        .from(cashRegisterTransactions)
        .where(eq(cashRegisterTransactions.sessionId, input.sessionId))
        .orderBy(desc(cashRegisterTransactions.createdAt));

      // cashSalesConfirmed = vendas que já entraram fisicamente no caixa
      // (transações SALE registradas). Usado só pra calcular currentBalance.
      let cashSalesConfirmed = 0;
      let totalRefunds = 0;
      let totalDeposits = 0;
      let totalWithdrawals = 0;
      let totalAdjustments = 0;

      for (const tx of transactions) {
        const amount = parseFloat(tx.amount);
        switch (tx.type) {
          case "SALE":
            cashSalesConfirmed += amount;
            break;
          case "REFUND":
            totalRefunds += amount; // normalmente negativo
            break;
          case "DEPOSIT":
            totalDeposits += amount;
            break;
          case "WITHDRAWAL":
            totalWithdrawals += amount;
            break;
          case "ADJUSTMENT":
            totalAdjustments += amount;
            break;
        }
      }

      // totalSales = TUDO que foi vendido na sessão (todos os canais e origens),
      // mesmo que o dinheiro ainda não tenha entrado. Pedidos cancelados não contam.
      // Inclui pedidos criados durante a janela da sessão OU pedidos com SALE/REFUND
      // registrados nessa sessão (cobre online finalizado depois de cruzar sessões).
      const sessionEnd = session.closedAt ?? new Date();
      const salesRows = await db
        .selectDistinct({
          id: orders.id,
          total: orders.total,
          discount: orders.discount,
        })
        .from(orders)
        .leftJoin(
          cashRegisterTransactions,
          eq(cashRegisterTransactions.orderId, orders.id)
        )
        .where(
          and(
            eq(orders.tenantId, ctx.tenantId),
            not(eq(orders.status, "CANCELLED")),
            or(
              and(
                gte(orders.createdAt, session.openedAt),
                lte(orders.createdAt, sessionEnd)
              ),
              and(
                eq(cashRegisterTransactions.sessionId, input.sessionId),
                inArray(cashRegisterTransactions.type, ["SALE", "REFUND"])
              )
            )
          )
        );
      const totalSales = salesRows.reduce(
        (sum, row) => sum + parseFloat(row.total),
        0
      );
      const totalDiscounts = salesRows.reduce(
        (sum, row) => sum + parseFloat(row.discount ?? "0"),
        0
      );

      const openingBalance = parseFloat(session.openingBalance);
      const cashSalesNet = cashSalesConfirmed + totalRefunds;
      const currentBalance =
        openingBalance + cashSalesNet + totalDeposits - totalWithdrawals + totalAdjustments;

      // Breakdown esperado por método — só retornado em histórico ou se explicitamente pedido.
      let breakdownByMethod: Record<MethodKey, number> | null = null;
      if (input.revealExpected || session.status === "CLOSED") {
        const rows = await db
          .select({
            method: orders.paymentMethod,
            total: sql<string>`COALESCE(SUM(${cashRegisterTransactions.amount}::numeric), 0)`,
          })
          .from(cashRegisterTransactions)
          .leftJoin(orders, eq(cashRegisterTransactions.orderId, orders.id))
          .where(
            and(
              eq(cashRegisterTransactions.sessionId, input.sessionId),
              inArray(cashRegisterTransactions.type, ["SALE", "REFUND"])
            )
          )
          .groupBy(orders.paymentMethod);

        breakdownByMethod = { ...BREAKDOWN_ZERO };
        for (const row of rows) {
          const key = paymentMethodToKey(row.method);
          if (!key) continue;
          breakdownByMethod[key] += parseFloat(row.total ?? "0");
        }
      }

      return {
        session,
        transactions,
        summary: {
          openingBalance,
          totalSales,
          totalDiscounts,
          totalRefunds,
          totalDeposits,
          totalWithdrawals,
          totalAdjustments,
          currentBalance,
        },
        breakdownByMethod,
      };
    }),
});
