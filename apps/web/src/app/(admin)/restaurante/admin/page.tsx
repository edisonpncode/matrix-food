"use client";

import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";
import {
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Star,
  ClipboardList,
  XCircle,
} from "lucide-react";
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
  AreaChart,
  Area,
} from "recharts";

const COLORS = ["#7c3aed", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

export default function DashboardPage() {
  const { data: summary, isLoading: loadingSummary } =
    trpc.analytics.getSummary.useQuery();
  const { data: salesByDay } =
    trpc.analytics.salesByDay.useQuery({ days: 7 });
  const { data: topProducts } =
    trpc.analytics.topProducts.useQuery({ limit: 5 });
  const { data: ordersByHour } = trpc.analytics.ordersByHour.useQuery();
  const { data: paymentMethods } =
    trpc.analytics.paymentMethods.useQuery();

  if (loadingSummary) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Visão geral do seu restaurante
        </p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Pedidos Hoje"
          value={summary?.today.orders ?? 0}
          icon={ClipboardList}
          color="text-purple-500"
          bgColor="bg-purple-50"
        />
        <StatCard
          title="Faturamento Hoje"
          value={formatCurrency(summary?.today.revenue ?? 0)}
          icon={DollarSign}
          color="text-green-500"
          bgColor="bg-green-50"
          isText
        />
        <StatCard
          title="Ticket Médio"
          value={formatCurrency(summary?.today.avgTicket ?? 0)}
          icon={TrendingUp}
          color="text-blue-500"
          bgColor="bg-blue-50"
          isText
        />
        <StatCard
          title="Avaliação Média"
          value={
            summary?.rating.count
              ? `${summary.rating.avg.toFixed(1)} ★`
              : "—"
          }
          icon={Star}
          color="text-yellow-500"
          bgColor="bg-yellow-50"
          subtitle={
            summary?.rating.count
              ? `${summary.rating.count} avaliações`
              : "Sem avaliações"
          }
          isText
        />
      </div>

      {/* Resumo Semanal e Mensal */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniCard
          label="Pedidos na Semana"
          value={summary?.week.orders ?? 0}
          icon={ShoppingBag}
        />
        <MiniCard
          label="Faturamento Semanal"
          value={formatCurrency(summary?.week.revenue ?? 0)}
          isText
        />
        <MiniCard
          label="Pedidos no Mês"
          value={summary?.month.orders ?? 0}
          icon={ShoppingBag}
        />
        <MiniCard
          label="Faturamento Mensal"
          value={formatCurrency(summary?.month.revenue ?? 0)}
          isText
        />
      </div>

      {/* Gráficos */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Vendas por Dia */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-4 font-semibold">Vendas - Últimos 7 dias</h3>
          {salesByDay && salesByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={salesByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => {
                    const date = new Date(d + "T12:00:00");
                    return date.toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    });
                  }}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip
                  formatter={(value: number) => [
                    formatCurrency(value),
                    "Faturamento",
                  ]}
                  labelFormatter={(label: string) => {
                    const date = new Date(label + "T12:00:00");
                    return date.toLocaleDateString("pt-BR");
                  }}
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
          ) : (
            <EmptyChart message="Nenhum dado de vendas ainda" />
          )}
        </div>

        {/* Produtos Mais Vendidos */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-4 font-semibold">Produtos Mais Vendidos</h3>
          {topProducts && topProducts.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  fontSize={12}
                  tickFormatter={(name: string) =>
                    name.length > 15 ? name.slice(0, 15) + "..." : name
                  }
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === "quantity") return [value, "Quantidade"];
                    return [formatCurrency(value), "Faturamento"];
                  }}
                />
                <Bar dataKey="quantity" fill="#7c3aed" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="Nenhum produto vendido ainda" />
          )}
        </div>

        {/* Horários de Pico */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-4 font-semibold">Horários de Pico (30 dias)</h3>
          {ordersByHour && ordersByHour.some((h) => h.orders > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={ordersByHour}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="hour"
                  fontSize={11}
                  interval={2}
                />
                <YAxis fontSize={12} />
                <Tooltip
                  formatter={(value: number) => [value, "Pedidos"]}
                />
                <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="Nenhum dado de horário ainda" />
          )}
        </div>

        {/* Formas de Pagamento */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-4 font-semibold">
            Formas de Pagamento (30 dias)
          </h3>
          {paymentMethods && paymentMethods.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={paymentMethods}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    dataKey="count"
                    nameKey="method"
                  >
                    {paymentMethods.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      value,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {paymentMethods.map((pm, i) => (
                  <div key={pm.method} className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{
                        backgroundColor: COLORS[i % COLORS.length],
                      }}
                    />
                    <span className="text-sm">
                      {pm.method}: {pm.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyChart message="Nenhum dado de pagamento ainda" />
          )}
        </div>
      </div>

      {/* Cancelados */}
      {(summary?.today.cancelled ?? 0) > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <XCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700">
            <strong>{summary?.today.cancelled}</strong> pedido(s) cancelado(s)
            hoje
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  bgColor,
  subtitle,
  isText,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  subtitle?: string;
  isText?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={`mt-1 ${isText ? "text-2xl" : "text-3xl"} font-bold`}>
            {value}
          </p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className={`rounded-lg ${bgColor} p-2.5`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

function MiniCard({
  label,
  value,
  icon: Icon,
  isText,
}: {
  label: string;
  value: number | string;
  icon?: React.ComponentType<{ className?: string }>;
  isText?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className={`mt-1 ${isText ? "text-lg" : "text-xl"} font-bold`}>
        {value}
      </p>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[250px] items-center justify-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
