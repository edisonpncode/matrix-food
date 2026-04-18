import { describe, it, expect } from "vitest";
import {
  MORPHEU_TEMPLATES,
  buildTemplateParams,
} from "../services/morpheu/templates";
import { isInsideWindow } from "../services/morpheu/events";

describe("buildTemplateParams", () => {
  it("monta parâmetros na ordem declarada", () => {
    const out = buildTemplateParams("morpheu_cash_open", {
      tenantName: "Bar do Zé",
      cashierName: "Edison",
      initialAmount: "100,00",
    });
    expect(out).toEqual(["Bar do Zé", "Edison", "100,00"]);
  });

  it("lança se placeholder faltar", () => {
    expect(() =>
      buildTemplateParams("morpheu_cash_open", {
        tenantName: "X",
        cashierName: "Y",
      })
    ).toThrow(/initialAmount/);
  });

  it("converte tudo pra string", () => {
    const out = buildTemplateParams("morpheu_daily_summary", {
      dateLabel: "17/04",
      totalRevenue: "1.234,00",
      ordersCount: "42",
      weekdayLabel: "sexta",
      variationLabel: "+5.0%",
      topCategoryOrProduct: "Pizza",
    });
    out.forEach((v) => expect(typeof v).toBe("string"));
  });

  it("todos os templates declaram placeholders", () => {
    for (const [name, spec] of Object.entries(MORPHEU_TEMPLATES)) {
      expect(spec.placeholders.length).toBeGreaterThan(0);
      // o nome técnico bate com a chave do map
      expect(spec.name).toBe(name);
    }
  });
});

describe("isInsideWindow", () => {
  it("janela normal 08:00-18:00", () => {
    expect(isInsideWindow("09:00", "08:00", "18:00")).toBe(true);
    expect(isInsideWindow("08:00", "08:00", "18:00")).toBe(true);
    expect(isInsideWindow("18:00", "08:00", "18:00")).toBe(false); // exclusive no fim
    expect(isInsideWindow("07:59", "08:00", "18:00")).toBe(false);
  });

  it("janela cruzando meia-noite 22:00-07:00", () => {
    expect(isInsideWindow("23:30", "22:00", "07:00")).toBe(true);
    expect(isInsideWindow("06:59", "22:00", "07:00")).toBe(true);
    expect(isInsideWindow("07:00", "22:00", "07:00")).toBe(false);
    expect(isInsideWindow("12:00", "22:00", "07:00")).toBe(false);
  });

  it("janela inválida start==end", () => {
    expect(isInsideWindow("00:00", "00:00", "00:00")).toBe(false);
  });
});
