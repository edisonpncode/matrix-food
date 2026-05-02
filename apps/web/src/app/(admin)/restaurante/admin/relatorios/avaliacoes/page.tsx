"use client";

import { useMemo, useState } from "react";
import { Star, MessageSquare, Reply } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
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

const RATING_COLOR: Record<number, string> = {
  1: "#ef4444",
  2: "#f97316",
  3: "#eab308",
  4: "#84cc16",
  5: "#10b981",
};

export default function AvaliacoesReportPage() {
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset("last30"));
  const isoRange = useMemo(() => rangeToISO(range), [range]);

  const summaryQ = trpc.reports.reviews.reviewsSummary.useQuery(isoRange);
  const trendQ = trpc.reports.reviews.reviewsTrend.useQuery(isoRange);
  const byProductQ = trpc.reports.reviews.reviewsByProduct.useQuery({
    ...isoRange,
    limit: 10,
  });

  function handleExport(format: ExportFormat) {
    if (format !== "csv") return;
    const rows = byProductQ.data ?? [];
    exportRowsAsCsv(
      `avaliacoes_${isoRange.from.slice(0, 10)}_${isoRange.to.slice(0, 10)}.csv`,
      [
        { header: "Produto", accessor: (r) => r.name },
        { header: "Avaliações", accessor: (r) => r.reviewCount },
        {
          header: "Nota média",
          accessor: (r) => r.avg.toFixed(2).replace(".", ","),
        },
      ],
      rows
    );
  }

  return (
    <ReportShell
      title="Relatório de Avaliações"
      description="Nota média, distribuição de estrelas e tendência."
      filters={<DateRangePicker value={range} onChange={setRange} />}
      actions={
        <ExportButton
          formats={["csv"]}
          onExport={handleExport}
          disabled={!byProductQ.data || byProductQ.data.length === 0}
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          title="Avaliações"
          value={summaryQ.data?.total ?? 0}
          icon={MessageSquare}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          loading={summaryQ.isLoading}
        />
        <KpiCard
          title="Nota média"
          value={
            summaryQ.data && summaryQ.data.total > 0
              ? `${summaryQ.data.avg.toFixed(2)} ★`
              : "—"
          }
          icon={Star}
          iconColor="text-yellow-600"
          iconBg="bg-yellow-50"
          loading={summaryQ.isLoading}
          isText
        />
        <KpiCard
          title="Taxa de resposta"
          value={
            summaryQ.data
              ? `${summaryQ.data.replyRate.toFixed(0)}%`
              : "—"
          }
          icon={Reply}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          subtitle={
            summaryQ.data
              ? `${summaryQ.data.replied} de ${summaryQ.data.total} respondidas`
              : undefined
          }
          loading={summaryQ.isLoading}
          isText
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartContainer
          title="Distribuição de estrelas"
          loading={summaryQ.isLoading}
          isEmpty={!summaryQ.data || summaryQ.data.total === 0}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={summaryQ.data?.distribution ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="rating"
                tickFormatter={(r: number) => `${r}★`}
                fontSize={12}
              />
              <YAxis fontSize={12} />
              <Tooltip
                formatter={(value: number) => [value, "Avaliações"]}
                labelFormatter={(label: number) => `${label} estrelas`}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {(summaryQ.data?.distribution ?? []).map((d) => (
                  <Cell key={d.rating} fill={RATING_COLOR[d.rating]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        <ChartContainer
          title="Evolução da nota média"
          description="Como sua nota varia ao longo do tempo."
          loading={trendQ.isLoading}
          isEmpty={!trendQ.data || trendQ.data.length === 0}
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendQ.data ?? []}>
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
              <YAxis domain={[0, 5]} fontSize={12} />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(2)} ★`, "Média"]}
                labelFormatter={(label: string) =>
                  new Date(label).toLocaleDateString("pt-BR")
                }
              />
              <Line
                type="monotone"
                dataKey="avg"
                stroke="#eab308"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      <ChartContainer
        title="Avaliações por produto"
        description="Produtos mais avaliados e a média deles."
        loading={byProductQ.isLoading}
        isEmpty={!byProductQ.data || byProductQ.data.length === 0}
        height={350}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3">Produto</th>
                <th className="py-2 pr-3 text-right">Avaliações</th>
                <th className="py-2 pr-3 text-right">Média</th>
              </tr>
            </thead>
            <tbody>
              {byProductQ.data?.map((p) => (
                <tr key={p.name} className="border-b last:border-0">
                  <td className="py-2 pr-3">{p.name}</td>
                  <td className="py-2 pr-3 text-right">{p.reviewCount}</td>
                  <td className="py-2 pr-3 text-right">
                    <span className="font-medium">{p.avg.toFixed(2)}</span>
                    <span className="ml-1 text-yellow-500">★</span>
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
