"use client";

import Link from "next/link";
import { Award, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ContaShell } from "../conta-shell";

export default function FidelidadePage() {
  const { data, isLoading } = trpc.customerPortal.getMyLoyalty.useQuery();

  return (
    <ContaShell title="Fidelidade">
      {isLoading && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl bg-white shadow-sm"
            />
          ))}
        </div>
      )}

      {!isLoading && data && data.length === 0 && (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <Award className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <h2 className="text-base font-semibold text-gray-900">
            Você ainda não tem pontos
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Faça pedidos nos restaurantes participantes para acumular pontos.
          </p>
        </div>
      )}

      {!isLoading && data && data.length > 0 && (
        <ul className="space-y-3">
          {data.map((row) => (
            <li
              key={row.tenantId}
              className="flex items-stretch gap-2 rounded-xl bg-white shadow-sm"
            >
              <Link
                href={`/restaurantes/${row.tenantSlug}`}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-l-xl p-4 hover:bg-gray-50"
              >
                {row.tenantLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.tenantLogoUrl}
                    alt={row.tenantName}
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-semibold text-gray-500">
                    {row.tenantName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-gray-900">
                    {row.tenantName}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    Toque para abrir o cardápio
                  </div>
                </div>
              </Link>
              <Link
                href={`/conta/fidelidade/${row.tenantId}`}
                className="flex shrink-0 items-center gap-1 rounded-r-xl px-4 py-4 text-right hover:bg-primary/5"
              >
                <div>
                  <div className="text-lg font-bold text-primary">
                    {row.loyaltyPointsBalance ?? 0}
                  </div>
                  <div className="text-xs text-gray-500">pontos</div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ContaShell>
  );
}
