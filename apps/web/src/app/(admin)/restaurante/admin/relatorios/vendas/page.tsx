"use client";

import { useMemo, useState } from "react";
import {
  ShoppingBag,
  DollarSign,
  TrendingUp,
  XCircle,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
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
  HeatmapChart,
  type ExportFormat,
} from "@/components/reports";
import {
  rangeFromPreset,
  rangeToISO,
  type DateRange,
} from "@/lib/reports/date-presets";
import { exportRowsAsCsv } from "@/lib/exporters/csv";

const PIE_COLORS = ["#7c3aed", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"];

const SOURCE_LABELS: Record<string, string> = {
  ONLINE: "Online",
  POS: "Balcão",
  PHONE: "Telefone",
  WHATSAPP: "WhatsApp",
};

const TYPE_LABELS: Record<string, string> = {
  DELIVERY: "Delivery",
  PICKUP: "Retirada",
  DINE_IN: "No salão",
  COUNTER: "Balcão",
  TABLE: "Mesa",
};

export default function VendasReportPage() {
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset("last30"));
  const isoRange = useMemo(() => rangeToISO(range), [range]);

  const granularity: "day" | "week" | "month" = useMemo(() => {
    const days = (range.to.getTime() - range.from.getTime()) / 86400000;
    if (days > 365) return "month";
    if (days > 60) return "week";
    return "day";
  }, [range]);

  const overviewQ = trpc.reports.sales.salesOverview.useQuery(isoRange);
  const revenueQ = trpc.reports.sales.revenueByPeriod.useQuery({
    ...isoRange,
    granularity,
  });
  const heatmapQ = trpc.reports.sales.seasonalityHeatmap.useQuery(isoRange);
  const channelQ = trpc.reports.sales.salesByChannel.useQuery(isoRange);
  const paymentQ = trpc.reports.sales.paymentMethodBreakdown.useQuery(isoRange);

  function handleExport(format: ExportFormat) {
    if (format !== "csv") return; // Phase 1 só CSV
    const rows = revenueQ.data ?? [];
    exportRowsAsCsv(
      `vendas_${isoRange.from.slice(0, 10)}_${isoRange.to.slice(0, 10)}.csv`,
      [
        { header: "Período", accessor: (r: { bucket: string }) => r.bucket.slice(0, 10) },
        { header: "Pedidos", accessor: (r: { orders: number }) => r.orders },
        {
          header: "Faturamento (R$)",
          accessor: (r: { revenue: number }) => r.revenue.toFixed(2).replace(".", ","),
        },
      ],
      rows
    );
  }

  const channelData = useMemo(() => {
    if (!channelQ.data) return [];
    return channelQ.data.map((r) => ({
      name: `${SOURCE_LABELS[r.source] ?? r.source} · ${TYPE_LABELS[r.type] ?? r.type}`,
      orders: r.orders,
      revenue: r.revenue,
    }));
  }, [channelQ.data]);

  return (
    <ReportShell
      title="Relatório de Vendas"
      description="Faturamento, ticket médio, sazonalidade e canais."
      filters={<DateRangePicker value={range} onChange={setRange} />}
      actions={
        <ExportButton
          formats={["csv"]}
          onExport={handleExport}
          disabled={!revenueQ.data || revenueQ.data.length === 0}
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Pedidos"
          value={overviewQ.data?.orders ?? 0}
          icon={ShoppingBag}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
          loading={overviewQ.isLoading}
        />
        <KpiCard
          title="Faturamento"
          value={formatCurrency(overviewQ.data?.revenue ?? 0)}
          icon={DollarSign}
          iconColor="text-green-600"
          iconBg="bg-green-50"
          loading={overviewQ.isLoading}
          isText
        />
        <KpiCard
          title="Ticket médio"
          value={formatCurrency(overviewQ.data?.avgTicket ?? 0)}
          icon={TrendingUp}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          subtitle={
            overviewQ.data
              ? `${overviewQ.data.validOrders} pedidos válidos`
              : undefined
          }
          loading={overviewQ.isLoading}
          isText
        />
        <KpiCard
          title="Cancelados"
          value={overviewQ.data?.cancelled ?? 0}
          icon={XCircle}
          iconColor="text-red-600"
          iconBg="bg-red-50"
          subtitle={
            overviewQ.data && overviewQ.data.orders > 0
              ? `${((overviewQ.data.cancelled / overviewQ.data.orders) * 100).toFixed(1)}% do total`
              : undefined
          }
          loading={overviewQ.isLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartContainer
          title="Faturamento ao longo do período"
          description={`Agrupado por ${granularity === "day" ? "dia" : granularity === "week" ? "semana" : "mês"}.`}
          loading={revenueQ.isLoading}
          isEmpty={!revenueQ.data || revenueQ.data.length === 0}
        >
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueQ.data ?? []}>
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
                formatter={(value: number) => [
                  formatCurrency(value),
                  "Faturamento",
                ]}
                labelFormatter={(label: string) =>
                  new Date(label).toLocaleDateString("pt-BR")
                }
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#7c3aed"
                fill="#7c3aed"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>

        <ChartContainer
          title="Métodos de pagamento"
          description="Distribuição por forma de pagamento principal."
          loading={paymentQ.isLoading}
          isEmpty={!paymentQ.data || paymentQ.data.length === 0}
        >
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={paymentQ.data ?? []}
                dataKey="revenue"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
              >
                {(paymentQ.data ?? []).map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), "Faturamento"]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      <ChartContainer
        title="Sazonalidade — dia da semana × hora"
        description="Volume de pedidos por horário, mostra quando seu restaurante mais vende."
        loading={heatmapQ.isLoading}
        isEmpty={
          !heatmapQ.data ||
          heatmapQ.data.matrix.every((row) => row.every((v) => v === 0))
        }
        height={300}
      >
        {heatmapQ.data && <HeatmapChart matrix={heatmapQ.data.matrix} />}
      </ChartContainer>

      <ChartContainer
        title="Vendas por canal"
        description="Origem do pedido (online, balcão, telefone) cruzado com o tipo (delivery, mesa)."
        loading={channelQ.isLoading}
        isEmpty={channelData.length === 0}
      >
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={channelData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" fontSize={12} />
            <YAxis type="category" dataKey="name" width={140} fontSize={12} />
            <Tooltip
              formatter={(value: number, key: string) => {
                if (key === "revenue") return [formatCurrency(value), "Faturamento"];
                return [value, "Pedidos"];
              }}
            />
            <Legend />
            <Bar dataKey="orders" name="Pedidos" fill="#7c3aed" radius={[0, 4, 4, 0]} />
            <Bar dataKey="revenue" name="Faturamento" fill="#10b981" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </ReportShell>
  );
}
