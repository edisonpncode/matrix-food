/**
 * Registro de templates WhatsApp do Morpheu.
 * Os nomes técnicos aqui DEVEM bater exatamente com o que for cadastrado
 * no Meta Business Manager. Ordem dos placeholders é relevante:
 * o índice no array abaixo corresponde a {{1}}, {{2}}, {{3}}... no corpo.
 */

export type MorpheuTemplateName =
  | "morpheu_otp"
  | "morpheu_welcome"
  | "morpheu_cash_open"
  | "morpheu_cash_deposit"
  | "morpheu_cash_withdraw"
  | "morpheu_order_cancel"
  | "morpheu_cash_close"
  | "morpheu_daily_summary"
  | "morpheu_anomaly_alert";

export interface MorpheuTemplateSpec {
  name: MorpheuTemplateName;
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  language: "pt_BR";
  body: string;
  placeholders: string[]; // nomes lógicos, posição = índice do placeholder
}

export const MORPHEU_TEMPLATES: Record<MorpheuTemplateName, MorpheuTemplateSpec> = {
  morpheu_otp: {
    name: "morpheu_otp",
    category: "AUTHENTICATION",
    language: "pt_BR",
    body: "Seu código de verificação Morpheu: *{{1}}*. Válido por 10 minutos.",
    placeholders: ["code"],
  },
  morpheu_welcome: {
    name: "morpheu_welcome",
    category: "UTILITY",
    language: "pt_BR",
    body: "Olá, {{1}}! Sou o Morpheu, gerente de IA do {{2}}. Me pergunte sobre vendas, pedidos, produtos e o que mais quiser saber. Pra começar, digite *vendas hoje*.",
    placeholders: ["userName", "tenantName"],
  },
  morpheu_cash_open: {
    name: "morpheu_cash_open",
    category: "UTILITY",
    language: "pt_BR",
    body: "💰 Caixa aberto no {{1}} por {{2}}. Valor inicial: R$ {{3}}.",
    placeholders: ["tenantName", "cashierName", "initialAmount"],
  },
  morpheu_cash_deposit: {
    name: "morpheu_cash_deposit",
    category: "UTILITY",
    language: "pt_BR",
    body: "⬆️ Depósito de R$ {{1}} no caixa do {{2}}. Motivo: {{3}}. Por: {{4}}.",
    placeholders: ["amount", "tenantName", "description", "cashierName"],
  },
  morpheu_cash_withdraw: {
    name: "morpheu_cash_withdraw",
    category: "UTILITY",
    language: "pt_BR",
    body: "⬇️ Retirada de R$ {{1}} do caixa do {{2}}. Motivo: {{3}}. Por: {{4}}.",
    placeholders: ["amount", "tenantName", "description", "cashierName"],
  },
  morpheu_order_cancel: {
    name: "morpheu_order_cancel",
    category: "UTILITY",
    language: "pt_BR",
    body: "❌ Pedido #{{1}} cancelado no {{2}}. Cliente: {{3}}. Valor: R$ {{4}}. Motivo: {{5}}.",
    placeholders: [
      "orderNumber",
      "tenantName",
      "customerName",
      "total",
      "reason",
    ],
  },
  morpheu_cash_close: {
    name: "morpheu_cash_close",
    category: "UTILITY",
    language: "pt_BR",
    body: "🧾 Fechamento do caixa {{1}}. Total vendido: R$ {{2}}. Em caixa: R$ {{3}}. Responda *detalhes {{4}}* pra ver o relatório completo.",
    placeholders: ["cashierName", "totalSold", "totalInCash", "cashRegisterId"],
  },
  morpheu_daily_summary: {
    name: "morpheu_daily_summary",
    category: "UTILITY",
    language: "pt_BR",
    body: "📊 Resumo de ontem ({{1}}): R$ {{2}} em {{3}} pedidos. Vs {{4}} semana passada: {{5}}. Campeão: {{6}}.",
    placeholders: [
      "dateLabel",
      "totalRevenue",
      "ordersCount",
      "weekdayLabel",
      "variationLabel",
      "topCategoryOrProduct",
    ],
  },
  morpheu_anomaly_alert: {
    name: "morpheu_anomaly_alert",
    category: "UTILITY",
    language: "pt_BR",
    body: "⚠️ Atenção, {{1}}. Suas vendas hoje estão {{2}}% abaixo da média. Faturamento até agora: R$ {{3}}. Quer investigar? Responda *sim*.",
    placeholders: ["userName", "variationPercent", "revenueToday"],
  },
};

/**
 * Monta o array de parâmetros do template na ordem correta.
 * Se faltar algum placeholder, lança erro (proteção contra deploy quebrado).
 */
export function buildTemplateParams(
  template: MorpheuTemplateName,
  values: Record<string, string>
): string[] {
  const spec = MORPHEU_TEMPLATES[template];
  return spec.placeholders.map((key) => {
    const v = values[key];
    if (v === undefined || v === null) {
      throw new Error(
        `Placeholder "${key}" ausente pro template "${template}".`
      );
    }
    return String(v);
  });
}
