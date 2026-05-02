/**
 * Helpers para pagamento dividido (split payment) usados no POS.
 * Mantidos isolados para facilitar testes.
 */

/**
 * Arredonda para 2 casas decimais.
 * Soma `Number.EPSILON` antes de multiplicar para corrigir o erro de
 * representação IEEE 754 (ex: 1.005 é armazenado como 1.00499...,
 * que sem o ajuste arredondaria para 1.00 em vez de 1.01).
 */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Divide `total` igualmente entre `n` pessoas.
 * Cada parcela é arredondada para 2 casas decimais; o resíduo (positivo
 * ou negativo) é absorvido pela ÚLTIMA parcela para garantir que a soma
 * seja exatamente `total`.
 *
 * Exemplo: splitEvenly(10, 3) → [3.33, 3.33, 3.34]
 */
export function splitEvenly(total: number, n: number): number[] {
  if (n <= 0) return [];
  if (total < 0) return [];
  const each = round2(total / n);
  const result = Array.from({ length: n }, () => each);
  const sum = round2(each * n);
  const diff = round2(total - sum);
  if (diff !== 0 && result.length > 0) {
    result[result.length - 1] = round2(result[result.length - 1]! + diff);
  }
  return result;
}

/**
 * Verifica se a soma das parcelas bate com o total esperado, com
 * tolerância de R$ 0,01 (centavos de arredondamento).
 */
export function isSplitTotalValid(
  parts: ReadonlyArray<{ amount: number }>,
  expectedTotal: number
): boolean {
  const sum = parts.reduce((s, p) => s + p.amount, 0);
  return Math.abs(round2(sum) - round2(expectedTotal)) <= 0.01;
}
