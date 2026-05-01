"use client";

import Link from "next/link";
import { ChevronRight, ShoppingBag } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";
import { ContaShell } from "../conta-shell";

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "Pendente", tone: "bg-yellow-100 text-yellow-800" },
  CONFIRMED: { label: "Confirmado", tone: "bg-blue-100 text-blue-800" },
  PREPARING: { label: "Em preparo", tone: "bg-orange-100 text-orange-800" },
  READY: { label: "Pronto", tone: "bg-purple-100 text-purple-800" },
  OUT_FOR_DELIVERY: {
    label: "Saiu para entrega",
    tone: "bg-indigo-100 text-indigo-800",
  },
  DELIVERED: { label: "Entregue", tone: "bg-green-100 text-green-800" },
  PICKED_UP: { label: "Retirado", tone: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Cancelado", tone: "bg-red-100 text-red-700" },
};

function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PedidosPage() {
  const { data, isLoading } = trpc.customerPortal.getMyOrders.useQuery();

  return (
    <ContaShell title="Meus pedidos">
      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl bg-white shadow-sm"
            />
          ))}
        </div>
      )}

      {!isLoading && data && data.length === 0 && (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <h2 className="text-base font-semibold text-gray-900">
            Você ainda não fez pedidos
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Quando fizer um pedido, ele aparece aqui.
          </p>
        </div>
      )}

      {!isLoading && data && data.length > 0 && (
        <ul className="space-y-3">
          {data.map((order) => {
            const status = STATUS_LABELS[order.status] ?? {
              label: order.status,
              tone: "bg-gray-100 text-gray-700",
            };
            const total = formatCurrency(Number(order.total ?? 0));
            return (
              <li key={order.id}>
                <Link
                  href={`/restaurantes/${order.tenantSlug}/pedido/${order.id}`}
                  className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-gray-900">
                        {order.tenantName}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${status.tone}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                      <span>#{order.displayNumber}</span>
                      <span aria-hidden>·</span>
                      <span>{formatDate(order.createdAt)}</span>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">
                      {total}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </ContaShell>
  );
}
