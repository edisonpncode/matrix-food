/**
 * Normalização e validação de telefone no formato E.164 (padrão WhatsApp).
 * Assume Brasil (+55) como default quando não há código de país.
 */

const BR_COUNTRY_CODE = "55";

/**
 * Converte "(51) 99999-9999", "+55 51 99999-9999", "5551999999999", etc.
 * para o formato E.164 ex: "+5551999999999".
 * Retorna null se não for possível normalizar.
 */
export function normalizePhoneE164(raw: string): string | null {
  if (!raw) return null;
  // remove tudo que não for dígito ou o '+' inicial
  const digits = raw.replace(/[^\d]/g, "");

  if (digits.length === 0) return null;

  // BR sem código: DDD + número (10 fixo, 11 com 9 de celular). Assume BR.
  if (digits.length === 10 || digits.length === 11) {
    return `+${BR_COUNTRY_CODE}${digits}`;
  }

  // Já com código de país BR (12 ou 13 dígitos começando com 55)
  if (digits.length >= 12 && digits.startsWith(BR_COUNTRY_CODE)) {
    return `+${digits}`;
  }

  // Outro país — >= 12 dígitos (código país + número). Rejeita 11 pra não
  // confundir com celular BR sem DDI.
  if (digits.length >= 12) {
    return `+${digits}`;
  }

  return null;
}

/**
 * Valida se um telefone está no formato E.164 esperado (+ seguido de 10-15 dígitos).
 */
export function isValidE164(phone: string): boolean {
  return /^\+\d{10,15}$/.test(phone);
}

/**
 * WhatsApp Cloud API aceita os mesmos dígitos sem o '+'.
 * Esta função devolve somente os dígitos.
 */
export function toWhatsAppWaId(phoneE164: string): string {
  return phoneE164.replace(/^\+/, "");
}

/**
 * Formata pra exibição amigável ex: "+55 (51) 99999-9999".
 */
export function formatPhoneDisplay(phoneE164: string): string {
  const digits = phoneE164.replace(/^\+/, "");
  if (digits.startsWith(BR_COUNTRY_CODE) && digits.length === 13) {
    const ddd = digits.slice(2, 4);
    const part1 = digits.slice(4, 9);
    const part2 = digits.slice(9);
    return `+55 (${ddd}) ${part1}-${part2}`;
  }
  if (digits.startsWith(BR_COUNTRY_CODE) && digits.length === 12) {
    const ddd = digits.slice(2, 4);
    const part1 = digits.slice(4, 8);
    const part2 = digits.slice(8);
    return `+55 (${ddd}) ${part1}-${part2}`;
  }
  return phoneE164;
}
