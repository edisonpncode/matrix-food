import type { MorpheuRuntimeConfig } from "./config";
import { toWhatsAppWaId } from "./phone";

/**
 * Cliente mínimo da WhatsApp Cloud API (Graph v21+).
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Todas as funções recebem a config explicitamente pra manter esse módulo
 * sem estado global — útil pra testes e pra permitir múltiplos tenants no futuro.
 */

export interface SendResult {
  whatsappMessageId: string;
  raw: unknown;
}

export class WhatsAppApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public raw?: unknown
  ) {
    super(message);
    this.name = "WhatsAppApiError";
  }
}

function graphUrl(config: MorpheuRuntimeConfig, path: string): string {
  return `https://graph.facebook.com/${config.graphApiVersion}/${path}`;
}

async function postMessage(
  config: MorpheuRuntimeConfig,
  body: Record<string, unknown>
): Promise<SendResult> {
  const url = graphUrl(config, `${config.metaPhoneNumberId}/messages`);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!response.ok) {
    const err = (json?.error as Record<string, unknown>) ?? {};
    throw new WhatsAppApiError(
      response.status,
      String(err.code ?? "unknown_error"),
      String(err.message ?? response.statusText),
      json
    );
  }

  const messages = (json?.messages as Array<{ id: string }> | undefined) ?? [];
  const id = messages[0]?.id ?? "";
  return { whatsappMessageId: id, raw: json };
}

/**
 * Envia texto livre. Só funciona DENTRO da janela de 24h desde a última
 * mensagem recebida do usuário. Fora da janela, use sendTemplate.
 */
export async function sendText(
  config: MorpheuRuntimeConfig,
  phoneE164: string,
  text: string,
  previewUrl = false
): Promise<SendResult> {
  return postMessage(config, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toWhatsAppWaId(phoneE164),
    type: "text",
    text: { body: text, preview_url: previewUrl },
  });
}

/**
 * Envia template aprovado no Meta Business Manager.
 * params = array de strings na ordem dos placeholders {{1}}, {{2}}...
 */
export async function sendTemplate(
  config: MorpheuRuntimeConfig,
  phoneE164: string,
  templateName: string,
  language: string,
  params: string[]
): Promise<SendResult> {
  const components = params.length
    ? [
        {
          type: "body",
          parameters: params.map((p) => ({ type: "text", text: p })),
        },
      ]
    : [];

  return postMessage(config, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toWhatsAppWaId(phoneE164),
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      components,
    },
  });
}

export interface InteractiveListSection {
  title: string;
  rows: Array<{ id: string; title: string; description?: string }>;
}

/**
 * Envia uma Interactive List Message (menu de opções).
 * Usado quando Morpheu precisa pedir clarificação.
 * Limite: 10 rows totais distribuídas entre sections.
 */
export async function sendInteractiveList(
  config: MorpheuRuntimeConfig,
  phoneE164: string,
  opts: {
    bodyText: string;
    buttonText: string;
    sections: InteractiveListSection[];
    headerText?: string;
    footerText?: string;
  }
): Promise<SendResult> {
  const interactive: Record<string, unknown> = {
    type: "list",
    body: { text: opts.bodyText },
    action: { button: opts.buttonText, sections: opts.sections },
  };
  if (opts.headerText) {
    interactive.header = { type: "text", text: opts.headerText };
  }
  if (opts.footerText) {
    interactive.footer = { text: opts.footerText };
  }
  return postMessage(config, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toWhatsAppWaId(phoneE164),
    type: "interactive",
    interactive,
  });
}

/**
 * Marca uma mensagem recebida como lida (envia "✓✓" azul pro usuário).
 */
export async function markAsRead(
  config: MorpheuRuntimeConfig,
  messageId: string
): Promise<void> {
  const url = graphUrl(config, `${config.metaPhoneNumberId}/messages`);
  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
  }).catch(() => {
    // ignora erro — read receipt é best-effort
  });
}

/**
 * Ping simples pra validar credenciais: busca info do phone number.
 */
export async function testConnection(
  config: MorpheuRuntimeConfig
): Promise<{ ok: boolean; displayPhoneNumber?: string; error?: string }> {
  try {
    const url = graphUrl(config, config.metaPhoneNumberId);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });
    const json = (await response.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    if (!response.ok) {
      const err = (json?.error as Record<string, unknown>) ?? {};
      return { ok: false, error: String(err.message ?? response.statusText) };
    }
    return {
      ok: true,
      displayPhoneNumber: String(json?.display_phone_number ?? ""),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
