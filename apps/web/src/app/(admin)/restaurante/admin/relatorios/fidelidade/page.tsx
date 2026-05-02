"use client";

import { useMemo, useState } from "react";
import { Star, Gift, AlertCircle, Wallet } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
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

export default function FidelidadeReportPage() {
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset("last30"));
  const isoRange = useMemo(() => rangeToISO(range), [range]);

  const flowQ = trpc.reports.loyalty.loyaltyFlow.useQuery(isoRange);
  const topQ = trpc.reports.loyalty.topRedeemers.useQuery({
    ...isoRange,
    limit: 10,
  });
  const liabilityQ = trpc.reports.loyalty.pointsLiability.useQuery();

  function handleExport(format: ExportFormat) {
    if (format !== "csv") return;
    const rows = topQ.data ?? [];
    exportRowsAsCsv(
      `top_resgatadores_${isoRange.from.slice(0, 10)}_${isoRange.to.slice(0, 10)}.csv`,
      [
        { header: "Cliente", accessor: (r) => r.name ?? "(sem nome)" },
        { header: "Telefone", accessor: (r) => r.phone },
        { header: "Pontos resgatados", accessor: (r) => r.pointsRedeemed },
        { header: "Resgates", accessor: (r) => r.redemptions },
      ],
      rows
    );
  }

  return (
    <ReportShell
      title="Relatório de Fidelidade"
      description="Pontos emitidos, resgatados, expirados e passivo do programa."
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
          title="Pontos emitidos"
          value={(flowQ.data?.totals.earned ?? 0).toLocaleString("pt-BR")}
          icon={Star}
          iconColor="text-yellow-600"
          iconBg="bg-yellow-50"
          loading={flowQ.isLoading}
          subtitle={`${flowQ.data?.counts.earned ?? 0} transações`}
        />
        <KpiCard
          title="Pontos resgatados"
          value={(flowQ.data?.totals.redeemed ?? 0).toLocaleString("pt-BR")}
          icon={Gift}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
          loading={flowQ.isLoading}
          subtitle={`${flowQ.data?.counts.redeemed ?? 0} resgates`}
        />
        <KpiCard
          title="Pontos expirados"
          value={(flowQ.data?.totals.expired ?? 0).toLocaleString("pt-BR")}
          icon={AlertCircle}
          iconColor="text-red-600"
          iconBg="bg-red-50"
          loading={flowQ.isLoading}
        />
        <KpiCard
          title="Saldo em circulação"
          value={(liabilityQ.data?.totalPoints ?? 0).toLocaleString("pt-BR")}
          icon={Wallet}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          loading={liabilityQ.isLoading}
          subtitle={
            liabilityQ.data
              ? `${liabilityQ.data.customersWithBalance} clientes c/ saldo`
              : undefined
          }
        />
      </div>

      <ChartContainer
        title="Fluxo diário de pontos"
        description="Comparativo entre pontos emitidos, resgatados e expirados."
        loading={flowQ.isLoading}
        isEmpty={!flowQ.data || flowQ.data.series.length === 0}
        height={320}
      >
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={flowQ.data?.series ?? []}>
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
            <Legend />
            <Bar dataKey="EARNED" name="Emitidos" fill="#eab308" stackId="a" />
            <Bar dataKey="REDEEMED" name="Resgatados" fill="#7c3aed" stackId="a" />
            <Bar dataKey="EXPIRED" name="Expirados" fill="#ef4444" stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>

      <ChartContainer
        title="Top resgatadores"
        description="Clientes que mais usam o programa."
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
                <th className="py-2 pr-3 text-right">Pontos resgatados</th>
                <th className="py-2 pr-3 text-right">Resgates</th>
              </tr>
            </thead>
            <tbody>
              {topQ.data?.map((r, i) => (
                <tr key={r.phone} className="border-b last:border-0">
                  <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 pr-3 font-medium">
                    {r.name ?? <span className="text-muted-foreground italic">(sem nome)</span>}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.phone}</td>
                  <td className="py-2 pr-3 text-right font-semibold">
                    {r.pointsRedeemed.toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2 pr-3 text-right">{r.redemptions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartContainer>
    </ReportShell>
  );
}
