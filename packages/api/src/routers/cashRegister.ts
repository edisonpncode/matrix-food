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
  desc,
  sql,
  inArray,
} from "@matrix-food/database";

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

      const [session] = await db
        .insert(cashRegisterSessions)
        .values({
          tenantId: ctx.tenantId,
          openedBy: ctx.user.name ?? ctx.user.email ?? "Funcionário",
          openingBalance: input.openingBalance,
          notes: input.notes,
        })
        .returning();

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
          closedBy: ctx.user.name ?? ctx.user.email ?? "Funcionário",
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

      // Devolve breakdown para que a UI exiba a tela de diferenças.
      return {
        session: updated,
        expectedBreakdown,
        countedBreakdown,
      };
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

      let totalSales = 0;
      let totalRefunds = 0;
      let totalDeposits = 0;
      let totalWithdrawals = 0;
      let totalAdjustments = 0;

      for (const tx of transactions) {
        const amount = parseFloat(tx.amount);
        switch (tx.type) {
          case "SALE":
            totalSales += amount;
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

      const openingBalance = parseFloat(session.openingBalance);
      const salesNet = totalSales + totalRefunds;
      const currentBalance =
        openingBalance + salesNet + totalDeposits - totalWithdrawals + totalAdjustments;

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
