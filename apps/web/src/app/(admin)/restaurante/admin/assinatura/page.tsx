"use client";

import { trpc } from "@/lib/trpc";
import { CreditCard, TrendingUp, Package, Receipt } from "lucide-react";

export default function AssinaturaPage() {
  const { data: subscription, isLoading: loadingSub } =
    trpc.billing.getMySubscription.useQuery();
  const { data: billing, isLoading: loadingBilling } =
    trpc.billing.getMyBilling.useQuery();

  if (loadingSub || loadingBilling) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Minha Assinatura</h1>

      {!subscription ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <CreditCard className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Sem plano ativo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Entre em contato com a Matrix Food para ativar seu plano.
          </p>
        </div>
      ) : (
        <>
          {/* Plano Atual */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Plano atual</p>
                <h2 className="text-xl font-bold">{subscription.plan.name}</h2>
                {subscription.plan.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {subscription.plan.description}
                  </p>
                )}
              </div>
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                {subscription.subscription.status === "ACTIVE"
                  ? "Ativo"
                  : subscription.subscription.status}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Pedidos grátis</p>
                <p className="text-lg font-bold">
                  {subscription.plan.freeOrdersLimit}/mês
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Taxa sobre vendas</p>
                <p className="text-lg font-bold">
                  {subscription.plan.percentageFee}%
                </p>
              </div>
              {subscription.plan.minMonthlyFee && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">
                    Mensalidade mínima
                  </p>
                  <p className="text-lg font-bold">
                    R$ {Number(subscription.plan.minMonthlyFee).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Mês Atual */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4" />
                <span className="text-sm">Pedidos este mês</span>
              </div>
              <p className="mt-2 text-2xl font-bold">
                {subscription.currentMonth.orders}
              </p>
              <p className="text-xs text-muted-foreground">
                {Math.max(
                  0,
                  subscription.plan.freeOrdersLimit -
                    subscription.currentMonth.orders
                )}{" "}
                grátis restantes
              </p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">Receita este mês</span>
              </div>
              <p className="mt-2 text-2xl font-bold">
                R$ {subscription.currentMonth.revenue.toFixed(2)}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Receipt className="h-4 w-4" />
                <span className="text-sm">Estimativa cobrança</span>
              </div>
              <p className="mt-2 text-2xl font-bold">
                R${" "}
                {Math.max(
                  (subscription.currentMonth.revenue *
                    Number(subscription.plan.percentageFee)) /
                    100,
                  Number(subscription.plan.minMonthlyFee || 0)
                ).toFixed(2)}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Histórico de Cobranças */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Histórico de cobranças</h2>
        {billing && billing.length > 0 ? (
          <div className="rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Período</th>
                  <th className="px-4 py-3 text-right font-medium">Pedidos</th>
                  <th className="px-4 py-3 text-right font-medium">Receita</th>
                  <th className="px-4 py-3 text-right font-medium">Cobrança</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {billing.map((record) => (
                  <tr key={record.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      {new Date(record.periodStart).toLocaleDateString("pt-BR", {
                        month: "long",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">{record.totalOrders}</td>
                    <td className="px-4 py-3 text-right">
                      R$ {Number(record.totalRevenue).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      R$ {Number(record.finalAmount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          record.status === "PAID"
                            ? "bg-green-100 text-green-700"
                            : record.status === "OVERDUE"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {record.status === "PAID"
                          ? "Pago"
                          : record.status === "OVERDUE"
                            ? "Atrasado"
                            : "Pendente"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            Nenhuma cobrança registrada ainda.
          </div>
        )}
      </div>
    </div>
  );
}
