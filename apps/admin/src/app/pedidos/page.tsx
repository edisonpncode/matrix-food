"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";
import { Clock, Check, ChefHat, Package, Truck, X } from "lucide-react";

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

const STATUS_FLOW: Record<string, OrderStatus> = {
  PENDING: "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "READY",
  READY: "DELIVERED",
};

const FILTER_TABS: { label: string; value: OrderStatus | "ALL" }[] = [
  { label: "Todos", value: "ALL" },
  { label: "Pendentes", value: "PENDING" },
  { label: "Confirmados", value: "CONFIRMED" },
  { label: "Preparando", value: "PREPARING" },
  { label: "Prontos", value: "READY" },
];

export default function PedidosPage() {
  const [filter, setFilter] = useState<OrderStatus | "ALL">("ALL");

  const { data: orders, refetch, isLoading, error } = trpc.order.listByTenant.useQuery(
    { status: filter === "ALL" ? undefined : filter },
    {
      refetchInterval: 15_000, // Atualiza a cada 15 segundos
      staleTime: 0,
      refetchOnWindowFocus: true,
    }
  );

  const updateStatus = trpc.order.updateStatus.useMutation({
    onSuccess: () => refetch(),
  });

  function handleAdvanceStatus(orderId: string, currentStatus: string) {
    const next = STATUS_FLOW[currentStatus];
    if (!next) return;
    updateStatus.mutate({ id: orderId, status: next });
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <button
          onClick={() => refetch()}
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Atualizar
        </button>
      </div>

      {/* Filtros */}
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

      {/* Lista de pedidos */}
      {isLoading ? (
        <p className="py-8 text-center text-muted-foreground">
          Carregando pedidos...
        </p>
      ) : error ? (
        <div className="py-8 text-center">
          <p className="text-red-500">Erro ao carregar pedidos: {error.message}</p>
          <button
            onClick={() => refetch()}
            className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90"
          >
            Tentar novamente
          </button>
        </div>
      ) : !orders || orders.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          Nenhum pedido encontrado.
        </p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const status = STATUS_CONFIG[order.status as OrderStatus];
            const nextStatus = STATUS_FLOW[order.status];
            const nextLabel = nextStatus
              ? STATUS_CONFIG[nextStatus]?.label
              : null;
            const StatusIcon = status?.icon ?? Clock;

            return (
              <div
                key={order.id}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold">
                      {order.displayNumber}
                    </span>
                    <span
                      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${status?.color ?? ""}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {status?.label ?? order.status}
                    </span>
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {order.type === "DELIVERY" ? "Entrega" : "Retirada"}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatTime(order.createdAt)}
                  </span>
                </div>

                {/* Cliente */}
                <div className="mt-2 text-sm text-muted-foreground">
                  {order.customerName} - {order.customerPhone}
                </div>

                {/* Itens */}
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
                    {order.status !== "DELIVERED" &&
                      order.status !== "PICKED_UP" &&
                      order.status !== "CANCELLED" && (
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
                          handleAdvanceStatus(order.id, order.status)
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
    </div>
  );
}
