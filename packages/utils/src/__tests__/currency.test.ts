import { describe, it, expect } from "vitest";
import { formatCurrency, parseCurrency } from "../currency";

describe("formatCurrency", () => {
  it("formata valor inteiro corretamente", () => {
    expect(formatCurrency(39)).toBe("R$\u00a039,00");
  });

  it("formata valor com centavos", () => {
    expect(formatCurrency(39.9)).toBe("R$\u00a039,90");
  });

  it("formata zero", () => {
    expect(formatCurrency(0)).toBe("R$\u00a00,00");
  });

  it("formata valores grandes com separador de milhar", () => {
    const result = formatCurrency(1500.5);
    expect(result).toContain("1.500,50");
  });
});

describe("parseCurrency", () => {
  it("converte string BRL para número", () => {
    expect(parseCurrency("R$ 39,90")).toBe(39.9);
  });

  it("converte string sem símbolo", () => {
    expect(parseCurrency("39,90")).toBe(39.9);
  });

  it("retorna 0 para string inválida", () => {
    expect(parseCurrency("abc")).toBe(0);
  });

  it("converte string com ponto de milhar", () => {
    expect(parseCurrency("1.500,50")).toBe(1500.5);
  });
});
