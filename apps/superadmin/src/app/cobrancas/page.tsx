"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Receipt, CheckCircle, AlertCircle, Clock, RefreshCw } from "lucide-react";

const STATUS_CONFIG = {
  PENDING: { label: "Pendente", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  PAID: { label: "Pago", color: "bg-green-100 text-green-700", icon: CheckCircle },
  OVERDUE: { label: "Atrasado", color: "bg-red-100 text-red-700", icon: AlertCircle },
  CANCELLED: { label: "Cancelado", color: "bg-gray-100 text-gray-700", icon: Receipt },
};

export default function CobrancasPage() {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data: records, isLoading } = trpc.billing.listRecords.useQuery(
    statusFilter
      ? { status: statusFilter as "PENDING" | "PAID" | "OVERDUE" | "CANCELLED" }
      : undefined
  );

  const generateMonthly = trpc.billing.generateMonthly.useMutation({
    onSuccess: (data) => {
      utils.billing.listRecords.invalidate();
      alert(`${data.generated} cobranças geradas com sucesso!`);
    },
  });

  const markAsPaid = trpc.billing.markAsPaid.useMutation({
    onSuccess: () => utils.billing.listRecords.invalidate(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cobranças</h1>
        <button
          onClick={() => generateMonthly.mutate()}
          disabled={generateMonthly.isPending}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${generateMonthly.isPending ? "animate-spin" : ""}`}
          />
          Gerar Cobranças do Mês
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {[
          { value: "", label: "Todos" },
          { value: "PENDING", label: "Pendentes" },
          { value: "PAID", label: "Pagos" },
          { value: "OVERDUE", label: "Atrasados" },
        ].map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStatusFilter(filter.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === filter.value
                ? "bg-primary text-white"
                : "bg-accent text-accent-foreground hover:bg-accent/80"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Restaurante</th>
              <th className="px-4 py-3 text-left font-medium">Período</th>
              <th className="px-4 py-3 text-right font-medium">Pedidos</th>
              <th className="px-4 py-3 text-right font-medium">Receita</th>
              <th className="px-4 py-3 text-right font-medium">Cobrança</th>
              <th className="px-4 py-3 text-center font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {records?.map(({ record, tenantName }) => {
              const status = STATUS_CONFIG[record.status];
              const StatusIcon = status.icon;
              return (
                <tr key={record.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{tenantName}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(record.periodStart).toLocaleDateString("pt-BR", {
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {record.totalOrders}
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      ({record.freeOrders} grátis)
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    R$ {Number(record.totalRevenue).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    R$ {Number(record.finalAmount).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {record.status === "PENDING" && (
                      <button
                        onClick={() => markAsPaid.mutate({ id: record.id })}
                        disabled={markAsPaid.isPending}
                        className="rounded-lg bg-green-100 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-200"
                      >
                        Marcar pago
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {records?.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            Nenhuma cobrança encontrada.
          </div>
        )}
      </div>
    </div>
  );
}
