import { z } from "zod";

/**
 * Códigos de forma de pagamento conhecidos pelo sistema.
 * "OTHER" agrupa todas as formas customizadas criadas pelo restaurante.
 */
export const PAYMENT_METHOD_CODES = [
  "PIX",
  "CASH",
  "CREDIT_CARD",
  "DEBIT_CARD",
  "OTHER",
] as const;

export type PaymentMethodCode = (typeof PAYMENT_METHOD_CODES)[number];

export interface PaymentMethodConfig {
  /** "PIX"/"CASH"/"CREDIT_CARD"/"DEBIT_CARD" para padrões; uuid p/ customizadas. */
  id: string;
  code: PaymentMethodCode;
  /** Texto exibido na UI ("PIX", "Dinheiro", "Vale-Refeição", ...). */
  label: string;
  /** Ligado/desligado sem deletar. */
  enabled: boolean;
  /** Ordem de exibição (0 = primeiro). */
  order: number;
  /** True para formas adicionadas pelo restaurante. */
  isCustom: boolean;
}

export const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  { id: "PIX", code: "PIX", label: "PIX", enabled: true, order: 0, isCustom: false },
  { id: "CASH", code: "CASH", label: "Dinheiro", enabled: true, order: 1, isCustom: false },
  { id: "CREDIT_CARD", code: "CREDIT_CARD", label: "Cartão de Crédito", enabled: true, order: 2, isCustom: false },
  { id: "DEBIT_CARD", code: "DEBIT_CARD", label: "Cartão de Débito", enabled: true, order: 3, isCustom: false },
];

const paymentMethodConfigSchema = z.object({
  id: z.string().min(1).max(64),
  code: z.enum(PAYMENT_METHOD_CODES),
  label: z.string().min(1).max(50),
  enabled: z.boolean(),
  order: z.number().int().min(0),
  isCustom: z.boolean(),
});

export const paymentMethodsListSchema = z
  .array(paymentMethodConfigSchema)
  .max(15, "Máximo de 15 formas de pagamento por restaurante.")
  .superRefine((list, ctx) => {
    const ids = new Set<string>();
    const labels = new Set<string>();
    for (const item of list) {
      if (ids.has(item.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `IDs duplicados: ${item.id}`,
        });
      }
      ids.add(item.id);

      const labelKey = item.label.trim().toLowerCase();
      if (labels.has(labelKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Nomes duplicados: ${item.label}`,
        });
      }
      labels.add(labelKey);

      if (!item.isCustom && item.code === "OTHER") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Forma padrão não pode ter código OTHER (${item.id}).`,
        });
      }
      if (item.isCustom && item.code !== "OTHER") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Forma customizada precisa do código OTHER (${item.id}).`,
        });
      }
    }
  });

/**
 * Filtra formas habilitadas e ordena por `order`.
 * Use ao renderizar opções para o cliente/atendente.
 */
export function getEnabledPaymentMethods(
  list: PaymentMethodConfig[] | null | undefined
): PaymentMethodConfig[] {
  const safe = list ?? DEFAULT_PAYMENT_METHODS;
  return [...safe].filter((m) => m.enabled).sort((a, b) => a.order - b.order);
}

/**
 * Encontra uma forma pelo id. Útil ao validar pedidos.
 */
export function findPaymentMethodById(
  list: PaymentMethodConfig[] | null | undefined,
  id: string
): PaymentMethodConfig | undefined {
  return (list ?? DEFAULT_PAYMENT_METHODS).find((m) => m.id === id);
}
