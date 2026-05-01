import {
  getDb,
  tenants,
  orders,
  orderItems,
  orderItemCustomizations,
  orderItemIngredients,
  tenantUsers,
  printJobs,
  eq,
  sql,
} from "@matrix-food/database";
import {
  generateCustomerReceipt,
  generateKitchenTicket,
  generateDeliverySlip,
} from "@matrix-food/utils";
import type { EscPosOrderData, EscPosConfig } from "@matrix-food/utils";

export type ReceiptType = "CUSTOMER" | "KITCHEN" | "DELIVERY";
export type PrintTrigger = "AUTO_NEW_ORDER" | "AUTO_CONFIRMED" | "MANUAL";

export interface PrintAttemptResult {
  printerId: string;
  printerName: string;
  receiptType: ReceiptType;
  success: boolean;
  error?: string;
  /** ID do registro em `print_jobs` (quando o caller pediu persistência). */
  jobId?: string;
}

/**
 * Envia bytes ESC/POS para uma impressora de rede via TCP.
 * Throws on failure — caller é responsável por capturar e registrar.
 */
async function sendBytesToNetworkPrinter(
  ipAddress: string,
  port: number,
  data: Uint8Array
): Promise<void> {
  const net = await import("node:net");
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("Timeout ao conectar na impressora"));
    }, 5_000);

    socket.connect(port, ipAddress, () => {
      clearTimeout(timeout);
      socket.write(Buffer.from(data), (err) => {
        socket.end();
        if (err) reject(err);
        else resolve();
      });
    });

    socket.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`Erro de conexao com impressora: ${err.message}`));
    });
  });
}

/**
 * Imprime um recibo de um pedido em uma impressora específica de rede.
 * Função reutilizável — usada tanto pelo router de impressão manual
 * quanto pelo auto-print do `order.create`.
 */
export async function printOrderReceiptToNetwork(args: {
  tenantId: string;
  orderId: string;
  printerId: string;
  receiptType: ReceiptType;
}): Promise<void> {
  const db = getDb();

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, args.tenantId))
    .limit(1);

  if (!tenant?.printerSettings) {
    throw new Error("Nenhuma impressora configurada.");
  }

  const printer = tenant.printerSettings.printers.find(
    (p) => p.id === args.printerId
  );
  if (
    !printer ||
    printer.connectionMethod !== "NETWORK" ||
    !printer.networkConfig
  ) {
    throw new Error("Impressora de rede nao encontrada.");
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, args.orderId))
    .limit(1);
  if (!order) throw new Error("Pedido nao encontrado.");

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  const itemsWithCustomizations = await Promise.all(
    items.map(async (item) => {
      const customizations = await db
        .select()
        .from(orderItemCustomizations)
        .where(eq(orderItemCustomizations.orderItemId, item.id));
      const ingredientMods = await db
        .select()
        .from(orderItemIngredients)
        .where(eq(orderItemIngredients.orderItemId, item.id));
      return {
        ...item,
        customizations,
        ingredientModifications: ingredientMods,
      };
    })
  );

  let deliveryPersonName: string | null = null;
  if (order.deliveryPersonId) {
    const [person] = await db
      .select({ name: tenantUsers.name })
      .from(tenantUsers)
      .where(eq(tenantUsers.id, order.deliveryPersonId))
      .limit(1);
    deliveryPersonName = person?.name ?? null;
  }

  const orderData: EscPosOrderData = {
    displayNumber: order.displayNumber ?? String(order.orderNumber),
    type: order.type,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    tableNumber: order.tableNumber,
    deliveryAddress:
      order.deliveryAddress as EscPosOrderData["deliveryAddress"],
    deliveryPersonName,
    subtotal: String(order.subtotal),
    deliveryFee: String(order.deliveryFee),
    discount: String(order.discount),
    total: String(order.total),
    paymentMethod: order.paymentMethod,
    notes: order.notes,
    createdAt: order.createdAt,
    items: itemsWithCustomizations.map((item) => ({
      productName: item.productName,
      variantName: item.variantName,
      quantity: item.quantity,
      unitPrice: String(item.unitPrice),
      totalPrice: String(item.totalPrice),
      notes: item.notes,
      customizations: item.customizations.map((c) => ({
        customizationOptionName: c.customizationOptionName,
        price: String(c.price),
      })),
      ingredientModifications: item.ingredientModifications.map((m) => ({
        modification: m.modification,
        price: String(m.price),
      })),
    })),
  };

  const receiptConfig = tenant.printerSettings.receiptConfig;

  let escPosData: Uint8Array;
  if (args.receiptType === "CUSTOMER") {
    const config: EscPosConfig = {
      restaurantName: tenant.name,
      headerText: receiptConfig.headerText,
      footerText: receiptConfig.footerText,
      paperWidth: printer.paperWidth,
      showCustomerInfo: receiptConfig.showCustomerInfo,
      showDeliveryAddress: receiptConfig.showDeliveryAddress,
      showItemNotes: receiptConfig.showItemNotes,
      showOrderNotes: receiptConfig.showOrderNotes,
      showPaymentMethod: receiptConfig.showPaymentMethod,
      showTimestamp: receiptConfig.showTimestamp,
    };
    escPosData = generateCustomerReceipt(orderData, config);
  } else if (args.receiptType === "KITCHEN") {
    escPosData = generateKitchenTicket(orderData, {
      paperWidth: printer.paperWidth,
    });
  } else {
    escPosData = generateDeliverySlip(orderData, {
      paperWidth: printer.paperWidth,
    });
  }

  await sendBytesToNetworkPrinter(
    printer.networkConfig.ipAddress,
    printer.networkConfig.port,
    escPosData
  );
}

/**
 * Tenta imprimir automaticamente um pedido recém-criado pelo link público.
 *
 * Regras (decisões de produto):
 *  - Só imprime se `tenant.printerSettings.autoPrint.enabled && onNewOrder`.
 *  - Imprime KITCHEN sempre (em todas as impressoras NETWORK ativas que
 *    estejam com receiptTypes.kitchen=true).
 *  - Imprime DELIVERY apenas se o pedido for do tipo `DELIVERY` E
 *    receiptTypes.delivery=true.
 *  - NÃO imprime CUSTOMER automaticamente — é decisão do produto.
 *  - Falhas de impressão NÃO devem propagar — cada tentativa é capturada
 *    e retornada individualmente para o caller decidir o que fazer
 *    (registrar em print_jobs, alertar UI, etc).
 *
 * Retorna a lista de tentativas com status. Caller pode persistir.
 */
export async function autoPrintNewOnlineOrder(args: {
  tenantId: string;
  orderId: string;
  orderType: string;
}): Promise<PrintAttemptResult[]> {
  const db = getDb();

  const [tenant] = await db
    .select({ printerSettings: tenants.printerSettings, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, args.tenantId))
    .limit(1);

  if (!tenant?.printerSettings) return [];

  const settings = tenant.printerSettings;
  if (!settings.autoPrint?.enabled || !settings.autoPrint?.onNewOrder) {
    return [];
  }

  const isDelivery = args.orderType === "DELIVERY";
  const typesToPrint: ReceiptType[] = [];
  if (settings.receiptTypes.kitchen) typesToPrint.push("KITCHEN");
  if (isDelivery && settings.receiptTypes.delivery) typesToPrint.push("DELIVERY");

  if (typesToPrint.length === 0) return [];

  const networkPrinters = settings.printers.filter(
    (p) => p.isActive && p.connectionMethod === "NETWORK" && p.networkConfig
  );
  if (networkPrinters.length === 0) return [];

  const tasks: Array<Promise<PrintAttemptResult>> = [];
  for (const printer of networkPrinters) {
    for (const receiptType of typesToPrint) {
      tasks.push(
        attemptPrintAndPersist({
          tenantId: args.tenantId,
          orderId: args.orderId,
          printerId: printer.id,
          printerName: printer.name,
          receiptType,
          trigger: "AUTO_NEW_ORDER",
        })
      );
    }
  }

  return Promise.all(tasks);
}

/**
 * Executa uma tentativa de impressão e registra em `print_jobs`.
 *
 * O registro é criado em `PENDING` antes da tentativa e atualizado para
 * `SUCCESS` ou `FAILED` ao final. Falhas não propagam — o caller
 * recebe um `PrintAttemptResult` com `success=false` e a mensagem.
 */
export async function attemptPrintAndPersist(args: {
  tenantId: string;
  orderId: string;
  printerId: string;
  printerName: string;
  receiptType: ReceiptType;
  trigger: PrintTrigger;
}): Promise<PrintAttemptResult> {
  const db = getDb();

  const [job] = await db
    .insert(printJobs)
    .values({
      tenantId: args.tenantId,
      orderId: args.orderId,
      printerId: args.printerId,
      printerName: args.printerName,
      receiptType: args.receiptType,
      trigger: args.trigger,
      status: "PENDING",
      attempts: 1,
    })
    .returning({ id: printJobs.id });

  const jobId = job?.id;

  try {
    await printOrderReceiptToNetwork({
      tenantId: args.tenantId,
      orderId: args.orderId,
      printerId: args.printerId,
      receiptType: args.receiptType,
    });
    if (jobId) {
      await db
        .update(printJobs)
        .set({
          status: "SUCCESS",
          completedAt: new Date(),
          attemptedAt: new Date(),
        })
        .where(eq(printJobs.id, jobId));
    }
    return {
      printerId: args.printerId,
      printerName: args.printerName,
      receiptType: args.receiptType,
      success: true,
      jobId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (jobId) {
      await db
        .update(printJobs)
        .set({
          status: "FAILED",
          errorMessage: message,
          attemptedAt: new Date(),
        })
        .where(eq(printJobs.id, jobId));
    }
    return {
      printerId: args.printerId,
      printerName: args.printerName,
      receiptType: args.receiptType,
      success: false,
      error: message,
      jobId,
    };
  }
}

/**
 * Tenta novamente uma impressão que falhou. Incrementa `attempts` e
 * atualiza status conforme o resultado.
 */
export async function retryPrintJob(args: {
  tenantId: string;
  jobId: string;
}): Promise<PrintAttemptResult> {
  const db = getDb();

  const [job] = await db
    .select()
    .from(printJobs)
    .where(eq(printJobs.id, args.jobId))
    .limit(1);

  if (!job || job.tenantId !== args.tenantId) {
    throw new Error("Job de impressão não encontrado.");
  }
  if (job.status === "SUCCESS") {
    return {
      printerId: job.printerId,
      printerName: job.printerName,
      receiptType: job.receiptType,
      success: true,
      jobId: job.id,
    };
  }

  await db
    .update(printJobs)
    .set({
      status: "PENDING",
      attempts: sql`${printJobs.attempts} + 1`,
      attemptedAt: new Date(),
      errorMessage: null,
    })
    .where(eq(printJobs.id, job.id));

  try {
    await printOrderReceiptToNetwork({
      tenantId: job.tenantId,
      orderId: job.orderId,
      printerId: job.printerId,
      receiptType: job.receiptType,
    });
    await db
      .update(printJobs)
      .set({
        status: "SUCCESS",
        completedAt: new Date(),
      })
      .where(eq(printJobs.id, job.id));
    return {
      printerId: job.printerId,
      printerName: job.printerName,
      receiptType: job.receiptType,
      success: true,
      jobId: job.id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(printJobs)
      .set({
        status: "FAILED",
        errorMessage: message,
      })
      .where(eq(printJobs.id, job.id));
    return {
      printerId: job.printerId,
      printerName: job.printerName,
      receiptType: job.receiptType,
      success: false,
      error: message,
      jobId: job.id,
    };
  }
}
