import { describe, it, expect } from "vitest";
import { round2, splitEvenly, isSplitTotalValid } from "../payment-split";

describe("round2", () => {
  it("arredonda para 2 casas decimais", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(1.004)).toBe(1.0);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it("preserva valores já arredondados", () => {
    expect(round2(10)).toBe(10);
    expect(round2(0)).toBe(0);
    expect(round2(99.99)).toBe(99.99);
  });
});

describe("splitEvenly", () => {
  it("divide valor exato igualmente", () => {
    expect(splitEvenly(10, 2)).toEqual([5, 5]);
    expect(splitEvenly(100, 4)).toEqual([25, 25, 25, 25]);
  });

  it("absorve resíduo na última parcela quando divisão não é exata", () => {
    // 10 / 3 = 3.3333... → 3.33 + 3.33 + 3.34 = 10.00
    const parts = splitEvenly(10, 3);
    expect(parts).toEqual([3.33, 3.33, 3.34]);
    expect(round2(parts.reduce((s, p) => s + p, 0))).toBe(10);
  });

  it("garante que a soma sempre fecha com o total (R$ 80 entre 7 pessoas)", () => {
    const parts = splitEvenly(80, 7);
    expect(parts).toHaveLength(7);
    expect(round2(parts.reduce((s, p) => s + p, 0))).toBe(80);
  });

  it("retorna array vazio para n <= 0", () => {
    expect(splitEvenly(100, 0)).toEqual([]);
    expect(splitEvenly(100, -1)).toEqual([]);
  });

  it("rejeita totais negativos", () => {
    expect(splitEvenly(-10, 2)).toEqual([]);
  });

  it("aceita uma única pessoa", () => {
    expect(splitEvenly(50, 1)).toEqual([50]);
  });

  it("lida com centavos", () => {
    // 0.10 / 3 = 0.0333... → arredonda para 0.03; resíduo = 0.01 vai pra última
    const parts = splitEvenly(0.1, 3);
    expect(round2(parts.reduce((s, p) => s + p, 0))).toBe(0.1);
  });
});

describe("isSplitTotalValid", () => {
  it("aceita soma exatamente igual ao total", () => {
    expect(
      isSplitTotalValid([{ amount: 50 }, { amount: 30 }, { amount: 20 }], 100)
    ).toBe(true);
  });

  it("aceita diferença até 1 centavo (tolerância de arredondamento)", () => {
    expect(
      isSplitTotalValid([{ amount: 33.33 }, { amount: 33.33 }, { amount: 33.34 }], 100)
    ).toBe(true);
    expect(
      isSplitTotalValid([{ amount: 50.005 }, { amount: 50.005 }], 100.01)
    ).toBe(true);
  });

  it("rejeita diferença maior que 1 centavo", () => {
    expect(isSplitTotalValid([{ amount: 50 }, { amount: 30 }], 100)).toBe(false);
    expect(
      isSplitTotalValid([{ amount: 99.97 }, { amount: 0 }], 100)
    ).toBe(false);
  });

  it("trata array vazio como inválido para total > 0", () => {
    expect(isSplitTotalValid([], 100)).toBe(false);
  });

  it("aceita total zero com array vazio", () => {
    expect(isSplitTotalValid([], 0)).toBe(true);
  });
});
