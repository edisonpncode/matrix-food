"use client";

import { trpc } from "@/lib/trpc";
import { FolderOpen, ShoppingBag, TrendingUp } from "lucide-react";

export default function DashboardPage() {
  const categories = trpc.category.listAll.useQuery(undefined, {
    retry: false,
  });
  const products = trpc.product.listAll.useQuery({}, { retry: false });

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">
        Bem-vindo ao painel administrativo
      </p>

      {/* Cards de resumo */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="Categorias"
          value={categories.data?.length ?? 0}
          icon={FolderOpen}
          color="text-blue-500"
        />
        <DashboardCard
          title="Produtos"
          value={products.data?.length ?? 0}
          icon={ShoppingBag}
          color="text-green-500"
        />
        <DashboardCard
          title="Pedidos Hoje"
          value={0}
          icon={TrendingUp}
          color="text-purple-500"
          subtitle="Em breve"
        />
      </div>
    </div>
  );
}

function DashboardCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-3">
        <Icon className={`h-8 w-8 ${color}`} />
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}
