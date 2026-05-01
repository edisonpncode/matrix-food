"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  PlusCircle,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Store,
  ArrowLeft,
} from "lucide-react";
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { UserIndicator } from "@/components/shared/user-session/user-indicator";
import { usePermissions } from "@/lib/permissions";
import { useOrderNotificationsContext } from "@/components/pos/order-notifications-provider";

const menuItems = [
  { href: "/restaurante/pos", label: "Pedidos", icon: ClipboardList, permission: "orders.view", showBadge: true },
  { href: "/restaurante/pos/novo-pedido", label: "Novo Pedido", icon: PlusCircle, permission: "pos.createOrder", showBadge: false },
  { href: "/restaurante/pos/caixa", label: "Caixa", icon: Banknote, permission: "cashRegister.view", showBadge: false },
] as const;

export function POSSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { data: tenant } = trpc.tenant.getById.useQuery();
  const { user } = usePermissions();
  const { pendingCount } = useOrderNotificationsContext();
  const isAdmin = !!user && (user.role === "OWNER" || user.kind === "admin");
  const userPermissions = user?.permissions;

  const restaurantName = tenant?.name || "Meu Restaurante";

  // Filtra itens com referências estáveis (evita loop com `can` sendo
  // função nova a cada render).
  const visibleItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (!user) return false;
      if (isAdmin) return true;
      return (userPermissions ?? {})[item.permission] === true;
    });
  }, [user, isAdmin, userPermissions]);

  return (
    <aside
      className={`flex flex-col border-r border-border bg-card transition-all duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="border-b border-border">
        <div className="flex h-14 items-center gap-3 px-4">
          <Store className="h-7 w-7 shrink-0 text-primary" />
          {!collapsed && (
            <span className="text-base font-bold text-foreground truncate">{restaurantName}</span>
          )}
        </div>
        <UserIndicator collapsed={collapsed} />
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/restaurante/pos"
              ? pathname === "/restaurante/pos"
              : pathname.startsWith(item.href);

          const showBadge = item.showBadge && pendingCount > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
              title={
                collapsed
                  ? showBadge
                    ? `${item.label} — ${pendingCount} aguardando`
                    : item.label
                  : undefined
              }
            >
              <span className="relative shrink-0">
                <item.icon className="h-5 w-5" />
                {showBadge && (
                  <span
                    aria-hidden
                    className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-card animate-pulse"
                  >
                    {pendingCount > 9 ? "9+" : pendingCount}
                  </span>
                )}
              </span>
              {!collapsed && (
                <span className="flex-1">{item.label}</span>
              )}
              {!collapsed && showBadge && (
                <span
                  className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse"
                  aria-label={`${pendingCount} pedidos aguardando aprovação`}
                >
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-2">
        <Link
          href="/restaurante/admin"
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          title={collapsed ? "Voltar ao Admin" : undefined}
        >
          <ArrowLeft className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Voltar ao Admin</span>}
        </Link>
      </div>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex h-12 items-center justify-center border-t border-border text-muted-foreground hover:text-foreground"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>
    </aside>
  );
}
