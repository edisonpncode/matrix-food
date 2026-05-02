"use client";

import { useMemo, useState } from "react";
import { Clock, XCircle, Users, Activity } from "lucide-react";
import { trpc } from "@/lib/trpc";
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

const REASON_LABELS: Record<string, string> = {
  CLIENTE_DESISTIU: "Cliente desistiu",
  PRODUTO_INDISPONIVEL: "Produto indisponível",
  ENDERECO_FORA_AREA: "Endereço fora da área",
  TEMPO_EXCESSIVO: "Tempo excessivo",
  PAGAMENTO_NEGADO: "Pagamento negado",
  OUTRO: "Outro",
};

function fmtMin(value: number): string {
  if (!value || !Number.isFinite(value)) return "—";
  if (value < 1) return "< 1 min";
  return `${value.toFixed(1)} min`;
}

export default function OperacionalReportPage() {
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset("last30"));
  const isoRange = useMemo(() => rangeToISO(range), [range]);

  const timingsQ = trpc.reports.operations.orderTimings.useQuery(isoRange);
  const cancellationsQ =
    trpc.reports.operations.cancellationAnalysis.useQuery(isoRange);
  const staffQ = trpc.reports.operations.staffProductivity.useQuery(isoRange);

  function handleExport(format: ExportFormat) {
    if (format !== "csv") return;
    const rows = staffQ.data ?? [];
    exportRowsAsCsv(
      `equipe_${isoRange.from.slice(0, 10)}_${isoRange.to.slice(0, 10)}.csv`,
      [
        { header: "Funcionário", accessor: (r) => r.userName },
        { header: "Pedidos criados", accessor: (r) => r.ordersCreated },
        { header: "Confirmados", accessor: (r) => r.ordersConfirmed },
        { header: "Cancelados", accessor: (r) => r.ordersCancelled },
        { header: "Caixas abertos", accessor: (r) => r.cashOpens },
        { header: "Caixas fechados", accessor: (r) => r.cashCloses },
      ],
      rows
    );
  }

  return (
    <ReportShell
      title="Relatório Operacional"
      description="Tempos do pedido, cancelamentos e produtividade da equipe."
      filters={<DateRangePicker value={range} onChange={setRange} />}
      actions={
        <ExportButton
          formats={["csv"]}
          onExport={handleExport}
          disabled={!staffQ.data || staffQ.data.length === 0}
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Tempo até aceitar"
          value={fmtMin(timingsQ.data?.avgAcceptMinutes ?? 0)}
          icon={Clock}
          iconColor="text-orange-600"
          iconBg="bg-orange-50"
          loading={timingsQ.isLoading}
          isText
        />
        <KpiCard
          title="Tempo de preparo"
          value={fmtMin(timingsQ.data?.avgPrepareMinutes ?? 0)}
          icon={Clock}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
          loading={timingsQ.isLoading}
          isText
        />
        <KpiCard
          title="Tempo de entrega"
          value={fmtMin(timingsQ.data?.avgDeliverMinutes ?? 0)}
          icon={Clock}
          iconColor="text-cyan-600"
          iconBg="bg-cyan-50"
          loading={timingsQ.isLoading}
          isText
        />
        <KpiCard
          title="Ciclo total"
          value={fmtMin(timingsQ.data?.avgFullCycleMinutes ?? 0)}
          icon={Activity}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          subtitle={
            timingsQ.data
              ? `Amostra: ${timingsQ.data.sample} pedidos`
              : undefined
          }
          loading={timingsQ.isLoading}
          isText
        />
      </div>

      {timingsQ.error && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Tempos indisponíveis</p>
          <p className="mt-1 text-amber-700">
            Os tempos de pedido dependem dos novos campos no banco. Rode{" "}
            <code className="rounded bg-amber-100 px-1">pnpm db:push</code> e marque
            cada pedido com os timestamps para usar este painel.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartContainer
          title="Cancelamentos por motivo"
          loading={cancellationsQ.isLoading}
          isEmpty={
            !cancellationsQ.data || cancellationsQ.data.byReason.length === 0
          }
          height={320}
        >
          <div className="space-y-2">
            {cancellationsQ.data?.byReason.map((r) => {
              const total = cancellationsQ.data?.total ?? 0;
              const share = total > 0 ? (r.count / total) * 100 : 0;
              return (
                <div key={r.reason} className="rounded-lg border p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium">
                      {REASON_LABELS[r.reason] ?? r.reason}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {r.count} ({share.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-red-500"
                      style={{ width: `${Math.min(share, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </ChartContainer>

        <ChartContainer
          title="Cancelamentos por funcionário"
          loading={cancellationsQ.isLoading}
          isEmpty={
            !cancellationsQ.data || cancellationsQ.data.byUser.length === 0
          }
          height={320}
        >
          <div className="space-y-2">
            {cancellationsQ.data?.byUser.map((u) => (
              <div
                key={u.userName}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="font-medium">{u.userName}</span>
                </div>
                <span className="text-lg font-bold">{u.count}</span>
              </div>
            ))}
          </div>
        </ChartContainer>
      </div>

      <ChartContainer
        title="Produtividade da equipe"
        description="Quantos pedidos cada um criou, confirmou ou cancelou no período."
        loading={staffQ.isLoading}
        isEmpty={!staffQ.data || staffQ.data.length === 0}
        height={400}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3">Funcionário</th>
                <th className="py-2 pr-3 text-right">Criados</th>
                <th className="py-2 pr-3 text-right">Confirmados</th>
                <th className="py-2 pr-3 text-right">Cancelados</th>
                <th className="py-2 pr-3 text-right">Caixas abertos</th>
                <th className="py-2 pr-3 text-right">Caixas fechados</th>
              </tr>
            </thead>
            <tbody>
              {staffQ.data?.map((u) => (
                <tr key={u.userId} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">
                    <Users className="mr-2 inline h-4 w-4 text-muted-foreground" />
                    {u.userName}
                  </td>
                  <td className="py-2 pr-3 text-right">{u.ordersCreated}</td>
                  <td className="py-2 pr-3 text-right">{u.ordersConfirmed}</td>
                  <td className="py-2 pr-3 text-right text-red-600">
                    {u.ordersCancelled}
                  </td>
                  <td className="py-2 pr-3 text-right">{u.cashOpens}</td>
                  <td className="py-2 pr-3 text-right">{u.cashCloses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartContainer>
    </ReportShell>
  );
}
