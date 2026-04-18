import { google } from "@ai-sdk/google";
import { generateText, stepCountIs, type ModelMessage } from "ai";
import {
  getDb,
  morpheuAuthorizedUsers,
  morpheuMessages,
  morpheuTenantSettings,
  tenants,
  eq,
  and,
  desc,
} from "@matrix-food/database";
import { loadMorpheuConfig } from "./config";
import { sendText, markAsRead, WhatsAppApiError } from "./whatsapp-client";
import { createMorpheuTools } from "./tools";
import { buildMorpheuSystemPrompt } from "./system-prompt";

const MAX_HISTORY = 20;
const MAX_STEPS = 6;
const MODEL_ID = "gemini-2.5-flash";

/**
 * Processa uma mensagem recebida no webhook do WhatsApp.
 * Resolve o authorized user pelo telefone, roda o Morpheu (Gemini + tools),
 * persiste inbound + resposta e envia via WhatsApp.
 *
 * Erros são registrados em morpheu_messages mas não lançam — o webhook
 * PRECISA retornar 200 rápido pro Meta.
 */
export async function processInboundText(params: {
  fromPhoneE164: string;
  text: string;
  whatsappMessageId: string;
}): Promise<{ handled: boolean; reason?: string }> {
  const { fromPhoneE164, text, whatsappMessageId } = params;
  const db = getDb();

  const config = await loadMorpheuConfig();
  if (!config) return { handled: false, reason: "morpheu_disabled" };

  // Localiza authorized user ativo com esse telefone verificado
  const [authorized] = await db
    .select()
    .from(morpheuAuthorizedUsers)
    .where(
      and(
        eq(morpheuAuthorizedUsers.phoneE164, fromPhoneE164),
        eq(morpheuAuthorizedUsers.active, true),
        eq(morpheuAuthorizedUsers.phoneVerified, true)
      )
    )
    .limit(1);

  if (!authorized) {
    // Loga a tentativa e responde educadamente no WhatsApp
    await db.insert(morpheuMessages).values({
      direction: "INBOUND",
      messageType: "TEXT",
      body: text,
      whatsappMessageId,
      phoneE164: fromPhoneE164,
      status: "RECEIVED",
    });
    try {
      await sendText(
        config,
        fromPhoneE164,
        "Olá! Este número é atendido pelo Morpheu, assistente da Matrix Food. Não encontrei seu acesso — peça ao dono do restaurante pra autorizá-lo."
      );
    } catch {
      // ignora
    }
    return { handled: false, reason: "unknown_sender" };
  }

  // Loga inbound
  const [inboundRow] = await db
    .insert(morpheuMessages)
    .values({
      tenantId: authorized.tenantId,
      authorizedUserId: authorized.id,
      direction: "INBOUND",
      messageType: "TEXT",
      body: text,
      whatsappMessageId,
      phoneE164: fromPhoneE164,
      status: "RECEIVED",
    })
    .returning();

  // Marca como lida (best-effort)
  markAsRead(config, whatsappMessageId).catch(() => {});

  // Carrega tenant + settings pro system prompt
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, authorized.tenantId))
    .limit(1);

  const [settings] = await db
    .select()
    .from(morpheuTenantSettings)
    .where(eq(morpheuTenantSettings.tenantId, authorized.tenantId))
    .limit(1);

  const timezone = settings?.timezone ?? "America/Sao_Paulo";
  const tenantName = tenant?.name ?? "seu restaurante";

  // Histórico recente (últimas N mensagens deste usuário) pra contexto
  const historyRows = await db
    .select({
      direction: morpheuMessages.direction,
      body: morpheuMessages.body,
      createdAt: morpheuMessages.createdAt,
      messageType: morpheuMessages.messageType,
    })
    .from(morpheuMessages)
    .where(
      and(
        eq(morpheuMessages.authorizedUserId, authorized.id),
        eq(morpheuMessages.messageType, "TEXT")
      )
    )
    .orderBy(desc(morpheuMessages.createdAt))
    .limit(MAX_HISTORY);

  // Ordena do mais antigo pro mais novo e descarta o inbound recém-inserido
  const orderedHistory = historyRows
    .reverse()
    .filter((r) => r.body && r.body !== text);

  const history: ModelMessage[] = orderedHistory.map((r) => ({
    role: r.direction === "INBOUND" ? "user" : "assistant",
    content: r.body ?? "",
  }));

  const systemPrompt = buildMorpheuSystemPrompt({
    tenantName,
    userName: null, // TODO: join com tenantUsers pra pegar nome
    userRole: authorized.role,
    timezone,
    customPrompt: config.defaultSystemPrompt,
  });

  const tools = createMorpheuTools(authorized.tenantId);

  let replyText: string;
  try {
    const result = await generateText({
      model: google(MODEL_ID),
      system: systemPrompt,
      messages: [...history, { role: "user", content: text }],
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
    });
    replyText =
      result.text?.trim() ||
      "Consegui processar sua pergunta, mas não tive resposta clara. Pode reformular?";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.error("[morpheu.agent] erro Gemini:", msg);
    replyText =
      "Tive um problema pra processar sua pergunta agora. Tenta de novo em instantes.";
  }

  // Envia resposta e loga outbound
  try {
    const send = await sendText(config, fromPhoneE164, replyText);
    await db.insert(morpheuMessages).values({
      tenantId: authorized.tenantId,
      authorizedUserId: authorized.id,
      direction: "OUTBOUND",
      messageType: "TEXT",
      body: replyText,
      whatsappMessageId: send.whatsappMessageId,
      phoneE164: fromPhoneE164,
      status: "SENT",
    });
  } catch (e) {
    const msg =
      e instanceof WhatsAppApiError
        ? `[${e.code}] ${e.message}`
        : e instanceof Error
          ? e.message
          : String(e);
    await db
      .insert(morpheuMessages)
      .values({
        tenantId: authorized.tenantId,
        authorizedUserId: authorized.id,
        direction: "OUTBOUND",
        messageType: "TEXT",
        body: replyText,
        phoneE164: fromPhoneE164,
        status: "FAILED",
        errorMessage: msg,
      })
      .catch(() => {});
  }

  return { handled: true };
}
