import { describe, it, expect } from "vitest";
import { isRestaurantOpen, getNextOpenTime } from "../operating-hours";

const sampleHours = {
  sunday: { open: "18:00", close: "23:00", isOpen: true },
  monday: { open: "18:00", close: "23:00", isOpen: true },
  tuesday: { open: "18:00", close: "23:00", isOpen: false },
  wednesday: { open: "18:00", close: "23:00", isOpen: true },
  thursday: { open: "18:00", close: "23:00", isOpen: true },
  friday: { open: "18:00", close: "23:59", isOpen: true },
  saturday: { open: "11:00", close: "23:59", isOpen: true },
};

describe("isRestaurantOpen", () => {
  it("retorna true quando está dentro do horário", () => {
    // Sexta-feira (5) às 20:00
    const friday8pm = new Date("2026-03-13T20:00:00");
    expect(isRestaurantOpen(sampleHours, friday8pm)).toBe(true);
  });

  it("retorna false quando está fora do horário", () => {
    // Sexta-feira (5) às 10:00
    const friday10am = new Date("2026-03-13T10:00:00");
    expect(isRestaurantOpen(sampleHours, friday10am)).toBe(false);
  });

  it("retorna false quando o dia está desativado", () => {
    // Terça-feira (2) às 20:00 - isOpen: false
    const tuesday8pm = new Date("2026-03-10T20:00:00");
    expect(isRestaurantOpen(sampleHours, tuesday8pm)).toBe(false);
  });

  it("retorna false quando operatingHours é null", () => {
    expect(isRestaurantOpen(null)).toBe(false);
  });
});

describe("getNextOpenTime", () => {
  it("retorna horário de abertura de hoje se ainda não abriu", () => {
    // Sexta-feira (5) às 10:00 - abre às 18:00
    const friday10am = new Date("2026-03-13T10:00:00");
    const result = getNextOpenTime(sampleHours, friday10am);
    expect(result).toBe("Abre hoje às 18:00");
  });

  it("retorna null quando não há horários configurados", () => {
    expect(getNextOpenTime(null)).toBeNull();
  });
});
