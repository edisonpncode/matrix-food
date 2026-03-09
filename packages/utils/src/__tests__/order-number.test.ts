import { describe, it, expect } from "vitest";
import { generateOrderNumber } from "../order-number";

describe("generateOrderNumber", () => {
  it("formata número com zeros à esquerda", () => {
    expect(generateOrderNumber(1)).toBe("#0001");
    expect(generateOrderNumber(42)).toBe("#0042");
    expect(generateOrderNumber(999)).toBe("#0999");
  });

  it("não trunca números grandes", () => {
    expect(generateOrderNumber(10000)).toBe("#10000");
  });
});
