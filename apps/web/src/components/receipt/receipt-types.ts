export interface ReceiptOrder {
  id: string;
  displayNumber: string;
  type: string;
  status: string;
  customerName: string;
  customerPhone: string;
  tableNumber?: number | null;
  deliveryAddress?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    referencePoint?: string;
  } | null;
  subtotal: string;
  deliveryFee: string;
  discount: string;
  total: string;
  paymentMethod: string;
  changeFor?: string | null;
  notes?: string | null;
  createdAt: string | Date;
  items: Array<{
    productName: string;
    variantName?: string | null;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
    notes?: string | null;
    customizations?: Array<{
      customizationOptionName: string;
      price: string;
    }>;
  }>;
}

export interface ReceiptConfig {
  headerText: string;
  footerText: string;
  showCustomerInfo: boolean;
  showDeliveryAddress: boolean;
  showItemNotes: boolean;
  showOrderNotes: boolean;
  showPaymentMethod: boolean;
  showTimestamp: boolean;
}

export type PaperWidth = "80mm" | "58mm";
export type ReceiptType = "CUSTOMER" | "KITCHEN" | "DELIVERY";

export const TYPE_LABELS: Record<string, string> = {
  COUNTER: "BALCAO",
  DINE_IN: "MESA",
  PICKUP: "VEM BUSCAR",
  DELIVERY: "TELE ENTREGA",
  TABLE: "MESA",
};

export const PAYMENT_LABELS: Record<string, string> = {
  PIX: "PIX",
  CASH: "Dinheiro",
  CREDIT_CARD: "Cartao de Credito",
  DEBIT_CARD: "Cartao de Debito",
};

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getTypeLabel(type: string, tableNumber?: number | null): string {
  if ((type === "DINE_IN" || type === "TABLE") && tableNumber) {
    return `MESA ${tableNumber}`;
  }
  return TYPE_LABELS[type] ?? type;
}

export function separator(paperWidth: PaperWidth): string {
  return paperWidth === "80mm" ? "-".repeat(48) : "-".repeat(32);
}

export function formatCurrencyPlain(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "R$ 0,00";
  return `R$ ${num.toFixed(2).replace(".", ",")}`;
}
