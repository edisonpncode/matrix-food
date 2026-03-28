"use client";

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";
import {
  Clock,
  Check,
  ChefHat,
  Package,
  Truck,
  X,
  RefreshCw,
  Volume2,
  VolumeX,
  Printer,
} from "lucide-react";
import { usePrinterSettings } from "@/hooks/use-printer-settings";

type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "PICKED_UP"
  | "CANCELLED";

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; bgColor: string; icon: React.ElementType }
> = {
  PENDING: { label: "Pendente", color: "text-yellow-700", bgColor: "bg-yellow-100", icon: Clock },
  CONFIRMED: { label: "Confirmado", color: "text-blue-700", bgColor: "bg-blue-100", icon: Check },
  PREPARING: { label: "Preparando", color: "text-orange-700", bgColor: "bg-orange-100", icon: ChefHat },
  READY: { label: "Pronto", color: "text-green-700", bgColor: "bg-green-100", icon: Package },
  OUT_FOR_DELIVERY: { label: "Saiu entrega", color: "text-purple-700", bgColor: "bg-purple-100", icon: Truck },
  DELIVERED: { label: "Entregue", color: "text-gray-700", bgColor: "bg-gray-100", icon: Check },
  PICKED_UP: { label: "Retirado", color: "text-gray-700", bgColor: "bg-gray-100", icon: Check },
  CANCELLED: { label: "Cancelado", color: "text-red-700", bgColor: "bg-red-100", icon: X },
};

const STATUS_FLOW: Record<string, OrderStatus> = {
  PENDING: "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "READY",
  READY: "DELIVERED",
};

const NEXT_ACTION_LABEL: Record<string, string> = {
  PENDING: "Confirmar",
  CONFIRMED: "Preparando",
  PREPARING: "Pronto",
  READY: "Entregue",
};

const FILTER_TABS: { label: string; value: OrderStatus | "ALL" | "ACTIVE" }[] = [
  { label: "Ativos", value: "ACTIVE" },
  { label: "Todos", value: "ALL" },
  { label: "Pendentes", value: "PENDING" },
  { label: "Confirmados", value: "CONFIRMED" },
  { label: "Preparando", value: "PREPARING" },
  { label: "Prontos", value: "READY" },
];

export default function PedidosPage() {
  const [filter, setFilter] = useState<OrderStatus | "ALL" | "ACTIVE">("ACTIVE");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const previousCountRef = useRef<number>(0);

  const queryStatus = filter === "ALL" || filter === "ACTIVE" ? undefined : filter;

  const { data: orders, refetch } = trpc.order.listByTenant.useQuery(
    { status: queryStatus },
    { refetchInterval: 15000 }
  );

  const { settings: printerSettings, printOrder, printAllTypes, getEnabledReceiptTypes } = usePrinterSettings();

  const updateStatus = trpc.order.updateStatus.useMutation({
    onSuccess: () => refetch(),
  });

  const filteredOrders =
    filter === "ACTIVE"
      ? orders?.filter(
          (o) =>
            o.status !== "DELIVERED" &&
            o.status !== "PICKED_UP" &&
            o.status !== "CANCELLED"
        )
      : orders;

  const pendingCount = orders?.filter((o) => o.status === "PENDING").length ?? 0;
  const preparingCount = orders?.filter((o) => o.status === "PREPARING").length ?? 0;
  const readyCount = orders?.filter((o) => o.status === "READY").length ?? 0;

  // Notification sound for new pending orders
  useEffect(() => {
    if (!orders) return;
    const currentPendingCount = orders.filter((o) => o.status === "PENDING").length;
    if (
      currentPendingCount > previousCountRef.current &&
      soundEnabled &&
      previousCountRef.current > 0
    ) {
      try {
        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.frequency.value = 800;
        oscillator.type = "sine";
        gainNode.gain.value = 0.3;
        oscillator.start();
        setTimeout(() => {
          oscillator.stop();
          ctx.close();
        }, 300);
      } catch {
        // Audio not available
      }
    }
    previousCountRef.current = currentPendingCount;
  }, [orders, soundEnabled]);

  function handleAdvanceStatus(orderId: string, currentStatus: string) {
    const next = STATUS_FLOW[currentStatus];
    if (!next) return;
    updateStatus.mutate({ id: orderId, status: next });

    // Auto-print ao confirmar
    if (
      next === "CONFIRMED" &&
      printerSettings.autoPrint.enabled &&
      printerSettings.autoPrint.onOrderConfirmed
    ) {
      const order = orders?.find((o) => o.id === orderId);
      if (order) {
        const orderForPrint = {
          id: order.id,
          displayNumber: order.displayNumber ?? String(order.orderNumber),
          type: order.type,
          status: order.status,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          tableNumber: order.tableNumber,
          deliveryAddress: order.deliveryAddress as any,
          subtotal: String(order.subtotal),
          deliveryFee: String(order.deliveryFee),
          discount: String(order.discount),
          total: String(order.total),
          paymentMethod: order.paymentMethod,
          notes: order.notes,
          createdAt: order.createdAt,
          items: order.items?.map((item: any) => ({
            productName: item.productName,
            variantName: item.variantName,
            quantity: item.quantity,
            unitPrice: String(item.unitPrice),
            totalPrice: String(item.totalPrice),
            notes: item.notes,
            customizations: item.customizations?.map((c: any) => ({
              customizationOptionName: c.customizationOptionName,
              price: String(c.price),
            })),
          })) ?? [],
        };
        printAllTypes(orderForPrint).catch(() => {});
      }
    }
  }

  function handlePrintOrder(orderId: string, receiptType: "CUSTOMER" | "KITCHEN" | "DELIVERY") {
    const order = orders?.find((o) => o.id === orderId);
    if (!order) return;
    const orderForPrint = {
      id: order.id,
      displayNumber: order.displayNumber ?? String(order.orderNumber),
      type: order.type,
      status: order.status,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      tableNumber: order.tableNumber,
      deliveryAddress: order.deliveryAddress as any,
      subtotal: String(order.subtotal),
      deliveryFee: String(order.deliveryFee),
      discount: String(order.discount),
      total: String(order.total),
      paymentMethod: order.paymentMethod,
      notes: order.notes,
      createdAt: order.createdAt,
      items: order.items?.map((item: any) => ({
        productName: item.productName,
        variantName: item.variantName,
        quantity: item.quantity,
        unitPrice: String(item.unitPrice),
        totalPrice: String(item.totalPrice),
        notes: item.notes,
        customizations: item.customizations?.map((c: any) => ({
          customizationOptionName: c.customizationOptionName,
          price: String(c.price),
        })),
      })) ?? [],
    };
    printOrder(orderForPrint, receiptType).catch(() => {});
  }

  function handleCancel(orderId: string) {
    if (confirm("Tem certeza que deseja cancelar este pedido?")) {
      updateStatus.mutate({ id: orderId, status: "CANCELLED" });
    }
  }

  function formatTime(date: Date | string) {
    return new Date(date).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="rounded-lg border p-2 hover:bg-accent"
            title={soundEnabled ? "Desativar som" : "Ativar som"}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-yellow-50 p-4 text-center">
          <p className="text-3xl font-bold text-yellow-700">{pendingCount}</p>
          <p className="text-sm text-yellow-600">Pendentes</p>
        </div>
        <div className="rounded-xl border bg-orange-50 p-4 text-center">
          <p className="text-3xl font-bold text-orange-700">{preparingCount}</p>
          <p className="text-sm text-orange-600">Preparando</p>
        </div>
        <div className="rounded-xl border bg-green-50 p-4 text-center">
          <p className="text-3xl font-bold text-green-700">{readyCount}</p>
          <p className="text-sm text-green-600">Prontos</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === tab.value
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-accent-foreground hover:bg-accent/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders Grid */}
      {!filteredOrders || filteredOrders.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          Nenhum pedido encontrado.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredOrders.map((order) => {
            const status = STATUS_CONFIG[order.status as OrderStatus];
            const nextLabel = NEXT_ACTION_LABEL[order.status];
            const StatusIcon = status?.icon ?? Clock;

            return (
              <div
                key={order.id}
                className={`rounded-xl border-2 bg-card p-5 shadow-sm ${
                  order.status === "PENDING"
                    ? "border-yellow-300"
                    : order.status === "READY"
                    ? "border-green-300"
                    : "border-border"
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold">
                    {order.displayNumber}
                  </span>
                  <span
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${status?.bgColor ?? ""} ${status?.color ?? ""}`}
                  >
                    <StatusIcon className="h-3.5 w-3.5" />
                    {status?.label ?? order.status}
                  </span>
                </div>

                {/* Type + Source + Time */}
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {order.type === "DELIVERY"
                      ? "Entrega"
                      : order.type === "DINE_IN"
                      ? "Mesa"
                      : "Retirada"}
                  </span>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {order.source === "POS" ? "POS" : "Online"}
                  </span>
                  <span>{formatTime(order.createdAt)}</span>
                </div>

                {/* Customer */}
                <div className="mt-2 text-sm text-muted-foreground">
                  {order.customerName}
                  {order.customerPhone && ` - ${order.customerPhone}`}
                </div>

                {/* Items */}
                <div className="mt-3 space-y-1 border-t pt-3 text-sm">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <span className="font-medium">
                        {item.quantity}x {item.productName}
                        {item.variantName && ` (${item.variantName})`}
                      </span>
                      <span className="text-muted-foreground">
                        {formatCurrency(parseFloat(item.totalPrice))}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Payment + Total */}
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <span className="text-xs text-muted-foreground">
                    {order.paymentMethod === "CASH"
                      ? "Dinheiro"
                      : order.paymentMethod === "PIX"
                      ? "PIX"
                      : order.paymentMethod === "CREDIT_CARD"
                      ? "Crédito"
                      : "Débito"}
                  </span>
                  <span className="text-xl font-bold text-primary">
                    {formatCurrency(parseFloat(order.total))}
                  </span>
                </div>

                {/* Actions */}
                <div className="mt-4 flex gap-2">
                  {/* Botao de impressao */}
                  {getEnabledReceiptTypes().length > 0 && (
                    <div className="relative group">
                      <button
                        className="rounded-lg border-2 border-border px-3 py-3 text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="Imprimir"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-10">
                        <div className="rounded-lg border border-border bg-card p-1 shadow-lg min-w-[140px]">
                          {getEnabledReceiptTypes().map((type) => (
                            <button
                              key={type}
                              onClick={() => handlePrintOrder(order.id, type)}
                              className="block w-full rounded px-3 py-1.5 text-left text-xs hover:bg-accent"
                            >
                              {type === "CUSTOMER"
                                ? "Recibo Cliente"
                                : type === "KITCHEN"
                                  ? "Ticket Cozinha"
                                  : "Via Entrega"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {order.status !== "DELIVERED" &&
                    order.status !== "PICKED_UP" &&
                    order.status !== "CANCELLED" && (
                      <button
                        onClick={() => handleCancel(order.id)}
                        className="flex-1 rounded-lg border-2 border-red-200 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 active:bg-red-100"
                      >
                        Cancelar
                      </button>
                    )}
                  {nextLabel && (
                    <button
                      onClick={() =>
                        handleAdvanceStatus(order.id, order.status)
                      }
                      disabled={updateStatus.isPending}
                      className="flex-[2] rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50"
                    >
                      {nextLabel}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
