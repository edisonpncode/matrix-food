"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";
import {
  Clock,
  Check,
  ChefHat,
  Truck,
  X,
  RefreshCw,
  Volume2,
  VolumeX,
  Printer,
  FileText,
  Loader2,
  User as UserIcon,
  Store,
  ShoppingBag,
  Utensils,
  Bike,
} from "lucide-react";
import { usePrinterSettings } from "@/hooks/use-printer-settings";
import { DeliveryPersonSelector } from "@/components/admin/delivery-person-selector";
import { FinalizeDeliveryModal } from "@/components/admin/finalize-delivery-modal";

type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "PICKED_UP"
  | "CANCELLED";

type OrderType = "DELIVERY" | "PICKUP" | "DINE_IN" | "COUNTER" | "TABLE";

type StageFilter =
  | "ACTIVE"
  | "PENDING"
  | "PREPARING"
  | "OUT_FOR_DELIVERY"
  | "FINALIZED";

const STATUS_BADGE: Record<
  OrderStatus,
  { label: string; color: string; bgColor: string; icon: React.ElementType }
> = {
  PENDING: {
    label: "Pendente",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
    icon: Clock,
  },
  CONFIRMED: {
    label: "Confirmado",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    icon: Check,
  },
  PREPARING: {
    label: "Preparando",
    color: "text-orange-700",
    bgColor: "bg-orange-100",
    icon: ChefHat,
  },
  READY: {
    label: "Pronto",
    color: "text-green-700",
    bgColor: "bg-green-100",
    icon: Check,
  },
  OUT_FOR_DELIVERY: {
    label: "Entregando",
    color: "text-purple-700",
    bgColor: "bg-purple-100",
    icon: Truck,
  },
  DELIVERED: {
    label: "Finalizado",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
    icon: Check,
  },
  PICKED_UP: {
    label: "Retirado",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
    icon: Check,
  },
  CANCELLED: {
    label: "Cancelado",
    color: "text-red-700",
    bgColor: "bg-red-100",
    icon: X,
  },
};

const STAGE_TABS: {
  value: StageFilter;
  label: string;
  color: string;
}[] = [
  { value: "ACTIVE", label: "Ativos", color: "bg-primary" },
  { value: "PENDING", label: "Pendentes", color: "bg-yellow-500" },
  { value: "PREPARING", label: "Preparando", color: "bg-orange-500" },
  { value: "OUT_FOR_DELIVERY", label: "Entregando", color: "bg-purple-500" },
  { value: "FINALIZED", label: "Finalizados", color: "bg-gray-500" },
];

const TYPE_TABS: {
  value: OrderType;
  label: string;
  icon: React.ElementType;
}[] = [
  { value: "DELIVERY", label: "Tele Entrega", icon: Bike },
  { value: "PICKUP", label: "Vem Buscar", icon: ShoppingBag },
  { value: "COUNTER", label: "Balcão", icon: Store },
  { value: "TABLE", label: "Mesa", icon: Utensils },
];

function matchesStage(order: { status: string; source: string; paymentStatus: string }, stage: StageFilter): boolean {
  switch (stage) {
    case "ACTIVE":
      return (
        order.status !== "DELIVERED" &&
        order.status !== "PICKED_UP" &&
        order.status !== "CANCELLED"
      );
    case "PENDING":
      return order.status === "PENDING" && order.source === "ONLINE";
    case "PREPARING":
      return order.status === "PREPARING";
    case "OUT_FOR_DELIVERY":
      return order.status === "OUT_FOR_DELIVERY";
    case "FINALIZED":
      return (
        (order.status === "DELIVERED" || order.status === "PICKED_UP") &&
        order.paymentStatus === "PAID"
      );
    default:
      return true;
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case "DELIVERY":
      return "Entrega";
    case "PICKUP":
      return "Retirada";
    case "COUNTER":
      return "Balcão";
    case "TABLE":
      return "Mesa";
    case "DINE_IN":
      return "Consumo";
    default:
      return type;
  }
}

function paymentLabel(method: string): string {
  switch (method) {
    case "CASH":
      return "Dinheiro";
    case "PIX":
      return "PIX";
    case "CREDIT_CARD":
      return "Crédito";
    case "DEBIT_CARD":
      return "Débito";
    default:
      return method;
  }
}

export function PedidosContent() {
  const [stage, setStage] = useState<StageFilter>("ACTIVE");
  const [typeFilter, setTypeFilter] = useState<OrderType | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const previousCountRef = useRef<number>(0);

  // Delivery assignment state
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  // Finalize delivery state
  const [finalizingOrderId, setFinalizingOrderId] = useState<string | null>(
    null
  );

  // Busca todos os pedidos do tenant (sem filtrar server-side — filtros são locais
  // para permitir trocar de aba sem refetch).
  const { data: orders, refetch } = trpc.order.listByTenant.useQuery(
    {},
    { refetchInterval: 15000 }
  );

  const deliveryPeopleQuery = trpc.staff.listDeliveryPeople.useQuery();

  const {
    settings: printerSettings,
    printOrder,
    printAllTypes,
    getEnabledReceiptTypes,
  } = usePrinterSettings();

  const fiscalConfig = trpc.fiscal.getConfig.useQuery();
  const emitNfce = trpc.fiscal.emit.useMutation({
    onSuccess: () => refetch(),
  });

  const isFiscalActive =
    fiscalConfig.data?.isActive &&
    fiscalConfig.data?.emissionMode === "MANUAL";

  const approveOrder = trpc.order.approveOnlineOrder.useMutation({
    onSuccess: () => refetch(),
  });

  const assignDeliveryPerson = trpc.order.assignDeliveryPerson.useMutation({
    onSuccess: () => {
      refetch();
      setAssigningOrderId(null);
    },
  });

  const finalizeOrder = trpc.order.finalizeOrder.useMutation({
    onSuccess: () => refetch(),
  });

  const cancelOrder = trpc.order.updateStatus.useMutation({
    onSuccess: () => refetch(),
  });

  // === Contadores ===
  const counters = useMemo(() => {
    if (!orders) {
      return {
        pending: 0,
        preparing: 0,
        outForDelivery: 0,
        finalized: 0,
      };
    }
    return {
      pending: orders.filter(
        (o) => o.status === "PENDING" && o.source === "ONLINE"
      ).length,
      preparing: orders.filter((o) => o.status === "PREPARING").length,
      outForDelivery: orders.filter((o) => o.status === "OUT_FOR_DELIVERY")
        .length,
      finalized: orders.filter(
        (o) =>
          (o.status === "DELIVERED" || o.status === "PICKED_UP") &&
          o.paymentStatus === "PAID"
      ).length,
    };
  }, [orders]);

  // === Pedidos filtrados ===
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter((o) => {
      if (!matchesStage(o, stage)) return false;
      if (typeFilter && o.type !== typeFilter) return false;
      return true;
    });
  }, [orders, stage, typeFilter]);

  // === Som de notificação para novos pedidos pendentes ===
  useEffect(() => {
    if (!orders) return;
    const currentPendingCount = orders.filter(
      (o) => o.status === "PENDING" && o.source === "ONLINE"
    ).length;
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

  function orderForPrint(order: NonNullable<typeof orders>[number]) {
    return {
      id: order.id,
      displayNumber: order.displayNumber ?? String(order.orderNumber),
      type: order.type,
      status: order.status,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      tableNumber: order.tableNumber,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      deliveryAddress: order.deliveryAddress as any,
      subtotal: String(order.subtotal),
      deliveryFee: String(order.deliveryFee),
      discount: String(order.discount),
      total: String(order.total),
      paymentMethod: order.paymentMethod,
      notes: order.notes,
      createdAt: order.createdAt,
      items:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        order.items?.map((item: any) => ({
          productName: item.productName,
          variantName: item.variantName,
          quantity: item.quantity,
          unitPrice: String(item.unitPrice),
          totalPrice: String(item.totalPrice),
          notes: item.notes,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          customizations: item.customizations?.map((c: any) => ({
            customizationOptionName: c.customizationOptionName,
            price: String(c.price),
          })),
        })) ?? [],
    };
  }

  function handleApprove(orderId: string) {
    approveOrder.mutate(
      { orderId },
      {
        onSuccess: () => {
          // Auto-imprimir ao aprovar (substitui o auto-print de CONFIRMED)
          const order = orders?.find((o) => o.id === orderId);
          if (
            order &&
            printerSettings.autoPrint.enabled &&
            printerSettings.autoPrint.onOrderConfirmed
          ) {
            printAllTypes(orderForPrint(order)).catch(() => {});
          }
        },
      }
    );
  }

  function handleAssignDeliveryPerson(personId: string) {
    if (!assigningOrderId) return;
    assignDeliveryPerson.mutate(
      { orderId: assigningOrderId, deliveryPersonId: personId },
      {
        onSuccess: () => {
          // Auto-imprimir via de entrega
          const order = orders?.find((o) => o.id === assigningOrderId);
          if (
            order &&
            printerSettings.autoPrint.enabled &&
            getEnabledReceiptTypes().includes("DELIVERY")
          ) {
            printOrder(orderForPrint(order), "DELIVERY").catch(() => {});
          }
        },
      }
    );
  }

  function handleFinalizeNonDelivery(orderId: string) {
    if (!confirm("Finalizar este pedido como pago?")) return;
    finalizeOrder.mutate({ orderId });
  }

  function handlePrintOrder(
    orderId: string,
    receiptType: "CUSTOMER" | "KITCHEN" | "DELIVERY"
  ) {
    const order = orders?.find((o) => o.id === orderId);
    if (!order) return;
    printOrder(orderForPrint(order), receiptType).catch(() => {});
  }

  function handleCancel(orderId: string) {
    if (confirm("Tem certeza que deseja cancelar este pedido?")) {
      cancelOrder.mutate({ id: orderId, status: "CANCELLED" });
    }
  }

  function formatTime(date: Date | string) {
    return new Date(date).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const orderBeingFinalized = useMemo(
    () => orders?.find((o) => o.id === finalizingOrderId) ?? null,
    [orders, finalizingOrderId]
  );

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

      {/* Counters — 4 cartões casando com os estágios principais */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border bg-yellow-50 p-4 text-center">
          <p className="text-3xl font-bold text-yellow-700">
            {counters.pending}
          </p>
          <p className="text-sm text-yellow-600">Pendentes</p>
        </div>
        <div className="rounded-xl border bg-orange-50 p-4 text-center">
          <p className="text-3xl font-bold text-orange-700">
            {counters.preparing}
          </p>
          <p className="text-sm text-orange-600">Preparando</p>
        </div>
        <div className="rounded-xl border bg-purple-50 p-4 text-center">
          <p className="text-3xl font-bold text-purple-700">
            {counters.outForDelivery}
          </p>
          <p className="text-sm text-purple-600">Entregando</p>
        </div>
        <div className="rounded-xl border bg-gray-50 p-4 text-center">
          <p className="text-3xl font-bold text-gray-700">
            {counters.finalized}
          </p>
          <p className="text-sm text-gray-600">Finalizados</p>
        </div>
      </div>

      {/* Filtros de estágio */}
      <div className="flex flex-wrap gap-2">
        {STAGE_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStage(tab.value)}
            className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              stage === tab.value
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-accent-foreground hover:bg-accent/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filtros de tipo (segunda linha) */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTypeFilter(null)}
          className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            typeFilter === null
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:bg-accent"
          }`}
        >
          Todos os tipos
        </button>
        {TYPE_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = typeFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setTypeFilter(active ? null : tab.value)}
              className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-accent"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Orders Grid */}
      {!filteredOrders || filteredOrders.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          Nenhum pedido encontrado.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredOrders.map((order) => {
            const status = STATUS_BADGE[order.status as OrderStatus];
            const StatusIcon = status?.icon ?? Clock;
            const isDelivery = order.type === "DELIVERY";
            const hasAssignedDriver = !!order.deliveryPersonId;
            const assignedDriverName = hasAssignedDriver
              ? deliveryPeopleQuery.data?.find(
                  (p) => p.id === order.deliveryPersonId
                )?.name ?? "Motoboy atribuído"
              : null;

            return (
              <div
                key={order.id}
                className={`rounded-xl border-2 bg-card p-5 shadow-sm ${
                  order.status === "PENDING" && order.source === "ONLINE"
                    ? "border-yellow-300"
                    : order.status === "OUT_FOR_DELIVERY"
                      ? "border-purple-300"
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
                    {typeLabel(order.type)}
                    {order.type === "TABLE" && order.tableNumber
                      ? ` ${order.tableNumber}`
                      : ""}
                  </span>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {order.source === "POS" ? "POS" : "Online"}
                  </span>
                  <span>{formatTime(order.createdAt)}</span>
                </div>

                {/* Customer */}
                <div className="mt-2 text-sm text-muted-foreground">
                  {order.customerName}
                  {order.customerPhone && ` — ${order.customerPhone}`}
                </div>

                {/* Motoboy (quando atribuído) */}
                {hasAssignedDriver && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-md bg-purple-50 px-2 py-1 text-xs text-purple-700">
                    <UserIcon className="h-3.5 w-3.5" />
                    <span className="font-medium">
                      Motoboy: {assignedDriverName}
                    </span>
                  </div>
                )}

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
                    {paymentLabel(order.paymentMethod)}
                    {order.paymentStatus === "PAID" && " • Pago"}
                    {order.paymentStatus === "PENDING" && " • A receber"}
                  </span>
                  <span className="text-xl font-bold text-primary">
                    {formatCurrency(parseFloat(order.total))}
                  </span>
                </div>

                {/* Valor recebido (somente finalizados) */}
                {order.amountReceived && (
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Valor recebido:</span>
                    <span className="font-semibold">
                      {formatCurrency(parseFloat(order.amountReceived))}
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex gap-2">
                  {/* Botão de impressão */}
                  {getEnabledReceiptTypes().length > 0 && (
                    <div className="group relative">
                      <button
                        className="rounded-lg border-2 border-border px-3 py-3 text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="Imprimir"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      <div className="absolute bottom-full left-0 z-10 mb-1 hidden group-hover:block">
                        <div className="min-w-[140px] rounded-lg border border-border bg-card p-1 shadow-lg">
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

                  {/* NFC-e manual */}
                  {isFiscalActive && order.paymentStatus === "PAID" && (
                    <button
                      onClick={() => emitNfce.mutate({ orderId: order.id })}
                      disabled={emitNfce.isPending}
                      className="rounded-lg border-2 border-green-200 px-3 py-3 text-green-600 hover:bg-green-50 active:bg-green-100 disabled:opacity-50"
                      title="Emitir NFC-e"
                    >
                      {emitNfce.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </button>
                  )}

                  {/* Cancelar (disponível enquanto não finalizado) */}
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

                  {/* Ação principal por status */}
                  {order.status === "PENDING" && order.source === "ONLINE" && (
                    <button
                      onClick={() => handleApprove(order.id)}
                      disabled={approveOrder.isPending}
                      className="flex-[2] rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50"
                    >
                      Aprovar
                    </button>
                  )}

                  {order.status === "PREPARING" && isDelivery && (
                    <button
                      onClick={() => setAssigningOrderId(order.id)}
                      disabled={assignDeliveryPerson.isPending}
                      className="flex flex-[2] items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                    >
                      <Bike className="h-4 w-4" />
                      Atribuir Motoboy
                    </button>
                  )}

                  {order.status === "PREPARING" && !isDelivery && (
                    <button
                      onClick={() => handleFinalizeNonDelivery(order.id)}
                      disabled={finalizeOrder.isPending}
                      className="flex-[2] rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                      Finalizar
                    </button>
                  )}

                  {order.status === "OUT_FOR_DELIVERY" && (
                    <button
                      onClick={() => setFinalizingOrderId(order.id)}
                      className="flex-[2] rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700"
                    >
                      Conferir e Finalizar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modais */}
      {assigningOrderId && (
        <DeliveryPersonSelector
          deliveryPeople={deliveryPeopleQuery.data ?? []}
          onSelect={handleAssignDeliveryPerson}
          onClose={() => setAssigningOrderId(null)}
          isLoading={assignDeliveryPerson.isPending}
        />
      )}

      {finalizingOrderId && orderBeingFinalized && (
        <FinalizeDeliveryModal
          order={{
            id: orderBeingFinalized.id,
            displayNumber: orderBeingFinalized.displayNumber,
            total: parseFloat(orderBeingFinalized.total),
            customerName: orderBeingFinalized.customerName,
          }}
          onClose={() => setFinalizingOrderId(null)}
          onSuccess={() => {
            setFinalizingOrderId(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
