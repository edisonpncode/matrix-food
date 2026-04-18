"use client";

import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";
import { Store, ShoppingBag, DollarSign, TrendingUp } from "lucide-react";

export default function SuperAdminDashboard() {
  const { data: stats, isLoading } = trpc.superadmin.globalStats.useQuery();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard - Matrix Food</h1>
        <p className="mt-1 text-muted-foreground">
          Visão geral de todos os restaurantes
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Restaurantes"
          value={stats?.tenants.total ?? 0}
          subtitle={`${stats?.tenants.active ?? 0} ativos`}
          icon={Store}
          color="text-purple-500"
          bgColor="bg-purple-50"
        />
        <StatCard
          title="Total de Pedidos"
          value={stats?.orders.total ?? 0}
          icon={ShoppingBag}
          color="text-blue-500"
          bgColor="bg-blue-50"
        />
        <StatCard
          title="Faturamento Total"
          value={formatCurrency(stats?.orders.totalRevenue ?? 0)}
          icon={DollarSign}
          color="text-green-500"
          bgColor="bg-green-50"
          isText
        />
        <StatCard
          title="Pedidos Hoje"
          value={stats?.today.orders ?? 0}
          subtitle={formatCurrency(stats?.today.revenue ?? 0)}
          icon={TrendingUp}
          color="text-orange-500"
          bgColor="bg-orange-50"
        />
      </div>
    </div>
  );
}

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
