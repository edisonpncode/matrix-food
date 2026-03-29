/**
 * Formata numero de telefone brasileiro progressivamente.
 * (11) 99999-9999 para celular / (11) 9999-9999 para fixo
 */
export function formatBrazilianPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 2) {
    return digits.length > 0 ? `(${digits}` : "";
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Remove formatacao, retornando apenas digitos.
 */
export function stripPhone(value: string): string {
  return value.replace(/\D/g, "");
}
