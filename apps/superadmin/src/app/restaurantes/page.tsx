"use client";

import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";
import { Store, Star, ExternalLink } from "lucide-react";

export default function RestaurantesPage() {
  const utils = trpc.useUtils();
  const { data: tenants, isLoading } = trpc.superadmin.listTenants.useQuery();

  const toggleTenant = trpc.superadmin.toggleTenant.useMutation({
    onSuccess: () => utils.superadmin.listTenants.invalidate(),
  });

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
        <h1 className="text-2xl font-bold">Restaurantes</h1>
        <p className="mt-1 text-muted-foreground">
          {tenants?.length ?? 0} restaurantes cadastrados
        </p>
      </div>

      {!tenants || tenants.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Store className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="mb-2 text-lg font-semibold">Nenhum restaurante</h2>
          <p className="text-sm text-muted-foreground">
            Restaurantes aparecerão aqui quando se cadastrarem.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tenants.map((tenant) => (
            <div
              key={tenant.id}
              className="rounded-xl border bg-card p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Store className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{tenant.name}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          tenant.isActive
                            ? "bg-green-100 text-green-600"
                            : "bg-red-100 text-red-600"
                        }`}
                      >
                        {tenant.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      /{tenant.slug}
                      {tenant.city && tenant.state && (
                        <> &middot; {tenant.city}/{tenant.state}</>
                      )}
                      {tenant.phone && <> &middot; {tenant.phone}</>}
                    </p>
                    <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
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
                        {new Date(tenant.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`http://localhost:3000/restaurante/${tenant.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Ver restaurante"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() =>
                      toggleTenant.mutate({
                        tenantId: tenant.id,
                        isActive: !tenant.isActive,
                      })
                    }
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      tenant.isActive
                        ? "bg-red-50 text-red-600 hover:bg-red-100"
                        : "bg-green-50 text-green-600 hover:bg-green-100"
                    }`}
                  >
                    {tenant.isActive ? "Desativar" : "Ativar"}
                  </button>
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
