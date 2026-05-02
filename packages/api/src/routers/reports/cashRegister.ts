import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../../trpc";
import {
  getDb,
  cashRegisterSessions,
  cashRegisterTransactions,
  eq,
  and,
  desc,
  sql,
} from "@matrix-food/database";

const dateRangeInput = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const cashRegisterReportsRouter = createTRPCRouter({
  /** Lista paginada de sessões de caixa no período. */
  sessionsList: tenantProcedure
    .input(
      dateRangeInput.extend({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const offset = (input.page - 1) * input.pageSize;

      const periodFilter = and(
        eq(cashRegisterSessions.tenantId, ctx.tenantId),
        sql`${cashRegisterSessions.openedAt} >= ${input.from}`,
        sql`${cashRegisterSessions.openedAt} < ${input.to}`
      );

      const rows = await db
        .select({
          id: cashRegisterSessions.id,
          openedAt: cashRegisterSessions.openedAt,
          closedAt: cashRegisterSessions.closedAt,
          status: cashRegisterSessions.status,
          openingBalance: cashRegisterSessions.openingBalance,
          closingBalance: cashRegisterSessions.closingBalance,
          expectedBalance: cashRegisterSessions.expectedBalance,
          openedBy: cashRegisterSessions.openedBy,
          closedBy: cashRegisterSessions.closedBy,
          notes: cashRegisterSessions.notes,
        })
        .from(cashRegisterSessions)
        .where(periodFilter)
        .orderBy(desc(cashRegisterSessions.openedAt))
        .limit(input.pageSize)
        .offset(offset);

      const [count] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(cashRegisterSessions)
        .where(periodFilter);

      return {
        rows: rows.map((r) => {
          const closing = r.closingBalance ? Number(r.closingBalance) : null;
          const expected = r.expectedBalance ? Number(r.expectedBalance) : null;
          const diff =
            closing !== null && expected !== null ? closing - expected : null;
          return {
            id: r.id,
            openedAt: r.openedAt,
            closedAt: r.closedAt,
            status: r.status,
            openingBalance: Number(r.openingBalance),
            closingBalance: closing,
            expectedBalance: expected,
            difference: diff,
            openedBy: r.openedBy,
            closedBy: r.closedBy ?? null,
            notes: r.notes,
          };
        }),
        total: count?.count ?? 0,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  /** Resumo de conciliação no período (sobra/falta total e por sessão). */
  cashReconciliation: tenantProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const rows = await db
        .select({
          status: cashRegisterSessions.status,
          closingBalance: cashRegisterSessions.closingBalance,
          expectedBalance: cashRegisterSessions.expectedBalance,
        })
        .from(cashRegisterSessions)
        .where(
          and(
            eq(cashRegisterSessions.tenantId, ctx.tenantId),
            sql`${cashRegisterSessions.openedAt} >= ${input.from}`,
            sql`${cashRegisterSessions.openedAt} < ${input.to}`,
            eq(cashRegisterSessions.status, "CLOSED")
          )
        );

      let totalSurplus = 0;
      let totalShortage = 0;
      let exactCount = 0;
      let surplusCount = 0;
      let shortageCount = 0;
      let totalExpected = 0;
      let totalCounted = 0;

      for (const r of rows) {
        const counted = r.closingBalance ? Number(r.closingBalance) : 0;
        const expected = r.expectedBalance ? Number(r.expectedBalance) : 0;
        totalExpected += expected;
        totalCounted += counted;
        const diff = counted - expected;
        if (Math.abs(diff) < 0.005) exactCount += 1;
        else if (diff > 0) {
          totalSurplus += diff;
          surplusCount += 1;
        } else {
          totalShortage += Math.abs(diff);
          shortageCount += 1;
        }
      }

      return {
        sessions: rows.length,
        exactCount,
        surplusCount,
        shortageCount,
        totalSurplus,
        totalShortage,
        netDifference: totalCounted - totalExpected,
        totalExpected,
        totalCounted,
      };
    }),

  /** Quebra de transações por tipo (SALE, REFUND, ADD, REMOVE). */
  transactionsBreakdown: tenantProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const rows = await db
        .select({
          type: cashRegisterTransactions.type,
          count: sql<number>`count(*)::int`,
          total: sql<number>`COALESCE(SUM(${cashRegisterTransactions.amount}::numeric), 0)::numeric`,
        })
        .from(cashRegisterTransactions)
        .innerJoin(
          cashRegisterSessions,
          eq(cashRegisterTransactions.sessionId, cashRegisterSessions.id)
        )
        .where(
          and(
            eq(cashRegisterSessions.tenantId, ctx.tenantId),
            sql`${cashRegisterTransactions.createdAt} >= ${input.from}`,
            sql`${cashRegisterTransactions.createdAt} < ${input.to}`
          )
        )
        .groupBy(cashRegisterTransactions.type);

      return rows.map((r) => ({
        type: r.type,
        count: r.count,
        total: Number(r.total),
      }));
    }),
});
