import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, tenantProcedure } from "../trpc";
import {
  getDb,
  tenants,
  orders,
  orderItems,
  orderItemCustomizations,
  orderItemIngredients,
  tenantUsers,
  cashRegisterSessions,
  cashRegisterTransactions,
  eq,
  and,
  sql,
} from "@matrix-food/database";
import {
  generateCustomerReceipt,
  generateKitchenTicket,
  generateDeliverySlip,
  generateCashClosingReceipt,
  generateTestPage,
} from "@matrix-food/utils";
import type { EscPosOrderData, EscPosConfig } from "@matrix-food/utils";

/** Envia dados binarios via TCP para impressora de rede */
async function sendToNetworkPrinter(
  ipAddress: string,
  port: number,
  data: Uint8Array
): Promise<void> {
  const net = await import("net");

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("Timeout ao conectar na impressora"));
    }, 5000);

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

export const printRouter = createTRPCRouter({
  /**
   * Envia impressao para impressora de rede via ESC/POS.
   */
  sendToNetwork: tenantProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        printerId: z.string().min(1),
        receiptType: z.enum(["CUSTOMER", "KITCHEN", "DELIVERY"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Buscar tenant com config de impressora
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, ctx.tenantId))
        .limit(1);

      if (!tenant?.printerSettings) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma impressora configurada.",
        });
      }

      const printer = tenant.printerSettings.printers.find(
        (p) => p.id === input.printerId
      );

      if (!printer || printer.connectionMethod !== "NETWORK" || !printer.networkConfig) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Impressora de rede nao encontrada.",
        });
      }

      // Buscar pedido completo
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pedido nao encontrado.",
        });
      }

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
          return { ...item, customizations, ingredientModifications: ingredientMods };
        })
      );

      // Buscar nome do entregador se houver
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
        deliveryAddress: order.deliveryAddress as EscPosOrderData["deliveryAddress"],
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

      // Gerar ESC/POS binario
      let escPosData: Uint8Array;
      if (input.receiptType === "CUSTOMER") {
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
      } else if (input.receiptType === "KITCHEN") {
        escPosData = generateKitchenTicket(orderData, {
          paperWidth: printer.paperWidth,
        });
      } else {
        escPosData = generateDeliverySlip(orderData, {
          paperWidth: printer.paperWidth,
        });
      }

      // Enviar para impressora
      try {
        await sendToNetworkPrinter(
          printer.networkConfig.ipAddress,
          printer.networkConfig.port,
          escPosData
        );
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            err instanceof Error
              ? err.message
              : "Erro ao enviar para impressora.",
        });
      }

      return { success: true };
    }),

  /**
   * Envia relatorio de fechamento de caixa para impressora de rede.
   */
  sendCashClosingToNetwork: tenantProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        printerId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, ctx.tenantId))
        .limit(1);

      if (!tenant?.printerSettings) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma impressora configurada.",
        });
      }

      const printer = tenant.printerSettings.printers.find(
        (p) => p.id === input.printerId
      );

      if (
        !printer ||
        printer.connectionMethod !== "NETWORK" ||
        !printer.networkConfig
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Impressora de rede nao encontrada.",
        });
      }

      const [session] = await db
        .select()
        .from(cashRegisterSessions)
        .where(
          and(
            eq(cashRegisterSessions.id, input.sessionId),
            eq(cashRegisterSessions.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!session || session.status !== "CLOSED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Sessão precisa estar fechada para imprimir o relatório.",
        });
      }

      const [sums] = await db
        .select({
          deposits: sql<string>`COALESCE(SUM(CASE WHEN ${cashRegisterTransactions.type} = 'DEPOSIT' THEN ${cashRegisterTransactions.amount}::numeric ELSE 0 END), 0)`,
          withdrawals: sql<string>`COALESCE(SUM(CASE WHEN ${cashRegisterTransactions.type} = 'WITHDRAWAL' THEN ${cashRegisterTransactions.amount}::numeric ELSE 0 END), 0)`,
          adjustments: sql<string>`COALESCE(SUM(CASE WHEN ${cashRegisterTransactions.type} = 'ADJUSTMENT' THEN ${cashRegisterTransactions.amount}::numeric ELSE 0 END), 0)`,
          refunds: sql<string>`COALESCE(SUM(CASE WHEN ${cashRegisterTransactions.type} = 'REFUND' THEN ${cashRegisterTransactions.amount}::numeric ELSE 0 END), 0)`,
        })
        .from(cashRegisterTransactions)
        .where(eq(cashRegisterTransactions.sessionId, input.sessionId));

      const zeroBreakdown = { cash: "0", creditCard: "0", debitCard: "0", pix: "0" };
      const escPosData = generateCashClosingReceipt({
        restaurantName: tenant.name,
        paperWidth: printer.paperWidth,
        openedAt: session.openedAt,
        closedAt: session.closedAt ?? new Date(),
        openedBy: session.openedBy,
        closedBy: session.closedBy ?? "-",
        openingBalance: session.openingBalance,
        deposits: sums?.deposits ?? "0",
        withdrawals: sums?.withdrawals ?? "0",
        adjustments: sums?.adjustments ?? "0",
        refunds: sums?.refunds ?? "0",
        expected: session.expectedBreakdown ?? zeroBreakdown,
        counted: session.countedBreakdown ?? zeroBreakdown,
        notes: session.notes,
      });

      try {
        await sendToNetworkPrinter(
          printer.networkConfig.ipAddress,
          printer.networkConfig.port,
          escPosData
        );
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            err instanceof Error
              ? err.message
              : "Erro ao enviar para impressora.",
        });
      }

      return { success: true };
    }),

  /**
   * Envia pagina de teste para impressora de rede.
   */
  testPrint: tenantProcedure
    .input(
      z.object({
        printerId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, ctx.tenantId))
        .limit(1);

      if (!tenant?.printerSettings) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma impressora configurada.",
        });
      }

      const printer = tenant.printerSettings.printers.find(
        (p) => p.id === input.printerId
      );

      if (!printer || printer.connectionMethod !== "NETWORK" || !printer.networkConfig) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Impressora de rede nao encontrada.",
        });
      }

      const escPosData = generateTestPage(tenant.name, printer.paperWidth);

      try {
        await sendToNetworkPrinter(
          printer.networkConfig.ipAddress,
          printer.networkConfig.port,
          escPosData
        );
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            err instanceof Error
              ? err.message
              : "Erro ao enviar para impressora.",
        });
      }

      return { success: true };
    }),
});
