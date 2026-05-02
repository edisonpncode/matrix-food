import { describe, it, expect } from "vitest";
import {
  calculateExpiration,
  type LoyaltyTxInput,
} from "../services/loyalty/expiration";

const NOW = new Date("2026-06-01T12:00:00Z");

function days(n: number): number {
  return n * 24 * 60 * 60 * 1000;
}

function earned(
  points: number,
  createdOffsetDays: number,
  expiresOffsetDays: number | null
): LoyaltyTxInput {
  return {
    type: "EARNED",
    points,
    createdAt: new Date(NOW.getTime() + createdOffsetDays * days(1)),
    expiresAt:
      expiresOffsetDays === null
        ? null
        : new Date(NOW.getTime() + expiresOffsetDays * days(1)),
  };
}

function redeemed(points: number, createdOffsetDays: number): LoyaltyTxInput {
  return {
    type: "REDEEMED",
    points: -Math.abs(points),
    createdAt: new Date(NOW.getTime() + createdOffsetDays * days(1)),
    expiresAt: null,
  };
}

function expired(points: number, createdOffsetDays: number): LoyaltyTxInput {
  return {
    type: "EXPIRED",
    points: -Math.abs(points),
    createdAt: new Date(NOW.getTime() + createdOffsetDays * days(1)),
    expiresAt: null,
  };
}

describe("calculateExpiration — FIFO", () => {
  it("retorna zero pra cliente sem transações", () => {
    const result = calculateExpiration([], NOW);
    expect(result).toEqual({
      totalToExpire: 0,
      nextExpiration: null,
      remainingBalance: 0,
    });
  });

  it("expira tudo quando há 1 EARNED já vencido sem resgate", () => {
    const result = calculateExpiration([earned(100, -100, -10)], NOW);
    expect(result.totalToExpire).toBe(100);
    expect(result.remainingBalance).toBe(100);
    expect(result.nextExpiration).toBeNull();
  });

  it("não expira quando o EARNED ainda está no prazo", () => {
    const result = calculateExpiration([earned(50, -10, 30)], NOW);
    expect(result.totalToExpire).toBe(0);
    expect(result.nextExpiration?.points).toBe(50);
  });

  it("FIFO consome do batch mais antigo primeiro", () => {
    // 100 antigos (já vencidos) + 50 novos (no prazo) - 60 resgatados depois.
    // FIFO: resgate consome 60 dos 100 antigos → sobram 40 antigos vencidos
    // (expirar) + 50 novos (não expirar).
    const result = calculateExpiration(
      [earned(100, -100, -10), earned(50, -5, 30), redeemed(60, -3)],
      NOW
    );
    expect(result.totalToExpire).toBe(40);
    expect(result.remainingBalance).toBe(90); // 40 + 50
    expect(result.nextExpiration?.points).toBe(50);
  });

  it("resgate maior que o primeiro batch atravessa pra fila seguinte", () => {
    // 30 antigos vencidos + 100 novos no prazo - 50 resgatados.
    // FIFO consome todos os 30 antigos + 20 dos novos. Sobram 80 novos no prazo.
    const result = calculateExpiration(
      [earned(30, -100, -10), earned(100, -5, 30), redeemed(50, -3)],
      NOW
    );
    expect(result.totalToExpire).toBe(0);
    expect(result.remainingBalance).toBe(80);
    expect(result.nextExpiration?.points).toBe(80);
  });

  it("ADJUSTMENT positivo é tratado como nunca-expira (expiresAt null)", () => {
    const result = calculateExpiration(
      [
        earned(50, -100, -10),
        {
          type: "ADJUSTMENT",
          points: 30,
          createdAt: new Date(NOW.getTime() - days(50)),
          expiresAt: null,
        },
      ],
      NOW
    );
    expect(result.totalToExpire).toBe(50);
    expect(result.remainingBalance).toBe(80);
    expect(result.nextExpiration).toBeNull();
  });

  it("idempotência: rodar novamente após EXPIRED gravado não duplica", () => {
    // Cenário: cron rodou ontem e gravou EXPIRED de 40 pontos.
    // Rodar de novo hoje deve dar totalToExpire = 0.
    const result = calculateExpiration(
      [
        earned(100, -100, -10),
        earned(50, -5, 30),
        redeemed(60, -3),
        expired(40, -1), // já foi expirado no cron de ontem
      ],
      NOW
    );
    expect(result.totalToExpire).toBe(0);
    expect(result.remainingBalance).toBe(50);
    expect(result.nextExpiration?.points).toBe(50);
  });

  it("nextExpiration retorna o lote que vence primeiro entre vários no prazo", () => {
    const result = calculateExpiration(
      [earned(20, -10, 60), earned(30, -5, 15), earned(40, -1, 90)],
      NOW
    );
    expect(result.totalToExpire).toBe(0);
    expect(result.nextExpiration?.points).toBe(30);
    expect(result.nextExpiration?.date.getTime()).toBe(
      NOW.getTime() + days(15)
    );
  });

  it("EARNED com expiresAt null nunca entra em totalToExpire nem nextExpiration", () => {
    const result = calculateExpiration([earned(100, -100, null)], NOW);
    expect(result.totalToExpire).toBe(0);
    expect(result.remainingBalance).toBe(100);
    expect(result.nextExpiration).toBeNull();
  });

  it("ordena por createdAt mesmo se input vier fora de ordem", () => {
    const result = calculateExpiration(
      [
        // Input em ordem aleatória — service deve sortar internamente
        redeemed(60, -3),
        earned(50, -5, 30),
        earned(100, -100, -10),
      ],
      NOW
    );
    expect(result.totalToExpire).toBe(40);
    expect(result.remainingBalance).toBe(90);
  });
});
