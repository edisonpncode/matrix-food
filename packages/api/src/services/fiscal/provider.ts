import type {
  EmitNfceRequest,
  EmitNfceResponse,
  CancelNfceRequest,
  CancelNfceResponse,
  StatusNfceResponse,
} from "./types";
import { FocusNfeProvider } from "./focus-nfe";

// ============================================
// Interface do Provedor Fiscal
// ============================================

export interface FiscalProvider {
  readonly name: string;
  emitNfce(request: EmitNfceRequest): Promise<EmitNfceResponse>;
  cancelNfce(request: CancelNfceRequest): Promise<CancelNfceResponse>;
  consultNfce(
    chaveAcesso: string,
    ambiente: number
  ): Promise<StatusNfceResponse>;
}

// ============================================
// Tipos de credenciais por provedor
// ============================================

export type FocusNfeCredentials = {
  token: string;
};

export type WebmaniaCredentials = {
  accessToken: string;
  accessTokenSecret: string;
};

export type NuvemFiscalCredentials = {
  clientId: string;
  clientSecret: string;
};

export type SafewebCredentials = {
  token: string;
};

export type ProviderCredentials =
  | { provider: "FOCUS_NFE"; credentials: FocusNfeCredentials }
  | { provider: "WEBMANIA"; credentials: WebmaniaCredentials }
  | { provider: "NUVEM_FISCAL"; credentials: NuvemFiscalCredentials }
  | { provider: "SAFEWEB"; credentials: SafewebCredentials };

// ============================================
// Factory
// ============================================

export function createFiscalProvider(
  config: ProviderCredentials
): FiscalProvider {
  switch (config.provider) {
    case "FOCUS_NFE":
      return new FocusNfeProvider(config.credentials);
    case "WEBMANIA":
      throw new Error(
        "Provedor Webmania ainda não implementado. Use Focus NFe."
      );
    case "NUVEM_FISCAL":
      throw new Error(
        "Provedor Nuvem Fiscal ainda não implementado. Use Focus NFe."
      );
    case "SAFEWEB":
      throw new Error(
        "Provedor SafeWeb ainda não implementado. Use Focus NFe."
      );
    default:
      throw new Error(
        `Provedor fiscal não suportado: ${(config as { provider: string }).provider}`
      );
  }
}
