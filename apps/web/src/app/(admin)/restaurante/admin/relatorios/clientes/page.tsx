"use client";

import { useMemo, useState } from "react";
import {
  Users,
  UserPlus,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
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

const SEGMENT_COLORS: Record<string, string> = {
  Champions: "#10b981",
  Leais: "#3b82f6",
  "Novos clientes": "#8b5cf6",
  Promissores: "#06b6d4",
  "Em risco": "#f59e0b",
  "Não posso perder": "#ef4444",
  Hibernando: "#6b7280",
  Perdidos: "#71717a",
  Atenção: "#a3a3a3",
};

export default function ClientesReportPage() {
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset("last30"));
  const [churnDays, setChurnDays] = useState(60);
  const isoRange = useMemo(() => rangeToISO(range), [range]);

  const overviewQ = trpc.reports.customers.customerOverview.useQuery(isoRange);
  const newReturningQ = trpc.reports.customers.newVsReturning.useQuery(isoRange);
  const topQ = trpc.reports.customers.topCustomers.useQuery({
    ...isoRange,
    limit: 10,
  });
  const rfmQ = trpc.reports.customers.rfmMatrix.useQuery({});
  const churnQ = trpc.reports.customers.churnAnalysis.useQuery({
    daysSinceLastOrder: churnDays,
  });

  function handleExport(format: ExportFormat) {
    if (format !== "csv") return;
    const rows = topQ.data ?? [];
    exportRowsAsCsv(
      `top_clientes_${isoRange.from.slice(0, 10)}_${isoRange.to.slice(0, 10)}.csv`,
      [
        { header: "Nome", accessor: (r) => r.name },
        { header: "Telefone", accessor: (r) => r.phone },
        { header: "Pedidos", accessor: (r) => r.orderCount },
        {
          header: "Total gasto (R$)",
          accessor: (r) => r.totalSpent.toFixed(2).replace(".", ","),
        },
        {
          header: "Ticket médio (R$)",
          accessor: (r) => r.avgTicket.toFixed(2).replace(".", ","),
        },
      ],
      rows
    );
  }

  const segmentEntries = useMemo(() => {
    if (!rfmQ.data) return [];
    return Object.entries(rfmQ.data.summary).sort((a, b) => b[1] - a[1]);
  }, [rfmQ.data]);

  return (
    <ReportShell
      title="Relatório de Clientes"
      description="Novos vs recorrentes, top clientes, RFM e churn."
      filters={<DateRangePicker value={range} onChange={setRange} />}
      actions={
        <ExportButton
          formats={["csv"]}
          onExport={handleExport}
          disabled={!topQ.data || topQ.data.length === 0}
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total de clientes"
          value={overviewQ.data?.totalCustomers ?? 0}
          icon={Users}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          loading={overviewQ.isLoading}
        />
        <KpiCard
          title="Ativos no período"
          value={overviewQ.data?.activeInPeriod ?? 0}
          icon={Users}
          iconColor="text-green-600"
          iconBg="bg-green-50"
          loading={overviewQ.isLoading}
        />
        <KpiCard
          title="Novos no período"
          value={overviewQ.data?.newInPeriod ?? 0}
          icon={UserPlus}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
          loading={overviewQ.isLoading}
        />
        <KpiCard
          title="Taxa de recorrência"
          value={
            overviewQ.data
              ? `${overviewQ.data.returningRate.toFixed(1)}%`
              : "—"
          }
          icon={RefreshCw}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          subtitle={
            overviewQ.data
              ? `${overviewQ.data.returningInPeriod} clientes recorrentes`
              : undefined
          }
          loading={overviewQ.isLoading}
          isText
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartContainer
          title="Novos vs recorrentes ao longo do tempo"
          loading={newReturningQ.isLoading}
          isEmpty={!newReturningQ.data || newReturningQ.data.length === 0}
        >
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={newReturningQ.data ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="bucket"
                tickFormatter={(d: string) =>
                  new Date(d).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                  })
                }
                fontSize={12}
              />
              <YAxis fontSize={12} />
              <Tooltip
                labelFormatter={(label: string) =>
                  new Date(label).toLocaleDateString("pt-BR")
                }
              />
              <Area
                type="monotone"
                dataKey="returning"
                name="Recorrentes"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.3}
                stackId="1"
              />
              <Area
                type="monotone"
                dataKey="new"
                name="Novos"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.3}
                stackId="1"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>

        <ChartContainer
          title="Segmentos RFM"
          description="Recência, frequência e gasto. Clique em um segmento para focar campanhas."
          loading={rfmQ.isLoading}
          isEmpty={segmentEntries.length === 0}
        >
          <div className="space-y-2">
            {segmentEntries.map(([segment, count]) => {
              const total = rfmQ.data?.customers.length ?? 0;
              const share = total > 0 ? (count / total) * 100 : 0;
              return (
                <div
                  key={segment}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: SEGMENT_COLORS[segment] ?? "#6b7280" }}
                  />
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between">
                      <span className="font-medium">{segment}</span>
                      <span className="text-sm text-muted-foreground">
                        {count} cliente{count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(share, 100)}%`,
                          backgroundColor: SEGMENT_COLORS[segment] ?? "#6b7280",
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ChartContainer>
      </div>

      <ChartContainer
        title="Top 10 clientes"
        description="Quem mais gastou no período."
        loading={topQ.isLoading}
        isEmpty={!topQ.data || topQ.data.length === 0}
        height={400}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Telefone</th>
                <th className="py-2 pr-3 text-right">Pedidos</th>
                <th className="py-2 pr-3 text-right">Total gasto</th>
                <th className="py-2 pr-3 text-right">Ticket médio</th>
              </tr>
            </thead>
            <tbody>
              {topQ.data?.map((c, i) => (
                <tr key={c.customerId ?? c.phone ?? i} className="border-b last:border-0">
                  <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 pr-3 font-medium">{c.name}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{c.phone}</td>
                  <td className="py-2 pr-3 text-right">{c.orderCount}</td>
                  <td className="py-2 pr-3 text-right font-semibold">
                    {formatCurrency(c.totalSpent)}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {formatCurrency(c.avgTicket)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartContainer>

      <ChartContainer
        title="Clientes inativos"
        description="Quem não pediu há um tempo. Bom alvo para campanhas de reativação."
        loading={churnQ.isLoading}
        isEmpty={!churnQ.data || churnQ.data.length === 0}
        height={400}
      >
        <div className="mb-3 flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Sem pedidos há mais de</span>
          <select
            value={churnDays}
            onChange={(e) => setChurnDays(Number(e.target.value))}
            className="rounded-md border bg-card px-2 py-1"
          >
            <option value={30}>30 dias</option>
            <option value={60}>60 dias</option>
            <option value={90}>90 dias</option>
            <option value={180}>180 dias</option>
            <option value={365}>1 ano</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Telefone</th>
                <th className="py-2 pr-3 text-right">Pedidos totais</th>
                <th className="py-2 pr-3 text-right">Gasto histórico</th>
                <th className="py-2 pr-3 text-right">Inativo há</th>
              </tr>
            </thead>
            <tbody>
              {churnQ.data?.slice(0, 30).map((c) => (
                <tr key={c.customerId} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">{c.name}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{c.phone}</td>
                  <td className="py-2 pr-3 text-right">{c.totalOrders}</td>
                  <td className="py-2 pr-3 text-right">
                    {formatCurrency(c.totalSpent)}
                  </td>
                  <td className="py-2 pr-3 text-right text-amber-600">
                    {c.daysInactive ?? "—"} dias
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartContainer>
    </ReportShell>
  );
}
