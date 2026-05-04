/**
 * Funções puras para cálculo de custo (CMV) e margem de produtos.
 *
 * Replica a lógica da planilha "CUSTO DOS LANCHES.xlsx":
 *   custo_unit_real = preco_compra / (qtde_comprada × (1 − %perda))
 *
 * Todas as entradas decimais aceitam string (formato Drizzle) ou number.
 * Conversão centralizada em `toNumber()` para evitar bugs de coerção.
 */

export type IngredientUnit = "g" | "ml" | "un";

/** Aceita string (Drizzle decimal) ou number; null/undefined viram 0. */
function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Limita um valor entre min e max. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Arredonda para N casas (default 6). */
function round(value: number, decimals = 6): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// ============================================
// 1. Custo unitário de ingrediente (folha)
// ============================================

export interface IngredientUnitCostInput {
  /** Quantidade comprada na unidade-base (g, ml ou un). > 0 */
  purchaseQuantity: string | number;
  /** Preço total da compra (R$) */
  purchasePrice: string | number;
  /** Perda no processo (0..1). Ex: 0.05 = 5% */
  wastePercent: string | number;
}

/**
 * Calcula o custo unitário ajustado por perda de processo.
 *
 * @example
 *   computeIngredientUnitCost({ purchaseQuantity: 1000, purchasePrice: 30, wastePercent: 0.02 })
 *   // → 0.030612 (R$ por grama, com 2% de perda)
 */
export function computeIngredientUnitCost(
  input: IngredientUnitCostInput
): number {
  const qty = toNumber(input.purchaseQuantity);
  const price = toNumber(input.purchasePrice);
  const waste = clamp(toNumber(input.wastePercent), 0, 0.99);

  if (qty <= 0 || price < 0) return 0;

  const effectiveQty = qty * (1 - waste);
  if (effectiveQty <= 0) return 0;

  return round(price / effectiveQty, 6);
}

// ============================================
// 2. Custo de ingrediente composto (sub-receita)
// ============================================

export interface CompositeRecipeItem {
  /** Custo unitário do componente (R$ por unidade-base do componente) */
  childUnitCost: string | number;
  /** Unidade do componente */
  childUnit: IngredientUnit;
  /** Quantidade usada na receita (na unidade do componente) */
  quantity: string | number;
  /** Unidade da quantidade (deve coincidir com childUnit) */
  unit: IngredientUnit;
}

export interface CompositeCostInput {
  items: CompositeRecipeItem[];
  /** Produção líquida da receita (na unidade-base do composto) */
  yieldQuantity: string | number;
  /** Perda no processo do composto (0..1). Ex: 0.10 = 10% */
  wastePercent: string | number;
}

/**
 * Calcula o custo unitário (R$ por unidade-base) de um ingrediente composto.
 *
 * Ex: MASSA PIZZA com receita: 500g farinha + 300ml água + 5g fermento → rende 800g.
 *   total_componentes = 500 × custo_farinha/g + 300 × custo_agua/ml + 5 × custo_fermento/g
 *   unitCost = total / (yield × (1 − %perda))
 */
export function computeCompositeCost(input: CompositeCostInput): number {
  const yieldQty = toNumber(input.yieldQuantity);
  const waste = clamp(toNumber(input.wastePercent), 0, 0.99);

  if (yieldQty <= 0) return 0;

  let total = 0;
  for (const item of input.items) {
    if (item.childUnit !== item.unit) continue; // unidade incompatível, ignora linha
    total += toNumber(item.quantity) * toNumber(item.childUnitCost);
  }

  const effectiveYield = yieldQty * (1 - waste);
  if (effectiveYield <= 0) return 0;

  return round(total / effectiveYield, 6);
}

// ============================================
// 3. Custo total da ficha técnica de um produto
// ============================================

export interface ProductIngredientLine {
  /** Nome para exibição/log */
  name?: string;
  /** Quantidade consumida do ingrediente para 1 produto (na unidade do produto-ingrediente) */
  quantity: string | number;
  /** Unidade da quantity. Null = legado, sistema usa weightGramsLegacy como gramas */
  unit: IngredientUnit | null;
  /** Fallback legado: peso em gramas quando `unit` é null */
  weightGramsLegacy?: string | number | null;
  /** Custo unitário do ingrediente (R$ por unidade-base) */
  ingredientUnitCost: string | number;
  /** Unidade-base do ingrediente */
  ingredientUnit: IngredientUnit;
}

export interface ProductCostLineResult {
  name?: string;
  cost: number;
  warning?: string;
}

export interface ProductCostResult {
  totalCost: number;
  lineItems: ProductCostLineResult[];
}

/**
 * Soma o custo de todos os ingredientes da ficha técnica.
 *
 * Lógica de unidade:
 *   1. Se `unit` está definido → usa `quantity` × `ingredientUnitCost` (com check de compatibilidade)
 *   2. Senão, se `weightGramsLegacy` > 0 e `ingredientUnit === 'g'` → usa esse peso como gramas
 *   3. Senão, custo da linha = 0 (com warning)
 */
export function computeProductCost(input: {
  ingredients: ProductIngredientLine[];
}): ProductCostResult {
  const lineItems: ProductCostLineResult[] = [];
  let totalCost = 0;

  for (const ing of input.ingredients) {
    const unitCost = toNumber(ing.ingredientUnitCost);
    let lineCost = 0;
    let warning: string | undefined;

    if (ing.unit) {
      if (ing.unit !== ing.ingredientUnit) {
        warning = `Unidade incompatível: ficha em "${ing.unit}" mas ingrediente em "${ing.ingredientUnit}"`;
      } else {
        lineCost = toNumber(ing.quantity) * unitCost;
      }
    } else if (ing.weightGramsLegacy != null) {
      const grams = toNumber(ing.weightGramsLegacy);
      if (grams > 0) {
        if (ing.ingredientUnit === "g") {
          lineCost = grams * unitCost;
        } else {
          warning = `Peso (g) legado mas ingrediente está em "${ing.ingredientUnit}"`;
        }
      }
    } else {
      warning = "Quantidade não preenchida";
    }

    lineCost = round(lineCost, 4);
    totalCost += lineCost;
    lineItems.push({
      name: ing.name,
      cost: lineCost,
      warning,
    });
  }

  return {
    totalCost: round(totalCost, 4),
    lineItems,
  };
}

// ============================================
// 4. Margem e markup
// ============================================

export interface MarginInput {
  sellPrice: string | number;
  cost: string | number;
}

export interface MarginResult {
  /** Lucro absoluto (R$) = preço − custo */
  profitBRL: number;
  /** Margem (%): lucro / preço — quanto sobra de cada R$1 vendido. 0 se preço = 0. */
  marginPercent: number;
  /** Markup (%): lucro / custo — quanto se cobra acima do custo. 0 se custo = 0. */
  markupPercent: number;
}

export function computeMargin(input: MarginInput): MarginResult {
  const price = toNumber(input.sellPrice);
  const cost = toNumber(input.cost);
  const profit = price - cost;

  return {
    profitBRL: round(profit, 2),
    marginPercent: price > 0 ? round((profit / price) * 100, 2) : 0,
    markupPercent: cost > 0 ? round((profit / cost) * 100, 2) : 0,
  };
}

// ============================================
// 5. Detecção de ciclos em sub-receitas (DFS)
// ============================================

/**
 * Verifica se adicionar `childId` como filho de `parentId` cria um ciclo no grafo de sub-receitas.
 *
 * @param parentId Ingrediente que vai receber o componente
 * @param childId Componente a adicionar
 * @param adjacency Mapa parentId → childIds atual (snapshot do banco)
 * @returns true se há ciclo (deve ser bloqueado)
 */
export function hasRecipeCycle(
  parentId: string,
  childId: string,
  adjacency: Map<string, string[]>
): boolean {
  if (parentId === childId) return true;

  const visited = new Set<string>();
  const stack: string[] = [childId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === parentId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const children = adjacency.get(current);
    if (children) stack.push(...children);
  }

  return false;
}
