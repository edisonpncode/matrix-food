import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../../trpc";
import {
  getDb,
  orders,
  deliveryAreas,
  deliveryPersonEarnings,
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

export const deliveryReportsRouter = createTRPCRouter({
  /** Tempo médio de entrega por área (requer timestamps de pedido). */
  deliveryTimings: tenantProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const rows = await db
        .select({
          areaId: orders.deliveryAreaId,
          areaName: deliveryAreas.name,
          avgMinutes: sql<number>`AVG(EXTRACT(EPOCH FROM (${orders.deliveredAt} - ${orders.outForDeliveryAt})) / 60)::numeric`,
          orders: sql<number>`count(*)::int`,
        })
        .from(orders)
        .leftJoin(deliveryAreas, eq(orders.deliveryAreaId, deliveryAreas.id))
        .where(
          and(
            eq(orders.tenantId, ctx.tenantId),
            eq(orders.type, "DELIVERY"),
            sql`${orders.createdAt} >= ${input.from}`,
            sql`${orders.createdAt} < ${input.to}`,
            sql`${orders.deliveredAt} IS NOT NULL`,
            sql`${orders.outForDeliveryAt} IS NOT NULL`
          )
        )
        .groupBy(orders.deliveryAreaId, deliveryAreas.name)
        .orderBy(desc(sql`count(*)`));

      return rows.map((r) => ({
        areaId: r.areaId,
        areaName: r.areaName ?? "Sem área",
        avgMinutes: Number(r.avgMinutes ?? 0),
        orders: r.orders,
      }));
    }),

  /** Heatmap geográfico: pontos lat/lng com peso. */
  deliveryHeatmap: tenantProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const rows = await db.execute<{
        lat: string | null;
        lng: string | null;
        orders: number;
      }>(sql`
        SELECT
          (delivery_address->>'lat')::numeric AS lat,
          (delivery_address->>'lng')::numeric AS lng,
          COUNT(*)::int AS orders
        FROM orders
        WHERE tenant_id = ${ctx.tenantId}
          AND created_at >= ${input.from}
          AND created_at < ${input.to}
          AND status <> 'CANCELLED'
          AND delivery_address IS NOT NULL
          AND delivery_address->>'lat' IS NOT NULL
          AND delivery_address->>'lng' IS NOT NULL
        GROUP BY (delivery_address->>'lat'), (delivery_address->>'lng')
      `);

      const points: Array<{ lat: number; lng: number; weight: number }> = [];
      const list = (rows as unknown as { rows?: Array<{ lat: string | null; lng: string | null; orders: number }> }).rows
        ?? (rows as unknown as Array<{ lat: string | null; lng: string | null; orders: number }>);
      for (const r of list ?? []) {
        if (r.lat === null || r.lng === null) continue;
        const lat = Number(r.lat);
        const lng = Number(r.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        points.push({ lat, lng, weight: r.orders });
      }

      return { points };
    }),

  /** Ganhos por motoboy. */
  motoboyEarnings: tenantProcedure
    .input(
      dateRangeInput.extend({
        motoboyId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const conditions = [
        eq(deliveryPersonEarnings.tenantId, ctx.tenantId),
        sql`${deliveryPersonEarnings.createdAt} >= ${input.from}`,
        sql`${deliveryPersonEarnings.createdAt} < ${input.to}`,
      ];
      if (input.motoboyId) {
        conditions.push(eq(deliveryPersonEarnings.deliveryPersonId, input.motoboyId));
      }

      const rows = await db
        .select({
          motoboyId: deliveryPersonEarnings.deliveryPersonId,
          name: tenantUsers.name,
          totalAmount: sql<number>`COALESCE(SUM(${deliveryPersonEarnings.amount}::numeric), 0)::numeric`,
          entries: sql<number>`count(*)::int`,
          commission: sql<number>`COALESCE(SUM(CASE WHEN ${deliveryPersonEarnings.type} = 'COMMISSION' THEN ${deliveryPersonEarnings.amount}::numeric ELSE 0 END), 0)::numeric`,
          payouts: sql<number>`COALESCE(SUM(CASE WHEN ${deliveryPersonEarnings.type} = 'PAYOUT' THEN ${deliveryPersonEarnings.amount}::numeric ELSE 0 END), 0)::numeric`,
        })
        .from(deliveryPersonEarnings)
        .leftJoin(
          tenantUsers,
          eq(deliveryPersonEarnings.deliveryPersonId, tenantUsers.id)
        )
        .where(and(...conditions))
        .groupBy(deliveryPersonEarnings.deliveryPersonId, tenantUsers.name)
        .orderBy(desc(sql`SUM(${deliveryPersonEarnings.amount}::numeric)`));

      return rows.map((r) => ({
        motoboyId: r.motoboyId,
        name: r.name ?? "—",
        totalAmount: Number(r.totalAmount),
        entries: r.entries,
        commission: Number(r.commission),
        payouts: Number(r.payouts),
      }));
    }),

  /** Top áreas por volume de pedidos e receita. */
  topDeliveryAreas: tenantProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const rows = await db
        .select({
          areaId: orders.deliveryAreaId,
          areaName: deliveryAreas.name,
          orders: sql<number>`count(*)::int`,
          revenue: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)::numeric`,
          deliveryFee: sql<number>`COALESCE(SUM(${orders.deliveryFee}::numeric), 0)::numeric`,
        })
        .from(orders)
        .leftJoin(deliveryAreas, eq(orders.deliveryAreaId, deliveryAreas.id))
        .where(
          and(
            eq(orders.tenantId, ctx.tenantId),
            eq(orders.type, "DELIVERY"),
            sql`${orders.createdAt} >= ${input.from}`,
            sql`${orders.createdAt} < ${input.to}`,
            sql`${orders.status} <> 'CANCELLED'`
          )
        )
        .groupBy(orders.deliveryAreaId, deliveryAreas.name)
        .orderBy(desc(sql`count(*)`));

      return rows.map((r) => ({
        areaId: r.areaId,
        areaName: r.areaName ?? "Sem área",
        orders: r.orders,
        revenue: Number(r.revenue),
        deliveryFee: Number(r.deliveryFee),
      }));
    }),
});
