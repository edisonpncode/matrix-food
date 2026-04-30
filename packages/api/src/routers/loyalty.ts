import { z } from "zod";
import { createTRPCRouter, publicProcedure, tenantProcedure } from "../trpc";
import {
  getDb,
  loyaltyConfig,
  loyaltyTransactions,
  customers,
  customerTenants,
  eq,
  and,
  desc,
  sql,
} from "@matrix-food/database";

export const loyaltyRouter = createTRPCRouter({
  // ============================================
  // CONFIG (Admin)
  // ============================================

  /** Buscar configuração de fidelidade do restaurante */
  getConfig: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const [config] = await db
      .select()
      .from(loyaltyConfig)
      .where(eq(loyaltyConfig.tenantId, ctx.tenantId))
      .limit(1);

    return config ?? null;
  }),

  /** Criar ou atualizar configuração de fidelidade */
  upsertConfig: tenantProcedure
    .input(
      z.object({
        isActive: z.boolean(),
        spendingBase: z.string().default("1"),
        pointsPerReal: z.string().default("1"),
        pointsName: z.string().min(1).max(50).default("Pontos"),
        minOrderForPoints: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Verificar se já existe
      const [existing] = await db
        .select()
        .from(loyaltyConfig)
        .where(eq(loyaltyConfig.tenantId, ctx.tenantId))
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(loyaltyConfig)
          .set({
            isActive: input.isActive,
            spendingBase: input.spendingBase,
            pointsPerReal: input.pointsPerReal,
            pointsName: input.pointsName,
            minOrderForPoints: input.minOrderForPoints ?? null,
          })
          .where(eq(loyaltyConfig.id, existing.id))
          .returning();
        return updated;
      }

      const [created] = await db
        .insert(loyaltyConfig)
        .values({
          tenantId: ctx.tenantId,
          isActive: input.isActive,
          spendingBase: input.spendingBase,
          pointsPerReal: input.pointsPerReal,
          pointsName: input.pointsName,
          minOrderForPoints: input.minOrderForPoints ?? null,
        })
        .returning();
      return created;
    }),

  // ============================================
  // CUSTOMER-FACING (Público)
  // ============================================

  /** Buscar configuração pública de fidelidade do tenant */
  getPublicConfig: publicProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [config] = await db
        .select()
        .from(loyaltyConfig)
        .where(
          and(
            eq(loyaltyConfig.tenantId, input.tenantId),
            eq(loyaltyConfig.isActive, true)
          )
        )
        .limit(1);

      if (!config) return null;
      return {
        spendingBase: config.spendingBase,
        pointsPerReal: config.pointsPerReal,
        pointsName: config.pointsName,
        minOrderForPoints: config.minOrderForPoints,
      };
    }),

  /** Consultar saldo de pontos do cliente (por telefone) */
  getBalance: publicProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        customerPhone: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();

      // Verificar se fidelidade está ativa
      const [config] = await db
        .select()
        .from(loyaltyConfig)
        .where(
          and(
            eq(loyaltyConfig.tenantId, input.tenantId),
            eq(loyaltyConfig.isActive, true)
          )
        )
        .limit(1);

      if (!config) return null;

      // Tentar saldo materializado (cliente registrado em customer_tenants)
      const [materialized] = await db
        .select({ balance: customerTenants.loyaltyPointsBalance })
        .from(customerTenants)
        .innerJoin(customers, eq(customers.id, customerTenants.customerId))
        .where(
          and(
            eq(customers.phone, input.customerPhone),
            eq(customerTenants.tenantId, input.tenantId)
          )
        )
        .limit(1);

      let balance: number;
      if (materialized) {
        balance = materialized.balance;
      } else {
        // Fallback para clientes legados (transações sem customer registrado)
        const [result] = await db
          .select({
            totalPoints: sql<number>`COALESCE(SUM(${loyaltyTransactions.points}), 0)::int`,
          })
          .from(loyaltyTransactions)
          .where(
            and(
              eq(loyaltyTransactions.tenantId, input.tenantId),
              eq(loyaltyTransactions.customerPhone, input.customerPhone)
            )
          );
        balance = result?.totalPoints ?? 0;
      }

      // Buscar últimas transações
      const history = await db
        .select()
        .from(loyaltyTransactions)
        .where(
          and(
            eq(loyaltyTransactions.tenantId, input.tenantId),
            eq(loyaltyTransactions.customerPhone, input.customerPhone)
          )
        )
        .orderBy(desc(loyaltyTransactions.createdAt))
        .limit(20);

      return {
        balance,
        pointsName: config.pointsName,
        history,
      };
    }),

  // ============================================
  // ADMIN: Ver clientes com pontos
  // ============================================

  /** Listar clientes com saldo de pontos (admin) */
  listCustomerBalances: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();

    const balances = await db
      .select({
        customerPhone: loyaltyTransactions.customerPhone,
        totalPoints: sql<number>`SUM(${loyaltyTransactions.points})::int`,
        transactionCount: sql<number>`count(*)::int`,
      })
      .from(loyaltyTransactions)
      .where(eq(loyaltyTransactions.tenantId, ctx.tenantId))
      .groupBy(loyaltyTransactions.customerPhone)
      .orderBy(desc(sql`SUM(${loyaltyTransactions.points})`));

    return balances;
  }),
});
