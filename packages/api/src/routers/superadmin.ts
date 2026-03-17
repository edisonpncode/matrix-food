import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
  getDb,
  tenants,
  orders,
  reviews,
  eq,
  desc,
  sql,
} from "@matrix-food/database";

export const superadminRouter = createTRPCRouter({
  /** Listar todos os restaurantes */
  listTenants: protectedProcedure.query(async () => {
    const db = getDb();

    const tenantList = await db
      .select()
      .from(tenants)
      .orderBy(desc(tenants.createdAt));

    // Buscar métricas para cada tenant
    const tenantsWithStats = await Promise.all(
      tenantList.map(async (tenant) => {
        const [orderStats] = await db
          .select({
            totalOrders: sql<number>`count(*)::int`,
            totalRevenue: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)::numeric`,
          })
          .from(orders)
          .where(eq(orders.tenantId, tenant.id));

        const [reviewStats] = await db
          .select({
            avgRating: sql<number>`COALESCE(AVG(${reviews.rating}), 0)::numeric`,
          })
          .from(reviews)
          .where(eq(reviews.tenantId, tenant.id));

        return {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          city: tenant.city,
          state: tenant.state,
          phone: tenant.phone,
          isActive: tenant.isActive,
          createdAt: tenant.createdAt,
          stats: {
            totalOrders: orderStats?.totalOrders ?? 0,
            totalRevenue: Number(orderStats?.totalRevenue ?? 0),
            avgRating: Math.round(Number(reviewStats?.avgRating ?? 0) * 10) / 10,
          },
        };
      })
    );

    return tenantsWithStats;
  }),

  /** Toggle ativar/desativar restaurante */
  toggleTenant: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      const [updated] = await getDb()
        .update(tenants)
        .set({ isActive: input.isActive })
        .where(eq(tenants.id, input.tenantId))
        .returning();
      return updated;
    }),

  /** Dashboard geral da Matrix Food */
  globalStats: protectedProcedure.query(async () => {
    const db = getDb();

    // Total de restaurantes
    const [tenantCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenants);

    const [activeTenants] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenants)
      .where(eq(tenants.isActive, true));

    // Total de pedidos global
    const [orderStats] = await db
      .select({
        totalOrders: sql<number>`count(*)::int`,
        totalRevenue: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)::numeric`,
      })
      .from(orders);

    // Pedidos hoje global
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [todayStats] = await db
      .select({
        totalOrders: sql<number>`count(*)::int`,
        totalRevenue: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)::numeric`,
      })
      .from(orders)
      .where(sql`${orders.createdAt} >= ${startOfToday}`);

    return {
      tenants: {
        total: tenantCount?.count ?? 0,
        active: activeTenants?.count ?? 0,
      },
      orders: {
        total: orderStats?.totalOrders ?? 0,
        totalRevenue: Number(orderStats?.totalRevenue ?? 0),
      },
      today: {
        orders: todayStats?.totalOrders ?? 0,
        revenue: Number(todayStats?.totalRevenue ?? 0),
      },
    };
  }),
});
