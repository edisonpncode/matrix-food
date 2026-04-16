"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  ShoppingBag,
  ClipboardList,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Store,
  Tag,
  Star,
  MessageSquare,
  CreditCard,
  Users,
  UserCircle,
  MapPin,
  Monitor,
  Printer,
  Sparkles,
  Egg,
  PlusCircle,
  Banknote,
  Package,
  FileText,
  Bike,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { UserIndicator } from "@/components/shared/user-session/user-indicator";
import { usePermissions } from "@/lib/permissions";

type MenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  highlight?: true | "ai";
  /** Permissão necessária. Se ausente, todos veem. */
  permission?: string | readonly string[];
};

type MenuGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  highlight?: true | "ai";
  children: MenuItem[];
};

type SidebarEntry = MenuItem | MenuGroup;

function isGroup(entry: SidebarEntry): entry is MenuGroup {
  return "children" in entry;
}

const sidebarEntries: SidebarEntry[] = [
  { href: "/restaurante/admin", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
  { href: "/restaurante/admin/mini-max", label: "Neo Assistente (Beta)", icon: Sparkles },
  {
    id: "pos",
    label: "Ponto de Venda",
    icon: Monitor,
    highlight: true,
    children: [
      { href: "/restaurante/admin/ponto-de-venda/pedidos", label: "Pedidos", icon: ClipboardList, permission: "orders.view" },
      { href: "/restaurante/admin/ponto-de-venda/novo-pedido", label: "Novo Pedido", icon: PlusCircle, permission: "pos.createOrder" },
      { href: "/restaurante/admin/ponto-de-venda/caixa", label: "Caixa", icon: Banknote, permission: "cashRegister.view" },
      { href: "/restaurante/admin/ponto-de-venda/motoboys", label: "Motoboys", icon: Bike, permission: "motoboys.view" },
    ],
  },
  {
    id: "produto",
    label: "Produto",
    icon: Package,
    children: [
      { href: "/restaurante/admin/categorias", label: "Categorias", icon: FolderOpen, permission: "categories.view" },
      { href: "/restaurante/admin/produtos", label: "Produtos", icon: ShoppingBag, permission: "products.view" },
      { href: "/restaurante/admin/ingredientes", label: "Ingredientes", icon: Egg, permission: "ingredients.view" },
      { href: "/restaurante/admin/promocoes", label: "Promoções", icon: Tag, permission: "promotions.view" },
    ],
  },
  {
    id: "cliente",
    label: "Cliente",
    icon: UserCircle,
    children: [
      { href: "/restaurante/admin/clientes", label: "Clientes", icon: UserCircle, permission: "customers.view" },
      { href: "/restaurante/admin/fidelidade", label: "Fidelidade", icon: Star, permission: "loyalty.view" },
      { href: "/restaurante/admin/avaliacoes", label: "Avaliações", icon: MessageSquare, permission: "reviews.view" },
    ],
  },
  {
    id: "config",
    label: "Configurações",
    icon: Settings,
    children: [
      { href: "/restaurante/admin/configuracoes", label: "Dados Empresa", icon: Settings, permission: "settings.view" },
      { href: "/restaurante/admin/areas-entrega", label: "Áreas de Entrega", icon: MapPin, permission: "deliveryAreas.view" },
      { href: "/restaurante/admin/equipe", label: "Equipe", icon: Users, permission: "staff.view" },
      { href: "/restaurante/admin/configuracoes/impressora", label: "Impressora", icon: Printer, permission: "printer.manage" },
      { href: "/restaurante/admin/fiscal", label: "Nota Fiscal", icon: FileText, permission: "fiscal.view" },
    ],
  },
  { href: "/restaurante/admin/assinatura", label: "Assinatura", icon: CreditCard, permission: "billing.view" },
];

function isChildActive(group: MenuGroup, pathname: string): boolean {
  return group.children.some((child) => {
    if (child.href === "/restaurante/admin/configuracoes") {
      return pathname === child.href;
    }
    return pathname.startsWith(child.href);
  });
}

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const { data: tenant } = trpc.tenant.getById.useQuery();
  const { can, canAny } = usePermissions();

  const restaurantName = tenant?.name || "Meu Restaurante";

  // Filtra menus conforme as permissões do usuário ativo
  const visibleEntries = useMemo<SidebarEntry[]>(() => {
    function itemAllowed(item: MenuItem): boolean {
      if (!item.permission) return true;
      return Array.isArray(item.permission)
        ? canAny(item.permission)
        : can(item.permission as string);
    }

    return sidebarEntries
      .map((entry) => {
        if (isGroup(entry)) {
          const visibleChildren = entry.children.filter(itemAllowed);
          if (visibleChildren.length === 0) return null;
          return { ...entry, children: visibleChildren };
        }
        return itemAllowed(entry) ? entry : null;
      })
      .filter((e): e is SidebarEntry => e !== null);
  }, [can, canAny]);

  // Auto-expand groups with active children
  useEffect(() => {
    const autoOpen = new Set<string>();
    for (const entry of visibleEntries) {
      if (isGroup(entry) && isChildActive(entry, pathname)) {
        autoOpen.add(entry.id);
      }
    }
    if (autoOpen.size > 0) {
      setOpenGroups((prev) => new Set([...prev, ...autoOpen]));
    }
  }, [pathname, visibleEntries]);

  function toggleGroup(id: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function isItemActive(href: string): boolean {
    if (href === "/restaurante/admin") {
      return pathname === "/restaurante/admin";
    }
    if (href === "/restaurante/admin/configuracoes") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  }

  function getHighlightClasses(
    highlight: true | "ai" | undefined,
    isActive: boolean
  ): string {
    if (highlight === "ai" && !isActive) {
      return "bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700";
    }
    if (highlight === true && !isActive) {
      return "bg-green-600 text-white hover:bg-green-700";
    }
    if (isActive) {
      return "bg-primary text-primary-foreground";
    }
    return "text-muted-foreground hover:bg-accent hover:text-accent-foreground";
  }

  function renderSimpleItem(item: MenuItem) {
    const active = isItemActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${getHighlightClasses(item.highlight, active)}`}
        title={collapsed ? item.label : undefined}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  }

  function renderGroup(group: MenuGroup) {
    const groupActive = isChildActive(group, pathname);
    const isOpen = openGroups.has(group.id);

    if (collapsed) {
      // Collapsed: show icon with hover popup
      return (
        <div key={group.id} className="relative group/menu">
          <button
            className={`flex w-full items-center justify-center rounded-md px-3 py-2.5 transition-colors ${getHighlightClasses(group.highlight, groupActive)}`}
            title={group.label}
          >
            <group.icon className="h-5 w-5 shrink-0" />
          </button>
          <div className="absolute left-full top-0 ml-1 hidden group-hover/menu:block z-50">
            <div className="rounded-lg border border-border bg-card py-1 shadow-lg min-w-[180px]">
              <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {group.label}
              </p>
              {group.children.map((child) => {
                const childActive = isItemActive(child.href);
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                      childActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-accent"
                    }`}
                  >
                    <child.icon className="h-4 w-4 shrink-0" />
                    {child.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // Expanded: collapsible group
    return (
      <div key={group.id}>
        <button
          onClick={() => toggleGroup(group.id)}
          className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
            groupActive && !isOpen
              ? getHighlightClasses(group.highlight, true)
              : groupActive && isOpen
                ? getHighlightClasses(group.highlight, false).replace(
                    "text-muted-foreground",
                    "text-foreground font-semibold"
                  )
                : getHighlightClasses(group.highlight, false)
          }`}
        >
          <group.icon className="h-5 w-5 shrink-0" />
          <span className="flex-1 text-left">{group.label}</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
              isOpen ? "rotate-0" : "-rotate-90"
            }`}
          />
        </button>
        {isOpen && (
          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-3">
            {group.children.map((child) => {
              const childActive = isItemActive(child.href);
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                    childActive
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <child.icon className="h-4 w-4 shrink-0" />
                  <span>{child.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

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

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {visibleEntries.map((entry) =>
          isGroup(entry) ? renderGroup(entry) : renderSimpleItem(entry)
        )}
      </nav>

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
