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
} from "lucide-react";
import { useState } from "react";

const menuItems = [
  { href: "/", label: "Pedidos", icon: ClipboardList },
  { href: "/novo-pedido", label: "Novo Pedido", icon: PlusCircle },
  { href: "/caixa", label: "Caixa", icon: Banknote },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex flex-col border-r border-border bg-card transition-all duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-4">
        <Store className="h-7 w-7 shrink-0 text-primary" />
        {!collapsed && (
          <span className="text-lg font-bold text-foreground">Funcionário</span>
        )}
      </div>

      {/* Menu */}
      <nav className="flex-1 space-y-1 p-2">
        {menuItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
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

      {/* Toggle */}
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
