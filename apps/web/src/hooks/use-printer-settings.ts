"use client";

import { useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { dispatchPrint, dispatchTestPrint, autoPrintOrder } from "@/lib/print-dispatcher";
import type { PrintSettings, PrinterInfo } from "@/lib/print-dispatcher";
import type { ReceiptOrder, ReceiptType } from "@/components/receipt/receipt-types";

const DEFAULT_SETTINGS: PrintSettings = {
  printers: [],
  autoPrint: {
    enabled: false,
    onNewOrder: false,
    onOrderConfirmed: false,
    copies: 1,
  },
  receiptTypes: {
    customer: true,
    kitchen: false,
    delivery: false,
  },
  receiptConfig: {
    headerText: "",
    footerText: "Obrigado pela preferencia!",
    showCustomerInfo: true,
    showDeliveryAddress: true,
    showItemNotes: true,
    showOrderNotes: true,
    showPaymentMethod: true,
    showTimestamp: true,
  },
};

export function usePrinterSettings() {
  const { data: settings, isLoading } =
    trpc.tenant.getPrinterSettings.useQuery();
  const networkPrint = trpc.print.sendToNetwork.useMutation();
  const networkTestPrint = trpc.print.testPrint.useMutation();
  const { data: tenant } = trpc.tenant.getById.useQuery();

  const currentSettings: PrintSettings = settings ?? DEFAULT_SETTINGS;
  const restaurantName = tenant?.name ?? "Meu Restaurante";

  const printOrder = useCallback(
    async (
      order: ReceiptOrder,
      receiptType: ReceiptType,
      deliveryPersonName?: string | null,
      printer?: PrinterInfo
    ) => {
      await dispatchPrint({
        order,
        receiptType,
        settings: currentSettings,
        restaurantName,
        deliveryPersonName,
        printer,
        trpcPrintToNetwork: networkPrint.mutateAsync,
      });
    },
    [currentSettings, restaurantName, networkPrint.mutateAsync]
  );

  const printAllTypes = useCallback(
    async (order: ReceiptOrder, deliveryPersonName?: string | null) => {
      await autoPrintOrder({
        order,
        settings: currentSettings,
        restaurantName,
        deliveryPersonName,
        trpcPrintToNetwork: networkPrint.mutateAsync,
      });
    },
    [currentSettings, restaurantName, networkPrint.mutateAsync]
  );

  const testPrint = useCallback(
    async (printer: PrinterInfo) => {
      await dispatchTestPrint({
        printer,
        restaurantName,
        trpcTestPrint: networkTestPrint.mutateAsync,
      });
    },
    [restaurantName, networkTestPrint.mutateAsync]
  );

  const getDefaultPrinter = useCallback((): PrinterInfo | undefined => {
    return (
      currentSettings.printers.find((p) => p.isDefault && p.isActive) ??
      currentSettings.printers.find((p) => p.isActive)
    );
  }, [currentSettings]);

  const getEnabledReceiptTypes = useCallback((): ReceiptType[] => {
    const types: ReceiptType[] = [];
    if (currentSettings.receiptTypes.customer) types.push("CUSTOMER");
    if (currentSettings.receiptTypes.kitchen) types.push("KITCHEN");
    if (currentSettings.receiptTypes.delivery) types.push("DELIVERY");
    return types;
  }, [currentSettings]);

  return {
    settings: currentSettings,
    isLoading,
    restaurantName,
    printOrder,
    printAllTypes,
    testPrint,
    getDefaultPrinter,
    getEnabledReceiptTypes,
    isPrinting: networkPrint.isPending,
  };
}
