import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../trpc";
import {
  getDb,
  ingredients,
  productIngredients,
  eq,
  and,
  asc,
  count,
} from "@matrix-food/database";

export const ingredientRouter = createTRPCRouter({
  /**
   * Lista todos os ingredientes do tenant.
   */
  list: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const allIngredients = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.tenantId, ctx.tenantId))
      .orderBy(asc(ingredients.name));

    // Conta quantos produtos usam cada ingrediente
    const usage = await db
      .select({
        ingredientId: productIngredients.ingredientId,
        count: count(),
      })
      .from(productIngredients)
      .groupBy(productIngredients.ingredientId);

    const usageMap = new Map(usage.map((u) => [u.ingredientId, u.count]));

    return allIngredients.map((ing) => ({
      ...ing,
      productCount: usageMap.get(ing.id) ?? 0,
    }));
  }),

  /**
   * Cria um novo ingrediente.
   */
  create: tenantProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        type: z.enum(["QUANTITY", "DESCRIPTION"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [created] = await db
        .insert(ingredients)
        .values({
          tenantId: ctx.tenantId,
          name: input.name,
          type: input.type,
        })
        .returning();
      return created;
    }),

  /**
   * Atualiza um ingrediente.
   */
  update: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255),
        type: z.enum(["QUANTITY", "DESCRIPTION"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [updated] = await db
        .update(ingredients)
        .set({
          name: input.name,
          type: input.type,
        })
        .where(
          and(
            eq(ingredients.id, input.id),
            eq(ingredients.tenantId, ctx.tenantId)
          )
        )
        .returning();
      return updated;
    }),

  /**
   * Deleta (soft-delete) um ingrediente.
   */
  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [updated] = await db
        .update(ingredients)
        .set({ isActive: false })
        .where(
          and(
            eq(ingredients.id, input.id),
            eq(ingredients.tenantId, ctx.tenantId)
          )
        )
        .returning();
      return updated;
    }),
});
