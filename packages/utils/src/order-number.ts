/**
 * Gera número do pedido formatado.
 * Ex: 42 → "#0042"
 */
export function generateOrderNumber(sequentialNumber: number): string {
  return `#${String(sequentialNumber).padStart(4, "0")}`;
}
