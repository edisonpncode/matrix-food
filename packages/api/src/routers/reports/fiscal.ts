import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../../trpc";
import {
  getDb,
  fiscalDocuments,
  orders,
  eq,
  and,
  desc,
  sql,
} from "@matrix-food/database";

const dateRangeInput = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const fiscalReportsRouter = createTRPCRouter({
  /** Resumo de NFC-e: emitidas, canceladas, com erro. */
  fiscalSummary: tenantProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const periodFilter = and(
        eq(fiscalDocuments.tenantId, ctx.tenantId),
        sql`${fiscalDocuments.createdAt} >= ${input.from}`,
        sql`${fiscalDocuments.createdAt} < ${input.to}`
      );

      const byStatus = await db
        .select({
          status: fiscalDocuments.status,
          count: sql<number>`count(*)::int`,
        })
        .from(fiscalDocuments)
        .where(periodFilter)
        .groupBy(fiscalDocuments.status);

      const map = new Map(byStatus.map((r) => [r.status, r.count]));

      const [authorized] = await db
        .select({
          totalRevenue: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)::numeric`,
        })
        .from(fiscalDocuments)
        .innerJoin(orders, eq(fiscalDocuments.orderId, orders.id))
        .where(
          and(periodFilter, eq(fiscalDocuments.status, "AUTHORIZED"))
        );

      const total = byStatus.reduce((sum, r) => sum + r.count, 0);

      return {
        total,
        authorized: map.get("AUTHORIZED") ?? 0,
        rejected: map.get("REJECTED") ?? 0,
        cancelled: map.get("CANCELLED") ?? 0,
        error: map.get("ERROR") ?? 0,
        pending: map.get("PENDING") ?? 0,
        processing: map.get("PROCESSING") ?? 0,
        authorizedRevenue: Number(authorized?.totalRevenue ?? 0),
        successRate:
          total > 0 ? ((map.get("AUTHORIZED") ?? 0) / total) * 100 : 0,
      };
    }),

  /** Export estruturado para o contador. */
  accountantExport: tenantProcedure
    .input(
      z.object({
        month: z.number().int().min(1).max(12),
        year: z.number().int().min(2020).max(2100),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const from = new Date(input.year, input.month - 1, 1);
      const to = new Date(input.year, input.month, 1);

      const rows = await db
        .select({
          chaveAcesso: fiscalDocuments.chaveAcesso,
          numeroNfce: fiscalDocuments.numeroNfce,
          serieNfce: fiscalDocuments.serieNfce,
          status: fiscalDocuments.status,
          orderId: fiscalDocuments.orderId,
          orderNumber: orders.displayNumber,
          orderTotal: orders.total,
          orderCreatedAt: orders.createdAt,
          cancelledAt: fiscalDocuments.cancelledAt,
          cancelReason: fiscalDocuments.cancelReason,
        })
        .from(fiscalDocuments)
        .innerJoin(orders, eq(fiscalDocuments.orderId, orders.id))
        .where(
          and(
            eq(fiscalDocuments.tenantId, ctx.tenantId),
            sql`${fiscalDocuments.createdAt} >= ${from.toISOString()}`,
            sql`${fiscalDocuments.createdAt} < ${to.toISOString()}`,
            sql`${fiscalDocuments.status} IN ('AUTHORIZED', 'CANCELLED')`
          )
        )
        .orderBy(desc(fiscalDocuments.createdAt));

      return {
        period: { from: from.toISOString(), to: to.toISOString() },
        documents: rows.map((r) => ({
          chaveAcesso: r.chaveAcesso,
          numero: r.numeroNfce,
          serie: r.serieNfce,
          status: r.status,
          orderNumber: r.orderNumber,
          total: Number(r.orderTotal),
          orderCreatedAt: r.orderCreatedAt,
          cancelledAt: r.cancelledAt,
          cancelReason: r.cancelReason,
        })),
      };
    }),
});
