"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";
import {
  Clock,
  Check,
  ChefHat,
  Package,
  Truck,
  X,
  Store,
  UtensilsCrossed,
  PackageCheck,
  User,
  Phone,
  MapPin,
} from "lucide-react";
import { DeliveryPersonSelector } from "@/components/admin/delivery-person-selector";

// --- Types ---

type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "PICKED_UP"
  | "CANCELLED";

type OrderType = "COUNTER" | "DINE_IN" | "TABLE" | "PICKUP" | "DELIVERY";

type TypeFilter = "ALL" | "COUNTER" | "TABLE" | "PICKUP" | "DELIVERY";

type ViewMode = "ORDERS" | "TABLES";

// --- Config ---

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  PENDING: { label: "Pendente", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  CONFIRMED: { label: "Confirmado", color: "bg-blue-100 text-blue-700", icon: Check },
  PREPARING: { label: "Preparando", color: "bg-orange-100 text-orange-700", icon: ChefHat },
  READY: { label: "Pronto", color: "bg-green-100 text-green-700", icon: Package },
  OUT_FOR_DELIVERY: { label: "Saiu entrega", color: "bg-purple-100 text-purple-700", icon: Truck },
  DELIVERED: { label: "Entregue", color: "bg-gray-100 text-gray-700", icon: Check },
  PICKED_UP: { label: "Retirado", color: "bg-gray-100 text-gray-700", icon: Check },
  CANCELLED: { label: "Cancelado", color: "bg-red-100 text-red-700", icon: X },
};

const TYPE_CONFIG: Record<
  OrderType,
  { label: string; color: string; icon: React.ElementType }
> = {
  COUNTER: { label: "Balcao", color: "bg-gray-100 text-gray-700", icon: Store },
  DINE_IN: { label: "Balcao", color: "bg-gray-100 text-gray-700", icon: Store },
  TABLE: { label: "Mesa", color: "bg-blue-100 text-blue-700", icon: UtensilsCrossed },
  PICKUP: { label: "Buscar", color: "bg-orange-100 text-orange-700", icon: PackageCheck },
  DELIVERY: { label: "Entrega", color: "bg-teal-100 text-teal-700", icon: Truck },
};

// Type-aware status flows
const STATUS_FLOW: Record<string, Record<string, OrderStatus | undefined>> = {
  COUNTER: {
    CONFIRMED: "PREPARING",
    PREPARING: "READY",
    READY: "PICKED_UP",
  },
  DINE_IN: {
    CONFIRMED: "PREPARING",
    PREPARING: "READY",
    READY: "PICKED_UP",
  },
  TABLE: {
    CONFIRMED: "PREPARING",
    PREPARING: "READY",
    READY: "DELIVERED",
  },
  PICKUP: {
    PENDING: "CONFIRMED",
    CONFIRMED: "PREPARING",
    PREPARING: "READY",
    READY: "PICKED_UP",
  },
  DELIVERY: {
    PENDING: "CONFIRMED",
    CONFIRMED: "PREPARING",
    PREPARING: "READY",
    READY: "OUT_FOR_DELIVERY",
    OUT_FOR_DELIVERY: "DELIVERED",
  },
};

const STATUS_FILTER_TABS: { label: string; value: OrderStatus | "ALL" }[] = [
  { label: "Todos", value: "ALL" },
  { label: "Pendentes", value: "PENDING" },
  { label: "Confirmados", value: "CONFIRMED" },
  { label: "Preparando", value: "PREPARING" },
  { label: "Prontos", value: "READY" },
];

const TYPE_FILTER_TABS: { label: string; value: TypeFilter }[] = [
  { label: "Todos", value: "ALL" },
  { label: "Balcao", value: "COUNTER" },
  { label: "Mesa", value: "TABLE" },
  { label: "Buscar", value: "PICKUP" },
  { label: "Entrega", value: "DELIVERY" },
];

const PAYMENT_METHODS = [
  { value: "PIX", label: "PIX" },
  { value: "CASH", label: "Dinheiro" },
  { value: "CREDIT_CARD", label: "Credito" },
  { value: "DEBIT_CARD", label: "Debito" },
] as const;

// --- Helper to get next status for a given order type ---

function getNextStatus(orderType: string, currentStatus: string): OrderStatus | undefined {
  const flow = STATUS_FLOW[orderType] ?? STATUS_FLOW["COUNTER"] ?? {};
  return flow[currentStatus];
}

// --- Component ---

export default function PedidosPage() {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [viewMode, setViewMode] = useState<ViewMode>("ORDERS");

  // Delivery person assignment modal
  const [deliveryModalOrderId, setDeliveryModalOrderId] = useState<string | null>(null);

  // Table detail modal
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [closeTablePayment, setCloseTablePayment] = useState<string>("PIX");

  const utils = trpc.useUtils();

  // --- Queries ---

  const { data: orders, refetch } = trpc.order.listByTenant.useQuery({
    status: statusFilter === "ALL" ? undefined : statusFilter,
  });

  const { data: openTables } = trpc.order.listOpenTables.useQuery(undefined, {
    enabled: viewMode === "TABLES",
  });

  const { data: tableOrders } = trpc.order.getTableOrders.useQuery(
    { tableNumber: selectedTable! },
    { enabled: selectedTable !== null }
  );

  const { data: staff } = trpc.staff.list.useQuery(undefined, {
    enabled: deliveryModalOrderId !== null,
  });

  // --- Mutations ---

  const updateStatus = trpc.order.updateStatus.useMutation({
    onSuccess: () => {
      refetch();
      utils.order.listOpenTables.invalidate();
    },
  });

  const assignDeliveryPerson = trpc.order.assignDeliveryPerson.useMutation({
    onSuccess: () => {
      setDeliveryModalOrderId(null);
      refetch();
    },
  });

  const closeTable = trpc.order.closeTable.useMutation({
    onSuccess: () => {
      setSelectedTable(null);
      refetch();
      utils.order.listOpenTables.invalidate();
    },
  });

  // --- Handlers ---

  function handleAdvanceStatus(orderId: string, orderType: string, currentStatus: string) {
    const next = getNextStatus(orderType, currentStatus);
    if (!next) return;

    // If advancing DELIVERY order to OUT_FOR_DELIVERY, show delivery person selector
    if (orderType === "DELIVERY" && next === "OUT_FOR_DELIVERY") {
      setDeliveryModalOrderId(orderId);
      return;
    }

    updateStatus.mutate({ id: orderId, status: next });
  }

  function handleAssignDeliveryPerson(deliveryPersonId: string) {
    if (!deliveryModalOrderId) return;
    assignDeliveryPerson.mutate({
      orderId: deliveryModalOrderId,
      deliveryPersonId,
    });
  }

  function handleCancel(orderId: string) {
    if (confirm("Tem certeza que deseja cancelar este pedido?")) {
      updateStatus.mutate({ id: orderId, status: "CANCELLED" });
    }
  }

  function handleCloseTable() {
    if (selectedTable === null) return;
    closeTable.mutate({
      tableNumber: selectedTable,
      paymentMethod: closeTablePayment as "PIX" | "CASH" | "CREDIT_CARD" | "DEBIT_CARD",
    });
  }

  function formatTime(date: Date | string) {
    return new Date(date).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatTimeSince(date: Date | string) {
    const now = new Date();
    const opened = new Date(date);
    const diffMs = now.getTime() - opened.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `${diffMin}min`;
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return `${hours}h${mins > 0 ? `${mins}min` : ""}`;
  }

  // --- Filter orders by type ---

  const filteredOrders = orders?.filter((order) => {
    if (typeFilter === "ALL") return true;
    if (typeFilter === "COUNTER") {
      return order.type === "COUNTER" || order.type === "DINE_IN";
    }
    return order.type === typeFilter;
  });

  // --- Delivery staff list ---

  const deliveryStaff = (staff ?? []).filter(
    (s) => s.role === "DELIVERY" && s.isActive
  );

  // --- Build a map of delivery person names by ID ---
  const deliveryPersonMap = new Map<string, string>();
  (staff ?? []).forEach((s) => {
    if (s.role === "DELIVERY") {
      deliveryPersonMap.set(s.id, s.name);
    }
  });

  // We always query staff so we can show delivery person names on cards
  const { data: allStaff } = trpc.staff.list.useQuery();
  const allStaffMap = new Map<string, { name: string; phone: string | null }>();
  (allStaff ?? []).forEach((s) => {
    allStaffMap.set(s.id, { name: s.name, phone: s.phone });
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <button
          onClick={() => refetch()}
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Atualizar
        </button>
      </div>

      {/* View Mode Tabs: Pedidos / Mesas */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode("ORDERS")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            viewMode === "ORDERS"
              ? "bg-primary text-primary-foreground"
              : "bg-accent text-accent-foreground hover:bg-accent/80"
          }`}
        >
          Pedidos
        </button>
        <button
          onClick={() => setViewMode("TABLES")}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            viewMode === "TABLES"
              ? "bg-primary text-primary-foreground"
              : "bg-accent text-accent-foreground hover:bg-accent/80"
          }`}
        >
          <UtensilsCrossed className="h-4 w-4" />
          Mesas
        </button>
      </div>

      {/* --- ORDERS VIEW --- */}
      {viewMode === "ORDERS" && (
        <>
          {/* Status Filters */}
          <div className="flex gap-2 overflow-x-auto">
            {STATUS_FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  statusFilter === tab.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-accent text-accent-foreground hover:bg-accent/80"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Type Filters */}
          <div className="flex gap-2 overflow-x-auto">
            {TYPE_FILTER_TABS.map((tab) => {
              const config = tab.value !== "ALL" ? TYPE_CONFIG[tab.value] : null;
              const TabIcon = config?.icon;
              return (
                <button
                  key={tab.value}
                  onClick={() => setTypeFilter(tab.value)}
                  className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    typeFilter === tab.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-accent-foreground hover:bg-accent/80"
                  }`}
                >
                  {TabIcon && <TabIcon className="h-3.5 w-3.5" />}
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Order List */}
          {!filteredOrders || filteredOrders.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Nenhum pedido encontrado.
            </p>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const status = STATUS_CONFIG[order.status as OrderStatus];
                const typeConfig = TYPE_CONFIG[order.type as OrderType] ?? TYPE_CONFIG.COUNTER;
                const nextStatus = getNextStatus(order.type, order.status);
                const nextLabel = nextStatus ? STATUS_CONFIG[nextStatus]?.label : null;
                const StatusIcon = status?.icon ?? Clock;
                const TypeIcon = typeConfig.icon;

                const isTerminal =
                  order.status === "DELIVERED" ||
                  order.status === "PICKED_UP" ||
                  order.status === "CANCELLED";

                // Delivery address info
                const deliveryAddr = order.deliveryAddress as {
                  street?: string;
                  number?: string;
                  neighborhood?: string;
                  referencePoint?: string;
                } | null;

                // Delivery person info
                const deliveryPersonInfo = order.deliveryPersonId
                  ? allStaffMap.get(order.deliveryPersonId)
                  : null;

                return (
                  <div
                    key={order.id}
                    className="rounded-xl border border-border bg-card p-4 shadow-sm"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-bold">
                          {order.displayNumber}
                        </span>
                        <span
                          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${status?.color ?? ""}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {status?.label ?? order.status}
                        </span>
                        {/* Type badge */}
                        <span
                          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${typeConfig.color}`}
                        >
                          <TypeIcon className="h-3 w-3" />
                          {typeConfig.label}
                        </span>
                        {/* Table badge for TABLE orders */}
                        {order.type === "TABLE" && order.tableNumber && (
                          <span className="flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            <UtensilsCrossed className="h-3 w-3" />
                            Mesa {order.tableNumber}
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatTime(order.createdAt)}
                      </span>
                    </div>

                    {/* Customer */}
                    <div className="mt-2 text-sm text-muted-foreground">
                      {order.customerName}
                      {(order.type === "PICKUP" || order.type === "DELIVERY") &&
                        order.customerPhone && (
                          <span className="ml-2 inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {order.customerPhone}
                          </span>
                        )}
                      {order.type !== "PICKUP" &&
                        order.type !== "DELIVERY" &&
                        order.customerPhone && (
                          <span> - {order.customerPhone}</span>
                        )}
                    </div>

                    {/* Delivery address for DELIVERY orders */}
                    {order.type === "DELIVERY" && deliveryAddr && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-teal-50 p-2 text-xs text-teal-800">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <div>
                          <span className="font-medium">
                            {deliveryAddr.street}, {deliveryAddr.number}
                          </span>
                          {deliveryAddr.neighborhood && (
                            <span> - {deliveryAddr.neighborhood}</span>
                          )}
                          {deliveryAddr.referencePoint && (
                            <div className="mt-0.5 text-teal-600">
                              Ref: {deliveryAddr.referencePoint}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Delivery person info */}
                    {order.type === "DELIVERY" && deliveryPersonInfo && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-purple-700">
                        <User className="h-3.5 w-3.5" />
                        <span className="font-medium">
                          Entregador: {deliveryPersonInfo.name}
                        </span>
                        {deliveryPersonInfo.phone && (
                          <span className="text-purple-500">
                            ({deliveryPersonInfo.phone})
                          </span>
                        )}
                      </div>
                    )}

                    {/* Items */}
                    <div className="mt-2 space-y-0.5 text-sm">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between">
                          <span>
                            {item.quantity}x {item.productName}
                            {item.variantName && ` (${item.variantName})`}
                          </span>
                          <span className="text-muted-foreground">
                            {formatCurrency(parseFloat(item.totalPrice))}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Total + Actions */}
                    <div className="mt-3 flex items-center justify-between border-t pt-3">
                      <span className="text-lg font-bold text-primary">
                        {formatCurrency(parseFloat(order.total))}
                      </span>

                      <div className="flex gap-2">
                        {!isTerminal && (
                          <button
                            onClick={() => handleCancel(order.id)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                          >
                            Cancelar
                          </button>
                        )}
                        {nextLabel && (
                          <button
                            onClick={() =>
                              handleAdvanceStatus(
                                order.id,
                                order.type,
                                order.status
                              )
                            }
                            disabled={updateStatus.isPending}
                            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                          >
                            {nextLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* --- TABLES VIEW --- */}
      {viewMode === "TABLES" && (
        <>
          {!openTables || openTables.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Nenhuma mesa aberta no momento.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {openTables.map((table) => (
                <button
                  key={table.tableNumber}
                  onClick={() => setSelectedTable(table.tableNumber)}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary hover:bg-accent"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                    <UtensilsCrossed className="h-6 w-6" />
                  </div>
                  <span className="text-lg font-bold">
                    Mesa {table.tableNumber}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {table.orderCount} pedido{table.orderCount !== 1 ? "s" : ""}
                  </span>
                  <span className="text-base font-semibold text-primary">
                    {formatCurrency(parseFloat(table.totalValue))}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Aberta ha {formatTimeSince(table.openedAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* --- TABLE DETAIL MODAL --- */}
      {selectedTable !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Mesa {selectedTable}</h3>
              <button
                onClick={() => setSelectedTable(null)}
                className="rounded-lg p-1.5 hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Table orders */}
            {!tableOrders || tableOrders.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nenhum pedido encontrado para esta mesa.
              </p>
            ) : (
              <div className="max-h-80 space-y-3 overflow-y-auto">
                {tableOrders.map((order) => {
                  const status = STATUS_CONFIG[order.status as OrderStatus];
                  const StatusIcon = status?.icon ?? Clock;
                  return (
                    <div
                      key={order.id}
                      className="rounded-lg border border-border p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{order.displayNumber}</span>
                        <span
                          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${status?.color ?? ""}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {status?.label ?? order.status}
                        </span>
                      </div>
                      <div className="mt-1 space-y-0.5 text-sm">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex justify-between">
                            <span>
                              {item.quantity}x {item.productName}
                              {item.variantName && ` (${item.variantName})`}
                            </span>
                            <span className="text-muted-foreground">
                              {formatCurrency(parseFloat(item.totalPrice))}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-1 text-right text-sm font-semibold text-primary">
                        {formatCurrency(parseFloat(order.total))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Total */}
            {tableOrders && tableOrders.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Total da mesa
                  </span>
                  <span className="text-xl font-bold text-primary">
                    {formatCurrency(
                      tableOrders.reduce(
                        (sum, o) => sum + parseFloat(o.total),
                        0
                      )
                    )}
                  </span>
                </div>

                {/* Payment method selection */}
                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium">
                    Forma de pagamento
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map((method) => (
                      <button
                        key={method.value}
                        onClick={() => setCloseTablePayment(method.value)}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          closeTablePayment === method.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-accent"
                        }`}
                      >
                        {method.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Close table button */}
                <button
                  onClick={handleCloseTable}
                  disabled={closeTable.isPending}
                  className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {closeTable.isPending ? "Fechando..." : "Fechar Mesa"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- DELIVERY PERSON SELECTOR MODAL --- */}
      {deliveryModalOrderId !== null && (
        <DeliveryPersonSelector
          deliveryPeople={deliveryStaff.map((s) => ({
            id: s.id,
            name: s.name,
            phone: s.phone,
          }))}
          onSelect={handleAssignDeliveryPerson}
          onClose={() => setDeliveryModalOrderId(null)}
          isLoading={assignDeliveryPerson.isPending}
        />
      )}
    </div>
  );
}
