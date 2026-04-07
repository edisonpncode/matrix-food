"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function FidelidadePage() {
  const { data, isLoading } = trpc.customerPortal.getMyLoyalty.useQuery();

  if (isLoading) {
    return <p className="text-center text-gray-500">Carregando pontos...</p>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl bg-white p-8 text-center shadow-sm">
        <Star className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-3 text-gray-600">
          Voce ainda nao acumulou pontos. Faca um pedido para comecar!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((row) => (
        <Link
          key={row.tenantId}
          href={`/restaurante/${row.tenantSlug}`}
          className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
        >
          <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
            {row.tenantLogoUrl ? (
              <img
                src={row.tenantLogoUrl}
                alt={row.tenantName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-bold text-purple-600">
                {row.tenantName.charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-gray-900">
              {row.tenantName}
            </p>
            <p className="text-xs text-gray-500">
              {row.totalOrders} pedido{row.totalOrders === 1 ? "" : "s"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-purple-600">
              {row.loyaltyPointsBalance}
            </p>
            <p className="text-xs text-gray-500">pontos</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
