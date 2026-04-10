import type { FiscalProvider } from "./provider";
import type { FocusNfeCredentials } from "./provider";
import type {
  EmitNfceRequest,
  EmitNfceResponse,
  CancelNfceRequest,
  CancelNfceResponse,
  StatusNfceResponse,
} from "./types";

const FOCUS_BASE_URL_PROD = "https://api.focusnfe.com.br";
const FOCUS_BASE_URL_HOMOLOG = "https://homologacao.focusnfe.com.br";

function getBaseUrl(ambiente: number): string {
  return ambiente === 1 ? FOCUS_BASE_URL_PROD : FOCUS_BASE_URL_HOMOLOG;
}

function buildAuthHeader(token: string): string {
  return `Basic ${Buffer.from(`${token}:`).toString("base64")}`;
}

export class FocusNfeProvider implements FiscalProvider {
  readonly name = "Focus NFe";
  private token: string;

  constructor(credentials: FocusNfeCredentials) {
    this.token = credentials.token;
  }

  async emitNfce(request: EmitNfceRequest): Promise<EmitNfceResponse> {
    const baseUrl = getBaseUrl(request.ambiente);
    const ref = `nfce-${Date.now()}`;

    const body = this.buildEmissionBody(request);

    try {
      const response = await fetch(`${baseUrl}/v2/nfce?ref=${ref}`, {
        method: "POST",
        headers: {
          Authorization: buildAuthHeader(this.token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as Record<string, unknown>;

      if (
        response.ok &&
        (data.status === "autorizado" || data.status === "processando_autorizacao")
      ) {
        // Se está processando, precisamos consultar depois
        if (data.status === "processando_autorizacao") {
          return {
            success: true,
            chaveAcesso: data.chave_nfe as string | undefined,
            protocolo: data.protocolo as string | undefined,
            numero: request.numero,
            rawResponse: data,
          };
        }

        return {
          success: true,
          chaveAcesso: data.chave_nfe as string | undefined,
          protocolo: data.protocolo as string | undefined,
          numero: request.numero,
          danfeUrl: data.caminho_danfe as string | undefined,
          xmlUrl: data.caminho_xml_nota_fiscal as string | undefined,
          rawResponse: data,
        };
      }

      return {
        success: false,
        errorCode: (data.codigo as string) || String(response.status),
        errorMessage:
          (data.mensagem as string) ||
          (data.erros_validacao
            ? JSON.stringify(data.erros_validacao)
            : "Erro ao emitir NFC-e"),
        rawResponse: data,
      };
    } catch (error) {
      return {
        success: false,
        errorCode: "NETWORK_ERROR",
        errorMessage:
          error instanceof Error ? error.message : "Erro de rede ao conectar com Focus NFe",
        rawResponse: { error: String(error) },
      };
    }
  }

  async cancelNfce(request: CancelNfceRequest): Promise<CancelNfceResponse> {
    const baseUrl = getBaseUrl(request.ambiente);

    try {
      const response = await fetch(
        `${baseUrl}/v2/nfce/${request.chaveAcesso}`,
        {
          method: "DELETE",
          headers: {
            Authorization: buildAuthHeader(this.token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            justificativa: request.justificativa,
          }),
        }
      );

      const data = (await response.json()) as Record<string, unknown>;

      if (response.ok && data.status === "cancelado") {
        return {
          success: true,
          protocolo: data.protocolo as string | undefined,
          rawResponse: data,
        };
      }

      return {
        success: false,
        errorCode: (data.codigo as string) || String(response.status),
        errorMessage:
          (data.mensagem as string) || "Erro ao cancelar NFC-e",
        rawResponse: data,
      };
    } catch (error) {
      return {
        success: false,
        errorCode: "NETWORK_ERROR",
        errorMessage:
          error instanceof Error ? error.message : "Erro de rede",
        rawResponse: { error: String(error) },
      };
    }
  }

  async consultNfce(
    chaveAcesso: string,
    ambiente: number
  ): Promise<StatusNfceResponse> {
    const baseUrl = getBaseUrl(ambiente);

    try {
      const response = await fetch(`${baseUrl}/v2/nfce/${chaveAcesso}`, {
        method: "GET",
        headers: {
          Authorization: buildAuthHeader(this.token),
        },
      });

      const data = (await response.json()) as Record<string, unknown>;

      const statusMap: Record<string, StatusNfceResponse["status"]> = {
        autorizado: "authorized",
        cancelado: "cancelled",
        processando_autorizacao: "processing",
        erro_autorizacao: "rejected",
      };

      return {
        status: statusMap[data.status as string] || "not_found",
        chaveAcesso: data.chave_nfe as string | undefined,
        protocolo: data.protocolo as string | undefined,
        rawResponse: data,
      };
    } catch (error) {
      return {
        status: "not_found",
        rawResponse: { error: String(error) },
      };
    }
  }

  private buildEmissionBody(request: EmitNfceRequest): Record<string, unknown> {
    const { emitter, recipient, items, payments } = request;

    return {
      natureza_operacao: "VENDA AO CONSUMIDOR",
      tipo_documento: 1, // NFC-e
      finalidade_emissao: 1, // Normal
      consumidor_final: 1,
      presenca_comprador: 1, // Presencial
      informacoes_adicionais_contribuinte:
        "Documento emitido por ME ou EPP optante pelo Simples Nacional",

      cnpj_emitente: emitter.cnpj.replace(/\D/g, ""),
      nome_emitente: emitter.razaoSocial,
      nome_fantasia_emitente: emitter.nomeFantasia || emitter.razaoSocial,
      inscricao_estadual_emitente: emitter.inscricaoEstadual?.replace(
        /\D/g,
        ""
      ),
      regime_tributario_emitente: emitter.regimeTributario,

      logradouro_emitente: emitter.endereco.logradouro,
      numero_emitente: emitter.endereco.numero,
      bairro_emitente: emitter.endereco.bairro,
      codigo_municipio_emitente: emitter.endereco.codigoMunicipio,
      municipio_emitente: emitter.endereco.municipio,
      uf_emitente: emitter.endereco.uf,
      cep_emitente: emitter.endereco.cep.replace(/\D/g, ""),

      // Consumidor (opcional para NFC-e)
      ...(recipient.cpf
        ? {
            cpf_destinatario: recipient.cpf.replace(/\D/g, ""),
            nome_destinatario: recipient.name || "CONSUMIDOR",
          }
        : {}),

      items: items.map((item, i) => ({
        numero_item: i + 1,
        codigo_produto: String(i + 1),
        descricao: item.description,
        codigo_ncm: item.ncm,
        cfop: item.cfop,
        unidade_comercial: "UN",
        quantidade_comercial: item.quantity,
        valor_unitario_comercial: item.unitPrice.toFixed(2),
        valor_bruto: item.totalPrice.toFixed(2),
        unidade_tributavel: "UN",
        quantidade_tributavel: item.quantity,
        valor_unitario_tributavel: item.unitPrice.toFixed(2),
        origem: 0, // Nacional
        icms_situacao_tributaria: item.csosn,
        // PIS e COFINS zerados para SN
        pis_situacao_tributaria: "49",
        cofins_situacao_tributaria: "49",
      })),

      formas_pagamento: payments.map((p) => ({
        forma_pagamento: p.method,
        valor_pagamento: p.amount.toFixed(2),
        ...(p.change && p.change > 0
          ? { troco: p.change.toFixed(2) }
          : {}),
      })),

      valor_desconto: request.discount > 0 ? request.discount.toFixed(2) : undefined,
    };
  }
}
