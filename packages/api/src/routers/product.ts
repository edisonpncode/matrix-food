import { z } from "zod";
import { createTRPCRouter, publicProcedure, tenantProcedure } from "../trpc";
import {
  getDb,
  products,
  productVariants,
  customizationGroups,
  customizationOptions,
  eq,
  and,
  asc,
} from "@matrix-food/database";

// --- Schemas de validação reutilizáveis ---

const variantInput = z.object({
  name: z.string().min(1).max(100),
  price: z.string(), // decimal como string
  originalPrice: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

const customizationOptionInput = z.object({
  name: z.string().min(1).max(255),
  price: z.string().default("0"),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

const customizationGroupInput = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  minSelections: z.number().int().min(0).default(0),
  maxSelections: z.number().int().min(1).default(1),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
  options: z.array(customizationOptionInput).default([]),
});

export const productRouter = createTRPCRouter({
  /**
   * Lista produtos de uma categoria (público, para clientes).
   */
  listByCategory: publicProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        categoryId: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const items = await db
        .select()
        .from(products)
        .where(
          and(
            eq(products.tenantId, input.tenantId),
            eq(products.categoryId, input.categoryId),
            eq(products.isActive, true)
          )
        )
        .orderBy(asc(products.sortOrder));

      // Buscar variantes para produtos que têm variantes
      const withVariants = await Promise.all(
        items.map(async (product) => {
          if (!product.hasVariants) return { ...product, variants: [] };
          const variants = await db
            .select()
            .from(productVariants)
            .where(
              and(
                eq(productVariants.productId, product.id),
                eq(productVariants.isActive, true)
              )
            )
            .orderBy(asc(productVariants.sortOrder));
          return { ...product, variants };
        })
      );

      return withVariants;
    }),

  /**
   * Lista TODOS os produtos de um tenant (admin).
   */
  listAll: tenantProcedure
    .input(
      z.object({
        categoryId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const conditions = [eq(products.tenantId, ctx.tenantId)];
      if (input.categoryId) {
        conditions.push(eq(products.categoryId, input.categoryId));
      }
      return db
        .select()
        .from(products)
        .where(and(...conditions))
        .orderBy(asc(products.sortOrder));
    }),

  /**
   * Busca produto completo por ID (com variantes e personalizações).
   */
  getById: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const [product] = await db
        .select()
        .from(products)
        .where(
          and(eq(products.id, input.id), eq(products.tenantId, ctx.tenantId))
        )
        .limit(1);

      if (!product) return null;

      // Buscar variantes
      const variants = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, product.id))
        .orderBy(asc(productVariants.sortOrder));

      // Buscar grupos de personalização com opções
      const groups = await db
        .select()
        .from(customizationGroups)
        .where(eq(customizationGroups.productId, product.id))
        .orderBy(asc(customizationGroups.sortOrder));

      const groupsWithOptions = await Promise.all(
        groups.map(async (group) => {
          const options = await db
            .select()
            .from(customizationOptions)
            .where(eq(customizationOptions.groupId, group.id))
            .orderBy(asc(customizationOptions.sortOrder));
          return { ...group, options };
        })
      );

      return {
        ...product,
        variants,
        customizationGroups: groupsWithOptions,
      };
    }),

  /**
   * Busca produto completo por ID (público, para clientes).
   */
  getPublic: publicProcedure
    .input(
      z.object({ id: z.string().uuid(), tenantId: z.string().uuid() })
    )
    .query(async ({ input }) => {
      const db = getDb();

      const [product] = await db
        .select()
        .from(products)
        .where(
          and(
            eq(products.id, input.id),
            eq(products.tenantId, input.tenantId),
            eq(products.isActive, true)
          )
        )
        .limit(1);

      if (!product) return null;

      const variants = product.hasVariants
        ? await db
            .select()
            .from(productVariants)
            .where(
              and(
                eq(productVariants.productId, product.id),
                eq(productVariants.isActive, true)
              )
            )
            .orderBy(asc(productVariants.sortOrder))
        : [];

      const groups = await db
        .select()
        .from(customizationGroups)
        .where(eq(customizationGroups.productId, product.id))
        .orderBy(asc(customizationGroups.sortOrder));

      const groupsWithOptions = await Promise.all(
        groups.map(async (group) => {
          const options = await db
            .select()
            .from(customizationOptions)
            .where(
              and(
                eq(customizationOptions.groupId, group.id),
                eq(customizationOptions.isActive, true)
              )
            )
            .orderBy(asc(customizationOptions.sortOrder));
          return { ...group, options };
        })
      );

      return {
        ...product,
        variants,
        customizationGroups: groupsWithOptions,
      };
    }),

  /**
   * Cria um produto completo (com variantes e personalizações).
   */
  create: tenantProcedure
    .input(
      z.object({
        categoryId: z.string().uuid(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        price: z.string().default("0"),
        originalPrice: z.string().nullable().optional(),
        imageUrl: z.string().url().optional(),
        isNew: z.boolean().default(false),
        hasVariants: z.boolean().default(false),
        sortOrder: z.number().int().min(0).default(0),
        isActive: z.boolean().default(true),
        variants: z.array(variantInput).default([]),
        customizationGroups: z.array(customizationGroupInput).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { variants, customizationGroups: groups, ...productData } = input;

      // Criar produto
      const [product] = await db
        .insert(products)
        .values({
          ...productData,
          tenantId: ctx.tenantId,
        })
        .returning();

      if (!product) throw new Error("Falha ao criar produto");

      // Criar variantes
      if (variants.length > 0) {
        await db.insert(productVariants).values(
          variants.map((v) => ({
            ...v,
            productId: product.id,
          }))
        );
      }

      // Criar grupos de personalização com opções
      for (const group of groups) {
        const { options, ...groupData } = group;
        const [createdGroup] = await db
          .insert(customizationGroups)
          .values({
            ...groupData,
            productId: product.id,
          })
          .returning();

        if (!createdGroup) continue;

        if (options.length > 0) {
          await db.insert(customizationOptions).values(
            options.map((opt) => ({
              ...opt,
              groupId: createdGroup.id,
            }))
          );
        }
      }

      return product;
    }),

  /**
   * Atualiza um produto (dados básicos).
   */
  update: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        categoryId: z.string().uuid().optional(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().nullable().optional(),
        price: z.string().optional(),
        originalPrice: z.string().nullable().optional(),
        imageUrl: z.string().url().nullable().optional(),
        isNew: z.boolean().optional(),
        hasVariants: z.boolean().optional(),
        sortOrder: z.number().int().min(0).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [updated] = await getDb()
        .update(products)
        .set(data)
        .where(
          and(eq(products.id, id), eq(products.tenantId, ctx.tenantId))
        )
        .returning();

      return updated;
    }),

  /**
   * Deleta um produto e tudo associado (variantes, personalizações).
   */
  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await getDb()
        .delete(products)
        .where(
          and(eq(products.id, input.id), eq(products.tenantId, ctx.tenantId))
        )
        .returning();

      return deleted;
    }),

  /**
   * Sincroniza variantes de um produto (delete all + insert).
   */
  syncVariants: tenantProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        variants: z.array(variantInput),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Verificar que o produto pertence ao tenant
      const [product] = await db
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            eq(products.id, input.productId),
            eq(products.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!product) return null;

      // Deletar variantes existentes e inserir novas
      await db
        .delete(productVariants)
        .where(eq(productVariants.productId, input.productId));

      if (input.variants.length > 0) {
        await db.insert(productVariants).values(
          input.variants.map((v) => ({
            ...v,
            productId: input.productId,
          }))
        );
      }

      return { success: true };
    }),

  /**
   * Sincroniza grupos de personalização (delete all + insert).
   */
  syncCustomizations: tenantProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        groups: z.array(customizationGroupInput),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Verificar que o produto pertence ao tenant
      const [product] = await db
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            eq(products.id, input.productId),
            eq(products.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!product) return null;

      // Deletar grupos existentes (cascade deleta opções)
      await db
        .delete(customizationGroups)
        .where(eq(customizationGroups.productId, input.productId));

      // Inserir novos grupos com opções
      for (const group of input.groups) {
        const { options, ...groupData } = group;
        const [createdGroup] = await db
          .insert(customizationGroups)
          .values({
            ...groupData,
            productId: input.productId,
          })
          .returning();

        if (!createdGroup) continue;

        if (options.length > 0) {
          await db.insert(customizationOptions).values(
            options.map((opt) => ({
              ...opt,
              groupId: createdGroup.id,
            }))
          );
        }
      }

      return { success: true };
    }),
});
