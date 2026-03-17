import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  tenantProcedure,
} from "../trpc";
import {
  getDb,
  billingPlans,
  tenantSubscriptions,
  billingRecords,
  tenants,
  orders,
  eq,
  and,
  desc,
  sql,
} from "@matrix-food/database";

export const billingRouter = createTRPCRouter({
  // ================================
  // SUPER ADMIN - Gestão de Planos
  // ================================

  /** Listar todos os planos */
  listPlans: protectedProcedure.query(async () => {
    return getDb()
      .select()
      .from(billingPlans)
      .orderBy(desc(billingPlans.createdAt));
  }),

  /** Criar plano */
  createPlan: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        freeOrdersLimit: z.number().int().min(0),
        percentageFee: z.number().min(0).max(100),
        minMonthlyFee: z.number().min(0).optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Se é default, remover default dos outros
      if (input.isDefault) {
        await db
          .update(billingPlans)
          .set({ isDefault: false })
          .where(eq(billingPlans.isDefault, true));
      }

      const [plan] = await db
        .insert(billingPlans)
        .values({
          name: input.name,
          description: input.description,
          freeOrdersLimit: input.freeOrdersLimit,
          percentageFee: String(input.percentageFee),
          minMonthlyFee: input.minMonthlyFee
            ? String(input.minMonthlyFee)
            : null,
          isDefault: input.isDefault ?? false,
        })
        .returning();

      return plan;
    }),

  /** Atualizar plano */
  updatePlan: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        freeOrdersLimit: z.number().int().min(0).optional(),
        percentageFee: z.number().min(0).max(100).optional(),
        minMonthlyFee: z.number().min(0).nullable().optional(),
        isActive: z.boolean().optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;

      if (data.isDefault) {
        await db
          .update(billingPlans)
          .set({ isDefault: false })
          .where(eq(billingPlans.isDefault, true));
      }

      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined)
        updateData.description = data.description;
      if (data.freeOrdersLimit !== undefined)
        updateData.freeOrdersLimit = data.freeOrdersLimit;
      if (data.percentageFee !== undefined)
        updateData.percentageFee = String(data.percentageFee);
      if (data.minMonthlyFee !== undefined)
        updateData.minMonthlyFee =
          data.minMonthlyFee !== null ? String(data.minMonthlyFee) : null;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

      const [updated] = await db
        .update(billingPlans)
        .set(updateData)
        .where(eq(billingPlans.id, id))
        .returning();

      return updated;
    }),

  // ================================
  // SUPER ADMIN - Assinaturas
  // ================================

  /** Atribuir plano a um restaurante */
  assignPlan: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        planId: z.string().uuid(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Verificar se já tem assinatura
      const existing = await db
        .select()
        .from(tenantSubscriptions)
        .where(eq(tenantSubscriptions.tenantId, input.tenantId))
        .limit(1);

      if (existing.length > 0) {
        // Atualizar assinatura existente
        const [updated] = await db
          .update(tenantSubscriptions)
          .set({ planId: input.planId, status: "ACTIVE" })
          .where(eq(tenantSubscriptions.tenantId, input.tenantId))
          .returning();
        return updated;
      }

      // Criar nova assinatura
      const [subscription] = await db
        .insert(tenantSubscriptions)
        .values({
          tenantId: input.tenantId,
          planId: input.planId,
        })
        .returning();

      return subscription;
    }),

  // ================================
  // SUPER ADMIN - Cobranças
  // ================================

  /** Gerar cobranças do mês anterior para todos os tenants */
  generateMonthly: protectedProcedure.mutation(async () => {
    const db = getDb();

    // Mês anterior
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const dueDate = new Date(now.getFullYear(), now.getMonth(), 15);

    // Buscar todas as assinaturas ativas
    const subscriptions = await db
      .select({
        subscription: tenantSubscriptions,
        plan: billingPlans,
      })
      .from(tenantSubscriptions)
      .innerJoin(billingPlans, eq(tenantSubscriptions.planId, billingPlans.id))
      .where(eq(tenantSubscriptions.status, "ACTIVE"));

    let generated = 0;

    for (const { subscription, plan } of subscriptions) {
      // Verificar se já existe cobrança para esse período
      const existing = await db
        .select()
        .from(billingRecords)
        .where(
          and(
            eq(billingRecords.tenantId, subscription.tenantId),
            eq(billingRecords.periodStart, periodStart)
          )
        )
        .limit(1);

      if (existing.length > 0) continue;

      // Contar pedidos e receita do período
      const [stats] = await db
        .select({
          totalOrders: sql<number>`count(*)::int`,
          totalRevenue: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)::numeric`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, subscription.tenantId),
            sql`${orders.createdAt} >= ${periodStart}`,
            sql`${orders.createdAt} <= ${periodEnd}`
          )
        );

      const totalOrders = stats?.totalOrders ?? 0;
      const totalRevenue = Number(stats?.totalRevenue ?? 0);
      const freeOrders = Math.min(totalOrders, plan.freeOrdersLimit);
      const billedOrders = Math.max(0, totalOrders - plan.freeOrdersLimit);

      // Calcular valor
      const fee = Number(plan.percentageFee);
      const calculatedAmount = (totalRevenue * fee) / 100;
      const minFee = plan.minMonthlyFee ? Number(plan.minMonthlyFee) : 0;
      const finalAmount = Math.max(calculatedAmount, minFee);

      await db.insert(billingRecords).values({
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        periodStart,
        periodEnd,
        totalOrders,
        totalRevenue: String(totalRevenue),
        freeOrders,
        billedOrders,
        percentageFee: plan.percentageFee,
        calculatedAmount: String(calculatedAmount),
        finalAmount: String(finalAmount),
        dueDate,
      });

      generated++;
    }

    return { generated };
  }),

  /** Listar cobranças (com filtros) */
  listRecords: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid().optional(),
        status: z.enum(["PENDING", "PAID", "OVERDUE", "CANCELLED"]).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();

      const conditions = [];
      if (input?.tenantId) {
        conditions.push(eq(billingRecords.tenantId, input.tenantId));
      }
      if (input?.status) {
        conditions.push(eq(billingRecords.status, input.status));
      }

      const records = await db
        .select({
          record: billingRecords,
          tenantName: tenants.name,
          tenantSlug: tenants.slug,
        })
        .from(billingRecords)
        .innerJoin(tenants, eq(billingRecords.tenantId, tenants.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(billingRecords.createdAt));

      return records;
    }),

  /** Marcar cobrança como paga */
  markAsPaid: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const [updated] = await getDb()
        .update(billingRecords)
        .set({ status: "PAID", paidAt: new Date() })
        .where(eq(billingRecords.id, input.id))
        .returning();
      return updated;
    }),

  // ================================
  // TENANT - Ver minha assinatura
  // ================================

  /** Restaurante vê seu plano atual */
  getMySubscription: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();

    const result = await db
      .select({
        subscription: tenantSubscriptions,
        plan: billingPlans,
      })
      .from(tenantSubscriptions)
      .innerJoin(
        billingPlans,
        eq(tenantSubscriptions.planId, billingPlans.id)
      )
      .where(eq(tenantSubscriptions.tenantId, ctx.tenantId))
      .limit(1);

    if (result.length === 0) return null;

    // Pedidos do mês atual
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [monthStats] = await db
      .select({
        totalOrders: sql<number>`count(*)::int`,
        totalRevenue: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)::numeric`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, ctx.tenantId),
          sql`${orders.createdAt} >= ${startOfMonth}`
        )
      );

    return {
      ...result[0],
      currentMonth: {
        orders: monthStats?.totalOrders ?? 0,
        revenue: Number(monthStats?.totalRevenue ?? 0),
      },
    };
  }),

  /** Restaurante vê suas cobranças */
  getMyBilling: tenantProcedure.query(async ({ ctx }) => {
    return getDb()
      .select()
      .from(billingRecords)
      .where(eq(billingRecords.tenantId, ctx.tenantId))
      .orderBy(desc(billingRecords.periodStart));
  }),
});
