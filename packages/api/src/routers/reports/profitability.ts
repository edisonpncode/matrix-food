import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../../trpc";
import {
  getDb,
  products,
  productIngredients,
  ingredients,
  categories,
  customizationGroups,
  customizationOptions,
  orders,
  orderItems,
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

const dateRangeInput = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

/**
 * Calcula o custo (CMV) e margem do produto base em um único batch.
 * Retorna lista enriquecida com custo, margem e classificação.
 */
async function buildProductMargins(tenantId: string) {
  const db = getDb();

  const allProducts = await db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      categoryId: products.categoryId,
      categoryName: categories.name,
      isActive: products.isActive,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.tenantId, tenantId))
    .orderBy(asc(products.sortOrder));

  if (allProducts.length === 0) return [];

  const productIds = allProducts.map((p) => p.id);

  const fichaRows = await db
    .select({
      productId: productIngredients.productId,
      quantity: productIngredients.quantity,
      unit: productIngredients.unit,
      weightGrams: productIngredients.weightGrams,
      ingredientName: ingredients.name,
      ingredientUnit: ingredients.unit,
      ingredientUnitCost: ingredients.unitCost,
      ingredientActive: ingredients.isActive,
    })
    .from(productIngredients)
    .innerJoin(
      ingredients,
      eq(productIngredients.ingredientId, ingredients.id)
    )
    .where(inArray(productIngredients.productId, productIds));

  const fichaByProduct = new Map<string, typeof fichaRows>();
  for (const row of fichaRows) {
    const list = fichaByProduct.get(row.productId) ?? [];
    list.push(row);
    fichaByProduct.set(row.productId, list);
  }

  return allProducts.map((p) => {
    const ficha = fichaByProduct.get(p.id) ?? [];
    const cost = computeProductCost({
      ingredients: ficha
        .filter((f) => f.ingredientActive)
        .map((f) => ({
          name: f.ingredientName,
          quantity: f.quantity,
          unit: f.unit as IngredientUnit | null,
          weightGramsLegacy: f.weightGrams,
          ingredientUnitCost: f.ingredientUnitCost,
          ingredientUnit: f.ingredientUnit as IngredientUnit,
        })),
    });
    const margin = computeMargin({ sellPrice: p.price, cost: cost.totalCost });

    return {
      id: p.id,
      name: p.name,
      categoryId: p.categoryId,
      categoryName: p.categoryName ?? "Sem categoria",
      sellPrice: Number(p.price),
      cost: cost.totalCost,
      profitBRL: margin.profitBRL,
      marginPercent: margin.marginPercent,
      markupPercent: margin.markupPercent,
      hasCost: cost.totalCost > 0,
      isActive: p.isActive,
      ingredientCount: ficha.length,
    };
  });
}

export const profitabilityReportsRouter = createTRPCRouter({
  /**
   * Lista produtos com custo, margem e classificação.
   * Permite ordenar e filtrar para encontrar os com margem baixa rapidamente.
   */
  productMargins: tenantProcedure
    .input(
      z.object({
        categoryId: z.string().uuid().optional(),
        onlyNegative: z.boolean().default(false),
        belowMarginPct: z.number().min(0).max(100).optional(),
        sortBy: z
          .enum(["marginPercentAsc", "marginPercentDesc", "profitDesc", "name"])
          .default("marginPercentAsc"),
      })
    )
    .query(async ({ ctx, input }) => {
      const all = await buildProductMargins(ctx.tenantId);

      let filtered = all;
      if (input.categoryId) {
        filtered = filtered.filter((p) => p.categoryId === input.categoryId);
      }
      if (input.onlyNegative) {
        filtered = filtered.filter((p) => p.hasCost && p.profitBRL < 0);
      }
      if (input.belowMarginPct != null) {
        filtered = filtered.filter(
          (p) => p.hasCost && p.marginPercent < input.belowMarginPct!
        );
      }

      filtered.sort((a, b) => {
        if (input.sortBy === "name") return a.name.localeCompare(b.name);
        if (input.sortBy === "marginPercentDesc")
          return b.marginPercent - a.marginPercent;
        if (input.sortBy === "profitDesc") return b.profitBRL - a.profitBRL;
        // marginPercentAsc (default): produtos sem custo vão pro fim
        if (a.hasCost !== b.hasCost) return a.hasCost ? -1 : 1;
        return a.marginPercent - b.marginPercent;
      });

      return filtered;
    }),

  /**
   * Resumo agregado: KPIs gerais para o dashboard.
   */
  summary: tenantProcedure.query(async ({ ctx }) => {
    const all = await buildProductMargins(ctx.tenantId);
    const withCost = all.filter((p) => p.hasCost && p.isActive);

    if (withCost.length === 0) {
      return {
        totalProducts: all.length,
        productsWithCost: 0,
        averageMarginPercent: 0,
        bestProduct: null,
        worstProduct: null,
        belowThreshold: 0,
      };
    }

    const avg =
      withCost.reduce((sum, p) => sum + p.marginPercent, 0) / withCost.length;
    const sorted = [...withCost].sort(
      (a, b) => a.marginPercent - b.marginPercent
    );

    return {
      totalProducts: all.length,
      productsWithCost: withCost.length,
      averageMarginPercent: Number(avg.toFixed(2)),
      worstProduct: {
        id: sorted[0]!.id,
        name: sorted[0]!.name,
        marginPercent: sorted[0]!.marginPercent,
      },
      bestProduct: {
        id: sorted[sorted.length - 1]!.id,
        name: sorted[sorted.length - 1]!.name,
        marginPercent: sorted[sorted.length - 1]!.marginPercent,
      },
      belowThreshold: withCost.filter((p) => p.marginPercent < 30).length,
    };
  }),

  /**
   * Margem média ponderada por categoria.
   */
  byCategory: tenantProcedure.query(async ({ ctx }) => {
    const all = await buildProductMargins(ctx.tenantId);

    const grouped = new Map<
      string,
      { categoryName: string; totalCost: number; totalRevenue: number; count: number }
    >();

    for (const p of all) {
      if (!p.hasCost) continue;
      const key = p.categoryId ?? "_no_category";
      const entry = grouped.get(key) ?? {
        categoryName: p.categoryName,
        totalCost: 0,
        totalRevenue: 0,
        count: 0,
      };
      entry.totalCost += p.cost;
      entry.totalRevenue += p.sellPrice;
      entry.count++;
      grouped.set(key, entry);
    }

    return Array.from(grouped.entries())
      .map(([categoryId, e]) => ({
        categoryId: categoryId === "_no_category" ? null : categoryId,
        categoryName: e.categoryName,
        productCount: e.count,
        totalCost: e.totalCost,
        totalRevenue: e.totalRevenue,
        averageMarginPercent:
          e.totalRevenue > 0
            ? Number(
                (((e.totalRevenue - e.totalCost) / e.totalRevenue) * 100).toFixed(
                  2
                )
              )
            : 0,
      }))
      .sort((a, b) => b.averageMarginPercent - a.averageMarginPercent);
  }),

  /**
   * CMV consolidado no período: faturamento, custo total (snapshot), lucro
   * bruto e CMV%. Agrupa por dia/semana/mês.
   *
   * Usa `orderItems.unitCostSnapshot` (custo no momento do pedido) para
   * estabilidade — não muda quando o usuário ajusta custos depois.
   */
  cmvByPeriod: tenantProcedure
    .input(
      dateRangeInput.extend({
        groupBy: z.enum(["day", "week", "month"]).default("day"),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const dateFn =
        input.groupBy === "day"
          ? sql`date_trunc('day', ${orders.createdAt})`
          : input.groupBy === "week"
            ? sql`date_trunc('week', ${orders.createdAt})`
            : sql`date_trunc('month', ${orders.createdAt})`;

      const rows = await db
        .select({
          period: sql<string>`${dateFn}::text`,
          revenue: sql<string>`COALESCE(SUM(${orderItems.totalPrice}::numeric), 0)::text`,
          cmv: sql<string>`COALESCE(SUM(${orderItems.unitCostSnapshot}::numeric * ${orderItems.quantity}), 0)::text`,
          itemCount: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)::int`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          and(
            eq(orders.tenantId, ctx.tenantId),
            sql`${orders.createdAt} >= ${input.from}`,
            sql`${orders.createdAt} < ${input.to}`,
            sql`${orders.status} <> 'CANCELLED'`
          )
        )
        .groupBy(dateFn)
        .orderBy(dateFn);

      const series = rows.map((r) => {
        const revenue = Number(r.revenue);
        const cmv = Number(r.cmv);
        const profit = revenue - cmv;
        return {
          period: r.period,
          revenue,
          cmv,
          profit,
          cmvPercent: revenue > 0 ? (cmv / revenue) * 100 : 0,
          marginPercent: revenue > 0 ? (profit / revenue) * 100 : 0,
          itemCount: r.itemCount,
        };
      });

      const totalRevenue = series.reduce((s, r) => s + r.revenue, 0);
      const totalCmv = series.reduce((s, r) => s + r.cmv, 0);
      const totalProfit = totalRevenue - totalCmv;

      return {
        series,
        summary: {
          totalRevenue,
          totalCmv,
          totalProfit,
          cmvPercent: totalRevenue > 0 ? (totalCmv / totalRevenue) * 100 : 0,
          marginPercent:
            totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
        },
      };
    }),

  /**
   * Top produtos por contribuição absoluta de lucro no período.
   * Considera unitCostSnapshot × quantity vs totalPrice.
   */
  topProfitableInPeriod: tenantProcedure
    .input(
      dateRangeInput.extend({
        limit: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const rows = await db
        .select({
          productId: orderItems.productId,
          productName: orderItems.productName,
          quantity: sql<number>`SUM(${orderItems.quantity})::int`,
          revenue: sql<string>`COALESCE(SUM(${orderItems.totalPrice}::numeric), 0)::text`,
          cmv: sql<string>`COALESCE(SUM(${orderItems.unitCostSnapshot}::numeric * ${orderItems.quantity}), 0)::text`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          and(
            eq(orders.tenantId, ctx.tenantId),
            sql`${orders.createdAt} >= ${input.from}`,
            sql`${orders.createdAt} < ${input.to}`,
            sql`${orders.status} <> 'CANCELLED'`
          )
        )
        .groupBy(orderItems.productId, orderItems.productName);

      return rows
        .map((r) => {
          const revenue = Number(r.revenue);
          const cmv = Number(r.cmv);
          const profit = revenue - cmv;
          return {
            productId: r.productId,
            productName: r.productName,
            quantity: r.quantity,
            revenue,
            cmv,
            profit,
            marginPercent: revenue > 0 ? (profit / revenue) * 100 : 0,
          };
        })
        .sort((a, b) => b.profit - a.profit)
        .slice(0, input.limit);
    }),

  /**
   * Lista adicionais (customizationOptions) com margem.
   * Identifica adicionais que estão com lucro baixo ou negativo.
   */
  customizationMargins: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select({
        id: customizationOptions.id,
        optionName: customizationOptions.name,
        price: customizationOptions.price,
        unitCost: customizationOptions.unitCost,
        groupName: customizationGroups.name,
        productId: customizationGroups.productId,
        productName: products.name,
      })
      .from(customizationOptions)
      .innerJoin(
        customizationGroups,
        eq(customizationOptions.groupId, customizationGroups.id)
      )
      .innerJoin(products, eq(customizationGroups.productId, products.id))
      .where(
        and(
          eq(products.tenantId, ctx.tenantId),
          eq(customizationOptions.isActive, true)
        )
      );

    return rows
      .map((r) => {
        const margin = computeMargin({
          sellPrice: r.price,
          cost: r.unitCost,
        });
        return {
          id: r.id,
          optionName: r.optionName,
          groupName: r.groupName,
          productId: r.productId,
          productName: r.productName,
          price: Number(r.price),
          unitCost: Number(r.unitCost),
          ...margin,
        };
      })
      .sort((a, b) => a.marginPercent - b.marginPercent);
  }),
});
