import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../../trpc";
import {
  getDb,
  orders,
  orderCancellations,
  activityLogs,
  tenantUsers,
  eq,
  and,
  desc,
  sql,
} from "@matrix-food/database";

const dateRangeInput = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const operationsReportsRouter = createTRPCRouter({
  /**
   * Tempos médios entre status do pedido (em minutos).
   * Requer que os timestamps acceptedAt/preparingAt/etc. estejam preenchidos —
   * só funciona após `pnpm db:push` aplicar a migration da Fase 0.
   */
  orderTimings: tenantProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const [row] = await db
        .select({
          accept: sql<number>`AVG(EXTRACT(EPOCH FROM (${orders.acceptedAt} - ${orders.createdAt})) / 60)::numeric`,
          prepare: sql<number>`AVG(EXTRACT(EPOCH FROM (${orders.readyAt} - ${orders.preparingAt})) / 60)::numeric`,
          deliver: sql<number>`AVG(EXTRACT(EPOCH FROM (${orders.deliveredAt} - ${orders.outForDeliveryAt})) / 60)::numeric`,
          fullCycle: sql<number>`AVG(EXTRACT(EPOCH FROM (${orders.deliveredAt} - ${orders.createdAt})) / 60)::numeric`,
          sample: sql<number>`count(*)::int`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, ctx.tenantId),
            sql`${orders.createdAt} >= ${input.from}`,
            sql`${orders.createdAt} < ${input.to}`,
            sql`${orders.deliveredAt} IS NOT NULL`
          )
        );

      return {
        avgAcceptMinutes: Number(row?.accept ?? 0),
        avgPrepareMinutes: Number(row?.prepare ?? 0),
        avgDeliverMinutes: Number(row?.deliver ?? 0),
        avgFullCycleMinutes: Number(row?.fullCycle ?? 0),
        sample: row?.sample ?? 0,
      };
    }),

  /**
   * Análise de cancelamentos: por motivo e por funcionário.
   * Funciona apenas após a tabela `order_cancellations` ser criada via db:push.
   */
  cancellationAnalysis: tenantProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const periodFilter = and(
        eq(orderCancellations.tenantId, ctx.tenantId),
        sql`${orderCancellations.createdAt} >= ${input.from}`,
        sql`${orderCancellations.createdAt} < ${input.to}`
      );

      const byReason = await db
        .select({
          reason: orderCancellations.reason,
          count: sql<number>`count(*)::int`,
        })
        .from(orderCancellations)
        .where(periodFilter)
        .groupBy(orderCancellations.reason)
        .orderBy(desc(sql`count(*)`));

      const byUser = await db
        .select({
          userName: tenantUsers.name,
          count: sql<number>`count(*)::int`,
        })
        .from(orderCancellations)
        .leftJoin(
          tenantUsers,
          eq(orderCancellations.cancelledByUserId, tenantUsers.id)
        )
        .where(periodFilter)
        .groupBy(tenantUsers.name)
        .orderBy(desc(sql`count(*)`));

      const [totals] = await db
        .select({
          total: sql<number>`count(*)::int`,
        })
        .from(orderCancellations)
        .where(periodFilter);

      return {
        total: totals?.total ?? 0,
        byReason: byReason.map((r) => ({ reason: r.reason, count: r.count })),
        byUser: byUser.map((u) => ({
          userName: u.userName ?? "(desconhecido)",
          count: u.count,
        })),
      };
    }),

  /** Produtividade por funcionário (de activity_logs). */
  staffProductivity: tenantProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const rows = await db
        .select({
          userId: activityLogs.userId,
          userName: tenantUsers.name,
          ordersCreated: sql<number>`SUM(CASE WHEN ${activityLogs.action} = 'ORDER_CREATED' THEN 1 ELSE 0 END)::int`,
          ordersConfirmed: sql<number>`SUM(CASE WHEN ${activityLogs.action} = 'ORDER_CONFIRMED' THEN 1 ELSE 0 END)::int`,
          ordersCancelled: sql<number>`SUM(CASE WHEN ${activityLogs.action} = 'ORDER_CANCELLED' THEN 1 ELSE 0 END)::int`,
          cashOpens: sql<number>`SUM(CASE WHEN ${activityLogs.action} = 'CASH_OPENED' THEN 1 ELSE 0 END)::int`,
          cashCloses: sql<number>`SUM(CASE WHEN ${activityLogs.action} = 'CASH_CLOSED' THEN 1 ELSE 0 END)::int`,
        })
        .from(activityLogs)
        .leftJoin(tenantUsers, eq(activityLogs.userId, tenantUsers.id))
        .where(
          and(
            eq(activityLogs.tenantId, ctx.tenantId),
            sql`${activityLogs.createdAt} >= ${input.from}`,
            sql`${activityLogs.createdAt} < ${input.to}`,
            sql`${activityLogs.userId} IS NOT NULL`
          )
        )
        .groupBy(activityLogs.userId, tenantUsers.name)
        .orderBy(
          desc(sql`SUM(CASE WHEN ${activityLogs.action} = 'ORDER_CREATED' THEN 1 ELSE 0 END)`)
        );

      return rows.map((r) => ({
        userId: r.userId,
        userName: r.userName ?? "(desconhecido)",
        ordersCreated: r.ordersCreated,
        ordersConfirmed: r.ordersConfirmed,
        ordersCancelled: r.ordersCancelled,
        cashOpens: r.cashOpens,
        cashCloses: r.cashCloses,
      }));
    }),
});
