"use client";

import { useMemo, useState } from "react";
import { Package, Trophy, TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
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

const COLORS = ["#7c3aed", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

const ABC_COLOR: Record<"A" | "B" | "C", string> = {
  A: "#10b981",
  B: "#f59e0b",
  C: "#ef4444",
};

const ABC_LABEL: Record<"A" | "B" | "C", string> = {
  A: "Classe A — top 80% da receita",
  B: "Classe B — próximos 15%",
  C: "Classe C — últimos 5%",
};

export default function ProdutosReportPage() {
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset("last30"));
  const [sortBy, setSortBy] = useState<"quantity" | "revenue">("revenue");
  const isoRange = useMemo(() => rangeToISO(range), [range]);

  const topQ = trpc.reports.products.topProducts.useQuery({
    ...isoRange,
    limit: 10,
    sortBy,
  });
  const abcQ = trpc.reports.products.abcCurve.useQuery(isoRange);
  const categoryQ = trpc.reports.products.productsByCategory.useQuery(isoRange);

  const totalProductsSold = useMemo(() => {
    return abcQ.data?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
  }, [abcQ.data]);

  const topProduct = topQ.data?.[0];

  function handleExport(format: ExportFormat) {
    if (format !== "csv") return;
    const rows = topQ.data ?? [];
    exportRowsAsCsv(
      `produtos_top_${isoRange.from.slice(0, 10)}_${isoRange.to.slice(0, 10)}.csv`,
      [
        { header: "Produto", accessor: (r) => r.name },
        { header: "Quantidade", accessor: (r) => r.quantity },
        {
          header: "Faturamento (R$)",
          accessor: (r) => r.revenue.toFixed(2).replace(".", ","),
        },
      ],
      rows
    );
  }

  return (
    <ReportShell
      title="Relatório de Produtos"
      description="Mais vendidos, curva ABC e mix por categoria."
      filters={
        <>
          <DateRangePicker value={range} onChange={setRange} />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "quantity" | "revenue")}
            className="rounded-md border bg-card px-3 py-2 text-sm"
          >
            <option value="revenue">Ordenar por receita</option>
            <option value="quantity">Ordenar por quantidade</option>
          </select>
        </>
      }
      actions={
        <ExportButton
          formats={["csv"]}
          onExport={handleExport}
          disabled={!topQ.data || topQ.data.length === 0}
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          title="Itens vendidos"
          value={totalProductsSold}
          icon={Package}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
          loading={abcQ.isLoading}
        />
        <KpiCard
          title="Faturamento (produtos)"
          value={formatCurrency(abcQ.data?.totalRevenue ?? 0)}
          icon={TrendingUp}
          iconColor="text-green-600"
          iconBg="bg-green-50"
          loading={abcQ.isLoading}
          isText
        />
        <KpiCard
          title="Produto líder"
          value={topProduct?.name ?? "—"}
          icon={Trophy}
          iconColor="text-yellow-600"
          iconBg="bg-yellow-50"
          subtitle={
            topProduct
              ? `${topProduct.quantity} unid. · ${formatCurrency(topProduct.revenue)}`
              : undefined
          }
          loading={topQ.isLoading}
          isText
        />
      </div>

      <ChartContainer
        title={`Top 10 produtos por ${sortBy === "revenue" ? "receita" : "quantidade"}`}
        loading={topQ.isLoading}
        isEmpty={!topQ.data || topQ.data.length === 0}
        height={350}
      >
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={topQ.data ?? []} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" fontSize={12} />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              fontSize={12}
              tickFormatter={(name: string) =>
                name.length > 18 ? name.slice(0, 18) + "…" : name
              }
            />
            <Tooltip
              formatter={(value: number, key: string) => {
                if (key === "revenue") return [formatCurrency(value), "Faturamento"];
                return [value, "Quantidade"];
              }}
            />
            <Bar
              dataKey={sortBy}
              name={sortBy === "revenue" ? "Faturamento" : "Quantidade"}
              fill="#7c3aed"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartContainer
          title="Curva ABC"
          description="Classifica produtos por concentração de receita. Foque nos A — eles puxam o caixa."
          loading={abcQ.isLoading}
          isEmpty={!abcQ.data || abcQ.data.items.length === 0}
        >
          <div className="space-y-3">
            {(["A", "B", "C"] as const).map((klass) => {
              const data = abcQ.data?.summary[klass];
              if (!data) return null;
              const total = abcQ.data?.totalRevenue ?? 0;
              const share = total > 0 ? (data.revenue / total) * 100 : 0;
              return (
                <div key={klass} className="rounded-lg border p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold" style={{ color: ABC_COLOR[klass] }}>
                      {ABC_LABEL[klass]}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {data.count} produto{data.count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-lg font-bold">
                      {formatCurrency(data.revenue)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {share.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(share, 100)}%`,
                        backgroundColor: ABC_COLOR[klass],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </ChartContainer>

        <ChartContainer
          title="Mix por categoria"
          description="Quanto cada categoria contribui para a receita."
          loading={categoryQ.isLoading}
          isEmpty={!categoryQ.data || categoryQ.data.length === 0}
        >
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={categoryQ.data ?? []}
                dataKey="revenue"
                nameKey="categoryName"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={95}
              >
                {(categoryQ.data ?? []).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), "Receita"]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
    </ReportShell>
  );
}
