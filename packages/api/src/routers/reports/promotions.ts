import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../../trpc";
import {
  getDb,
  promotions,
  promotionUsage,
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

export const promotionsReportsRouter = createTRPCRouter({
  /** Uso e desconto concedido por promoção. */
  promotionUsage: tenantProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const rows = await db
        .select({
          promotionId: promotionUsage.promotionId,
          code: promotions.code,
          description: promotions.description,
          type: promotions.type,
          uses: sql<number>`count(*)::int`,
          totalDiscount: sql<number>`COALESCE(SUM(${promotionUsage.discountAmount}::numeric), 0)::numeric`,
          uniqueCustomers: sql<number>`count(DISTINCT ${promotionUsage.customerPhone})::int`,
        })
        .from(promotionUsage)
        .innerJoin(promotions, eq(promotionUsage.promotionId, promotions.id))
        .where(
          and(
            eq(promotionUsage.tenantId, ctx.tenantId),
            sql`${promotionUsage.createdAt} >= ${input.from}`,
            sql`${promotionUsage.createdAt} < ${input.to}`
          )
        )
        .groupBy(
          promotionUsage.promotionId,
          promotions.code,
          promotions.description,
          promotions.type
        )
        .orderBy(desc(sql`count(*)`));

      return rows.map((r) => ({
        promotionId: r.promotionId,
        code: r.code,
        description: r.description,
        type: r.type,
        uses: r.uses,
        totalDiscount: Number(r.totalDiscount),
        uniqueCustomers: r.uniqueCustomers,
      }));
    }),

  /**
   * ROI: receita gerada (pedidos com promo) vs desconto concedido.
   * Calcula receita a partir dos pedidos que usaram cada promoção.
   */
  promotionROI: tenantProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const rows = await db
        .select({
          promotionId: promotionUsage.promotionId,
          code: promotions.code,
          uses: sql<number>`count(DISTINCT ${promotionUsage.orderId})::int`,
          totalDiscount: sql<number>`COALESCE(SUM(${promotionUsage.discountAmount}::numeric), 0)::numeric`,
          attributedRevenue: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)::numeric`,
          attributedSubtotal: sql<number>`COALESCE(SUM(${orders.subtotal}::numeric), 0)::numeric`,
        })
        .from(promotionUsage)
        .innerJoin(promotions, eq(promotionUsage.promotionId, promotions.id))
        .innerJoin(orders, eq(promotionUsage.orderId, orders.id))
        .where(
          and(
            eq(promotionUsage.tenantId, ctx.tenantId),
            sql`${promotionUsage.createdAt} >= ${input.from}`,
            sql`${promotionUsage.createdAt} < ${input.to}`,
            sql`${orders.status} <> 'CANCELLED'`
          )
        )
        .groupBy(promotionUsage.promotionId, promotions.code)
        .orderBy(desc(sql`SUM(${orders.total}::numeric)`));

      return rows.map((r) => ({
        promotionId: r.promotionId,
        code: r.code,
        uses: r.uses,
        totalDiscount: Number(r.totalDiscount),
        attributedRevenue: Number(r.attributedRevenue),
        attributedSubtotal: Number(r.attributedSubtotal),
        roi:
          Number(r.totalDiscount) > 0
            ? Number(r.attributedRevenue) / Number(r.totalDiscount)
            : 0,
      }));
    }),
});
