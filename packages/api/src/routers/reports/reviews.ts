import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../../trpc";
import {
  getDb,
  reviews,
  orders,
  orderItems,
  eq,
  and,
  desc,
  sql,
} from "@matrix-food/database";

const dateRangeInput = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const reviewsReportsRouter = createTRPCRouter({
  /** Estatística geral: média, total, distribuição 1..5. */
  reviewsSummary: tenantProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const periodFilter = and(
        eq(reviews.tenantId, ctx.tenantId),
        sql`${reviews.createdAt} >= ${input.from}`,
        sql`${reviews.createdAt} < ${input.to}`
      );

      const [summary] = await db
        .select({
          count: sql<number>`count(*)::int`,
          avg: sql<number>`COALESCE(AVG(${reviews.rating})::numeric, 0)`,
          replied: sql<number>`SUM(CASE WHEN ${reviews.reply} IS NOT NULL THEN 1 ELSE 0 END)::int`,
        })
        .from(reviews)
        .where(periodFilter);

      const distribution = await db
        .select({
          rating: reviews.rating,
          count: sql<number>`count(*)::int`,
        })
        .from(reviews)
        .where(periodFilter)
        .groupBy(reviews.rating);

      const map = new Map<number, number>(
        distribution.map((d) => [d.rating, d.count])
      );
      const dist = [1, 2, 3, 4, 5].map((rating) => ({
        rating,
        count: map.get(rating) ?? 0,
      }));

      const total = summary?.count ?? 0;
      const replied = summary?.replied ?? 0;

      return {
        total,
        avg: Number(summary?.avg ?? 0),
        replied,
        replyRate: total > 0 ? (replied / total) * 100 : 0,
        distribution: dist,
      };
    }),

  /** Tendência da nota média ao longo do tempo (granularidade dia). */
  reviewsTrend: tenantProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const rows = await db
        .select({
          bucket: sql<string>`DATE_TRUNC('day', ${reviews.createdAt})::text`,
          count: sql<number>`count(*)::int`,
          avg: sql<number>`COALESCE(AVG(${reviews.rating})::numeric, 0)`,
        })
        .from(reviews)
        .where(
          and(
            eq(reviews.tenantId, ctx.tenantId),
            sql`${reviews.createdAt} >= ${input.from}`,
            sql`${reviews.createdAt} < ${input.to}`
          )
        )
        .groupBy(sql`DATE_TRUNC('day', ${reviews.createdAt})`)
        .orderBy(sql`DATE_TRUNC('day', ${reviews.createdAt})`);

      return rows.map((r) => ({
        bucket: r.bucket,
        count: r.count,
        avg: Number(r.avg),
      }));
    }),

  /**
   * Avaliações mais comuns por produto (proxy: produtos presentes em pedidos avaliados).
   * Útil para identificar produtos que recebem mais avaliações negativas.
   */
  reviewsByProduct: tenantProcedure
    .input(
      dateRangeInput.extend({
        limit: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const rows = await db
        .select({
          productName: orderItems.productName,
          reviewCount: sql<number>`count(DISTINCT ${reviews.id})::int`,
          avg: sql<number>`COALESCE(AVG(${reviews.rating})::numeric, 0)`,
        })
        .from(reviews)
        .innerJoin(orders, eq(reviews.orderId, orders.id))
        .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
        .where(
          and(
            eq(reviews.tenantId, ctx.tenantId),
            sql`${reviews.createdAt} >= ${input.from}`,
            sql`${reviews.createdAt} < ${input.to}`
          )
        )
        .groupBy(orderItems.productName)
        .orderBy(desc(sql`count(DISTINCT ${reviews.id})`))
        .limit(input.limit);

      return rows.map((r) => ({
        name: r.productName,
        reviewCount: r.reviewCount,
        avg: Number(r.avg),
      }));
    }),
});
