// ============================================
// Tipos compartilhados para integração fiscal
// ============================================

export interface FiscalEmitter {
  cnpj: string;
  inscricaoEstadual?: string;
  razaoSocial: string;
  nomeFantasia?: string;
  regimeTributario: number;
  endereco: {
    logradouro: string;
    numero: string;
    bairro: string;
    codigoMunicipio: string;
    municipio: string;
    uf: string;
    cep: string;
  };
}

export interface FiscalRecipient {
  cpf?: string;
  name?: string;
}

export interface FiscalItem {
  description: string;
  ncm: string;
  cfop: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  csosn: string;
}

export interface FiscalPayment {
  /** Código NFC-e: 01=Dinheiro, 03=Crédito, 04=Débito, 17=PIX */
  method: string;
  amount: number;
  change?: number;
}

export interface EmitNfceRequest {
  emitter: FiscalEmitter;
  recipient: FiscalRecipient;
  items: FiscalItem[];
  payments: FiscalPayment[];
  totalAmount: number;
  discount: number;
  numero: number;
  serie: number;
  ambiente: number;
  cscId: string;
  csc: string;
}

export interface EmitNfceResponse {
  success: boolean;
  chaveAcesso?: string;
  protocolo?: string;
  numero?: number;
  danfeUrl?: string;
  xmlUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  rawResponse: Record<string, unknown>;
}

export interface CancelNfceRequest {
  chaveAcesso: string;
  protocolo: string;
  justificativa: string;
  ambiente: number;
}

export interface CancelNfceResponse {
  success: boolean;
  protocolo?: string;
  errorCode?: string;
  errorMessage?: string;
  rawResponse: Record<string, unknown>;
}

export interface StatusNfceResponse {
  status:
    | "authorized"
    | "cancelled"
    | "processing"
    | "rejected"
    | "not_found";
  chaveAcesso?: string;
  protocolo?: string;
  rawResponse: Record<string, unknown>;
}

/**
 * Mapeia paymentMethod do sistema para código NFC-e (tPag)
 */
export const PAYMENT_METHOD_MAP: Record<string, string> = {
  CASH: "01",
  CREDIT_CARD: "03",
  DEBIT_CARD: "04",
  PIX: "17",
};
