/**
 * Webhook WhatsApp Cloud API (Meta).
 *
 * - GET: handshake do Meta (`hub.mode=subscribe` + `hub.verify_token` + `hub.challenge`).
 * - POST: notificações de mensagens/status. Valida assinatura HMAC, dedupe por
 *   event id, processa INBOUND (text) via agente Morpheu e atualiza status de
 *   mensagens OUTBOUND previamente enviadas.
 *
 * Este endpoint **precisa responder 200 rápido** pro Meta — qualquer trabalho
 * custoso é fire-and-forget. Erros do agente são logados em morpheu_messages.
 */
import { NextResponse } from "next/server";
import {
  getDb,
  morpheuWebhookEvents,
  morpheuMessages,
  eq,
} from "@matrix-food/database";
import {
  loadMorpheuConfig,
  verifyMetaSignature,
  processInboundText,
  normalizePhoneE164,
} from "@matrix-food/api/services/morpheu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Não dá pra deixar mais curto que 60s se o agente Gemini decidir raciocinar —
// mas retornamos 200 cedo, então 60s é folga.
export const maxDuration = 60;

// ---------- GET: handshake de verificação ----------

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token || !challenge) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  const config = await loadMorpheuConfig().catch(() => null);
  if (!config) {
    // eslint-disable-next-line no-console
    console.warn("[morpheu.webhook.GET] config não carregada — handshake rejeitado");
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (token !== config.webhookVerifyToken) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Meta exige devolver o challenge como texto puro
  return new NextResponse(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

// ---------- POST: eventos do Meta ----------

/**
 * Estrutura simplificada do payload do webhook WhatsApp.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
 */
interface MetaWebhookPayload {
  object?: string;
  entry?: Array<{
    id: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
        contacts?: Array<{
          wa_id?: string;
          profile?: { name?: string };
        }>;
        messages?: Array<{
          id: string;
          from?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
          button?: { text?: string; payload?: string };
          interactive?: {
            button_reply?: { id?: string; title?: string };
            list_reply?: { id?: string; title?: string; description?: string };
          };
        }>;
        statuses?: Array<{
          id: string; // wamid da mensagem OUTBOUND
          status?: "sent" | "delivered" | "read" | "failed";
          timestamp?: string;
          recipient_id?: string;
          errors?: Array<{ code?: number; title?: string; message?: string }>;
        }>;
      };
    }>;
  }>;
}

export async function POST(req: Request) {
  // --- lê raw body pra verificar HMAC antes de parsear JSON
  const raw = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  const config = await loadMorpheuConfig().catch(() => null);
  if (!config) {
    // eslint-disable-next-line no-console
    console.warn("[morpheu.webhook.POST] config não carregada — 200 noop");
    // 200 pra não ficar reentregando — sem config, não há o que fazer
    return NextResponse.json({ received: true, skipped: "no_config" });
  }

  if (!verifyMetaSignature(raw, signature, config.webhookSecret)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }

  // Resposta rápida pro Meta — processa em background
  void processPayload(payload).catch((e) => {
    // eslint-disable-next-line no-console
    console.error("[morpheu.webhook] erro processando payload:", e);
  });

  return NextResponse.json({ received: true });
}

/**
 * Processa cada mensagem/status do payload.
 * Fire-and-forget pelo handler POST — nenhuma exceção aqui pode derrubar o 200.
 */
async function processPayload(payload: MetaWebhookPayload): Promise<void> {
  if (payload.object !== "whatsapp_business_account") return;
  const entries = payload.entry ?? [];
  const db = getDb();

  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;

      // --- Inbound messages ---
      for (const msg of value.messages ?? []) {
        if (!msg.id) continue;
        const eventId = `msg:${msg.id}`;

        // Idempotência: se já processamos esse id, pula
        const alreadySeen = await db
          .select({ id: morpheuWebhookEvents.id })
          .from(morpheuWebhookEvents)
          .where(eq(morpheuWebhookEvents.metaEventId, eventId))
          .limit(1);
        if (alreadySeen.length > 0) continue;

        try {
          await db.insert(morpheuWebhookEvents).values({
            metaEventId: eventId,
            payload: msg as unknown as Record<string, unknown>,
          });
        } catch {
          // Corrida: outro worker inseriu entre o SELECT e o INSERT. Pula.
          continue;
        }

        const fromPhone = msg.from ? normalizePhoneE164(msg.from) : null;
        if (!fromPhone) continue;

        // Extrai o texto conforme o tipo
        let text: string | null = null;
        if (msg.type === "text") {
          text = msg.text?.body ?? null;
        } else if (msg.type === "button") {
          text = msg.button?.text ?? msg.button?.payload ?? null;
        } else if (msg.type === "interactive") {
          text =
            msg.interactive?.button_reply?.title ??
            msg.interactive?.list_reply?.title ??
            null;
        }

        if (!text) {
          // Tipos não suportados no MVP (audio, image, sticker…). Loga e ignora.
          try {
            await db.insert(morpheuMessages).values({
              direction: "INBOUND",
              messageType: "INTERACTIVE",
              phoneE164: fromPhone,
              whatsappMessageId: msg.id,
              status: "RECEIVED",
              body: `[tipo não suportado: ${msg.type ?? "desconhecido"}]`,
              rawPayload: msg as unknown as Record<string, unknown>,
            });
          } catch {
            // ignora
          }
          continue;
        }

        await processInboundText({
          fromPhoneE164: fromPhone,
          text,
          whatsappMessageId: msg.id,
        }).catch((e) => {
          // eslint-disable-next-line no-console
          console.error("[morpheu.webhook] processInboundText falhou:", e);
        });
      }

      // --- Status updates (sent/delivered/read/failed) ---
      for (const st of value.statuses ?? []) {
        if (!st.id || !st.status) continue;
        const eventId = `status:${st.id}:${st.status}`;

        // Idempotência dos status também — Meta pode reentregar
        const seen = await db
          .select({ id: morpheuWebhookEvents.id })
          .from(morpheuWebhookEvents)
          .where(eq(morpheuWebhookEvents.metaEventId, eventId))
          .limit(1);
        if (seen.length > 0) continue;
        try {
          await db.insert(morpheuWebhookEvents).values({
            metaEventId: eventId,
            payload: st as unknown as Record<string, unknown>,
          });
        } catch {
          continue;
        }

        const mappedStatus =
          st.status === "sent"
            ? "SENT"
            : st.status === "delivered"
              ? "DELIVERED"
              : st.status === "read"
                ? "READ"
                : st.status === "failed"
                  ? "FAILED"
                  : null;
        if (!mappedStatus) continue;

        const errorSummary =
          st.errors && st.errors.length > 0
            ? `[${st.errors[0]?.code ?? "?"}] ${
                st.errors[0]?.title ?? st.errors[0]?.message ?? "erro desconhecido"
              }`
            : null;

        try {
          await db
            .update(morpheuMessages)
            .set({
              status: mappedStatus,
              errorMessage: errorSummary,
            })
            .where(eq(morpheuMessages.whatsappMessageId, st.id));
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("[morpheu.webhook] update status falhou:", e);
        }
      }
    }
  }
}
