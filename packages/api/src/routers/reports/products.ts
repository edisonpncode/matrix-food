import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../../trpc";
import {
  getDb,
  orders,
  orderItems,
  products,
  categories,
  eq,
  and,
  desc,
  sql,
} from "@matrix-food/database";

const dateRangeInput = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const productsReportsRouter = createTRPCRouter({
  /**
   * Top produtos por quantidade ou faturamento.
   * Considera apenas pedidos não-cancelados.
   */
  topProducts: tenantProcedure
    .input(
      dateRangeInput.extend({
        limit: z.number().int().min(1).max(50).default(10),
        sortBy: z.enum(["quantity", "revenue"]).default("revenue"),
        categoryId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const conditions = [
        eq(orders.tenantId, ctx.tenantId),
        sql`${orders.createdAt} >= ${input.from}`,
        sql`${orders.createdAt} < ${input.to}`,
        sql`${orders.status} <> 'CANCELLED'`,
      ];
      if (input.categoryId) {
        conditions.push(eq(products.categoryId, input.categoryId));
      }

      const orderExpr =
        input.sortBy === "quantity"
          ? sql`SUM(${orderItems.quantity})`
          : sql`SUM(${orderItems.totalPrice}::numeric)`;

      const result = await db
        .select({
          productId: orderItems.productId,
          productName: orderItems.productName,
          quantity: sql<number>`SUM(${orderItems.quantity})::int`,
          revenue: sql<number>`COALESCE(SUM(${orderItems.totalPrice}::numeric), 0)::numeric`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(and(...conditions))
        .groupBy(orderItems.productId, orderItems.productName)
        .orderBy(desc(orderExpr))
        .limit(input.limit);

      return result.map((r) => ({
        productId: r.productId,
        name: r.productName,
        quantity: r.quantity,
        revenue: Number(r.revenue),
      }));
    }),

  /**
   * Curva ABC: classifica produtos em A (até 80% acumulado), B (até 95%), C (resto).
   * Usa receita acumulada como base.
   */
  abcCurve: tenantProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const rows = await db
        .select({
          productName: orderItems.productName,
          quantity: sql<number>`SUM(${orderItems.quantity})::int`,
          revenue: sql<number>`COALESCE(SUM(${orderItems.totalPrice}::numeric), 0)::numeric`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          and(
            eq(orders.tenantId, ctx.tenantId),
            sql`${orders.createdAt} >= ${input.from}`,
            sql`${orders.createdAt} < ${input.to}`,
            sql`${orders.status} <> 'CANCELLED'`
          )
        )
        .groupBy(orderItems.productName)
        .orderBy(desc(sql`SUM(${orderItems.totalPrice}::numeric)`));

      const totalRevenue = rows.reduce((sum, r) => sum + Number(r.revenue), 0);
      let acc = 0;
      const classified = rows.map((r) => {
        const revenue = Number(r.revenue);
        acc += revenue;
        const cumulative = totalRevenue > 0 ? (acc / totalRevenue) * 100 : 0;
        const klass: "A" | "B" | "C" =
          cumulative <= 80 ? "A" : cumulative <= 95 ? "B" : "C";
        return {
          name: r.productName,
          quantity: r.quantity,
          revenue,
          share: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
          cumulative,
          class: klass,
        };
      });

      const buckets = {
        A: classified.filter((c) => c.class === "A"),
        B: classified.filter((c) => c.class === "B"),
        C: classified.filter((c) => c.class === "C"),
      };

      return {
        items: classified,
        totalRevenue,
        summary: {
          A: { count: buckets.A.length, revenue: buckets.A.reduce((s, c) => s + c.revenue, 0) },
          B: { count: buckets.B.length, revenue: buckets.B.reduce((s, c) => s + c.revenue, 0) },
          C: { count: buckets.C.length, revenue: buckets.C.reduce((s, c) => s + c.revenue, 0) },
        },
      };
    }),

  /** Mix de vendas por categoria. */
  productsByCategory: tenantProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const rows = await db
        .select({
          categoryId: products.categoryId,
          categoryName: categories.name,
          quantity: sql<number>`SUM(${orderItems.quantity})::int`,
          revenue: sql<number>`COALESCE(SUM(${orderItems.totalPrice}::numeric), 0)::numeric`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .leftJoin(products, eq(orderItems.productId, products.id))
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(
          and(
            eq(orders.tenantId, ctx.tenantId),
            sql`${orders.createdAt} >= ${input.from}`,
            sql`${orders.createdAt} < ${input.to}`,
            sql`${orders.status} <> 'CANCELLED'`
          )
        )
        .groupBy(products.categoryId, categories.name)
        .orderBy(desc(sql`SUM(${orderItems.totalPrice}::numeric)`));

      const total = rows.reduce((sum, r) => sum + Number(r.revenue), 0);

      return rows.map((r) => ({
        categoryId: r.categoryId,
        categoryName: r.categoryName ?? "Sem categoria",
        quantity: r.quantity,
        revenue: Number(r.revenue),
        share: total > 0 ? (Number(r.revenue) / total) * 100 : 0,
      }));
    }),
});
