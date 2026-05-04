"use client";

import { useMemo, useState } from "react";
import { TrendingUp, DollarSign, Calculator } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
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

type GroupBy = "day" | "week" | "month";

const GROUP_LABELS: Record<GroupBy, string> = {
  day: "Diário",
  week: "Semanal",
  month: "Mensal",
};

function formatPeriod(value: string, groupBy: GroupBy): string {
  const date = new Date(value);
  if (groupBy === "month") {
    return date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  }
  if (groupBy === "week") {
    return `Sem. ${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function CmvPage() {
  const [range, setRange] = useState<DateRange>(() =>
    rangeFromPreset("last30")
  );
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const isoRange = useMemo(() => rangeToISO(range), [range]);

  const cmvQ = trpc.reports.profitability.cmvByPeriod.useQuery({
    ...isoRange,
    groupBy,
  });
  const topQ = trpc.reports.profitability.topProfitableInPeriod.useQuery({
    ...isoRange,
    limit: 10,
  });

  const summary = cmvQ.data?.summary;
  const series = cmvQ.data?.series ?? [];

  const chartData = useMemo(
    () =>
      series.map((s) => ({
        period: formatPeriod(s.period, groupBy),
        Receita: s.revenue,
        CMV: s.cmv,
        Lucro: s.profit,
        cmvPercent: s.cmvPercent,
        marginPercent: s.marginPercent,
      })),
    [series, groupBy]
  );

  function handleExport(format: ExportFormat) {
    if (format !== "csv") return;
    exportRowsAsCsv(
      `cmv_${groupBy}_${isoRange.from.slice(0, 10)}_${isoRange.to.slice(0, 10)}.csv`,
      [
        { header: "Período", accessor: (r) => r.period },
        {
          header: "Receita (R$)",
          accessor: (r) => r.revenue.toFixed(2).replace(".", ","),
        },
        { header: "CMV (R$)", accessor: (r) => r.cmv.toFixed(2).replace(".", ",") },
        {
          header: "Lucro (R$)",
          accessor: (r) => r.profit.toFixed(2).replace(".", ","),
        },
        { header: "CMV (%)", accessor: (r) => r.cmvPercent.toFixed(2) },
        { header: "Margem (%)", accessor: (r) => r.marginPercent.toFixed(2) },
      ],
      series
    );
  }

  return (
    <ReportShell
      title="CMV no Período"
      description="Custo de mercadoria vendida consolidado, faturamento e margem real do período."
      filters={
        <>
          <DateRangePicker value={range} onChange={setRange} />
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="rounded-md border bg-card px-3 py-2 text-sm"
          >
            {(Object.keys(GROUP_LABELS) as GroupBy[]).map((k) => (
              <option key={k} value={k}>
                {GROUP_LABELS[k]}
              </option>
            ))}
          </select>
        </>
      }
      actions={
        <ExportButton
          formats={["csv"]}
          onExport={handleExport}
          disabled={series.length === 0}
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard
          title="Faturamento"
          value={formatCurrency(summary?.totalRevenue ?? 0)}
          icon={TrendingUp}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          loading={cmvQ.isLoading}
          isText
        />
        <KpiCard
          title="CMV total"
          value={formatCurrency(summary?.totalCmv ?? 0)}
          icon={Calculator}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          loading={cmvQ.isLoading}
          isText
        />
        <KpiCard
          title="Lucro bruto"
          value={formatCurrency(summary?.totalProfit ?? 0)}
          icon={DollarSign}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          subtitle={
            summary
              ? `Margem ${summary.marginPercent.toFixed(1)}%`
              : undefined
          }
          loading={cmvQ.isLoading}
          isText
        />
        <KpiCard
          title="CMV %"
          value={summary ? `${summary.cmvPercent.toFixed(1)}%` : "—"}
          icon={Calculator}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
          subtitle="Quanto da receita virou custo"
          loading={cmvQ.isLoading}
          isText
        />
      </div>

      <ChartContainer
        title="Receita vs CMV vs Lucro"
        description="Linha do tempo dos componentes da margem."
        loading={cmvQ.isLoading}
        isEmpty={chartData.length === 0}
        height={350}
      >
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" fontSize={12} />
            <YAxis
              fontSize={12}
              tickFormatter={(v: number) => formatCurrency(v)}
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="Receita"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="CMV"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="Lucro"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>

      <ChartContainer
        title="Margem (%) ao longo do tempo"
        description="Margem bruta consolidada por período."
        loading={cmvQ.isLoading}
        isEmpty={chartData.length === 0}
        height={250}
      >
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" fontSize={12} />
            <YAxis
              fontSize={12}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              domain={[0, 100]}
            />
            <Tooltip
              formatter={(value: number) => `${value.toFixed(1)}%`}
            />
            <Line
              type="monotone"
              dataKey="marginPercent"
              name="Margem"
              stroke="#7c3aed"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>

      <ChartContainer
        title="Top 10 produtos por lucro absoluto"
        description="Soma do lucro de todas as unidades vendidas no período."
        loading={topQ.isLoading}
        isEmpty={!topQ.data || topQ.data.length === 0}
        height={350}
      >
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={topQ.data ?? []} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" fontSize={12} tickFormatter={(v: number) => formatCurrency(v)} />
            <YAxis
              type="category"
              dataKey="productName"
              width={150}
              fontSize={12}
              tickFormatter={(name: string) =>
                name.length > 18 ? name.slice(0, 18) + "…" : name
              }
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
            />
            <Bar
              dataKey="profit"
              name="Lucro bruto"
              fill="#10b981"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>

      <ChartContainer
        title="Detalhamento por período"
        loading={cmvQ.isLoading}
        isEmpty={series.length === 0}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                <th className="py-2 px-2 text-left">Período</th>
                <th className="py-2 px-2 text-right">Itens</th>
                <th className="py-2 px-2 text-right">Receita</th>
                <th className="py-2 px-2 text-right">CMV</th>
                <th className="py-2 px-2 text-right">Lucro</th>
                <th className="py-2 px-2 text-right">CMV %</th>
                <th className="py-2 px-2 text-right">Margem %</th>
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.period} className="border-b border-border/50">
                  <td className="py-2 px-2 whitespace-nowrap">
                    {formatPeriod(s.period, groupBy)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {s.itemCount}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {formatCurrency(s.revenue)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-amber-700">
                    {formatCurrency(s.cmv)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums font-medium text-emerald-700">
                    {formatCurrency(s.profit)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                    {s.cmvPercent.toFixed(1)}%
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {s.marginPercent.toFixed(1)}%
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
