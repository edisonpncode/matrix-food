import { z } from "zod";
import { createTRPCRouter, publicProcedure, tenantProcedure } from "../trpc";
import { getDb, categories, eq, and, asc } from "@matrix-food/database";

export const categoryRouter = createTRPCRouter({
  /**
   * Lista todas as categorias de um restaurante.
   * Público - clientes podem ver o cardápio.
   */
  list: publicProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ input }) => {
      return getDb()
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.tenantId, input.tenantId),
            eq(categories.isActive, true)
          )
        )
        .orderBy(asc(categories.sortOrder));
    }),

  /**
   * Lista TODAS as categorias (incluindo inativas) - para o admin.
   */
  listAll: tenantProcedure.query(async ({ ctx }) => {
    return getDb()
      .select()
      .from(categories)
      .where(eq(categories.tenantId, ctx.tenantId))
      .orderBy(asc(categories.sortOrder));
  }),

  /**
   * Busca uma categoria por ID.
   */
  getById: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [category] = await getDb()
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.id, input.id),
            eq(categories.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      return category ?? null;
    }),

  /**
   * Cria uma nova categoria.
   */
  create: tenantProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        imageUrl: z.string().url().optional(),
        sortOrder: z.number().int().min(0).default(0),
        isActive: z.boolean().default(true),
        schedule: z
          .object({
            enabled: z.boolean(),
            days: z.array(z.number().int().min(0).max(6)),
            startTime: z.string(),
            endTime: z.string(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await getDb()
        .insert(categories)
        .values({
          ...input,
          tenantId: ctx.tenantId,
        })
        .returning();

      return created;
    }),

  /**
   * Atualiza uma categoria.
   */
  update: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().nullable().optional(),
        imageUrl: z.string().url().nullable().optional(),
        sortOrder: z.number().int().min(0).optional(),
        isActive: z.boolean().optional(),
        schedule: z
          .object({
            enabled: z.boolean(),
            days: z.array(z.number().int().min(0).max(6)),
            startTime: z.string(),
            endTime: z.string(),
          })
          .nullable()
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [updated] = await getDb()
        .update(categories)
        .set(data)
        .where(
          and(eq(categories.id, id), eq(categories.tenantId, ctx.tenantId))
        )
        .returning();

      return updated;
    }),

  /**
   * Deleta uma categoria.
   */
  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await getDb()
        .delete(categories)
        .where(
          and(
            eq(categories.id, input.id),
            eq(categories.tenantId, ctx.tenantId)
          )
        )
        .returning();

      return deleted;
    }),

  /**
   * Reordena categorias (drag & drop).
   */
  reorder: tenantProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            id: z.string().uuid(),
            sortOrder: z.number().int().min(0),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      for (const item of input.items) {
        await db
          .update(categories)
          .set({ sortOrder: item.sortOrder })
          .where(
            and(
              eq(categories.id, item.id),
              eq(categories.tenantId, ctx.tenantId)
            )
          );
      }
      return { success: true };
    }),
});
