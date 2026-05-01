import { describe, it, expect } from "vitest";
import { cleanCpf, formatCpf, isValidCpf } from "../cpf";

describe("cleanCpf", () => {
  it("remove pontos, hifen e espacos", () => {
    expect(cleanCpf("123.456.789-09")).toBe("12345678909");
    expect(cleanCpf(" 123 456 789 09 ")).toBe("12345678909");
  });

  it("retorna string vazia para entrada vazia", () => {
    expect(cleanCpf("")).toBe("");
  });
});

describe("formatCpf", () => {
  it("aplica mascara completa em CPF de 11 digitos", () => {
    expect(formatCpf("12345678909")).toBe("123.456.789-09");
  });

  it("preserva mascara enquanto o usuario digita", () => {
    expect(formatCpf("123")).toBe("123");
    expect(formatCpf("1234")).toBe("123.4");
    expect(formatCpf("1234567")).toBe("123.456.7");
    expect(formatCpf("123456789")).toBe("123.456.789");
    expect(formatCpf("1234567890")).toBe("123.456.789-0");
  });

  it("ignora caracteres extras alem dos 11 digitos", () => {
    expect(formatCpf("123456789091234")).toBe("123.456.789-09");
  });
});

describe("isValidCpf", () => {
  it("valida CPFs reais", () => {
    expect(isValidCpf("123.456.789-09")).toBe(true);
    expect(isValidCpf("11144477735")).toBe(true);
  });

  it("rejeita CPFs com digitos verificadores invalidos", () => {
    expect(isValidCpf("123.456.789-00")).toBe(false);
    expect(isValidCpf("12345678910")).toBe(false);
  });

  it("rejeita CPFs com todos os digitos iguais", () => {
    expect(isValidCpf("00000000000")).toBe(false);
    expect(isValidCpf("11111111111")).toBe(false);
    expect(isValidCpf("99999999999")).toBe(false);
  });

  it("rejeita CPFs com tamanho errado", () => {
    expect(isValidCpf("")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
    expect(isValidCpf("123456789012")).toBe(false);
  });

  it("aceita CPF com ou sem mascara", () => {
    expect(isValidCpf("11144477735")).toBe(true);
    expect(isValidCpf("111.444.777-35")).toBe(true);
  });
});
