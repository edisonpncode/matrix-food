"use client";

import { useMemo, useState } from "react";
import {
  Banknote,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";
import {
  ReportShell,
  DateRangePicker,
  KpiCard,
  ChartContainer,
  ExportButton,
  type ExportFormat,
} from "@/components/reports";
import {
  rangeFromPreset,
  rangeToISO,
  type DateRange,
} from "@/lib/reports/date-presets";
import { exportRowsAsCsv } from "@/lib/exporters/csv";

const TX_LABELS: Record<string, string> = {
  SALE: "Vendas",
  REFUND: "Reembolsos",
  ADD: "Suprimentos",
  REMOVE: "Sangrias",
  ADJUSTMENT: "Ajustes",
};

function formatDateTime(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CaixaReportPage() {
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset("last30"));
  const [page, setPage] = useState(1);
  const isoRange = useMemo(() => rangeToISO(range), [range]);

  const sessionsQ = trpc.reports.cashRegister.sessionsList.useQuery({
    ...isoRange,
    page,
    pageSize: 20,
  });
  const reconciliationQ = trpc.reports.cashRegister.cashReconciliation.useQuery(
    isoRange
  );
  const txQ = trpc.reports.cashRegister.transactionsBreakdown.useQuery(isoRange);

  const totalPages = Math.max(
    1,
    Math.ceil((sessionsQ.data?.total ?? 0) / (sessionsQ.data?.pageSize ?? 20))
  );

  function handleExport(format: ExportFormat) {
    if (format !== "csv") return;
    const rows = sessionsQ.data?.rows ?? [];
    exportRowsAsCsv(
      `caixa_${isoRange.from.slice(0, 10)}_${isoRange.to.slice(0, 10)}.csv`,
      [
        { header: "Aberto em", accessor: (r) => formatDateTime(r.openedAt) },
        { header: "Fechado em", accessor: (r) => formatDateTime(r.closedAt) },
        { header: "Status", accessor: (r) => r.status },
        { header: "Aberto por", accessor: (r) => r.openedBy },
        {
          header: "Saldo inicial",
          accessor: (r) => r.openingBalance.toFixed(2).replace(".", ","),
        },
        {
          header: "Esperado",
          accessor: (r) =>
            r.expectedBalance !== null
              ? r.expectedBalance.toFixed(2).replace(".", ",")
              : "",
        },
        {
          header: "Contado",
          accessor: (r) =>
            r.closingBalance !== null
              ? r.closingBalance.toFixed(2).replace(".", ",")
              : "",
        },
        {
          header: "Diferença",
          accessor: (r) =>
            r.difference !== null ? r.difference.toFixed(2).replace(".", ",") : "",
        },
      ],
      rows
    );
  }

  return (
    <ReportShell
      title="Relatório de Caixa"
      description="Sessões, conciliação e movimentação financeira."
      filters={<DateRangePicker value={range} onChange={setRange} />}
      actions={
        <ExportButton
          formats={["csv"]}
          onExport={handleExport}
          disabled={!sessionsQ.data || sessionsQ.data.rows.length === 0}
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Sessões fechadas"
          value={reconciliationQ.data?.sessions ?? 0}
          icon={Banknote}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          loading={reconciliationQ.isLoading}
        />
        <KpiCard
          title="Caixas exatos"
          value={reconciliationQ.data?.exactCount ?? 0}
          icon={CheckCircle2}
          iconColor="text-green-600"
          iconBg="bg-green-50"
          loading={reconciliationQ.isLoading}
          subtitle={
            reconciliationQ.data && reconciliationQ.data.sessions > 0
              ? `${((reconciliationQ.data.exactCount / reconciliationQ.data.sessions) * 100).toFixed(0)}% do total`
              : undefined
          }
        />
        <KpiCard
          title="Sobras totais"
          value={formatCurrency(reconciliationQ.data?.totalSurplus ?? 0)}
          icon={TrendingUp}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          loading={reconciliationQ.isLoading}
          subtitle={
            reconciliationQ.data
              ? `${reconciliationQ.data.surplusCount} sessões`
              : undefined
          }
          isText
        />
        <KpiCard
          title="Faltas totais"
          value={formatCurrency(reconciliationQ.data?.totalShortage ?? 0)}
          icon={TrendingDown}
          iconColor="text-red-600"
          iconBg="bg-red-50"
          loading={reconciliationQ.isLoading}
          subtitle={
            reconciliationQ.data
              ? `${reconciliationQ.data.shortageCount} sessões`
              : undefined
          }
          isText
        />
      </div>

      <ChartContainer
        title="Movimentação por tipo"
        description="Soma de transações no período por tipo."
        loading={txQ.isLoading}
        isEmpty={!txQ.data || txQ.data.length === 0}
        height={140}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(txQ.data ?? []).map((tx) => (
            <div key={tx.type} className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">
                {TX_LABELS[tx.type] ?? tx.type}
              </p>
              <p className="mt-1 text-lg font-bold">{formatCurrency(tx.total)}</p>
              <p className="text-xs text-muted-foreground">
                {tx.count} transaç{tx.count === 1 ? "ão" : "ões"}
              </p>
            </div>
          ))}
        </div>
      </ChartContainer>

      <ChartContainer
        title="Sessões"
        description="Histórico de aberturas/fechamentos no período."
        loading={sessionsQ.isLoading}
        isEmpty={!sessionsQ.data || sessionsQ.data.rows.length === 0}
        height={400}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3">Aberto</th>
                <th className="py-2 pr-3">Fechado</th>
                <th className="py-2 pr-3">Operador</th>
                <th className="py-2 pr-3 text-right">Inicial</th>
                <th className="py-2 pr-3 text-right">Esperado</th>
                <th className="py-2 pr-3 text-right">Contado</th>
                <th className="py-2 pr-3 text-right">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {sessionsQ.data?.rows.map((s) => {
                const diff = s.difference;
                const diffColor =
                  diff === null
                    ? "text-muted-foreground"
                    : Math.abs(diff) < 0.01
                      ? "text-muted-foreground"
                      : diff > 0
                        ? "text-blue-600"
                        : "text-red-600";
                return (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{formatDateTime(s.openedAt)}</td>
                    <td className="py-2 pr-3">{formatDateTime(s.closedAt)}</td>
                    <td className="py-2 pr-3">{s.openedBy}</td>
                    <td className="py-2 pr-3 text-right">
                      {formatCurrency(s.openingBalance)}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {s.expectedBalance !== null
                        ? formatCurrency(s.expectedBalance)
                        : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {s.closingBalance !== null
                        ? formatCurrency(s.closingBalance)
                        : "—"}
                    </td>
                    <td className={`py-2 pr-3 text-right font-medium ${diffColor}`}>
                      {diff === null
                        ? "—"
                        : `${diff > 0 ? "+" : ""}${formatCurrency(diff)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="rounded-md border px-3 py-1 hover:bg-accent disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="rounded-md border px-3 py-1 hover:bg-accent disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </ChartContainer>
    </ReportShell>
  );
}
