/**
 * Formata um valor numérico para moeda brasileira (BRL).
 * Ex: 39.90 → "R$ 39,90"
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Converte uma string de moeda brasileira para número.
 * Ex: "R$ 39,90" → 39.90
 */
export function parseCurrency(value: string): number {
  const cleaned = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3})/g, "")
    .replace(",", ".");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}
