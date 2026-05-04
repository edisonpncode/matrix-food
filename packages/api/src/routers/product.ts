import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, tenantProcedure } from "../trpc";
import {
  getDb,
  products,
  productVariants,
  productSizePrices,
  categorySizes,
  categories,
  customizationGroups,
  customizationOptions,
  productIngredients,
  ingredients,
  eq,
  and,
  asc,
  inArray,
  sql,
} from "@matrix-food/database";
import {
  computeProductCost,
  computeMargin,
  type IngredientUnit,
} from "@matrix-food/utils";

// --- Schemas de validação reutilizáveis ---

const variantInput = z
  .object({
    name: z.string().min(1).max(100),
    price: z.string(), // decimal como string
    originalPrice: z.string().nullable().optional(),
    pointsPrice: z.number().int().positive().nullable().optional(),
    sortOrder: z.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
  })
  .refine(
    (v) => Number(v.price) > 0 || (v.pointsPrice ?? 0) > 0,
    "Variante precisa ter preço em R$ ou valor em pontos"
  );

const sizePriceInput = z
  .object({
    sizeId: z.string().uuid(),
    price: z.string(),
    pointsPrice: z.number().int().positive().nullable().optional(),
  })
  .refine(
    (v) => Number(v.price) > 0 || (v.pointsPrice ?? 0) > 0,
    "Tamanho precisa ter preço em R$ ou valor em pontos"
  );

const customizationOptionInput = z.object({
  name: z.string().min(1).max(255),
  price: z.string().default("0"),
  unitCost: z.string().default("0"),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

const productIngredientInput = z.object({
  ingredientId: z.string().uuid(),
  defaultQuantity: z.number().int().min(0).default(1),
  /** Para QUANTITY: limite máximo por item (null = sem limite). Ignorado para DESCRIPTION. */
  maxQuantity: z.number().int().min(0).nullable().optional(),
  defaultState: z.enum(["COM", "SEM"]).default("COM"),
  additionalPrice: z.string().default("0"),
  weightGrams: z.string().nullable().optional(),
  /** Quantidade consumida do ingrediente para 1 produto (na unidade do ingrediente) */
  quantity: z.string().default("0"),
  /** Unidade snapshot. Null = legado, sistema usa weightGrams como gramas */
  unit: z.enum(["g", "ml", "un"]).nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
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
   * Lista TODOS os produtos ativos agrupados por categoria (público, para scrollspy).
   * Retorna categorias com seus produtos e variantes em 1 query batch.
   */
  listAllPublic: publicProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = getDb();

      // Buscar categorias ativas
      const cats = await db
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.tenantId, input.tenantId),
            eq(categories.isActivePublic, true)
          )
        )
        .orderBy(asc(categories.sortOrder));

      // Buscar todos os produtos ativos do tenant
      const allProducts = await db
        .select()
        .from(products)
        .where(
          and(
            eq(products.tenantId, input.tenantId),
            eq(products.isActivePublic, true)
          )
        )
        .orderBy(asc(products.sortOrder));

      // Buscar variantes para produtos que têm variantes
      const productIds = allProducts
        .filter((p) => p.hasVariants)
        .map((p) => p.id);

      let allVariants: (typeof productVariants.$inferSelect)[] = [];
      if (productIds.length > 0) {
        allVariants = await db
          .select()
          .from(productVariants)
          .where(
            and(
              inArray(productVariants.productId, productIds),
              eq(productVariants.isActive, true)
            )
          )
          .orderBy(asc(productVariants.sortOrder));
      }

      // Montar mapa de variantes por productId
      const variantsByProduct = new Map<
        string,
        (typeof productVariants.$inferSelect)[]
      >();
      for (const v of allVariants) {
        const list = variantsByProduct.get(v.productId) ?? [];
        list.push(v);
        variantsByProduct.set(v.productId, list);
      }

      // Buscar ingredientes de todos os produtos
      const allProductIds = allProducts.map((p) => p.id);
      let allProdIngredients: Array<
        typeof productIngredients.$inferSelect & {
          ingredientName: string;
          ingredientType: "QUANTITY" | "DESCRIPTION";
        }
      > = [];
      if (allProductIds.length > 0) {
        const raw = await db
          .select({
            id: productIngredients.id,
            productId: productIngredients.productId,
            ingredientId: productIngredients.ingredientId,
            defaultQuantity: productIngredients.defaultQuantity,
            maxQuantity: productIngredients.maxQuantity,
            defaultState: productIngredients.defaultState,
            additionalPrice: productIngredients.additionalPrice,
            weightGrams: productIngredients.weightGrams,
            quantity: productIngredients.quantity,
            unit: productIngredients.unit,
            sortOrder: productIngredients.sortOrder,
            ingredientName: ingredients.name,
            ingredientType: ingredients.type,
          })
          .from(productIngredients)
          .innerJoin(
            ingredients,
            eq(productIngredients.ingredientId, ingredients.id)
          )
          .where(
            and(
              inArray(productIngredients.productId, allProductIds),
              eq(ingredients.isActive, true)
            )
          )
          .orderBy(asc(productIngredients.sortOrder));
        allProdIngredients = raw;
      }

      const ingredientsByProduct = new Map<string, typeof allProdIngredients>();
      for (const pi of allProdIngredients) {
        const list = ingredientsByProduct.get(pi.productId) ?? [];
        list.push(pi);
        ingredientsByProduct.set(pi.productId, list);
      }

      // Agrupar produtos por categoria
      return cats.map((cat) => ({
        ...cat,
        products: allProducts
          .filter((p) => p.categoryId === cat.id)
          .map((p) => ({
            ...p,
            variants: variantsByProduct.get(p.id) ?? [],
            ingredients: ingredientsByProduct.get(p.id) ?? [],
          })),
      }));
    }),

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
            eq(products.isActivePublic, true)
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
   * Lista produtos com variantes e customizações (para POS/employee).
   */
  listForPOS: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();
    // Filtra produtos só-pontos (price = 0). POS só vende em R$.
    const items = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.tenantId, ctx.tenantId),
          eq(products.isActivePOS, true),
          sql`${products.price}::numeric > 0`
        )
      )
      .orderBy(asc(products.sortOrder));

    const withDetails = await Promise.all(
      items.map(async (product) => {
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

        const customizationGroupsList = await Promise.all(
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

        // Buscar preços por tamanho
        const sizePricesRaw = await db
          .select({
            id: productSizePrices.id,
            sizeId: productSizePrices.sizeId,
            price: productSizePrices.price,
            pointsPrice: productSizePrices.pointsPrice,
            sizeName: categorySizes.name,
            maxFlavors: categorySizes.maxFlavors,
          })
          .from(productSizePrices)
          .innerJoin(categorySizes, eq(productSizePrices.sizeId, categorySizes.id))
          .where(eq(productSizePrices.productId, product.id))
          .orderBy(asc(categorySizes.sortOrder));

        // Buscar ingredientes
        const prodIngredients = await db
          .select({
            id: productIngredients.id,
            productId: productIngredients.productId,
            ingredientId: productIngredients.ingredientId,
            defaultQuantity: productIngredients.defaultQuantity,
            maxQuantity: productIngredients.maxQuantity,
            defaultState: productIngredients.defaultState,
            additionalPrice: productIngredients.additionalPrice,
            weightGrams: productIngredients.weightGrams,
            quantity: productIngredients.quantity,
            unit: productIngredients.unit,
            sortOrder: productIngredients.sortOrder,
            ingredientName: ingredients.name,
            ingredientType: ingredients.type,
            ingredientUnit: ingredients.unit,
            ingredientUnitCost: ingredients.unitCost,
          })
          .from(productIngredients)
          .innerJoin(
            ingredients,
            eq(productIngredients.ingredientId, ingredients.id)
          )
          .where(
            and(
              eq(productIngredients.productId, product.id),
              eq(ingredients.isActive, true)
            )
          )
          .orderBy(asc(productIngredients.sortOrder));

        return {
          ...product,
          variants,
          sizePrices: sizePricesRaw,
          customizationGroups: customizationGroupsList,
          ingredients: prodIngredients,
        };
      })
    );

    return withDetails;
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

      // Buscar preços por tamanho (com nome do tamanho)
      const sizePricesRaw = await db
        .select({
          id: productSizePrices.id,
          sizeId: productSizePrices.sizeId,
          price: productSizePrices.price,
          pointsPrice: productSizePrices.pointsPrice,
          sizeName: categorySizes.name,
        })
        .from(productSizePrices)
        .innerJoin(categorySizes, eq(productSizePrices.sizeId, categorySizes.id))
        .where(eq(productSizePrices.productId, product.id))
        .orderBy(asc(categorySizes.sortOrder));

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

      // Buscar ingredientes do produto
      const prodIngredients = await db
        .select({
          id: productIngredients.id,
          productId: productIngredients.productId,
          ingredientId: productIngredients.ingredientId,
          defaultQuantity: productIngredients.defaultQuantity,
          maxQuantity: productIngredients.maxQuantity,
          defaultState: productIngredients.defaultState,
          additionalPrice: productIngredients.additionalPrice,
          weightGrams: productIngredients.weightGrams,
          quantity: productIngredients.quantity,
          unit: productIngredients.unit,
          sortOrder: productIngredients.sortOrder,
          ingredientName: ingredients.name,
          ingredientType: ingredients.type,
          ingredientUnit: ingredients.unit,
          ingredientUnitCost: ingredients.unitCost,
        })
        .from(productIngredients)
        .innerJoin(
          ingredients,
          eq(productIngredients.ingredientId, ingredients.id)
        )
        .where(eq(productIngredients.productId, product.id))
        .orderBy(asc(productIngredients.sortOrder));

      return {
        ...product,
        variants,
        sizePrices: sizePricesRaw,
        customizationGroups: groupsWithOptions,
        ingredients: prodIngredients,
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
            eq(products.isActivePublic, true)
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

      // Buscar ingredientes do produto
      const prodIngredients = await db
        .select({
          id: productIngredients.id,
          productId: productIngredients.productId,
          ingredientId: productIngredients.ingredientId,
          defaultQuantity: productIngredients.defaultQuantity,
          maxQuantity: productIngredients.maxQuantity,
          defaultState: productIngredients.defaultState,
          additionalPrice: productIngredients.additionalPrice,
          weightGrams: productIngredients.weightGrams,
          quantity: productIngredients.quantity,
          unit: productIngredients.unit,
          sortOrder: productIngredients.sortOrder,
          ingredientName: ingredients.name,
          ingredientType: ingredients.type,
        })
        .from(productIngredients)
        .innerJoin(
          ingredients,
          eq(productIngredients.ingredientId, ingredients.id)
        )
        .where(
          and(
            eq(productIngredients.productId, product.id),
            eq(ingredients.isActive, true)
          )
        )
        .orderBy(asc(productIngredients.sortOrder));

      return {
        ...product,
        variants,
        customizationGroups: groupsWithOptions,
        ingredients: prodIngredients,
      };
    }),

  /**
   * Retorna o detalhamento de custo (CMV) de um produto:
   * total, linhas por ingrediente e margem para cada faixa de preço.
   */
  getCostBreakdown: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const [product] = await db
        .select({
          id: products.id,
          name: products.name,
          price: products.price,
          hasVariants: products.hasVariants,
        })
        .from(products)
        .where(
          and(eq(products.id, input.id), eq(products.tenantId, ctx.tenantId))
        )
        .limit(1);

      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Ficha técnica + dados do ingrediente
      const fichaRows = await db
        .select({
          ingredientId: productIngredients.ingredientId,
          quantity: productIngredients.quantity,
          unit: productIngredients.unit,
          weightGrams: productIngredients.weightGrams,
          ingredientName: ingredients.name,
          ingredientUnit: ingredients.unit,
          ingredientUnitCost: ingredients.unitCost,
        })
        .from(productIngredients)
        .innerJoin(
          ingredients,
          eq(productIngredients.ingredientId, ingredients.id)
        )
        .where(
          and(
            eq(productIngredients.productId, input.id),
            eq(ingredients.isActive, true)
          )
        )
        .orderBy(asc(productIngredients.sortOrder));

      const costResult = computeProductCost({
        ingredients: fichaRows.map((r) => ({
          name: r.ingredientName,
          quantity: r.quantity,
          unit: r.unit as IngredientUnit | null,
          weightGramsLegacy: r.weightGrams,
          ingredientUnitCost: r.ingredientUnitCost,
          ingredientUnit: r.ingredientUnit as IngredientUnit,
        })),
      });

      // Margem do preço base
      const margin = computeMargin({
        sellPrice: product.price,
        cost: costResult.totalCost,
      });

      // Margem por variante e por tamanho (range de margens)
      const variants = product.hasVariants
        ? await db
            .select({ name: productVariants.name, price: productVariants.price })
            .from(productVariants)
            .where(eq(productVariants.productId, product.id))
        : [];

      const sizePrices = await db
        .select({
          name: categorySizes.name,
          price: productSizePrices.price,
        })
        .from(productSizePrices)
        .innerJoin(
          categorySizes,
          eq(productSizePrices.sizeId, categorySizes.id)
        )
        .where(eq(productSizePrices.productId, product.id));

      const variantMargins = variants.map((v) => ({
        name: v.name,
        price: Number(v.price),
        ...computeMargin({ sellPrice: v.price, cost: costResult.totalCost }),
      }));

      const sizeMargins = sizePrices.map((sp) => ({
        name: sp.name,
        price: Number(sp.price),
        ...computeMargin({ sellPrice: sp.price, cost: costResult.totalCost }),
      }));

      return {
        productId: product.id,
        productName: product.name,
        sellPrice: Number(product.price),
        totalCost: costResult.totalCost,
        ingredients: fichaRows.map((r, i) => ({
          ingredientId: r.ingredientId,
          name: r.ingredientName,
          quantity: Number(r.quantity),
          unit: r.unit,
          legacyWeightGrams: r.weightGrams,
          unitCost: Number(r.ingredientUnitCost),
          ingredientUnit: r.ingredientUnit,
          lineCost: costResult.lineItems[i]?.cost ?? 0,
          warning: costResult.lineItems[i]?.warning,
        })),
        margin,
        variantMargins,
        sizeMargins,
      };
    }),

  /**
   * Cria um produto completo (com variantes e personalizações).
   */
  create: tenantProcedure
    .input(
      z
        .object({
          categoryId: z.string().uuid(),
          name: z.string().min(1).max(255),
          description: z.string().optional(),
          price: z.string().default("0"),
          originalPrice: z.string().nullable().optional(),
          pointsPrice: z.number().int().positive().nullable().optional(),
          imageUrl: z.string().url().optional(),
          isNew: z.boolean().default(false),
          hasVariants: z.boolean().default(false),
          sortOrder: z.number().int().min(0).default(0),
          isActive: z.boolean().default(true),
          variants: z.array(variantInput).default([]),
          sizePrices: z.array(sizePriceInput).default([]),
          customizationGroups: z.array(customizationGroupInput).default([]),
          ingredients: z.array(productIngredientInput).default([]),
        })
        .refine(
          (d) =>
            d.hasVariants ||
            d.variants.length > 0 ||
            d.sizePrices.length > 0 ||
            Number(d.price) > 0 ||
            (d.pointsPrice ?? 0) > 0,
          "Produto sem variantes precisa ter preço em R$ ou valor em pontos"
        )
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { variants, sizePrices, customizationGroups: groups, ingredients: ingredientsList, ...productData } = input;

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

      // Criar preços por tamanho
      if (sizePrices.length > 0) {
        await db.insert(productSizePrices).values(
          sizePrices.map((sp) => ({
            productId: product.id,
            sizeId: sp.sizeId,
            price: sp.price,
            pointsPrice: sp.pointsPrice ?? null,
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

      // Criar ingredientes do produto
      if (ingredientsList.length > 0) {
        await db.insert(productIngredients).values(
          ingredientsList.map((ing) => ({
            productId: product.id,
            ingredientId: ing.ingredientId,
            defaultQuantity: ing.defaultQuantity,
            maxQuantity: ing.maxQuantity ?? null,
            defaultState: ing.defaultState,
            additionalPrice: ing.additionalPrice,
            weightGrams: ing.weightGrams ?? null,
            quantity: ing.quantity,
            unit: ing.unit ?? null,
            sortOrder: ing.sortOrder,
          }))
        );
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
        pointsPrice: z.number().int().positive().nullable().optional(),
        imageUrl: z.string().url().nullable().optional(),
        isNew: z.boolean().optional(),
        hasVariants: z.boolean().optional(),
        sortOrder: z.number().int().min(0).optional(),
        isActive: z.boolean().optional(),
        isActivePublic: z.boolean().optional(),
        isActivePOS: z.boolean().optional(),
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

  /**
   * Sincroniza preços por tamanho de um produto (delete all + insert).
   */
  syncSizePrices: tenantProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        sizePrices: z.array(sizePriceInput),
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

      // Deletar preços existentes e inserir novos
      await db
        .delete(productSizePrices)
        .where(eq(productSizePrices.productId, input.productId));

      if (input.sizePrices.length > 0) {
        await db.insert(productSizePrices).values(
          input.sizePrices.map((sp) => ({
            productId: input.productId,
            sizeId: sp.sizeId,
            price: sp.price,
            pointsPrice: sp.pointsPrice ?? null,
          }))
        );
      }

      return { success: true };
    }),

  /**
   * Sincroniza ingredientes de um produto (delete all + insert).
   */
  syncIngredients: tenantProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        ingredients: z.array(productIngredientInput),
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

      // Deletar ingredientes existentes e inserir novos
      await db
        .delete(productIngredients)
        .where(eq(productIngredients.productId, input.productId));

      if (input.ingredients.length > 0) {
        await db.insert(productIngredients).values(
          input.ingredients.map((ing) => ({
            productId: input.productId,
            ingredientId: ing.ingredientId,
            defaultQuantity: ing.defaultQuantity,
            maxQuantity: ing.maxQuantity ?? null,
            defaultState: ing.defaultState,
            additionalPrice: ing.additionalPrice,
            weightGrams: ing.weightGrams ?? null,
            quantity: ing.quantity,
            unit: ing.unit ?? null,
            sortOrder: ing.sortOrder,
          }))
        );
      }

      return { success: true };
    }),
});
