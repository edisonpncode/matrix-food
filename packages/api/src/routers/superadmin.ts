import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, superadminProcedure } from "../trpc";
import {
  getDb,
  tenants,
  tenantUsers,
  orders,
  reviews,
  systemSettings,
  eq,
  and,
  desc,
  sql,
} from "@matrix-food/database";

const MAX_RESTAURANTS_KEY = "max_active_restaurants";

async function readMaxActiveRestaurants(
  db: ReturnType<typeof getDb>
): Promise<number | null> {
  const [row] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, MAX_RESTAURANTS_KEY))
    .limit(1);
  if (!row?.value) return null;
  const parsed = parseInt(row.value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export const superadminRouter = createTRPCRouter({
  /** Listar todos os restaurantes com dados de lead e estatísticas. */
  listTenants: superadminProcedure.query(async () => {
    const db = getDb();

    const tenantList = await db
      .select()
      .from(tenants)
      .orderBy(desc(tenants.createdAt));

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

        const [owner] = await db
          .select({
            name: tenantUsers.name,
            email: tenantUsers.email,
            phone: tenantUsers.phone,
          })
          .from(tenantUsers)
          .where(
            and(
              eq(tenantUsers.tenantId, tenant.id),
              eq(tenantUsers.role, "OWNER")
            )
          )
          .limit(1);

        return {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          city: tenant.city,
          state: tenant.state,
          phone: tenant.phone,
          email: tenant.email,
          status: tenant.status,
          isActive: tenant.isActive,
          usesOtherSystem: tenant.usesOtherSystem,
          currentSystemName: tenant.currentSystemName,
          monthlySalesRange: tenant.monthlySalesRange,
          foodTypes: tenant.foodTypes,
          createdAt: tenant.createdAt,
          owner: owner
            ? { name: owner.name, email: owner.email, phone: owner.phone }
            : null,
          stats: {
            totalOrders: orderStats?.totalOrders ?? 0,
            totalRevenue: Number(orderStats?.totalRevenue ?? 0),
            avgRating:
              Math.round(Number(reviewStats?.avgRating ?? 0) * 10) / 10,
          },
        };
      })
    );

    return tenantsWithStats;
  }),

  /** Toggle de "loja aberta agora" — não muda status de aprovação. */
  toggleTenant: superadminProcedure
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

  /** Aprova um restaurante em WAITLIST → ACTIVE (respeita o limite global). */
  approveTenant: superadminProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const db = getDb();

      const [target] = await db
        .select({ id: tenants.id, status: tenants.status })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);
      if (!target) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Restaurante não encontrado.",
        });
      }
      if (target.status === "ACTIVE") return target;

      const max = await readMaxActiveRestaurants(db);
      if (max !== null) {
        const [activeCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(tenants)
          .where(eq(tenants.status, "ACTIVE"));
        if ((activeCount?.count ?? 0) >= max) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Limite de restaurantes ativos atingido. Aumente o limite em Configurações antes de aprovar.",
          });
        }
      }

      const [updated] = await db
        .update(tenants)
        .set({ status: "ACTIVE" })
        .where(eq(tenants.id, input.tenantId))
        .returning();
      return updated;
    }),

  /** Suspende um restaurante (ACTIVE → SUSPENDED). Libera vaga. */
  suspendTenant: superadminProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const [updated] = await getDb()
        .update(tenants)
        .set({ status: "SUSPENDED" })
        .where(eq(tenants.id, input.tenantId))
        .returning();
      return updated;
    }),

  /** Configurações globais do sistema (limite + contadores atuais). */
  getSystemConfig: superadminProcedure.query(async () => {
    const db = getDb();
    const max = await readMaxActiveRestaurants(db);

    const [active] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenants)
      .where(eq(tenants.status, "ACTIVE"));
    const [waitlist] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenants)
      .where(eq(tenants.status, "WAITLIST"));

    return {
      maxActiveRestaurants: max,
      currentActive: active?.count ?? 0,
      currentWaitlist: waitlist?.count ?? 0,
    };
  }),

  /** Atualiza o limite de restaurantes ativos. null = sem limite. */
  updateSystemConfig: superadminProcedure
    .input(
      z.object({
        maxActiveRestaurants: z.number().int().min(0).nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const value =
        input.maxActiveRestaurants === null ||
        input.maxActiveRestaurants === 0
          ? ""
          : String(input.maxActiveRestaurants);

      await db
        .insert(systemSettings)
        .values({ key: MAX_RESTAURANTS_KEY, value })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { value, updatedAt: new Date() },
        });

      return { success: true };
    }),

  /** Dashboard geral da Matrix Food. */
  globalStats: superadminProcedure.query(async () => {
    const db = getDb();

    const [tenantCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenants);

    const [activeTenants] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenants)
      .where(eq(tenants.isActive, true));

    const [orderStats] = await db
      .select({
        totalOrders: sql<number>`count(*)::int`,
        totalRevenue: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)::numeric`,
      })
      .from(orders);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [todayStats] = await db
      .select({
        totalOrders: sql<number>`count(*)::int`,
        totalRevenue: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)::numeric`,
      })
      .from(orders)
      .where(sql`${orders.createdAt} >= ${startOfToday.toISOString()}`);

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
