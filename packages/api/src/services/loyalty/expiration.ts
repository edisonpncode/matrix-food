/**
 * Cálculo de expiração de pontos via FIFO virtual.
 *
 * Idempotente e puro: recebe lista de transações e devolve o que precisa
 * expirar agora + qual será a próxima expiração futura. Não toca em banco.
 *
 * Regra: pontos novos pegam o expiresAt vigente quando creditados (EARNED).
 * Pontos já existentes mantêm o expiresAt original — mudar a config do
 * restaurante não retroage. ADJUSTMENT positivo manual entra com
 * expiresAt = null (nunca expira), pra não punir o cliente em ajustes do admin.
 */

export type LoyaltyTxInput = {
  type: "EARNED" | "REDEEMED" | "EXPIRED" | "ADJUSTMENT";
  points: number;
  expiresAt: Date | null;
  createdAt: Date;
};

type FifoBatch = {
  remaining: number;
  expiresAt: Date | null;
};

export type ExpirationResult = {
  /** Pontos a expirar agora (sempre >= 0). Vira uma transação EXPIRED com -totalToExpire. */
  totalToExpire: number;
  /** Próximo lote a expirar no futuro, pra mostrar pro cliente. */
  nextExpiration: { points: number; date: Date } | null;
  /** Saldo total ainda não expirado nem gasto (soma do que sobrou na fila). */
  remainingBalance: number;
};

/**
 * Algoritmo FIFO: walk through transações em ordem cronológica, consumindo
 * o batch mais antigo primeiro em cada gasto. Após o walk, batches que
 * ainda têm `remaining > 0` AND `expiresAt <= now` são candidatos a expirar.
 */
export function calculateExpiration(
  transactions: LoyaltyTxInput[],
  now: Date
): ExpirationResult {
  const sorted = [...transactions].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  const queue: FifoBatch[] = [];

  for (const tx of sorted) {
    if (tx.points > 0) {
      queue.push({ remaining: tx.points, expiresAt: tx.expiresAt });
    } else if (tx.points < 0) {
      let toConsume = Math.abs(tx.points);
      while (toConsume > 0 && queue.length > 0) {
        const head = queue[0]!;
        if (head.remaining <= toConsume) {
          toConsume -= head.remaining;
          queue.shift();
        } else {
          head.remaining -= toConsume;
          toConsume = 0;
        }
      }
    }
  }

  let totalToExpire = 0;
  let nextExpiration: { points: number; date: Date } | null = null;
  let remainingBalance = 0;

  for (const batch of queue) {
    remainingBalance += batch.remaining;
    if (batch.expiresAt === null) continue;
    if (batch.expiresAt.getTime() <= now.getTime()) {
      totalToExpire += batch.remaining;
    } else if (
      nextExpiration === null ||
      batch.expiresAt.getTime() < nextExpiration.date.getTime()
    ) {
      nextExpiration = { points: batch.remaining, date: batch.expiresAt };
    }
  }

  return { totalToExpire, nextExpiration, remainingBalance };
}
