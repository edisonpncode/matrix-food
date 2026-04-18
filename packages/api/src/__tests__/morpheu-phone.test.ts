import { describe, it, expect } from "vitest";
import {
  normalizePhoneE164,
  isValidE164,
  toWhatsAppWaId,
  formatPhoneDisplay,
} from "../services/morpheu/phone";

describe("normalizePhoneE164", () => {
  it("normaliza máscara BR comum", () => {
    expect(normalizePhoneE164("(51) 99999-9999")).toBe("+5551999999999");
  });
  it("normaliza com + e espaços", () => {
    expect(normalizePhoneE164("+55 51 99999-9999")).toBe("+5551999999999");
  });
  it("já normalizado", () => {
    expect(normalizePhoneE164("5551999999999")).toBe("+5551999999999");
  });
  it("DDD sem 9 (10 dígitos)", () => {
    expect(normalizePhoneE164("5133334444")).toBe("+555133334444");
  });
  it("retorna null pra entrada vazia", () => {
    expect(normalizePhoneE164("")).toBeNull();
  });
  it("retorna null pra entrada curta", () => {
    expect(normalizePhoneE164("12345")).toBeNull();
  });
  it("aceita número internacional com DDI", () => {
    // 12+ dígitos sem prefixo BR cai no branch de outro país
    expect(normalizePhoneE164("+442071838750")).toBe("+442071838750");
  });
});

describe("isValidE164", () => {
  it("aceita E.164 válido", () => {
    expect(isValidE164("+5551999999999")).toBe(true);
  });
  it("rejeita sem +", () => {
    expect(isValidE164("5551999999999")).toBe(false);
  });
  it("rejeita muito curto", () => {
    expect(isValidE164("+123")).toBe(false);
  });
  it("rejeita com letras", () => {
    expect(isValidE164("+5551abcdefghi")).toBe(false);
  });
});

describe("toWhatsAppWaId", () => {
  it("tira o + inicial", () => {
    expect(toWhatsAppWaId("+5551999999999")).toBe("5551999999999");
  });
});

describe("formatPhoneDisplay", () => {
  it("formata BR 11 dígitos (com 9)", () => {
    expect(formatPhoneDisplay("+5551999999999")).toBe("+55 (51) 99999-9999");
  });
  it("formata BR 10 dígitos (fixo)", () => {
    expect(formatPhoneDisplay("+555133334444")).toBe("+55 (51) 3333-4444");
  });
  it("retorna original pra outros formatos", () => {
    expect(formatPhoneDisplay("+442071838750")).toBe("+442071838750");
  });
});
