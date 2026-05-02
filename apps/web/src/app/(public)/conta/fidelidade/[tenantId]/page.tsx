"use client";

import Link from "next/link";
import { use } from "react";
import { trpc } from "@/lib/trpc";
import { ContaShell } from "../../conta-shell";

const TYPE_LABELS: Record<string, string> = {
  EARNED: "Crédito",
  REDEEMED: "Resgate",
  ADJUSTMENT: "Ajuste",
  EXPIRED: "Expirado",
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

function formatDateOnly(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function ExtratoPontosPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = use(params);
  const { data, isLoading, error } =
    trpc.customerPortal.getMyLoyaltyTransactions.useQuery({ tenantId });

  return (
    <ContaShell title="Extrato de pontos" backHref="/conta/fidelidade">
      {isLoading && (
        <div className="space-y-3">
          <div className="h-32 animate-pulse rounded-xl bg-white shadow-sm" />
          <div className="h-20 animate-pulse rounded-xl bg-white shadow-sm" />
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error.message}
        </div>
      )}

      {!isLoading && data && (
        <div className="space-y-4">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {data.tenant.name}
            </div>
            <div className="mt-1 text-3xl font-bold text-primary">
              {data.balance ?? 0}
              <span className="ml-2 align-middle text-sm font-medium text-gray-500">
                pontos
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
              <div>
                <div className="text-xs text-gray-500">Total ganho</div>
                <div className="mt-0.5 text-base font-semibold text-green-600">
                  +{data.totalEarned}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Total gasto</div>
                <div className="mt-0.5 text-base font-semibold text-red-600">
                  -{data.totalRedeemed}
                </div>
              </div>
            </div>
            {data.nextExpiration && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <span className="font-semibold">{data.nextExpiration.points} pontos</span>{" "}
                expiram em{" "}
                <span className="font-semibold">
                  {formatDateOnly(data.nextExpiration.date)}
                </span>
                . Use antes para não perder!
              </div>
            )}
          </div>

          <div className="rounded-xl bg-white shadow-sm">
            <h2 className="border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-900">
              Histórico
            </h2>
            {data.transactions.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-gray-500">
                Nenhuma transação ainda.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {data.transactions.map((tx) => {
                  const isCredit = tx.points > 0;
                  const orderLabel = tx.orderDisplayNumber
                    ? `Pedido #${tx.orderDisplayNumber}`
                    : null;
                  const typeLabel = TYPE_LABELS[tx.type] ?? tx.type;
                  const showExpires =
                    tx.type === "EARNED" &&
                    tx.expiresAt &&
                    new Date(tx.expiresAt).getTime() > Date.now();
                  return (
                    <li key={tx.id} className="flex items-start gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {tx.description ?? typeLabel}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-500">
                          {formatDate(tx.createdAt)}
                          {orderLabel && tx.orderId ? (
                            <>
                              {" · "}
                              <Link
                                href={`/restaurantes/${data.tenant.slug}/pedido/${tx.orderId}`}
                                className="text-primary hover:underline"
                              >
                                {orderLabel}
                              </Link>
                            </>
                          ) : orderLabel ? (
                            <> · {orderLabel}</>
                          ) : null}
                        </div>
                        {showExpires && (
                          <div className="mt-0.5 text-xs text-amber-700">
                            Expira em {formatDateOnly(tx.expiresAt!)}
                          </div>
                        )}
                      </div>
                      <div
                        className={`shrink-0 text-sm font-semibold ${
                          isCredit ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {isCredit ? "+" : ""}
                        {tx.points}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </ContaShell>
  );
}
