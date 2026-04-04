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
} from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

const menuItems = [
  { href: "/restaurante/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/restaurante/pos", label: "Ponto de Venda", icon: Monitor, highlight: true },
  { href: "/restaurante/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/restaurante/admin/categorias", label: "Categorias", icon: FolderOpen },
  { href: "/restaurante/admin/produtos", label: "Produtos", icon: ShoppingBag },
  { href: "/restaurante/admin/ingredientes", label: "Ingredientes", icon: Egg },
  { href: "/restaurante/admin/clientes", label: "Clientes", icon: UserCircle },
  { href: "/restaurante/admin/areas-entrega", label: "Áreas de Entrega", icon: MapPin },
  { href: "/restaurante/admin/promocoes", label: "Promoções", icon: Tag },
  { href: "/restaurante/admin/fidelidade", label: "Fidelidade", icon: Star },
  { href: "/restaurante/admin/avaliacoes", label: "Avaliações", icon: MessageSquare },
  { href: "/restaurante/admin/equipe", label: "Equipe", icon: Users },
  { href: "/restaurante/admin/mini-max", label: "Neo Assistente", icon: Sparkles, highlight: "ai" as const },
  { href: "/restaurante/admin/assinatura", label: "Assinatura", icon: CreditCard },
  { href: "/restaurante/admin/configuracoes", label: "Configurações", icon: Settings },
  { href: "/restaurante/admin/configuracoes/impressora", label: "Impressora", icon: Printer },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { data: tenant } = trpc.tenant.getById.useQuery();

  const restaurantName = tenant?.name || "Meu Restaurante";

  return (
    <aside
      className={`flex flex-col border-r border-border bg-card transition-all duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex h-16 items-center gap-3 border-b border-border px-4">
        <Store className="h-7 w-7 shrink-0 text-primary" />
        {!collapsed && (
          <span className="text-lg font-bold text-foreground truncate">{restaurantName}</span>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {menuItems.map((item) => {
          const isActive =
            item.href === "/restaurante/admin"
              ? pathname === "/restaurante/admin"
              : pathname.startsWith(item.href);

          const highlightType = "highlight" in item ? item.highlight : undefined;
          const isAiHighlight = highlightType === "ai";
          const isPosHighlight = highlightType === true;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                isAiHighlight && !isActive
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700"
                  : isPosHighlight && !isActive
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
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
