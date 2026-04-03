/**
 * Gerador de comandos ESC/POS para impressoras termicas.
 * Protocolo padrao usado por Epson, Elgin, Bematech, etc.
 */

// Comandos ESC/POS
const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
  INIT: [ESC, 0x40], // Inicializa impressora
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_HEIGHT_ON: [GS, 0x21, 0x10],
  DOUBLE_WIDTH_ON: [GS, 0x21, 0x20],
  DOUBLE_SIZE_ON: [GS, 0x21, 0x30],
  NORMAL_SIZE: [GS, 0x21, 0x00],
  LINE_FEED: [0x0a],
  CUT_PAPER: [GS, 0x56, 0x00], // Corte total
  CUT_PARTIAL: [GS, 0x56, 0x01], // Corte parcial
  FEED_AND_CUT: [GS, 0x56, 0x41, 0x03], // Avanca 3 linhas e corta
} as const;

const CHARS_PER_LINE: Record<string, number> = {
  "80mm": 48,
  "58mm": 32,
};

/** Remove acentos para impressoras que nao suportam UTF-8 */
function stripAccents(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, "?");
}

/** Converte string para bytes */
function textToBytes(text: string): number[] {
  return Array.from(stripAccents(text), (char) => char.charCodeAt(0));
}

/** Cria linha separadora */
function separator(paperWidth: string): number[] {
  const width = CHARS_PER_LINE[paperWidth] ?? 48;
  return textToBytes("-".repeat(width));
}

/** Alinha texto a esquerda e direita na mesma linha */
function twoColumnLine(
  left: string,
  right: string,
  paperWidth: string
): number[] {
  const width = CHARS_PER_LINE[paperWidth] ?? 48;
  const maxLeft = width - right.length - 1;
  const trimmedLeft = left.length > maxLeft ? left.slice(0, maxLeft) : left;
  const spaces = width - trimmedLeft.length - right.length;
  return textToBytes(trimmedLeft + " ".repeat(Math.max(1, spaces)) + right);
}

export interface EscPosOrderData {
  displayNumber: string;
  type: string;
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
  deliveryPersonName?: string | null;
  subtotal: string;
  deliveryFee: string;
  discount: string;
  total: string;
  paymentMethod: string;
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
    ingredientModifications?: Array<{
      modification: string;
      price: string;
    }>;
  }>;
}

export interface EscPosConfig {
  restaurantName: string;
  headerText: string;
  footerText: string;
  paperWidth: "80mm" | "58mm";
  showCustomerInfo: boolean;
  showDeliveryAddress: boolean;
  showItemNotes: boolean;
  showOrderNotes: boolean;
  showPaymentMethod: boolean;
  showTimestamp: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  COUNTER: "BALCAO",
  DINE_IN: "MESA",
  PICKUP: "VEM BUSCAR",
  DELIVERY: "TELE ENTREGA",
  TABLE: "MESA",
};

const PAYMENT_LABELS: Record<string, string> = {
  PIX: "PIX",
  CASH: "Dinheiro",
  CREDIT_CARD: "Cartao de Credito",
  DEBIT_CARD: "Cartao de Debito",
};

function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrencyPlain(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return "R$ 0,00";
  return `R$ ${num.toFixed(2).replace(".", ",")}`;
}

/** Gera recibo completo do cliente em ESC/POS */
export function generateCustomerReceipt(
  order: EscPosOrderData,
  config: EscPosConfig
): Uint8Array {
  const bytes: number[] = [];
  const pw = config.paperWidth;

  const typeLabel =
    order.type === "DINE_IN" && order.tableNumber
      ? `MESA ${order.tableNumber}`
      : order.type === "TABLE" && order.tableNumber
        ? `MESA ${order.tableNumber}`
        : (TYPE_LABELS[order.type] ?? order.type);

  // Inicializar
  bytes.push(...CMD.INIT);

  // Cabecalho - nome do restaurante
  bytes.push(...CMD.ALIGN_CENTER);
  bytes.push(...CMD.BOLD_ON);
  bytes.push(...CMD.DOUBLE_SIZE_ON);
  bytes.push(...textToBytes(config.restaurantName));
  bytes.push(...CMD.LINE_FEED);
  bytes.push(...CMD.NORMAL_SIZE);
  bytes.push(...CMD.BOLD_OFF);

  // Header text (CNPJ, endereco, etc)
  if (config.headerText) {
    for (const line of config.headerText.split("\n")) {
      bytes.push(...textToBytes(line.trim()));
      bytes.push(...CMD.LINE_FEED);
    }
  }

  // Separador
  bytes.push(...CMD.ALIGN_LEFT);
  bytes.push(...separator(pw));
  bytes.push(...CMD.LINE_FEED);

  // Numero do pedido
  bytes.push(...CMD.ALIGN_CENTER);
  bytes.push(...CMD.BOLD_ON);
  bytes.push(...CMD.DOUBLE_SIZE_ON);
  bytes.push(...textToBytes(`PEDIDO #${order.displayNumber}`));
  bytes.push(...CMD.LINE_FEED);
  bytes.push(...CMD.NORMAL_SIZE);
  bytes.push(...textToBytes(`[${typeLabel}]`));
  bytes.push(...CMD.LINE_FEED);
  bytes.push(...CMD.BOLD_OFF);

  // Separador
  bytes.push(...CMD.ALIGN_LEFT);
  bytes.push(...separator(pw));
  bytes.push(...CMD.LINE_FEED);

  // Dados do cliente
  if (config.showCustomerInfo) {
    bytes.push(...CMD.BOLD_ON);
    bytes.push(...textToBytes("Cliente: "));
    bytes.push(...CMD.BOLD_OFF);
    bytes.push(...textToBytes(order.customerName));
    bytes.push(...CMD.LINE_FEED);
    bytes.push(...CMD.BOLD_ON);
    bytes.push(...textToBytes("Fone: "));
    bytes.push(...CMD.BOLD_OFF);
    bytes.push(...textToBytes(order.customerPhone));
    bytes.push(...CMD.LINE_FEED);
  }

  // Endereco de entrega
  if (
    config.showDeliveryAddress &&
    order.type === "DELIVERY" &&
    order.deliveryAddress
  ) {
    const addr = order.deliveryAddress;
    bytes.push(...CMD.BOLD_ON);
    bytes.push(...textToBytes("Endereco: "));
    bytes.push(...CMD.BOLD_OFF);
    bytes.push(
      ...textToBytes(
        `${addr.street}, ${addr.number}${addr.complement ? ` - ${addr.complement}` : ""}`
      )
    );
    bytes.push(...CMD.LINE_FEED);
    bytes.push(...textToBytes(addr.neighborhood));
    bytes.push(...CMD.LINE_FEED);
    bytes.push(...textToBytes(`${addr.city} - ${addr.state}`));
    bytes.push(...CMD.LINE_FEED);
    if (addr.referencePoint) {
      bytes.push(...textToBytes(`Ref: ${addr.referencePoint}`));
      bytes.push(...CMD.LINE_FEED);
    }
  }

  // Entregador
  if (order.deliveryPersonName) {
    bytes.push(...CMD.BOLD_ON);
    bytes.push(...textToBytes("Entregador: "));
    bytes.push(...CMD.BOLD_OFF);
    bytes.push(...textToBytes(order.deliveryPersonName));
    bytes.push(...CMD.LINE_FEED);
  }

  // Separador
  bytes.push(...separator(pw));
  bytes.push(...CMD.LINE_FEED);

  // Itens
  for (const item of order.items) {
    const itemName = `${item.quantity}x ${item.productName}${item.variantName ? ` (${item.variantName})` : ""}`;
    const itemPrice = formatCurrencyPlain(item.totalPrice);
    bytes.push(...twoColumnLine(itemName, itemPrice, pw));
    bytes.push(...CMD.LINE_FEED);

    if (item.customizations) {
      for (const cust of item.customizations) {
        const custPrice =
          parseFloat(cust.price) > 0
            ? ` (${formatCurrencyPlain(cust.price)})`
            : "";
        bytes.push(...textToBytes(`  + ${cust.customizationOptionName}${custPrice}`));
        bytes.push(...CMD.LINE_FEED);
      }
    }

    if (item.ingredientModifications) {
      for (const mod of item.ingredientModifications) {
        const modPrice =
          parseFloat(mod.price) > 0
            ? ` (${formatCurrencyPlain(mod.price)})`
            : "";
        bytes.push(...textToBytes(`  ${mod.modification}${modPrice}`));
        bytes.push(...CMD.LINE_FEED);
      }
    }

    if (config.showItemNotes && item.notes) {
      bytes.push(...textToBytes(`  OBS: ${item.notes}`));
      bytes.push(...CMD.LINE_FEED);
    }
  }

  // Separador
  bytes.push(...separator(pw));
  bytes.push(...CMD.LINE_FEED);

  // Totais
  const subtotal = parseFloat(order.subtotal);
  const deliveryFee = parseFloat(order.deliveryFee);
  const discount = parseFloat(order.discount);

  bytes.push(
    ...twoColumnLine("Subtotal:", formatCurrencyPlain(order.subtotal), pw)
  );
  bytes.push(...CMD.LINE_FEED);

  if (deliveryFee > 0) {
    bytes.push(
      ...twoColumnLine(
        "Taxa Entrega:",
        formatCurrencyPlain(order.deliveryFee),
        pw
      )
    );
    bytes.push(...CMD.LINE_FEED);
  }

  if (discount > 0) {
    bytes.push(
      ...twoColumnLine("Desconto:", `-${formatCurrencyPlain(order.discount)}`, pw)
    );
    bytes.push(...CMD.LINE_FEED);
  }

  bytes.push(...CMD.BOLD_ON);
  bytes.push(...CMD.DOUBLE_HEIGHT_ON);
  bytes.push(
    ...twoColumnLine("TOTAL:", formatCurrencyPlain(order.total), pw)
  );
  bytes.push(...CMD.LINE_FEED);
  bytes.push(...CMD.NORMAL_SIZE);
  bytes.push(...CMD.BOLD_OFF);

  // Separador
  bytes.push(...separator(pw));
  bytes.push(...CMD.LINE_FEED);

  // Pagamento
  if (config.showPaymentMethod) {
    bytes.push(...CMD.BOLD_ON);
    bytes.push(...textToBytes("Pagamento: "));
    bytes.push(...CMD.BOLD_OFF);
    bytes.push(
      ...textToBytes(PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod)
    );
    bytes.push(...CMD.LINE_FEED);
  }

  // Observacoes do pedido
  if (config.showOrderNotes && order.notes) {
    bytes.push(...CMD.BOLD_ON);
    bytes.push(...textToBytes("Obs: "));
    bytes.push(...CMD.BOLD_OFF);
    bytes.push(...textToBytes(order.notes));
    bytes.push(...CMD.LINE_FEED);
  }

  // Timestamp
  if (config.showTimestamp) {
    bytes.push(...textToBytes(formatDateTime(order.createdAt)));
    bytes.push(...CMD.LINE_FEED);
  }

  // Separador
  bytes.push(...separator(pw));
  bytes.push(...CMD.LINE_FEED);

  // Rodape
  bytes.push(...CMD.ALIGN_CENTER);
  if (config.footerText) {
    for (const line of config.footerText.split("\n")) {
      bytes.push(...textToBytes(line.trim()));
      bytes.push(...CMD.LINE_FEED);
    }
  }

  // Avanca e corta
  bytes.push(...CMD.LINE_FEED);
  bytes.push(...CMD.LINE_FEED);
  bytes.push(...CMD.FEED_AND_CUT);

  return new Uint8Array(bytes);
}

/** Gera ticket de cozinha em ESC/POS (sem precos) */
export function generateKitchenTicket(
  order: EscPosOrderData,
  config: Pick<EscPosConfig, "paperWidth">
): Uint8Array {
  const bytes: number[] = [];
  const pw = config.paperWidth;

  const typeLabel =
    order.type === "DINE_IN" && order.tableNumber
      ? `MESA ${order.tableNumber}`
      : order.type === "TABLE" && order.tableNumber
        ? `MESA ${order.tableNumber}`
        : (TYPE_LABELS[order.type] ?? order.type);

  bytes.push(...CMD.INIT);

  // Titulo
  bytes.push(...CMD.ALIGN_CENTER);
  bytes.push(...CMD.BOLD_ON);
  bytes.push(...CMD.DOUBLE_SIZE_ON);
  bytes.push(...textToBytes("*** COZINHA ***"));
  bytes.push(...CMD.LINE_FEED);
  bytes.push(...textToBytes(`PEDIDO #${order.displayNumber}`));
  bytes.push(...CMD.LINE_FEED);
  bytes.push(...CMD.NORMAL_SIZE);
  bytes.push(...textToBytes(`[${typeLabel}]`));
  bytes.push(...CMD.LINE_FEED);
  bytes.push(...CMD.BOLD_OFF);

  // Separador
  bytes.push(...CMD.ALIGN_LEFT);
  bytes.push(...separator(pw));
  bytes.push(...CMD.LINE_FEED);

  // Itens (sem precos, letra grande)
  bytes.push(...CMD.DOUBLE_HEIGHT_ON);
  for (const item of order.items) {
    const itemText = `${item.quantity}x ${item.productName}${item.variantName ? ` (${item.variantName})` : ""}`;
    bytes.push(...CMD.BOLD_ON);
    bytes.push(...textToBytes(itemText));
    bytes.push(...CMD.LINE_FEED);
    bytes.push(...CMD.BOLD_OFF);

    if (item.customizations) {
      for (const cust of item.customizations) {
        bytes.push(...textToBytes(`   + ${cust.customizationOptionName}`));
        bytes.push(...CMD.LINE_FEED);
      }
    }

    if (item.ingredientModifications) {
      for (const mod of item.ingredientModifications) {
        bytes.push(...textToBytes(`   ${mod.modification}`));
        bytes.push(...CMD.LINE_FEED);
      }
    }

    if (item.notes) {
      bytes.push(...textToBytes(`   OBS: ${item.notes}`));
      bytes.push(...CMD.LINE_FEED);
    }
  }
  bytes.push(...CMD.NORMAL_SIZE);

  // Separador
  bytes.push(...separator(pw));
  bytes.push(...CMD.LINE_FEED);

  // Observacoes do pedido em destaque
  if (order.notes) {
    bytes.push(...CMD.BOLD_ON);
    bytes.push(...CMD.DOUBLE_HEIGHT_ON);
    bytes.push(...textToBytes(`** ${order.notes.toUpperCase()} **`));
    bytes.push(...CMD.LINE_FEED);
    bytes.push(...CMD.NORMAL_SIZE);
    bytes.push(...CMD.BOLD_OFF);
  }

  // Timestamp
  bytes.push(...textToBytes(formatDateTime(order.createdAt)));
  bytes.push(...CMD.LINE_FEED);

  // Corte
  bytes.push(...CMD.LINE_FEED);
  bytes.push(...CMD.FEED_AND_CUT);

  return new Uint8Array(bytes);
}

/** Gera via de entrega em ESC/POS */
export function generateDeliverySlip(
  order: EscPosOrderData,
  config: Pick<EscPosConfig, "paperWidth">
): Uint8Array {
  const bytes: number[] = [];
  const pw = config.paperWidth;

  bytes.push(...CMD.INIT);

  // Numero do pedido
  bytes.push(...CMD.ALIGN_CENTER);
  bytes.push(...CMD.BOLD_ON);
  bytes.push(...CMD.DOUBLE_SIZE_ON);
  bytes.push(...textToBytes(`PEDIDO #${order.displayNumber}`));
  bytes.push(...CMD.LINE_FEED);
  bytes.push(...CMD.NORMAL_SIZE);
  bytes.push(...CMD.BOLD_OFF);

  // Separador
  bytes.push(...CMD.ALIGN_LEFT);
  bytes.push(...separator(pw));
  bytes.push(...CMD.LINE_FEED);

  // Cliente (destaque)
  bytes.push(...CMD.BOLD_ON);
  bytes.push(...CMD.DOUBLE_HEIGHT_ON);
  bytes.push(...textToBytes(order.customerName.toUpperCase()));
  bytes.push(...CMD.LINE_FEED);
  bytes.push(...CMD.NORMAL_SIZE);
  bytes.push(...CMD.BOLD_OFF);
  bytes.push(...textToBytes(order.customerPhone));
  bytes.push(...CMD.LINE_FEED);

  // Endereco (destaque)
  if (order.deliveryAddress) {
    const addr = order.deliveryAddress;
    bytes.push(...CMD.BOLD_ON);
    bytes.push(...CMD.DOUBLE_HEIGHT_ON);
    bytes.push(
      ...textToBytes(
        `${addr.street}, ${addr.number}${addr.complement ? ` - ${addr.complement}` : ""}`
      )
    );
    bytes.push(...CMD.LINE_FEED);
    bytes.push(...textToBytes(addr.neighborhood));
    bytes.push(...CMD.LINE_FEED);
    bytes.push(...CMD.NORMAL_SIZE);
    bytes.push(...CMD.BOLD_OFF);
    if (addr.referencePoint) {
      bytes.push(...CMD.BOLD_ON);
      bytes.push(...textToBytes(`Ref: ${addr.referencePoint}`));
      bytes.push(...CMD.BOLD_OFF);
      bytes.push(...CMD.LINE_FEED);
    }
  }

  // Separador
  bytes.push(...separator(pw));
  bytes.push(...CMD.LINE_FEED);

  // Itens (compactos, sem preco individual)
  for (const item of order.items) {
    bytes.push(
      ...textToBytes(
        `${item.quantity}x ${item.productName}${item.variantName ? ` (${item.variantName})` : ""}`
      )
    );
    bytes.push(...CMD.LINE_FEED);

    if (item.ingredientModifications) {
      for (const mod of item.ingredientModifications) {
        bytes.push(...textToBytes(`  ${mod.modification}`));
        bytes.push(...CMD.LINE_FEED);
      }
    }
  }

  // Total
  bytes.push(...CMD.BOLD_ON);
  bytes.push(...CMD.DOUBLE_HEIGHT_ON);
  bytes.push(
    ...twoColumnLine("TOTAL:", formatCurrencyPlain(order.total), pw)
  );
  bytes.push(...CMD.LINE_FEED);
  bytes.push(...CMD.NORMAL_SIZE);
  bytes.push(...CMD.BOLD_OFF);

  // Pagamento
  bytes.push(
    ...textToBytes(
      `Pagamento: ${PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}`
    )
  );
  bytes.push(...CMD.LINE_FEED);

  // Entregador
  if (order.deliveryPersonName) {
    bytes.push(...CMD.BOLD_ON);
    bytes.push(...textToBytes(`Entregador: ${order.deliveryPersonName}`));
    bytes.push(...CMD.BOLD_OFF);
    bytes.push(...CMD.LINE_FEED);
  }

  // Corte
  bytes.push(...CMD.LINE_FEED);
  bytes.push(...CMD.LINE_FEED);
  bytes.push(...CMD.FEED_AND_CUT);

  return new Uint8Array(bytes);
}

/** Gera pagina de teste em ESC/POS */
export function generateTestPage(
  restaurantName: string,
  paperWidth: "80mm" | "58mm"
): Uint8Array {
  const bytes: number[] = [];

  bytes.push(...CMD.INIT);

  bytes.push(...CMD.ALIGN_CENTER);
  bytes.push(...CMD.BOLD_ON);
  bytes.push(...CMD.DOUBLE_SIZE_ON);
  bytes.push(...textToBytes(restaurantName));
  bytes.push(...CMD.LINE_FEED);
  bytes.push(...CMD.NORMAL_SIZE);
  bytes.push(...CMD.BOLD_OFF);

  bytes.push(...CMD.ALIGN_LEFT);
  bytes.push(...separator(paperWidth));
  bytes.push(...CMD.LINE_FEED);

  bytes.push(...CMD.ALIGN_CENTER);
  bytes.push(...textToBytes("TESTE DE IMPRESSAO"));
  bytes.push(...CMD.LINE_FEED);
  bytes.push(...textToBytes("Impressora configurada com sucesso!"));
  bytes.push(...CMD.LINE_FEED);
  bytes.push(...CMD.LINE_FEED);
  bytes.push(...textToBytes(`Papel: ${paperWidth}`));
  bytes.push(...CMD.LINE_FEED);
  bytes.push(...textToBytes(formatDateTime(new Date())));
  bytes.push(...CMD.LINE_FEED);

  bytes.push(...CMD.ALIGN_LEFT);
  bytes.push(...separator(paperWidth));
  bytes.push(...CMD.LINE_FEED);

  bytes.push(...CMD.ALIGN_CENTER);
  bytes.push(...textToBytes("Matrix Food"));
  bytes.push(...CMD.LINE_FEED);

  bytes.push(...CMD.LINE_FEED);
  bytes.push(...CMD.LINE_FEED);
  bytes.push(...CMD.FEED_AND_CUT);

  return new Uint8Array(bytes);
}
