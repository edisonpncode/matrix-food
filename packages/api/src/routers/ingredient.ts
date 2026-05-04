import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, tenantProcedure } from "../trpc";
import {
  getDb,
  ingredients,
  productIngredients,
  subRecipeItems,
  ingredientCostHistory,
  eq,
  and,
  asc,
  desc,
  count,
  inArray,
} from "@matrix-food/database";
import {
  computeIngredientUnitCost,
  computeCompositeCost,
  hasRecipeCycle,
  type IngredientUnit,
} from "@matrix-food/utils";

const unitEnum = z.enum(["g", "ml", "un"]);

const purchaseInput = z.object({
  unit: unitEnum,
  purchaseQuantity: z.string().refine((v) => Number(v) >= 0, "Quantidade inválida"),
  purchasePrice: z.string().refine((v) => Number(v) >= 0, "Preço inválido"),
  wastePercent: z
    .string()
    .refine(
      (v) => {
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 && n < 1;
      },
      "Perda deve ser entre 0 e 0,99 (ex: 0.05 para 5%)"
    ),
});

const subRecipeItemInput = z.object({
  childIngredientId: z.string().uuid(),
  quantity: z.string().refine((v) => Number(v) > 0, "Quantidade > 0"),
  unit: unitEnum,
  sortOrder: z.number().int().min(0).default(0),
});

/**
 * Recalcula `unitCost` de um ingrediente composto a partir de seus subRecipeItems.
 * Lê os custos atuais dos componentes do banco.
 */
async function recalculateCompositeCost(
  db: ReturnType<typeof getDb>,
  parentId: string
): Promise<number> {
  const [parent] = await db
    .select({
      yieldQuantity: ingredients.yieldQuantity,
      wastePercent: ingredients.wastePercent,
    })
    .from(ingredients)
    .where(eq(ingredients.id, parentId))
    .limit(1);

  if (!parent) return 0;

  const items = await db
    .select({
      childId: subRecipeItems.childIngredientId,
      quantity: subRecipeItems.quantity,
      unit: subRecipeItems.unit,
      childUnitCost: ingredients.unitCost,
      childUnit: ingredients.unit,
    })
    .from(subRecipeItems)
    .innerJoin(ingredients, eq(subRecipeItems.childIngredientId, ingredients.id))
    .where(eq(subRecipeItems.parentIngredientId, parentId));

  const cost = computeCompositeCost({
    items: items.map((i) => ({
      quantity: i.quantity,
      unit: i.unit as IngredientUnit,
      childUnitCost: i.childUnitCost,
      childUnit: i.childUnit as IngredientUnit,
    })),
    yieldQuantity: parent.yieldQuantity ?? "0",
    wastePercent: parent.wastePercent ?? "0",
  });

  await db
    .update(ingredients)
    .set({ unitCost: cost.toFixed(6) })
    .where(eq(ingredients.id, parentId));

  return cost;
}

/**
 * Recalcula em cascata todos os ingredientes compostos que dependem (direta ou
 * indiretamente) de `changedIngredientId`. Limita profundidade a 5 para evitar loops.
 */
async function cascadeRecalculate(
  db: ReturnType<typeof getDb>,
  tenantId: string,
  changedIngredientId: string
): Promise<void> {
  const visited = new Set<string>();
  const queue: string[] = [changedIngredientId];
  let depth = 0;

  while (queue.length > 0 && depth < 5) {
    const batch = [...queue];
    queue.length = 0;

    const parents = await db
      .select({ parentId: subRecipeItems.parentIngredientId })
      .from(subRecipeItems)
      .innerJoin(
        ingredients,
        eq(subRecipeItems.parentIngredientId, ingredients.id)
      )
      .where(
        and(
          inArray(subRecipeItems.childIngredientId, batch),
          eq(ingredients.tenantId, tenantId),
          eq(ingredients.isComposite, true)
        )
      );

    for (const { parentId } of parents) {
      if (visited.has(parentId)) continue;
      visited.add(parentId);
      await recalculateCompositeCost(db, parentId);
      queue.push(parentId);
    }

    depth++;
  }
}

export const ingredientRouter = createTRPCRouter({
  /**
   * Lista todos os ingredientes do tenant com contador de produtos que os usam.
   */
  list: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const allIngredients = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.tenantId, ctx.tenantId))
      .orderBy(asc(ingredients.name));

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
   * Busca um ingrediente com sua sub-receita (se composto).
   */
  getById: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [ing] = await db
        .select()
        .from(ingredients)
        .where(
          and(
            eq(ingredients.id, input.id),
            eq(ingredients.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!ing) return null;

      const recipeItems = ing.isComposite
        ? await db
            .select({
              id: subRecipeItems.id,
              childIngredientId: subRecipeItems.childIngredientId,
              quantity: subRecipeItems.quantity,
              unit: subRecipeItems.unit,
              sortOrder: subRecipeItems.sortOrder,
              childName: ingredients.name,
              childUnit: ingredients.unit,
              childUnitCost: ingredients.unitCost,
            })
            .from(subRecipeItems)
            .innerJoin(
              ingredients,
              eq(subRecipeItems.childIngredientId, ingredients.id)
            )
            .where(eq(subRecipeItems.parentIngredientId, ing.id))
            .orderBy(asc(subRecipeItems.sortOrder))
        : [];

      return { ...ing, recipeItems };
    }),

  /**
   * Histórico de custo de um ingrediente.
   */
  getCostHistory: tenantProcedure
    .input(z.object({ id: z.string().uuid(), limit: z.number().int().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      return db
        .select()
        .from(ingredientCostHistory)
        .where(
          and(
            eq(ingredientCostHistory.ingredientId, input.id),
            eq(ingredientCostHistory.tenantId, ctx.tenantId)
          )
        )
        .orderBy(desc(ingredientCostHistory.changedAt))
        .limit(input.limit);
    }),

  /**
   * Cria um ingrediente simples (folha).
   */
  create: tenantProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        type: z.enum(["QUANTITY", "DESCRIPTION"]),
        unit: unitEnum.default("un"),
        purchaseQuantity: z.string().default("0"),
        purchasePrice: z.string().default("0"),
        wastePercent: z.string().default("0"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const unitCost = computeIngredientUnitCost({
        purchaseQuantity: input.purchaseQuantity,
        purchasePrice: input.purchasePrice,
        wastePercent: input.wastePercent,
      });

      const [created] = await db
        .insert(ingredients)
        .values({
          tenantId: ctx.tenantId,
          name: input.name,
          type: input.type,
          unit: input.unit,
          purchaseQuantity: input.purchaseQuantity,
          purchasePrice: input.purchasePrice,
          wastePercent: input.wastePercent,
          unitCost: unitCost.toFixed(6),
          isComposite: false,
        })
        .returning();

      if (created && Number(input.purchasePrice) > 0) {
        await db.insert(ingredientCostHistory).values({
          tenantId: ctx.tenantId,
          ingredientId: created.id,
          purchaseQuantity: input.purchaseQuantity,
          purchasePrice: input.purchasePrice,
          wastePercent: input.wastePercent,
          unitCost: unitCost.toFixed(6),
          note: "Cadastro inicial",
        });
      }

      return created;
    }),

  /**
   * Atualiza um ingrediente simples e propaga mudanças de custo aos compostos.
   */
  update: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255),
        type: z.enum(["QUANTITY", "DESCRIPTION"]),
        unit: unitEnum,
        purchaseQuantity: z.string(),
        purchasePrice: z.string(),
        wastePercent: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const [previous] = await db
        .select()
        .from(ingredients)
        .where(
          and(
            eq(ingredients.id, input.id),
            eq(ingredients.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!previous) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ingrediente não encontrado" });
      }

      // Sub-receitas têm unitCost calculado, não editado.
      const isComposite = previous.isComposite;
      const unitCost = isComposite
        ? Number(previous.unitCost)
        : computeIngredientUnitCost({
            purchaseQuantity: input.purchaseQuantity,
            purchasePrice: input.purchasePrice,
            wastePercent: input.wastePercent,
          });

      const costChanged =
        !isComposite &&
        (Number(previous.purchaseQuantity) !== Number(input.purchaseQuantity) ||
          Number(previous.purchasePrice) !== Number(input.purchasePrice) ||
          Number(previous.wastePercent) !== Number(input.wastePercent));

      const [updated] = await db
        .update(ingredients)
        .set({
          name: input.name,
          type: input.type,
          unit: input.unit,
          purchaseQuantity: input.purchaseQuantity,
          purchasePrice: input.purchasePrice,
          wastePercent: input.wastePercent,
          unitCost: unitCost.toFixed(6),
        })
        .where(
          and(
            eq(ingredients.id, input.id),
            eq(ingredients.tenantId, ctx.tenantId)
          )
        )
        .returning();

      if (costChanged) {
        await db.insert(ingredientCostHistory).values({
          tenantId: ctx.tenantId,
          ingredientId: input.id,
          purchaseQuantity: input.purchaseQuantity,
          purchasePrice: input.purchasePrice,
          wastePercent: input.wastePercent,
          unitCost: unitCost.toFixed(6),
        });
        await cascadeRecalculate(db, ctx.tenantId, input.id);
      }

      return updated;
    }),

  /**
   * Marca um ingrediente como composto (sub-receita) ou folha simples.
   * Define yield e perda do processo composto.
   */
  setComposite: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        isComposite: z.boolean(),
        yieldQuantity: z.string().optional(),
        wastePercent: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const updates: Record<string, string | boolean | null> = {
        isComposite: input.isComposite,
      };

      if (input.isComposite) {
        if (input.yieldQuantity !== undefined) {
          updates.yieldQuantity = input.yieldQuantity;
        }
        if (input.wastePercent !== undefined) {
          updates.wastePercent = input.wastePercent;
        }
      } else {
        // Voltando a ser folha: limpa yield e remove sub-receita
        updates.yieldQuantity = null;
        await db
          .delete(subRecipeItems)
          .where(eq(subRecipeItems.parentIngredientId, input.id));
      }

      await db
        .update(ingredients)
        .set(updates)
        .where(
          and(
            eq(ingredients.id, input.id),
            eq(ingredients.tenantId, ctx.tenantId)
          )
        );

      if (input.isComposite) {
        await recalculateCompositeCost(db, input.id);
      }

      await cascadeRecalculate(db, ctx.tenantId, input.id);
      return { success: true };
    }),

  /**
   * Sincroniza os componentes de um ingrediente composto (sub-receita).
   * Valida ciclos via DFS antes de gravar.
   */
  syncRecipe: tenantProcedure
    .input(
      z.object({
        parentIngredientId: z.string().uuid(),
        items: z.array(subRecipeItemInput),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const [parent] = await db
        .select()
        .from(ingredients)
        .where(
          and(
            eq(ingredients.id, input.parentIngredientId),
            eq(ingredients.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!parent) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ingrediente não encontrado" });
      }
      if (!parent.isComposite) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Marque o ingrediente como sub-receita antes de adicionar componentes",
        });
      }

      // Carrega adjacência atual (todos os pares parent → child do tenant)
      const allEdges = await db
        .select({
          parentId: subRecipeItems.parentIngredientId,
          childId: subRecipeItems.childIngredientId,
        })
        .from(subRecipeItems)
        .innerJoin(
          ingredients,
          eq(subRecipeItems.parentIngredientId, ingredients.id)
        )
        .where(eq(ingredients.tenantId, ctx.tenantId));

      // Remove edges do parent atual (vamos sobrescrever) e simula novas
      const adjacency = new Map<string, string[]>();
      for (const e of allEdges) {
        if (e.parentId === input.parentIngredientId) continue;
        const list = adjacency.get(e.parentId) ?? [];
        list.push(e.childId);
        adjacency.set(e.parentId, list);
      }

      // Adiciona as novas edges propostas e checa ciclos
      const proposedChildren = input.items.map((i) => i.childIngredientId);
      adjacency.set(input.parentIngredientId, proposedChildren);

      for (const childId of proposedChildren) {
        if (hasRecipeCycle(input.parentIngredientId, childId, adjacency)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Esta receita criaria um ciclo (um ingrediente não pode depender de si mesmo)",
          });
        }
      }

      // Valida que todos os componentes pertencem ao tenant e que unit bate com a unidade-base do filho
      if (proposedChildren.length > 0) {
        const childRows = await db
          .select({ id: ingredients.id, unit: ingredients.unit })
          .from(ingredients)
          .where(
            and(
              inArray(ingredients.id, proposedChildren),
              eq(ingredients.tenantId, ctx.tenantId)
            )
          );
        const childMap = new Map(childRows.map((c) => [c.id, c.unit]));
        for (const item of input.items) {
          const childUnit = childMap.get(item.childIngredientId);
          if (!childUnit) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Componente inválido ou de outro restaurante",
            });
          }
          if (childUnit !== item.unit) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Unidade do componente difere da unidade-base (${childUnit} vs ${item.unit})`,
            });
          }
        }
      }

      // Sincroniza: deleta tudo + insere
      await db
        .delete(subRecipeItems)
        .where(eq(subRecipeItems.parentIngredientId, input.parentIngredientId));

      if (input.items.length > 0) {
        await db.insert(subRecipeItems).values(
          input.items.map((it, idx) => ({
            parentIngredientId: input.parentIngredientId,
            childIngredientId: it.childIngredientId,
            quantity: it.quantity,
            unit: it.unit,
            sortOrder: it.sortOrder ?? idx,
          }))
        );
      }

      await recalculateCompositeCost(db, input.parentIngredientId);
      await cascadeRecalculate(db, ctx.tenantId, input.parentIngredientId);

      return { success: true };
    }),

  /**
   * Atualiza apenas a configuração de compra (mantido por compatibilidade — preferir `update`).
   */
  setPurchase: tenantProcedure
    .input(z.object({ id: z.string().uuid() }).merge(purchaseInput))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const unitCost = computeIngredientUnitCost(input);

      const [updated] = await db
        .update(ingredients)
        .set({
          unit: input.unit,
          purchaseQuantity: input.purchaseQuantity,
          purchasePrice: input.purchasePrice,
          wastePercent: input.wastePercent,
          unitCost: unitCost.toFixed(6),
        })
        .where(
          and(
            eq(ingredients.id, input.id),
            eq(ingredients.tenantId, ctx.tenantId)
          )
        )
        .returning();

      await db.insert(ingredientCostHistory).values({
        tenantId: ctx.tenantId,
        ingredientId: input.id,
        purchaseQuantity: input.purchaseQuantity,
        purchasePrice: input.purchasePrice,
        wastePercent: input.wastePercent,
        unitCost: unitCost.toFixed(6),
      });

      await cascadeRecalculate(db, ctx.tenantId, input.id);
      return updated;
    }),

  /**
   * Soft-delete (marca isActive = false).
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
