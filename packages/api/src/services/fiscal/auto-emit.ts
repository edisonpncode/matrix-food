import {
  eq,
  and,
  getDb,
  fiscalConfigs,
  fiscalDocuments,
  orders,
} from "@matrix-food/database";
import { createFiscalProvider } from "./provider";
import type { ProviderCredentials } from "./provider";
import { decrypt } from "./encryption";
import { PAYMENT_METHOD_MAP } from "./types";
import type { EmitNfceRequest, FiscalItem, FiscalPayment } from "./types";

/**
 * Tenta emitir NFC-e automaticamente para um pedido.
 * Fire-and-forget: nunca lança exceção, nunca bloqueia o pedido.
 */
export async function tryAutoEmitNfce(
  tenantId: string,
  orderId: string
): Promise<void> {
  try {
    const db = getDb();

    // 1. Verificar se o tenant tem config fiscal ativa com modo AUTOMATIC
    const config = await db.query.fiscalConfigs.findFirst({
      where: and(
        eq(fiscalConfigs.tenantId, tenantId),
        eq(fiscalConfigs.isActive, true)
      ),
    });

    if (!config || config.emissionMode !== "AUTOMATIC") return;

    // 2. Verificar se já existe documento fiscal autorizado para este pedido
    const existingDoc = await db.query.fiscalDocuments.findFirst({
      where: and(
        eq(fiscalDocuments.orderId, orderId),
        eq(fiscalDocuments.status, "AUTHORIZED")
      ),
    });

    if (existingDoc) return;

    // 3. Buscar dados do pedido
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { items: true },
    });

    if (!order || order.paymentStatus !== "PAID") return;

    // 4. Montar request
    const credentials = JSON.parse(
      decrypt(config.encryptedCredentials)
    ) as ProviderCredentials["credentials"];

    const csc = config.encryptedCsc ? decrypt(config.encryptedCsc) : "";

    const fiscalItems: FiscalItem[] = (order.items || []).map((item) => ({
      description: item.productName,
      ncm: config.defaultNcm,
      cfop: config.defaultCfop,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
      csosn: config.defaultCsosn,
    }));

    const fiscalPayments: FiscalPayment[] = [
      {
        method: PAYMENT_METHOD_MAP[order.paymentMethod] || "99",
        amount: Number(order.total),
      },
    ];

    const emitRequest: EmitNfceRequest = {
      emitter: {
        cnpj: config.cnpj,
        inscricaoEstadual: config.inscricaoEstadual || undefined,
        razaoSocial: config.razaoSocial,
        nomeFantasia: config.nomeFantasia || undefined,
        regimeTributario: config.regimeTributario,
        endereco: {
          logradouro: config.logradouro || "",
          numero: config.numeroEndereco || "",
          bairro: config.bairro || "",
          codigoMunicipio: config.codigoMunicipio || "",
          municipio: config.municipio || "",
          uf: config.uf || "",
          cep: config.cep || "",
        },
      },
      recipient: {},
      items: fiscalItems,
      payments: fiscalPayments,
      totalAmount: Number(order.total),
      discount: Number(order.discount || 0),
      numero: config.proximoNumeroNfce,
      serie: config.serieNfce,
      ambiente: config.ambiente,
      cscId: config.cscId || "",
      csc,
    };

    // 5. Inserir documento pendente
    const [doc] = await db
      .insert(fiscalDocuments)
      .values({
        tenantId,
        orderId,
        status: "PROCESSING",
        provider: config.provider,
        numeroNfce: config.proximoNumeroNfce,
        serieNfce: config.serieNfce,
        lastAttemptAt: new Date(),
      })
      .returning();

    if (!doc) return;

    // 6. Emitir via provedor
    const provider = createFiscalProvider({
      provider: config.provider,
      credentials,
    } as ProviderCredentials);

    const result = await provider.emitNfce(emitRequest);

    // 7. Atualizar documento com resultado
    if (result.success) {
      await db
        .update(fiscalDocuments)
        .set({
          status: "AUTHORIZED",
          chaveAcesso: result.chaveAcesso,
          protocolo: result.protocolo,
          danfeUrl: result.danfeUrl,
          xmlUrl: result.xmlUrl,
          providerResponse: result.rawResponse,
        })
        .where(eq(fiscalDocuments.id, doc.id));

      // Incrementar número da NFC-e
      await db
        .update(fiscalConfigs)
        .set({ proximoNumeroNfce: config.proximoNumeroNfce + 1 })
        .where(eq(fiscalConfigs.id, config.id));
    } else {
      await db
        .update(fiscalDocuments)
        .set({
          status: "ERROR",
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
          retryCount: 1,
          nextRetryAt: new Date(Date.now() + 60_000), // retry em 1 min
          providerResponse: result.rawResponse,
        })
        .where(eq(fiscalDocuments.id, doc.id));
    }
  } catch {
    // Silencioso: nunca bloqueia o pedido
    console.error(
      `[fiscal] Erro ao emitir NFC-e automaticamente para pedido ${orderId}`
    );
  }
}
