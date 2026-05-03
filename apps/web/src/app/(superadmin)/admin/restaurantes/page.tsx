"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";
import {
  Store,
  Star,
  ExternalLink,
  Mail,
  User,
  TrendingUp,
  Settings2,
  Check,
  Pause,
  Play,
} from "lucide-react";

const SALES_LABELS: Record<string, string> = {
  NOT_OPENED: "Ainda não inaugurou",
  UP_TO_100K: "Até R$ 100 mil/mês",
  FROM_100K_TO_500K: "R$ 100 mil – R$ 500 mil/mês",
  FROM_500K_TO_1M: "R$ 500 mil – R$ 1 milhão/mês",
  ABOVE_1M: "Acima de R$ 1 milhão/mês",
};

type StatusFilter = "ALL" | "ACTIVE" | "WAITLIST" | "SUSPENDED";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "ACTIVE", label: "Ativos" },
  { value: "WAITLIST", label: "Em fila" },
  { value: "SUSPENDED", label: "Suspensos" },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    WAITLIST: "bg-amber-100 text-amber-700",
    SUSPENDED: "bg-gray-200 text-gray-700",
  };
  const labels: Record<string, string> = {
    ACTIVE: "Ativo",
    WAITLIST: "Em fila",
    SUSPENDED: "Suspenso",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        styles[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}

export default function RestaurantesPage() {
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const { data: tenants, isLoading } = trpc.superadmin.listTenants.useQuery();
  const { data: config } = trpc.superadmin.getSystemConfig.useQuery();

  const invalidateAll = () => {
    utils.superadmin.listTenants.invalidate();
    utils.superadmin.getSystemConfig.invalidate();
  };

  const approveTenant = trpc.superadmin.approveTenant.useMutation({
    onSuccess: invalidateAll,
    onError: (err) => alert(err.message),
  });
  const suspendTenant = trpc.superadmin.suspendTenant.useMutation({
    onSuccess: invalidateAll,
  });
  const toggleTenant = trpc.superadmin.toggleTenant.useMutation({
    onSuccess: invalidateAll,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const filtered = (tenants ?? []).filter((t) =>
    filter === "ALL" ? true : t.status === filter
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Restaurantes</h1>
            <p className="mt-1 text-muted-foreground">
              {tenants?.length ?? 0} restaurantes cadastrados
            </p>
          </div>
          {config && (
            <div className="rounded-xl border bg-card px-4 py-2 text-sm">
              <span className="font-semibold">{config.currentActive}</span>
              {config.maxActiveRestaurants !== null && (
                <>
                  {" / "}
                  <span className="font-semibold">
                    {config.maxActiveRestaurants}
                  </span>
                </>
              )}{" "}
              <span className="text-muted-foreground">
                vagas ativas usadas
              </span>
              {config.currentWaitlist > 0 && (
                <span className="ml-2 text-amber-600">
                  · {config.currentWaitlist} na fila
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const count =
              f.value === "ALL"
                ? tenants?.length ?? 0
                : (tenants ?? []).filter((t) => t.status === f.value).length;
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Store className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="mb-2 text-lg font-semibold">
            {filter === "ALL"
              ? "Nenhum restaurante"
              : "Nenhum restaurante neste filtro"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Restaurantes aparecerão aqui quando se cadastrarem.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((tenant) => (
            <div key={tenant.id} className="rounded-xl border bg-card p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-1 items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Store className="h-6 w-6 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{tenant.name}</h3>
                      <StatusBadge status={tenant.status} />
                      {tenant.status === "ACTIVE" && !tenant.isActive && (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-600">
                          Loja fechada
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      /{tenant.slug}
                      {tenant.city && tenant.state && (
                        <>
                          {" "}
                          &middot; {tenant.city}/{tenant.state}
                        </>
                      )}
                      {tenant.phone && <> &middot; {tenant.phone}</>}
                    </p>

                    {tenant.owner && (
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {tenant.owner.name}
                        </span>
                        {tenant.owner.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {tenant.owner.email}
                          </span>
                        )}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Settings2 className="h-3 w-3" />
                        {tenant.usesOtherSystem === true
                          ? `Já usa: ${tenant.currentSystemName ?? "(não informado)"}`
                          : tenant.usesOtherSystem === false
                            ? "Não usa sistema"
                            : "Sistema: —"}
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {tenant.monthlySalesRange
                          ? SALES_LABELS[tenant.monthlySalesRange] ??
                            tenant.monthlySalesRange
                          : "Vendas: —"}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ShoppingBagIcon />
                        {tenant.stats.totalOrders} pedidos
                      </span>
                      <span>
                        {formatCurrency(tenant.stats.totalRevenue)} faturamento
                      </span>
                      {tenant.stats.avgRating > 0 && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-500" />
                          {tenant.stats.avgRating.toFixed(1)}
                        </span>
                      )}
                      <span>
                        Desde{" "}
                        {new Date(tenant.createdAt).toLocaleDateString(
                          "pt-BR"
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <a
                    href={`/restaurante/${tenant.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Ver restaurante"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>

                  {tenant.status === "WAITLIST" && (
                    <button
                      onClick={() =>
                        approveTenant.mutate({ tenantId: tenant.id })
                      }
                      disabled={approveTenant.isPending}
                      className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Aprovar
                    </button>
                  )}

                  {tenant.status === "ACTIVE" && (
                    <>
                      <button
                        onClick={() =>
                          toggleTenant.mutate({
                            tenantId: tenant.id,
                            isActive: !tenant.isActive,
                          })
                        }
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                          tenant.isActive
                            ? "bg-orange-50 text-orange-600 hover:bg-orange-100"
                            : "bg-green-50 text-green-700 hover:bg-green-100"
                        }`}
                        title={
                          tenant.isActive
                            ? "Fechar loja temporariamente"
                            : "Abrir loja"
                        }
                      >
                        {tenant.isActive ? "Fechar loja" : "Abrir loja"}
                      </button>
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `Suspender ${tenant.name}? Eles perderão acesso ao painel.`
                            )
                          ) {
                            suspendTenant.mutate({ tenantId: tenant.id });
                          }
                        }}
                        className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                      >
                        <Pause className="h-3.5 w-3.5" />
                        Suspender
                      </button>
                    </>
                  )}

                  {tenant.status === "SUSPENDED" && (
                    <button
                      onClick={() =>
                        approveTenant.mutate({ tenantId: tenant.id })
                      }
                      disabled={approveTenant.isPending}
                      className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Reativar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ShoppingBagIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}
