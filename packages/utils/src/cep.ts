/**
 * Busca dados de endereço a partir de um CEP usando a API gratuita ViaCEP.
 * Não requer chave; rate-limit prático ~1 req/segundo.
 *
 * Aceita CEP com ou sem máscara (ex: "01310-100" ou "01310100").
 * Retorna `null` se o CEP for inválido ou não encontrado.
 */
export interface ViaCepAddress {
  zipCode: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | string;
}

export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export async function fetchAddressByCep(
  cep: string
): Promise<ViaCepAddress | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const data = (await res.json()) as ViaCepResponse;
    if (data.erro) return null;

    return {
      zipCode: formatCep(digits),
      street: data.logradouro ?? "",
      neighborhood: data.bairro ?? "",
      city: data.localidade ?? "",
      state: data.uf ?? "",
    };
  } catch {
    return null;
  }
}
