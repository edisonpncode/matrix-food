import { printViaIframe, printTestPage } from "./print";
import type {
  ReceiptOrder,
  ReceiptConfig,
  PaperWidth,
  ReceiptType,
} from "@/components/receipt/receipt-types";

export interface PrinterInfo {
  id: string;
  name: string;
  paperWidth: PaperWidth;
  connectionMethod: "BROWSER" | "NETWORK";
  networkConfig?: {
    ipAddress: string;
    port: number;
  };
  isDefault: boolean;
  isActive: boolean;
}

export interface PrintSettings {
  printers: PrinterInfo[];
  autoPrint: {
    enabled: boolean;
    onNewOrder: boolean;
    onOrderConfirmed: boolean;
    copies: number;
  };
  receiptTypes: {
    customer: boolean;
    kitchen: boolean;
    delivery: boolean;
  };
  receiptConfig: ReceiptConfig;
}

interface DispatchPrintArgs {
  order: ReceiptOrder;
  receiptType: ReceiptType;
  settings: PrintSettings;
  restaurantName: string;
  deliveryPersonName?: string | null;
  printer?: PrinterInfo;
  trpcPrintToNetwork?: (args: {
    orderId: string;
    printerId: string;
    receiptType: ReceiptType;
  }) => Promise<{ success: boolean }>;
}

/**
 * Despacha a impressao para o metodo correto (browser ou rede).
 * Gerencia copias automaticamente.
 */
export async function dispatchPrint({
  order,
  receiptType,
  settings,
  restaurantName,
  deliveryPersonName,
  printer,
  trpcPrintToNetwork,
}: DispatchPrintArgs): Promise<void> {
  const targetPrinter =
    printer ??
    settings.printers.find((p) => p.isDefault && p.isActive) ??
    settings.printers.find((p) => p.isActive);

  if (!targetPrinter) {
    throw new Error("Nenhuma impressora ativa encontrada.");
  }

  const copies = settings.autoPrint.copies || 1;

  for (let i = 0; i < copies; i++) {
    if (targetPrinter.connectionMethod === "NETWORK" && trpcPrintToNetwork) {
      await trpcPrintToNetwork({
        orderId: order.id,
        printerId: targetPrinter.id,
        receiptType,
      });
    } else {
      printViaIframe(
        order,
        settings.receiptConfig,
        targetPrinter.paperWidth,
        receiptType,
        restaurantName,
        deliveryPersonName
      );
    }
  }
}

/**
 * Despacha impressao de teste.
 */
export async function dispatchTestPrint({
  printer,
  restaurantName,
  trpcTestPrint,
}: {
  printer: PrinterInfo;
  restaurantName: string;
  trpcTestPrint?: (args: { printerId: string }) => Promise<{ success: boolean }>;
}): Promise<void> {
  if (printer.connectionMethod === "NETWORK" && trpcTestPrint) {
    await trpcTestPrint({ printerId: printer.id });
  } else {
    printTestPage(restaurantName, printer.paperWidth);
  }
}

/**
 * Imprime automaticamente todos os tipos de recibo ativados para um pedido.
 */
export async function autoPrintOrder(args: Omit<DispatchPrintArgs, "receiptType">): Promise<void> {
  const { settings } = args;

  if (settings.receiptTypes.customer) {
    await dispatchPrint({ ...args, receiptType: "CUSTOMER" });
  }
  if (settings.receiptTypes.kitchen) {
    await dispatchPrint({ ...args, receiptType: "KITCHEN" });
  }
  if (settings.receiptTypes.delivery && args.order.type === "DELIVERY") {
    await dispatchPrint({ ...args, receiptType: "DELIVERY" });
  }
}
