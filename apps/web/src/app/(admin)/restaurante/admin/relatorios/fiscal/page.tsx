"use client";

import { useMemo, useState } from "react";
import { FileText, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
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

const STATUS_LABELS: Record<string, string> = {
  AUTHORIZED: "Autorizada",
  REJECTED: "Rejeitada",
  CANCELLED: "Cancelada",
  ERROR: "Erro",
  PENDING: "Pendente",
  PROCESSING: "Processando",
};

export default function FiscalReportPage() {
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset("last30"));
  const isoRange = useMemo(() => rangeToISO(range), [range]);

  const now = new Date();
  const [exportMonth, setExportMonth] = useState(now.getMonth() + 1);
  const [exportYear, setExportYear] = useState(now.getFullYear());

  const summaryQ = trpc.reports.fiscal.fiscalSummary.useQuery(isoRange);
  const exportQ = trpc.reports.fiscal.accountantExport.useQuery({
    month: exportMonth,
    year: exportYear,
  });

  function handleExport(format: ExportFormat) {
    if (format !== "csv") return;
    const rows = exportQ.data?.documents ?? [];
    exportRowsAsCsv(
      `nfce_${exportYear}_${String(exportMonth).padStart(2, "0")}.csv`,
      [
        { header: "Pedido", accessor: (r) => r.orderNumber },
        { header: "Status", accessor: (r) => STATUS_LABELS[r.status] ?? r.status },
        { header: "Número NFC-e", accessor: (r) => r.numero ?? "" },
        { header: "Série", accessor: (r) => r.serie ?? "" },
        { header: "Chave de acesso", accessor: (r) => r.chaveAcesso ?? "" },
        {
          header: "Total (R$)",
          accessor: (r) => r.total.toFixed(2).replace(".", ","),
        },
        {
          header: "Cancelada em",
          accessor: (r) =>
            r.cancelledAt
              ? new Date(r.cancelledAt).toLocaleDateString("pt-BR")
              : "",
        },
        { header: "Motivo do cancelamento", accessor: (r) => r.cancelReason ?? "" },
      ],
      rows
    );
  }

  return (
    <ReportShell
      title="Relatório Fiscal"
      description="NFC-e emitidas, canceladas, erros e exportação para o contador."
      filters={<DateRangePicker value={range} onChange={setRange} />}
      actions={
        <ExportButton
          formats={["csv"]}
          onExport={handleExport}
          disabled={!exportQ.data || exportQ.data.documents.length === 0}
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total NFC-e"
          value={summaryQ.data?.total ?? 0}
          icon={FileText}
          iconColor="text-slate-600"
          iconBg="bg-slate-100"
          loading={summaryQ.isLoading}
        />
        <KpiCard
          title="Autorizadas"
          value={summaryQ.data?.authorized ?? 0}
          icon={CheckCircle2}
          iconColor="text-green-600"
          iconBg="bg-green-50"
          subtitle={
            summaryQ.data
              ? `Faturamento: ${formatCurrency(summaryQ.data.authorizedRevenue)}`
              : undefined
          }
          loading={summaryQ.isLoading}
        />
        <KpiCard
          title="Taxa de sucesso"
          value={
            summaryQ.data ? `${summaryQ.data.successRate.toFixed(1)}%` : "—"
          }
          icon={CheckCircle2}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          loading={summaryQ.isLoading}
          isText
        />
        <KpiCard
          title="Com erro / rejeitadas"
          value={(summaryQ.data?.error ?? 0) + (summaryQ.data?.rejected ?? 0)}
          icon={AlertTriangle}
          iconColor="text-red-600"
          iconBg="bg-red-50"
          subtitle={
            summaryQ.data
              ? `${summaryQ.data.cancelled} canceladas`
              : undefined
          }
          loading={summaryQ.isLoading}
        />
      </div>

      <ChartContainer
        title="Status detalhado"
        loading={summaryQ.isLoading}
        isEmpty={!summaryQ.data || summaryQ.data.total === 0}
        height={120}
      >
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(STATUS_LABELS).map(([key, label]) => {
            const count = summaryQ.data
              ? ((summaryQ.data as unknown as Record<string, number>)[
                  key.toLowerCase()
                ] ?? 0)
              : 0;
            return (
              <div key={key} className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-bold">{count}</p>
              </div>
            );
          })}
        </div>
      </ChartContainer>

      <ChartContainer
        title="Exportar para o contador"
        description="Selecione o mês para gerar o relatório de NFC-e autorizadas e canceladas."
        loading={exportQ.isLoading}
        isEmpty={false}
        height={400}
      >
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium">Período fiscal:</span>
          <select
            value={exportMonth}
            onChange={(e) => setExportMonth(Number(e.target.value))}
            className="rounded-md border bg-card px-3 py-2"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {new Date(2000, m - 1, 1).toLocaleDateString("pt-BR", {
                  month: "long",
                })}
              </option>
            ))}
          </select>
          <select
            value={exportYear}
            onChange={(e) => setExportYear(Number(e.target.value))}
            className="rounded-md border bg-card px-3 py-2"
          >
            {Array.from({ length: 6 }, (_, i) => now.getFullYear() - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <span className="text-muted-foreground">
            {exportQ.data?.documents.length ?? 0} documento
            {exportQ.data?.documents.length === 1 ? "" : "s"} no período
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3">Pedido</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Nº NFC-e</th>
                <th className="py-2 pr-3">Chave</th>
                <th className="py-2 pr-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {exportQ.data?.documents.slice(0, 50).map((d, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-mono">#{d.orderNumber}</td>
                  <td className="py-2 pr-3">
                    {d.status === "AUTHORIZED" ? (
                      <span className="text-green-600">
                        {STATUS_LABELS[d.status]}
                      </span>
                    ) : (
                      <span className="text-red-600">
                        <XCircle className="mr-1 inline h-3 w-3" />
                        {STATUS_LABELS[d.status] ?? d.status}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 font-mono">
                    {d.numero ? `${d.numero}/${d.serie ?? "—"}` : "—"}
                  </td>
                  <td
                    className="py-2 pr-3 font-mono text-xs text-muted-foreground"
                    title={d.chaveAcesso ?? ""}
                  >
                    {d.chaveAcesso
                      ? `${d.chaveAcesso.slice(0, 12)}…${d.chaveAcesso.slice(-4)}`
                      : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right font-medium">
                    {formatCurrency(d.total)}
                  </td>
                </tr>
              ))}
              {exportQ.data?.documents.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    Nenhum documento no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ChartContainer>
    </ReportShell>
  );
}
