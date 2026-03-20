import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, tenantProcedure } from "../trpc";
import {
  getDb,
  loyaltyConfig,
  loyaltyRewards,
  loyaltyTransactions,
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
  // REWARDS (Admin CRUD)
  // ============================================

  /** Listar recompensas do restaurante */
  listRewards: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select()
      .from(loyaltyRewards)
      .where(eq(loyaltyRewards.tenantId, ctx.tenantId))
      .orderBy(loyaltyRewards.sortOrder);
  }),

  /** Criar recompensa */
  createReward: tenantProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().max(500).optional(),
        pointsCost: z.number().int().min(1),
        discountValue: z.string(),
        maxRedemptions: z.number().int().min(1).nullable().optional(),
        sortOrder: z.number().int().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [reward] = await getDb()
        .insert(loyaltyRewards)
        .values({
          tenantId: ctx.tenantId,
          name: input.name,
          description: input.description,
          pointsCost: input.pointsCost,
          discountValue: input.discountValue,
          maxRedemptions: input.maxRedemptions ?? null,
          sortOrder: input.sortOrder,
        })
        .returning();
      return reward;
    }),

  /** Atualizar recompensa */
  updateReward: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255),
        description: z.string().max(500).optional(),
        pointsCost: z.number().int().min(1),
        discountValue: z.string(),
        maxRedemptions: z.number().int().min(1).nullable().optional(),
        sortOrder: z.number().int().default(0),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await getDb()
        .update(loyaltyRewards)
        .set({
          name: input.name,
          description: input.description,
          pointsCost: input.pointsCost,
          discountValue: input.discountValue,
          maxRedemptions: input.maxRedemptions ?? null,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
        })
        .where(
          and(
            eq(loyaltyRewards.id, input.id),
            eq(loyaltyRewards.tenantId, ctx.tenantId)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recompensa não encontrada",
        });
      }
      return updated;
    }),

  /** Excluir recompensa */
  deleteReward: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await getDb()
        .delete(loyaltyRewards)
        .where(
          and(
            eq(loyaltyRewards.id, input.id),
            eq(loyaltyRewards.tenantId, ctx.tenantId)
          )
        )
        .returning();

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recompensa não encontrada",
        });
      }
      return { success: true };
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

  /** Listar recompensas ativas do tenant (para o cliente ver) */
  listPublicRewards: publicProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
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

      if (!config) return [];

      return db
        .select({
          id: loyaltyRewards.id,
          name: loyaltyRewards.name,
          description: loyaltyRewards.description,
          pointsCost: loyaltyRewards.pointsCost,
          discountValue: loyaltyRewards.discountValue,
        })
        .from(loyaltyRewards)
        .where(
          and(
            eq(loyaltyRewards.tenantId, input.tenantId),
            eq(loyaltyRewards.isActive, true)
          )
        )
        .orderBy(loyaltyRewards.sortOrder);
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

      // Somar todos os pontos do cliente
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
        balance: result?.totalPoints ?? 0,
        pointsName: config.pointsName,
        history,
      };
    }),

  /** Resgatar recompensa (retorna desconto a ser aplicado no pedido) */
  redeemReward: publicProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        customerPhone: z.string().min(1),
        rewardId: z.string().uuid(),
      })
    )
    .mutation(async ({ input }) => {
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

      if (!config) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Sistema de fidelidade não está ativo",
        });
      }

      // Buscar recompensa
      const [reward] = await db
        .select()
        .from(loyaltyRewards)
        .where(
          and(
            eq(loyaltyRewards.id, input.rewardId),
            eq(loyaltyRewards.tenantId, input.tenantId),
            eq(loyaltyRewards.isActive, true)
          )
        )
        .limit(1);

      if (!reward) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recompensa não encontrada",
        });
      }

      // Verificar limite de resgates
      if (
        reward.maxRedemptions &&
        reward.totalRedemptions >= reward.maxRedemptions
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Recompensa esgotada",
        });
      }

      // Verificar saldo
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

      const balance = result?.totalPoints ?? 0;

      if (balance < reward.pointsCost) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Saldo insuficiente. Você tem ${balance} ${config.pointsName}, mas precisa de ${reward.pointsCost}`,
        });
      }

      // Registrar resgate (pontos negativos)
      await db.insert(loyaltyTransactions).values({
        tenantId: input.tenantId,
        customerPhone: input.customerPhone,
        type: "REDEEMED",
        points: -reward.pointsCost,
        description: `Resgate: ${reward.name}`,
        rewardId: reward.id,
      });

      // Incrementar contador de resgates
      await db
        .update(loyaltyRewards)
        .set({
          totalRedemptions: sql`${loyaltyRewards.totalRedemptions} + 1`,
        })
        .where(eq(loyaltyRewards.id, reward.id));

      return {
        discountValue: reward.discountValue,
        rewardName: reward.name,
        newBalance: balance - reward.pointsCost,
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
