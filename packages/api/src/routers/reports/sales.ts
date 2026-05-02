import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../../trpc";
import { getDb, orders, eq, and, sql } from "@matrix-food/database";

/**
 * Input padrão de período usado em todos os relatórios.
 * `from` e `to` são ISO datetimes (UTC). `to` é exclusivo (< to).
 */
const dateRangeInput = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const salesReportsRouter = createTRPCRouter({
  /**
   * Visão geral de vendas no período:
   *  - quantidade de pedidos
   *  - faturamento bruto (soma de orders.total)
   *  - ticket médio
   *
   * Procedures detalhados (sazonalidade, canal, etc) entram nas Fases seguintes.
   */
  salesOverview: tenantProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const [row] = await db
        .select({
          orderCount: sql<number>`count(*)::int`,
          revenue: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)::numeric`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, ctx.tenantId),
            sql`${orders.createdAt} >= ${input.from}`,
            sql`${orders.createdAt} < ${input.to}`
          )
        );

      const orderCount = row?.orderCount ?? 0;
      const revenue = Number(row?.revenue ?? 0);

      return {
        orders: orderCount,
        revenue,
        avgTicket: orderCount > 0 ? revenue / orderCount : 0,
      };
    }),
});
