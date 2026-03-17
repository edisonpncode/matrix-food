import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../trpc";
import {
  getDb,
  orders,
  orderItems,
  reviews,
  eq,
  and,
  sql,
  desc,
} from "@matrix-food/database";

export const analyticsRouter = createTRPCRouter({
  /** Resumo geral: pedidos hoje, semana, mês, ticket médio */
  getSummary: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const tenantId = ctx.tenantId;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Pedidos hoje
    const [today] = await db
      .select({
        count: sql<number>`count(*)::int`,
        total: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)::numeric`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          sql`${orders.createdAt} >= ${startOfToday}`
        )
      );

    // Pedidos na semana
    const [week] = await db
      .select({
        count: sql<number>`count(*)::int`,
        total: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)::numeric`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          sql`${orders.createdAt} >= ${startOfWeek}`
        )
      );

    // Pedidos no mês
    const [month] = await db
      .select({
        count: sql<number>`count(*)::int`,
        total: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)::numeric`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          sql`${orders.createdAt} >= ${startOfMonth}`
        )
      );

    // Pedidos cancelados hoje
    const [cancelled] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          eq(orders.status, "CANCELLED"),
          sql`${orders.createdAt} >= ${startOfToday}`
        )
      );

    // Avaliação média
    const [avgRating] = await db
      .select({
        avg: sql<number>`COALESCE(AVG(${reviews.rating}), 0)::numeric`,
        count: sql<number>`count(*)::int`,
      })
      .from(reviews)
      .where(eq(reviews.tenantId, tenantId));

    const todayCount = today?.count ?? 0;
    const todayTotal = Number(today?.total ?? 0);

    return {
      today: {
        orders: todayCount,
        revenue: todayTotal,
        avgTicket: todayCount > 0 ? todayTotal / todayCount : 0,
        cancelled: cancelled?.count ?? 0,
      },
      week: {
        orders: week?.count ?? 0,
        revenue: Number(week?.total ?? 0),
      },
      month: {
        orders: month?.count ?? 0,
        revenue: Number(month?.total ?? 0),
      },
      rating: {
        avg: Number(avgRating?.avg ?? 0),
        count: avgRating?.count ?? 0,
      },
    };
  }),

  /** Vendas por dia (últimos 7 dias) para gráfico */
  salesByDay: tenantProcedure
    .input(z.object({ days: z.number().int().min(1).max(90).default(7) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const result = await db
        .select({
          date: sql<string>`DATE(${orders.createdAt})`,
          orders: sql<number>`count(*)::int`,
          revenue: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)::numeric`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, ctx.tenantId),
            sql`${orders.createdAt} >= NOW() - INTERVAL '${sql.raw(String(input.days))} days'`
          )
        )
        .groupBy(sql`DATE(${orders.createdAt})`)
        .orderBy(sql`DATE(${orders.createdAt})`);

      return result.map((r) => ({
        date: r.date,
        orders: r.orders,
        revenue: Number(r.revenue),
      }));
    }),

  /** Produtos mais vendidos */
  topProducts: tenantProcedure
    .input(z.object({ limit: z.number().int().min(1).max(20).default(10) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const result = await db
        .select({
          productName: orderItems.productName,
          totalQuantity: sql<number>`SUM(${orderItems.quantity})::int`,
          totalRevenue: sql<number>`COALESCE(SUM(${orderItems.totalPrice}::numeric), 0)::numeric`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(eq(orders.tenantId, ctx.tenantId))
        .groupBy(orderItems.productName)
        .orderBy(desc(sql`SUM(${orderItems.quantity})`))
        .limit(input.limit);

      return result.map((r) => ({
        name: r.productName,
        quantity: r.totalQuantity,
        revenue: Number(r.totalRevenue),
      }));
    }),

  /** Pedidos por hora (horários de pico) */
  ordersByHour: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();

    const result = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${orders.createdAt})::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, ctx.tenantId),
          sql`${orders.createdAt} >= NOW() - INTERVAL '30 days'`
        )
      )
      .groupBy(sql`EXTRACT(HOUR FROM ${orders.createdAt})`)
      .orderBy(sql`EXTRACT(HOUR FROM ${orders.createdAt})`);

    // Preencher todas as 24 horas
    const hourMap = new Map(result.map((r) => [r.hour, r.count]));
    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, "0")}:00`,
      orders: hourMap.get(i) ?? 0,
    }));
  }),

  /** Distribuição de formas de pagamento */
  paymentMethods: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();

    const result = await db
      .select({
        method: orders.paymentMethod,
        count: sql<number>`count(*)::int`,
        total: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)::numeric`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, ctx.tenantId),
          sql`${orders.createdAt} >= NOW() - INTERVAL '30 days'`
        )
      )
      .groupBy(orders.paymentMethod);

    const LABELS: Record<string, string> = {
      PIX: "PIX",
      CASH: "Dinheiro",
      CREDIT_CARD: "Crédito",
      DEBIT_CARD: "Débito",
    };

    return result.map((r) => ({
      method: LABELS[r.method] ?? r.method,
      count: r.count,
      total: Number(r.total),
    }));
  }),
});
