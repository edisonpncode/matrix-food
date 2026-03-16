import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, tenantProcedure } from "../trpc";
import {
  getDb,
  cashRegisterSessions,
  cashRegisterTransactions,
  eq,
  and,
  desc,
  sql,
  sum,
} from "@matrix-food/database";

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

      // Verificar se já existe sessão aberta
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
   * Fecha a sessão de caixa atual.
   */
  closeSession: tenantProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        closingBalance: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Calcular saldo esperado
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

      // Somar transações
      const [txSums] = await db
        .select({
          totalSales: sql<string>`COALESCE(SUM(CASE WHEN ${cashRegisterTransactions.type} = 'SALE' THEN ${cashRegisterTransactions.amount} ELSE 0 END), 0)`,
          totalDeposits: sql<string>`COALESCE(SUM(CASE WHEN ${cashRegisterTransactions.type} = 'DEPOSIT' THEN ${cashRegisterTransactions.amount} ELSE 0 END), 0)`,
          totalWithdrawals: sql<string>`COALESCE(SUM(CASE WHEN ${cashRegisterTransactions.type} = 'WITHDRAWAL' THEN ${cashRegisterTransactions.amount} ELSE 0 END), 0)`,
          totalAdjustments: sql<string>`COALESCE(SUM(CASE WHEN ${cashRegisterTransactions.type} = 'ADJUSTMENT' THEN ${cashRegisterTransactions.amount} ELSE 0 END), 0)`,
        })
        .from(cashRegisterTransactions)
        .where(eq(cashRegisterTransactions.sessionId, input.sessionId));

      const openingBalance = parseFloat(session.openingBalance);
      const sales = parseFloat(txSums?.totalSales ?? "0");
      const deposits = parseFloat(txSums?.totalDeposits ?? "0");
      const withdrawals = parseFloat(txSums?.totalWithdrawals ?? "0");
      const adjustments = parseFloat(txSums?.totalAdjustments ?? "0");
      const expectedBalance =
        openingBalance + sales + deposits - withdrawals + adjustments;

      const [updated] = await db
        .update(cashRegisterSessions)
        .set({
          status: "CLOSED",
          closedBy: ctx.user.name ?? ctx.user.email ?? "Funcionário",
          closingBalance: input.closingBalance,
          expectedBalance: expectedBalance.toFixed(2),
          closedAt: new Date(),
          notes: input.notes ?? session.notes,
        })
        .where(eq(cashRegisterSessions.id, input.sessionId))
        .returning();

      return updated;
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
        type: z.enum(["SALE", "WITHDRAWAL", "DEPOSIT", "ADJUSTMENT"]),
        amount: z.string(),
        description: z.string().optional(),
        orderId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Verificar que sessão existe e está aberta
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
   * Resumo da sessão de caixa: vendas, retiradas, depósitos, saldo.
   */
  getSessionSummary: tenantProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
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

      // Buscar transações
      const transactions = await db
        .select()
        .from(cashRegisterTransactions)
        .where(eq(cashRegisterTransactions.sessionId, input.sessionId))
        .orderBy(desc(cashRegisterTransactions.createdAt));

      // Calcular totais
      let totalSales = 0;
      let totalDeposits = 0;
      let totalWithdrawals = 0;
      let totalAdjustments = 0;

      for (const tx of transactions) {
        const amount = parseFloat(tx.amount);
        switch (tx.type) {
          case "SALE":
            totalSales += amount;
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
      const currentBalance =
        openingBalance + totalSales + totalDeposits - totalWithdrawals + totalAdjustments;

      return {
        session,
        transactions,
        summary: {
          openingBalance,
          totalSales,
          totalDeposits,
          totalWithdrawals,
          totalAdjustments,
          currentBalance,
        },
      };
    }),
});
