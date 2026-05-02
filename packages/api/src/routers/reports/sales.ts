import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../../trpc";
import { getDb, orders, eq, and, sql } from "@matrix-food/database";

/** Período padrão dos relatórios. `from` inclusivo, `to` exclusivo. */
const dateRangeInput = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

const granularityInput = dateRangeInput.extend({
  granularity: z.enum(["day", "week", "month"]).default("day"),
});

export const salesReportsRouter = createTRPCRouter({
  /** KPIs gerais: pedidos, faturamento, ticket médio, cancelados, descontos. */
  salesOverview: tenantProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const periodFilter = and(
        eq(orders.tenantId, ctx.tenantId),
        sql`${orders.createdAt} >= ${input.from}`,
        sql`${orders.createdAt} < ${input.to}`
      );

      const [row] = await db
        .select({
          orderCount: sql<number>`count(*)::int`,
          revenue: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)::numeric`,
          discount: sql<number>`COALESCE(SUM(${orders.discount}::numeric), 0)::numeric`,
          cancelled: sql<number>`SUM(CASE WHEN ${orders.status} = 'CANCELLED' THEN 1 ELSE 0 END)::int`,
        })
        .from(orders)
        .where(periodFilter);

      const orderCount = row?.orderCount ?? 0;
      const cancelled = row?.cancelled ?? 0;
      const revenue = Number(row?.revenue ?? 0);
      const discount = Number(row?.discount ?? 0);
      // Pedidos válidos = total - cancelados, usado para ticket médio.
      const validOrders = Math.max(orderCount - cancelled, 0);

      return {
        orders: orderCount,
        validOrders,
        cancelled,
        revenue,
        discount,
        avgTicket: validOrders > 0 ? revenue / validOrders : 0,
      };
    }),

  /** Faturamento agrupado por dia/semana/mês. */
  revenueByPeriod: tenantProcedure
    .input(granularityInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const truncFn =
        input.granularity === "month"
          ? sql`DATE_TRUNC('month', ${orders.createdAt})`
          : input.granularity === "week"
            ? sql`DATE_TRUNC('week', ${orders.createdAt})`
            : sql`DATE_TRUNC('day', ${orders.createdAt})`;

      const result = await db
        .select({
          bucket: sql<string>`${truncFn}::text`,
          orders: sql<number>`count(*)::int`,
          revenue: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)::numeric`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, ctx.tenantId),
            sql`${orders.createdAt} >= ${input.from}`,
            sql`${orders.createdAt} < ${input.to}`
          )
        )
        .groupBy(truncFn)
        .orderBy(truncFn);

      return result.map((r) => ({
        bucket: r.bucket,
        orders: r.orders,
        revenue: Number(r.revenue),
      }));
    }),

  /** Heatmap dia da semana (0=Dom..6=Sáb) × hora (0..23). */
  seasonalityHeatmap: tenantProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const result = await db
        .select({
          dow: sql<number>`EXTRACT(DOW FROM ${orders.createdAt})::int`,
          hour: sql<number>`EXTRACT(HOUR FROM ${orders.createdAt})::int`,
          orders: sql<number>`count(*)::int`,
          revenue: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)::numeric`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, ctx.tenantId),
            sql`${orders.createdAt} >= ${input.from}`,
            sql`${orders.createdAt} < ${input.to}`
          )
        )
        .groupBy(
          sql`EXTRACT(DOW FROM ${orders.createdAt})`,
          sql`EXTRACT(HOUR FROM ${orders.createdAt})`
        );

      // Preencher matriz 7×24 (faltantes ficam 0).
      const matrix: number[][] = Array.from({ length: 7 }, () =>
        Array.from({ length: 24 }, () => 0)
      );
      for (const row of result) {
        if (row.dow >= 0 && row.dow < 7 && row.hour >= 0 && row.hour < 24) {
          matrix[row.dow]![row.hour] = row.orders;
        }
      }

      return {
        matrix,
        rows: result.map((r) => ({
          dow: r.dow,
          hour: r.hour,
          orders: r.orders,
          revenue: Number(r.revenue),
        })),
      };
    }),

  /** Quebra por canal (source × type). */
  salesByChannel: tenantProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const result = await db
        .select({
          source: orders.source,
          type: orders.type,
          orders: sql<number>`count(*)::int`,
          revenue: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)::numeric`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, ctx.tenantId),
            sql`${orders.createdAt} >= ${input.from}`,
            sql`${orders.createdAt} < ${input.to}`
          )
        )
        .groupBy(orders.source, orders.type);

      return result.map((r) => ({
        source: r.source,
        type: r.type,
        orders: r.orders,
        revenue: Number(r.revenue),
      }));
    }),

  /** Métodos de pagamento. */
  paymentMethodBreakdown: tenantProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const result = await db
        .select({
          method: orders.paymentMethod,
          orders: sql<number>`count(*)::int`,
          revenue: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)::numeric`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, ctx.tenantId),
            sql`${orders.createdAt} >= ${input.from}`,
            sql`${orders.createdAt} < ${input.to}`
          )
        )
        .groupBy(orders.paymentMethod);

      const LABELS: Record<string, string> = {
        PIX: "PIX",
        CASH: "Dinheiro",
        CREDIT_CARD: "Crédito",
        DEBIT_CARD: "Débito",
        VOUCHER: "Voucher",
        OTHER: "Outro",
      };

      return result.map((r) => ({
        method: r.method,
        label: LABELS[r.method] ?? r.method,
        orders: r.orders,
        revenue: Number(r.revenue),
      }));
    }),
});
