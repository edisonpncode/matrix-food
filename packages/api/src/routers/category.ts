import { z } from "zod";
import { createTRPCRouter, publicProcedure, tenantProcedure } from "../trpc";
import { getDb, categories, categorySizes, eq, and, asc } from "@matrix-food/database";

export const categoryRouter = createTRPCRouter({
  /**
   * Lista todas as categorias de um restaurante (público).
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
   * Lista categorias com seus tamanhos - para admin e POS.
   */
  listAllWithSizes: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const cats = await db
      .select()
      .from(categories)
      .where(eq(categories.tenantId, ctx.tenantId))
      .orderBy(asc(categories.sortOrder));

    const allSizes = await db
      .select()
      .from(categorySizes)
      .orderBy(asc(categorySizes.sortOrder));

    return cats.map((cat) => ({
      ...cat,
      sizes: allSizes.filter((s) => s.categoryId === cat.id),
    }));
  }),

  /**
   * Busca uma categoria por ID.
   */
  getById: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [category] = await db
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.id, input.id),
            eq(categories.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!category) return null;

      const sizes = await db
        .select()
        .from(categorySizes)
        .where(eq(categorySizes.categoryId, category.id))
        .orderBy(asc(categorySizes.sortOrder));

      return { ...category, sizes };
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
        hasSizes: z.boolean().default(false),
        schedule: z
          .object({
            enabled: z.boolean(),
            days: z.array(z.number().int().min(0).max(6)),
            startTime: z.string(),
            endTime: z.string(),
          })
          .optional(),
        sizes: z
          .array(
            z.object({
              name: z.string().min(1).max(100),
              maxFlavors: z.number().int().min(1).default(1),
              sortOrder: z.number().int().min(0).default(0),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { sizes, ...catData } = input;
      const db = getDb();

      const [created] = await db
        .insert(categories)
        .values({
          ...catData,
          tenantId: ctx.tenantId,
        })
        .returning();

      // Criar tamanhos se fornecidos
      if (sizes && sizes.length > 0 && created) {
        await db.insert(categorySizes).values(
          sizes.map((s) => ({
            categoryId: created.id,
            name: s.name,
            maxFlavors: s.maxFlavors,
            sortOrder: s.sortOrder,
          }))
        );
      }

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
        hasSizes: z.boolean().optional(),
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

  // ======== CATEGORY SIZES (Tamanhos) ========

  /**
   * Sincroniza tamanhos de uma categoria (delete all + insert).
   */
  syncSizes: tenantProcedure
    .input(
      z.object({
        categoryId: z.string().uuid(),
        sizes: z.array(
          z.object({
            name: z.string().min(1).max(100),
            maxFlavors: z.number().int().min(1).default(1),
            sortOrder: z.number().int().min(0).default(0),
            isActive: z.boolean().default(true),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Deletar tamanhos existentes
      await db
        .delete(categorySizes)
        .where(eq(categorySizes.categoryId, input.categoryId));

      // Inserir novos
      if (input.sizes.length > 0) {
        await db.insert(categorySizes).values(
          input.sizes.map((s) => ({
            categoryId: input.categoryId,
            name: s.name,
            maxFlavors: s.maxFlavors,
            sortOrder: s.sortOrder,
            isActive: s.isActive,
          }))
        );
      }

      return { success: true };
    }),
});
