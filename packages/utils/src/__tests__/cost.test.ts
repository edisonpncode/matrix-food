import { describe, expect, it } from "vitest";
import {
  computeCompositeCost,
  computeIngredientUnitCost,
  computeMargin,
  computeProductCost,
  hasRecipeCycle,
} from "../cost";

describe("computeIngredientUnitCost", () => {
  it("calcula alho 1 unidade R$2,00 com 5% de perda", () => {
    // Cenário da planilha: ALHO 1un por R$2 com 5% perda → R$2,1053/un
    const result = computeIngredientUnitCost({
      purchaseQuantity: 1,
      purchasePrice: 2,
      wastePercent: 0.05,
    });
    expect(result).toBeCloseTo(2.105263, 4);
  });

  it("calcula queijo 1000g R$30 com 2% de perda", () => {
    const result = computeIngredientUnitCost({
      purchaseQuantity: 1000,
      purchasePrice: 30,
      wastePercent: 0.02,
    });
    expect(result).toBeCloseTo(0.030612, 4);
  });

  it("calcula bife 1000g R$45 com 8% de perda", () => {
    const result = computeIngredientUnitCost({
      purchaseQuantity: 1000,
      purchasePrice: 45,
      wastePercent: 0.08,
    });
    expect(result).toBeCloseTo(0.048913, 4);
  });

  it("aceita inputs como string (formato Drizzle decimal)", () => {
    const result = computeIngredientUnitCost({
      purchaseQuantity: "1000",
      purchasePrice: "30.00",
      wastePercent: "0.0200",
    });
    expect(result).toBeCloseTo(0.030612, 4);
  });

  it("retorna 0 sem perda quando perda não definida", () => {
    const result = computeIngredientUnitCost({
      purchaseQuantity: 100,
      purchasePrice: 10,
      wastePercent: 0,
    });
    expect(result).toBeCloseTo(0.1, 4);
  });

  it("retorna 0 quando quantidade é 0 (evita divisão por zero)", () => {
    expect(
      computeIngredientUnitCost({
        purchaseQuantity: 0,
        purchasePrice: 10,
        wastePercent: 0,
      })
    ).toBe(0);
  });

  it("aceita qualquer valor de perda mas trava em 99%", () => {
    const high = computeIngredientUnitCost({
      purchaseQuantity: 100,
      purchasePrice: 10,
      wastePercent: 1.5, // 150% — clampa em 0.99
    });
    // 10 / (100 × 0.01) = 10
    expect(high).toBeCloseTo(10, 4);
  });
});

describe("computeProductCost", () => {
  it("soma ingredientes simples com unit definido", () => {
    const result = computeProductCost({
      ingredients: [
        {
          name: "Pão",
          quantity: 80,
          unit: "g",
          ingredientUnitCost: 0.012, // R$/g
          ingredientUnit: "g",
        },
        {
          name: "Carne",
          quantity: 100,
          unit: "g",
          ingredientUnitCost: 0.045,
          ingredientUnit: "g",
        },
        {
          name: "Queijo",
          quantity: 30,
          unit: "g",
          ingredientUnitCost: 0.0306,
          ingredientUnit: "g",
        },
      ],
    });
    // 0.96 + 4.5 + 0.918 = 6.378
    expect(result.totalCost).toBeCloseTo(6.378, 2);
    expect(result.lineItems).toHaveLength(3);
    expect(result.lineItems[0]?.cost).toBeCloseTo(0.96, 2);
  });

  it("usa weightGrams como fallback para legado", () => {
    const result = computeProductCost({
      ingredients: [
        {
          name: "Queijo",
          quantity: 0,
          unit: null,
          weightGramsLegacy: 50,
          ingredientUnitCost: 0.0306,
          ingredientUnit: "g",
        },
      ],
    });
    expect(result.totalCost).toBeCloseTo(1.53, 2);
    expect(result.lineItems[0]?.warning).toBeUndefined();
  });

  it("emite warning quando unidade da ficha difere da unidade do ingrediente", () => {
    const result = computeProductCost({
      ingredients: [
        {
          name: "Azeite",
          quantity: 10,
          unit: "g",
          ingredientUnitCost: 0.025,
          ingredientUnit: "ml",
        },
      ],
    });
    expect(result.totalCost).toBe(0);
    expect(result.lineItems[0]?.warning).toMatch(/incompat/i);
  });

  it("calcula pizza 4 queijos completa (cenário planilha)", () => {
    // Cenário PIZZA 4 QUEIJOS GRANDE da planilha:
    // MASSA 0.53kg = 530g a R$2,358/g (massa rende custo R$1,25 para 530g)
    // QUEIJO 25g, CATUPIRY 25g, CHEDDAR 25g a R$0,2264/g
    // PARMESÃO 5g R$0,632/g, MOLHO 5g R$0,036/g, ORÉGANO 0,5g R$0,32/g
    // CX PIZZA G 1un R$2,42
    // Total esperado: ~R$16,77
    const result = computeProductCost({
      ingredients: [
        { name: "Massa", quantity: 530, unit: "g", ingredientUnitCost: 0.002358, ingredientUnit: "g" },
        { name: "Queijo", quantity: 25, unit: "g", ingredientUnitCost: 0.2264, ingredientUnit: "g" },
        { name: "Catupiry", quantity: 25, unit: "g", ingredientUnitCost: 0.0788, ingredientUnit: "g" },
        { name: "Cheddar", quantity: 25, unit: "g", ingredientUnitCost: 0.0788, ingredientUnit: "g" },
        { name: "Parmesão", quantity: 5, unit: "g", ingredientUnitCost: 0.632, ingredientUnit: "g" },
        { name: "Molho", quantity: 5, unit: "g", ingredientUnitCost: 0.036, ingredientUnit: "g" },
        { name: "Orégano", quantity: 0.5, unit: "g", ingredientUnitCost: 0.32, ingredientUnit: "g" },
        { name: "Caixa Pizza G", quantity: 1, unit: "un", ingredientUnitCost: 2.42, ingredientUnit: "un" },
      ],
    });
    // 1.249 + 5.66 + 1.97 + 1.97 + 3.16 + 0.18 + 0.16 + 2.42 ≈ 16.77
    expect(result.totalCost).toBeGreaterThan(16);
    expect(result.totalCost).toBeLessThan(17.5);
  });
});

describe("computeMargin", () => {
  it("calcula margem do XIS CARNE da planilha (preço 17, custo 8.21)", () => {
    const result = computeMargin({ sellPrice: 17, cost: 8.21 });
    expect(result.profitBRL).toBeCloseTo(8.79, 2);
    expect(result.marginPercent).toBeCloseTo(51.71, 1);
    // markup = 8.79 / 8.21 = 1.071 → 107%. Planilha mostra como "207%" (preço/custo).
    expect(result.markupPercent).toBeCloseTo(107.06, 1);
  });

  it("retorna margem negativa quando preço < custo", () => {
    const result = computeMargin({ sellPrice: 5, cost: 8 });
    expect(result.profitBRL).toBe(-3);
    expect(result.marginPercent).toBe(-60);
  });

  it("não quebra quando preço ou custo são zero", () => {
    expect(computeMargin({ sellPrice: 0, cost: 5 })).toEqual({
      profitBRL: -5,
      marginPercent: 0, // preço 0 → marginPercent 0 por convenção
      markupPercent: -100,
    });

    expect(computeMargin({ sellPrice: 10, cost: 0 })).toEqual({
      profitBRL: 10,
      marginPercent: 100,
      markupPercent: 0, // custo 0 → markupPercent 0 por convenção
    });
  });
});

describe("computeCompositeCost", () => {
  it("calcula custo de MASSA PIZZA: 500g farinha + 300ml agua + 5g fermento → 800g", () => {
    const result = computeCompositeCost({
      items: [
        { quantity: 500, unit: "g", childUnitCost: 0.005, childUnit: "g" }, // 2.50
        { quantity: 300, unit: "ml", childUnitCost: 0, childUnit: "ml" }, // água grátis
        { quantity: 5, unit: "g", childUnitCost: 0.05, childUnit: "g" }, // 0.25
      ],
      yieldQuantity: 800,
      wastePercent: 0,
    });
    // total = 2.75 / 800 = 0.003437/g
    expect(result).toBeCloseTo(0.003438, 4);
  });

  it("aplica perda no processo do composto", () => {
    const result = computeCompositeCost({
      items: [{ quantity: 100, unit: "g", childUnitCost: 0.1, childUnit: "g" }], // R$10
      yieldQuantity: 100,
      wastePercent: 0.1, // 10% perda
    });
    // 10 / (100 × 0.9) = 0.1111
    expect(result).toBeCloseTo(0.111111, 4);
  });

  it("ignora linha com unidade incompatível", () => {
    const result = computeCompositeCost({
      items: [
        { quantity: 100, unit: "g", childUnitCost: 0.1, childUnit: "g" }, // ok: 10
        { quantity: 50, unit: "ml", childUnitCost: 0.5, childUnit: "g" }, // ignora
      ],
      yieldQuantity: 100,
      wastePercent: 0,
    });
    expect(result).toBeCloseTo(0.1, 4);
  });
});

describe("hasRecipeCycle", () => {
  it("detecta auto-referência", () => {
    expect(hasRecipeCycle("a", "a", new Map())).toBe(true);
  });

  it("detecta ciclo simples (a → b, adicionar b → a)", () => {
    const adj = new Map<string, string[]>([["a", ["b"]]]);
    expect(hasRecipeCycle("b", "a", adj)).toBe(true);
  });

  it("detecta ciclo profundo (a → b → c, adicionar c → a)", () => {
    const adj = new Map<string, string[]>([
      ["a", ["b"]],
      ["b", ["c"]],
    ]);
    expect(hasRecipeCycle("c", "a", adj)).toBe(true);
  });

  it("não acusa ciclo em grafo acíclico", () => {
    const adj = new Map<string, string[]>([
      ["a", ["b", "c"]],
      ["d", ["e"]],
    ]);
    expect(hasRecipeCycle("a", "d", adj)).toBe(false);
  });
});
