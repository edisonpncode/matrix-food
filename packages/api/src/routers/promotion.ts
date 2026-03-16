import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, tenantProcedure } from "../trpc";
import {
  getDb,
  promotions,
  promotionUsage,
  eq,
  and,
  sql,
} from "@matrix-food/database";

export const promotionRouter = createTRPCRouter({
  /**
   * Lista promoções do restaurante (admin).
   */
  list: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();

    const promoList = await db
      .select({
        id: promotions.id,
        code: promotions.code,
        description: promotions.description,
        type: promotions.type,
        value: promotions.value,
        minOrderValue: promotions.minOrderValue,
        maxDiscount: promotions.maxDiscount,
        maxUses: promotions.maxUses,
        maxUsesPerCustomer: promotions.maxUsesPerCustomer,
        startDate: promotions.startDate,
        endDate: promotions.endDate,
        isActive: promotions.isActive,
        createdAt: promotions.createdAt,
        usageCount: sql<number>`(
          SELECT COUNT(*) FROM promotion_usage
          WHERE promotion_usage.promotion_id = ${promotions.id}
        )::int`,
      })
      .from(promotions)
      .where(eq(promotions.tenantId, ctx.tenantId))
      .orderBy(promotions.createdAt);

    return promoList;
  }),

  /**
   * Cria uma promoção (admin).
   */
  create: tenantProcedure
    .input(
      z.object({
        code: z.string().min(1).max(50).transform((v) => v.toUpperCase().trim()),
        description: z.string().max(500).optional(),
        type: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_DELIVERY"]),
        value: z.string().min(1),
        minOrderValue: z.string().optional(),
        maxDiscount: z.string().optional(),
        maxUses: z.number().int().positive().optional(),
        maxUsesPerCustomer: z.number().int().positive().default(1),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Verificar código único por tenant
      const [existing] = await db
        .select({ id: promotions.id })
        .from(promotions)
        .where(
          and(
            eq(promotions.tenantId, ctx.tenantId),
            eq(promotions.code, input.code)
          )
        )
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Já existe uma promoção com o código "${input.code}"`,
        });
      }

      const [promo] = await db
        .insert(promotions)
        .values({
          tenantId: ctx.tenantId,
          code: input.code,
          description: input.description,
          type: input.type,
          value: input.value,
          minOrderValue: input.minOrderValue || null,
          maxDiscount: input.maxDiscount || null,
          maxUses: input.maxUses,
          maxUsesPerCustomer: input.maxUsesPerCustomer,
          startDate: input.startDate ? new Date(input.startDate) : new Date(),
          endDate: input.endDate ? new Date(input.endDate) : null,
        })
        .returning();

      return promo;
    }),

  /**
   * Atualiza uma promoção (admin).
   */
  update: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        code: z.string().min(1).max(50).transform((v) => v.toUpperCase().trim()).optional(),
        description: z.string().max(500).optional(),
        type: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_DELIVERY"]).optional(),
        value: z.string().optional(),
        minOrderValue: z.string().nullable().optional(),
        maxDiscount: z.string().nullable().optional(),
        maxUses: z.number().int().positive().nullable().optional(),
        maxUsesPerCustomer: z.number().int().positive().optional(),
        startDate: z.string().optional(),
        endDate: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, startDate, endDate, ...rest } = input;

      // Se mudou o código, verificar unicidade
      if (rest.code) {
        const [existing] = await db
          .select({ id: promotions.id })
          .from(promotions)
          .where(
            and(
              eq(promotions.tenantId, ctx.tenantId),
              eq(promotions.code, rest.code)
            )
          )
          .limit(1);

        if (existing && existing.id !== id) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Já existe uma promoção com o código "${rest.code}"`,
          });
        }
      }

      const updateData: Record<string, unknown> = { ...rest };
      if (startDate !== undefined) {
        updateData.startDate = new Date(startDate);
      }
      if (endDate !== undefined) {
        updateData.endDate = endDate ? new Date(endDate) : null;
      }

      const [updated] = await db
        .update(promotions)
        .set(updateData)
        .where(
          and(eq(promotions.id, id), eq(promotions.tenantId, ctx.tenantId))
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Promoção não encontrada",
        });
      }

      return updated;
    }),

  /**
   * Exclui uma promoção (admin).
   */
  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await getDb()
        .delete(promotions)
        .where(
          and(
            eq(promotions.id, input.id),
            eq(promotions.tenantId, ctx.tenantId)
          )
        )
        .returning();

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Promoção não encontrada",
        });
      }

      return { success: true };
    }),

  /**
   * Valida um código de promoção (público - usado no checkout do cliente).
   * Retorna detalhes do desconto se válido.
   */
  validate: publicProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        code: z.string().min(1).transform((v) => v.toUpperCase().trim()),
        subtotal: z.number().positive(),
        deliveryFee: z.number().min(0).default(0),
        customerPhone: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();

      // Buscar promoção
      const [promo] = await db
        .select()
        .from(promotions)
        .where(
          and(
            eq(promotions.tenantId, input.tenantId),
            eq(promotions.code, input.code),
            eq(promotions.isActive, true)
          )
        )
        .limit(1);

      if (!promo) {
        return { valid: false, error: "Código de promoção inválido" };
      }

      // Verificar datas
      const now = new Date();
      if (promo.startDate && now < promo.startDate) {
        return { valid: false, error: "Esta promoção ainda não começou" };
      }
      if (promo.endDate && now > promo.endDate) {
        return { valid: false, error: "Esta promoção já expirou" };
      }

      // Verificar valor mínimo do pedido
      if (promo.minOrderValue && input.subtotal < parseFloat(promo.minOrderValue)) {
        return {
          valid: false,
          error: `Pedido mínimo de R$ ${parseFloat(promo.minOrderValue).toFixed(2)} para esta promoção`,
        };
      }

      // Verificar limite total de usos
      if (promo.maxUses) {
        const [usageCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(promotionUsage)
          .where(eq(promotionUsage.promotionId, promo.id));

        if ((usageCount?.count ?? 0) >= promo.maxUses) {
          return { valid: false, error: "Esta promoção esgotou o limite de usos" };
        }
      }

      // Verificar limite de usos por cliente
      if (input.customerPhone && promo.maxUsesPerCustomer) {
        const [customerUsage] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(promotionUsage)
          .where(
            and(
              eq(promotionUsage.promotionId, promo.id),
              eq(promotionUsage.customerPhone, input.customerPhone)
            )
          );

        if ((customerUsage?.count ?? 0) >= promo.maxUsesPerCustomer) {
          return {
            valid: false,
            error: "Você já usou esta promoção o número máximo de vezes",
          };
        }
      }

      // Calcular desconto
      let discountAmount = 0;

      switch (promo.type) {
        case "PERCENTAGE": {
          discountAmount = input.subtotal * (parseFloat(promo.value) / 100);
          // Aplicar teto de desconto se existir
          if (promo.maxDiscount) {
            discountAmount = Math.min(
              discountAmount,
              parseFloat(promo.maxDiscount)
            );
          }
          break;
        }
        case "FIXED_AMOUNT": {
          discountAmount = Math.min(parseFloat(promo.value), input.subtotal);
          break;
        }
        case "FREE_DELIVERY": {
          discountAmount = input.deliveryFee;
          break;
        }
      }

      discountAmount = Math.round(discountAmount * 100) / 100;

      return {
        valid: true,
        promotionId: promo.id,
        code: promo.code,
        type: promo.type,
        description: promo.description,
        discountAmount,
      };
    }),

  /**
   * Lista promoções ativas do tenant (público - para banners no cardápio).
   */
  listPublic: publicProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = getDb();
      const now = new Date();

      const promoList = await db
        .select({
          code: promotions.code,
          description: promotions.description,
          type: promotions.type,
          value: promotions.value,
          minOrderValue: promotions.minOrderValue,
        })
        .from(promotions)
        .where(
          and(
            eq(promotions.tenantId, input.tenantId),
            eq(promotions.isActive, true),
            sql`${promotions.startDate} <= ${now}`,
            sql`(${promotions.endDate} IS NULL OR ${promotions.endDate} >= ${now})`
          )
        );

      return promoList;
    }),
});
