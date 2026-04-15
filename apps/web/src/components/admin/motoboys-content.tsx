"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";
import {
  Bike,
  DollarSign,
  TrendingUp,
  TrendingDown,
  HandCoins,
  Loader2,
  X,
  Check,
} from "lucide-react";

type PeriodPreset = "TODAY" | "LAST_7" | "LAST_30" | "CUSTOM";

function startOfDay(d: Date) {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

function daysAgo(n: number) {
  return startOfDay(new Date(Date.now() - n * 24 * 60 * 60 * 1000));
}

export function MotoboysContent() {
  const [period, setPeriod] = useState<PeriodPreset>("LAST_7");
  const [payoutFor, setPayoutFor] = useState<{
    id: string;
    name: string;
    balance: number;
  } | null>(null);

  const { from, to } = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "TODAY":
        return { from: startOfDay(now), to: now };
      case "LAST_7":
        return { from: daysAgo(7), to: now };
      case "LAST_30":
      default:
        return { from: daysAgo(30), to: now };
    }
  }, [period]);

  const balancesQuery = trpc.order.getDeliveryPersonBalances.useQuery({
    from,
    to,
  });

  const payoutMutation = trpc.order.registerDriverPayout.useMutation({
    onSuccess: () => {
      balancesQuery.refetch();
      setPayoutFor(null);
    },
  });

  const balances = balancesQuery.data ?? [];
  const totals = useMemo(() => {
    return balances.reduce(
      (acc, b) => {
        acc.commission += parseFloat(b.totalCommission);
        acc.shortage += parseFloat(b.totalShortage);
        acc.surplus += parseFloat(b.totalSurplus);
        acc.payout += parseFloat(b.totalPayout);
        acc.balance += parseFloat(b.balance);
        acc.orders += b.orderCount;
        return acc;
      },
      {
        commission: 0,
        shortage: 0,
        surplus: 0,
        payout: 0,
        balance: 0,
        orders: 0,
      }
    );
  }, [balances]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Bike className="h-6 w-6 text-primary" />
            Motoboys
          </h1>
          <p className="text-sm text-muted-foreground">
            Saldo, comissões e acertos por entregador.
          </p>
        </div>
      </div>

      {/* Filtros de período */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { value: "TODAY" as const, label: "Hoje" },
            { value: "LAST_7" as const, label: "Últimos 7 dias" },
            { value: "LAST_30" as const, label: "Últimos 30 dias" },
          ]
        ).map((opt) => (
          <button
            key={opt.value}
            onClick={() => setPeriod(opt.value)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              period === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-accent-foreground hover:bg-accent/80"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Totais */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Entregas</p>
          <p className="text-2xl font-bold">{totals.orders}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <DollarSign className="h-3 w-3" /> Comissões
          </p>
          <p className="text-lg font-bold text-purple-700">
            {formatCurrency(totals.commission)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingDown className="h-3 w-3" /> Descontos
          </p>
          <p className="text-lg font-bold text-red-700">
            {formatCurrency(totals.shortage)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" /> Sobras
          </p>
          <p className="text-lg font-bold text-blue-700">
            {formatCurrency(totals.surplus)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <HandCoins className="h-3 w-3" /> Pagamentos
          </p>
          <p className="text-lg font-bold text-gray-700">
            {formatCurrency(Math.abs(totals.payout))}
          </p>
        </div>
      </div>

      {/* Lista de motoboys */}
      {balancesQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : balances.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          Nenhum motoboy cadastrado.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 font-semibold">Motoboy</th>
                <th className="p-3 font-semibold">Entregas</th>
                <th className="p-3 font-semibold">Comissão</th>
                <th className="p-3 font-semibold">Descontos</th>
                <th className="p-3 font-semibold">Sobras</th>
                <th className="p-3 text-right font-semibold">Saldo</th>
                <th className="p-3 text-right font-semibold">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {balances.map((row) => {
                const balance = parseFloat(row.balance);
                return (
                  <tr
                    key={row.deliveryPersonId}
                    className="text-sm hover:bg-muted/30"
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-700">
                          <Bike className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="font-medium">{row.name}</span>
                          {!row.isActive && (
                            <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                              inativo
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">{row.orderCount}</td>
                    <td className="p-3 text-purple-700">
                      {formatCurrency(parseFloat(row.totalCommission))}
                    </td>
                    <td className="p-3 text-red-700">
                      {formatCurrency(parseFloat(row.totalShortage))}
                    </td>
                    <td className="p-3 text-blue-700">
                      {formatCurrency(parseFloat(row.totalSurplus))}
                    </td>
                    <td
                      className={`p-3 text-right font-bold ${
                        balance > 0
                          ? "text-green-700"
                          : balance < 0
                            ? "text-red-700"
                            : "text-muted-foreground"
                      }`}
                    >
                      {formatCurrency(balance)}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() =>
                          setPayoutFor({
                            id: row.deliveryPersonId,
                            name: row.name,
                            balance,
                          })
                        }
                        disabled={balance <= 0}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Acertar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de acerto */}
      {payoutFor && (
        <PayoutModal
          person={payoutFor}
          onClose={() => setPayoutFor(null)}
          onConfirm={(amount) =>
            payoutMutation.mutate({
              deliveryPersonId: payoutFor.id,
              amount,
            })
          }
          isLoading={payoutMutation.isPending}
          error={payoutMutation.error?.message ?? null}
        />
      )}
    </div>
  );
}

interface PayoutModalProps {
  person: { id: string; name: string; balance: number };
  onClose: () => void;
  onConfirm: (amount: number) => void;
  isLoading: boolean;
  error: string | null;
}

function PayoutModal({
  person,
  onClose,
  onConfirm,
  isLoading,
  error,
}: PayoutModalProps) {
  const [amountStr, setAmountStr] = useState(person.balance.toFixed(2));

  const amount = useMemo(() => {
    const parsed = parseFloat(amountStr.replace(",", "."));
    return isNaN(parsed) ? 0 : parsed;
  }, [amountStr]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Acerto com {person.name}</h3>
            <p className="text-sm text-muted-foreground">
              Saldo atual:{" "}
              <strong>{formatCurrency(person.balance)}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-accent"
            disabled={isLoading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mb-2 block text-sm font-medium">
          Valor a pagar
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            R$
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            autoFocus
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            className="w-full rounded-lg border px-3 py-3 pl-10 text-lg font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          Saída registrada no caixa + lançamento PAYOUT no saldo do motoboy.
        </p>

        {error && (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-lg border px-4 py-2.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(amount)}
            disabled={isLoading || amount <= 0}
            className="flex flex-[2] items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Confirmar pagamento
          </button>
        </div>
      </div>
    </div>
  );
}
