"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { trpc } from "@/lib/trpc";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pendente", color: "bg-yellow-100 text-yellow-700" },
  CONFIRMED: { label: "Confirmado", color: "bg-blue-100 text-blue-700" },
  PREPARING: { label: "Preparando", color: "bg-orange-100 text-orange-700" },
  READY: { label: "Pronto", color: "bg-purple-100 text-purple-700" },
  OUT_FOR_DELIVERY: {
    label: "Saiu para entrega",
    color: "bg-indigo-100 text-indigo-700",
  },
  DELIVERED: { label: "Entregue", color: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Cancelado", color: "bg-red-100 text-red-700" },
};

const TYPE_LABELS: Record<string, string> = {
  DELIVERY: "Entrega",
  PICKUP: "Retirada",
  COUNTER: "Balcao",
  TABLE: "Mesa",
};

function formatBRL(value: string | number) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PedidosPage() {
  const { data: orders, isLoading } = trpc.customerPortal.getMyOrders.useQuery();

  if (isLoading) {
    return <p className="text-center text-gray-500">Carregando pedidos...</p>;
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="rounded-xl bg-white p-8 text-center shadow-sm">
        <ShoppingBag className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-3 text-gray-600">Voce ainda nao fez nenhum pedido.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const status = STATUS_LABELS[order.status] ?? {
          label: order.status,
          color: "bg-gray-100 text-gray-700",
        };
        return (
          <Link
            key={order.id}
            href={`/restaurante/${order.tenantSlug}/pedido/${order.id}`}
            className="block rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">
                  {order.tenantName}
                </p>
                <p className="text-xs text-gray-500">
                  Pedido #{order.displayNumber} ·{" "}
                  {TYPE_LABELS[order.type] ?? order.type}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {new Date(order.createdAt).toLocaleString("pt-BR")}
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}
                >
                  {status.label}
                </span>
                <p className="mt-1 text-base font-bold text-gray-900">
                  {formatBRL(order.total)}
                </p>
                {order.loyaltyPointsEarned > 0 && (
                  <p className="text-xs text-purple-600">
                    +{order.loyaltyPointsEarned} pts
                  </p>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
