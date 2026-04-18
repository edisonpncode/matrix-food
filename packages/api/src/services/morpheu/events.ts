import {
  getDb,
  morpheuTenantSettings,
  morpheuAuthorizedUsers,
  morpheuMessages,
  tenants,
  eq,
  and,
} from "@matrix-food/database";
import { loadMorpheuConfig } from "./config";
import { sendTemplate, WhatsAppApiError } from "./whatsapp-client";
import {
  buildTemplateParams,
  type MorpheuTemplateName,
} from "./templates";

/**
 * Tipos de eventos que o Morpheu notifica.
 * Mapeia 1-para-1 com um template WhatsApp.
 */
export type MorpheuEventType =
  | "CASH_OPEN"
  | "CASH_DEPOSIT"
  | "CASH_WITHDRAW"
  | "CASH_CLOSE"
  | "ORDER_CANCEL"
  | "DAILY_SUMMARY"
  | "ANOMALY_ALERT";

const EVENT_TO_TEMPLATE: Record<MorpheuEventType, MorpheuTemplateName> = {
  CASH_OPEN: "morpheu_cash_open",
  CASH_DEPOSIT: "morpheu_cash_deposit",
  CASH_WITHDRAW: "morpheu_cash_withdraw",
  CASH_CLOSE: "morpheu_cash_close",
  ORDER_CANCEL: "morpheu_order_cancel",
  DAILY_SUMMARY: "morpheu_daily_summary",
  ANOMALY_ALERT: "morpheu_anomaly_alert",
};

const EVENT_TO_TOGGLE: Record<MorpheuEventType, keyof typeof morpheuTenantSettings._.columns | null> = {
  CASH_OPEN: "notifyCashOpen",
  CASH_DEPOSIT: "notifyCashDeposit",
  CASH_WITHDRAW: "notifyCashWithdraw",
  CASH_CLOSE: "notifyCashClose",
  ORDER_CANCEL: "notifyOrderCancel",
  DAILY_SUMMARY: "notifyDailySummary",
  ANOMALY_ALERT: "notifyAnomalyAlerts",
};

/**
 * Retorna HH:mm atual no timezone pedido.
 */
function currentHHmm(timezone: string): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h}:${m}`;
}

/**
 * Verifica se o "agora" (timezone) está dentro do intervalo [start, end].
 * Suporta janelas que cruzam meia-noite (ex: 22:00 → 07:00).
 */
export function isInsideWindow(
  nowHHmm: string,
  start: string,
  end: string
): boolean {
  if (start === end) return false;
  if (start < end) return nowHHmm >= start && nowHHmm < end;
  // cruza meia-noite
  return nowHHmm >= start || nowHHmm < end;
}

export interface MorpheuEventPayload {
  CASH_OPEN: {
    tenantName: string;
    cashierName: string;
    initialAmount: string;
  };
  CASH_DEPOSIT: {
    tenantName: string;
    cashierName: string;
    amount: string;
    description: string;
  };
  CASH_WITHDRAW: {
    tenantName: string;
    cashierName: string;
    amount: string;
    description: string;
  };
  CASH_CLOSE: {
    tenantName: string;
    cashierName: string;
    totalSold: string;
    totalInCash: string;
    cashRegisterId: string;
    detailMessage?: string; // texto livre enviado na sequência dentro da janela 24h
  };
  ORDER_CANCEL: {
    tenantName: string;
    orderNumber: string;
    customerName: string;
    total: string;
    reason: string;
  };
  DAILY_SUMMARY: {
    userName: string;
    dateLabel: string;
    totalRevenue: string;
    ordersCount: string;
    weekdayLabel: string;
    variationLabel: string;
    topCategoryOrProduct: string;
  };
  ANOMALY_ALERT: {
    userName: string;
    variationPercent: string;
    revenueToday: string;
  };
}

/**
 * Dispara uma notificação para todos os authorized users ativos com telefone verificado.
 * Respeita quiet hours e toggles de preferência do tenant.
 *
 * Falhas são logadas em morpheu_messages mas NÃO lançam exceção —
 * a operação do restaurante não pode quebrar porque o WhatsApp caiu.
 */
export async function emitMorpheuEvent<T extends MorpheuEventType>(
  tenantId: string,
  event: T,
  payload: MorpheuEventPayload[T]
): Promise<{ sent: number; skipped: number; errors: number }> {
  const result = { sent: 0, skipped: 0, errors: 0 };

  try {
    const db = getDb();
    const config = await loadMorpheuConfig();
    if (!config) {
      result.skipped++;
      return result;
    }

    const [settings] = await db
      .select()
      .from(morpheuTenantSettings)
      .where(eq(morpheuTenantSettings.tenantId, tenantId))
      .limit(1);

    if (!settings || !settings.enabled) {
      result.skipped++;
      return result;
    }

    const toggleKey = EVENT_TO_TOGGLE[event];
    if (toggleKey) {
      const enabled = (settings as Record<string, unknown>)[String(toggleKey)];
      if (enabled === false) {
        result.skipped++;
        return result;
      }
    }

    // Quiet hours — exceto pra ANOMALY_ALERT (crítico, ignora)
    if (event !== "ANOMALY_ALERT") {
      const now = currentHHmm(settings.timezone);
      if (
        isInsideWindow(now, settings.quietHoursStart, settings.quietHoursEnd)
      ) {
        result.skipped++;
        return result;
      }
    }

    // Destinatários: todos active + phoneVerified
    const recipients = await db
      .select()
      .from(morpheuAuthorizedUsers)
      .where(
        and(
          eq(morpheuAuthorizedUsers.tenantId, tenantId),
          eq(morpheuAuthorizedUsers.active, true),
          eq(morpheuAuthorizedUsers.phoneVerified, true)
        )
      );

    if (recipients.length === 0) {
      result.skipped++;
      return result;
    }

    const templateName = EVENT_TO_TEMPLATE[event];
    const params = buildTemplateParams(
      templateName,
      payload as unknown as Record<string, string>
    );

    for (const rcpt of recipients) {
      if (!rcpt.phoneE164) continue;
      try {
        const send = await sendTemplate(
          config,
          rcpt.phoneE164,
          templateName,
          "pt_BR",
          params
        );
        await db.insert(morpheuMessages).values({
          tenantId,
          authorizedUserId: rcpt.id,
          direction: "OUTBOUND",
          messageType: "TEMPLATE",
          templateName,
          body: JSON.stringify(payload),
          whatsappMessageId: send.whatsappMessageId,
          phoneE164: rcpt.phoneE164,
          status: "SENT",
          rawPayload: (send.raw as Record<string, unknown>) ?? null,
        });
        result.sent++;

        // Follow-up livre pro CASH_CLOSE (dentro da janela de 24h recém aberta)
        if (
          event === "CASH_CLOSE" &&
          (payload as MorpheuEventPayload["CASH_CLOSE"]).detailMessage
        ) {
          try {
            const { sendText } = await import("./whatsapp-client");
            const detail = (payload as MorpheuEventPayload["CASH_CLOSE"])
              .detailMessage!;
            const follow = await sendText(config, rcpt.phoneE164, detail);
            await db.insert(morpheuMessages).values({
              tenantId,
              authorizedUserId: rcpt.id,
              direction: "OUTBOUND",
              messageType: "TEXT",
              body: detail,
              whatsappMessageId: follow.whatsappMessageId,
              phoneE164: rcpt.phoneE164,
              status: "SENT",
            });
          } catch {
            // ignora — o template principal já foi enviado
          }
        }
      } catch (e) {
        result.errors++;
        const msg =
          e instanceof WhatsAppApiError
            ? `[${e.code}] ${e.message}`
            : e instanceof Error
              ? e.message
              : String(e);
        await db
          .insert(morpheuMessages)
          .values({
            tenantId,
            authorizedUserId: rcpt.id,
            direction: "OUTBOUND",
            messageType: "TEMPLATE",
            templateName,
            body: JSON.stringify(payload),
            phoneE164: rcpt.phoneE164,
            status: "FAILED",
            errorMessage: msg,
          })
          .catch(() => {
            // se o log falhar, segue — não quebra operação
          });
      }
    }
  } catch (e) {
    // Protege o caller: qualquer erro inesperado é apenas logado em console.
    result.errors++;
    // eslint-disable-next-line no-console
    console.error("[morpheu.emitMorpheuEvent] erro:", e);
  }

  return result;
}

/**
 * Helper pra buscar o nome do tenant — usado pelos routers que não querem
 * repetir a query toda vez.
 */
export async function getTenantName(tenantId: string): Promise<string> {
  const db = getDb();
  const [row] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return row?.name ?? "seu restaurante";
}
