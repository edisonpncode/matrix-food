"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Package,
  ChefHat,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";

const tabs = [
  {
    href: "/restaurante/admin/produtos/custos/insumos",
    label: "Insumos",
    icon: Package,
    description: "Cadastre o preço, quantidade e perda de cada ingrediente.",
  },
  {
    href: "/restaurante/admin/produtos/custos/sub-receitas",
    label: "Sub-receitas",
    icon: ChefHat,
    description: "Matérias-primas compostas (massa de pizza, bife marinado).",
  },
  {
    href: "/restaurante/admin/produtos/custos/produtos",
    label: "Custo dos Produtos",
    icon: ShoppingBag,
    description: "CMV, margem e preço de cada produto do cardápio.",
  },
  {
    href: "/restaurante/admin/produtos/custos/cmv",
    label: "CMV no Período",
    icon: TrendingUp,
    description: "Custo de mercadoria vendida consolidado dos pedidos.",
  },
];

export default function CustosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const activeTab = tabs.find((t) => pathname.startsWith(t.href));

  return (
    <div>
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-foreground">Custos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {activeTab?.description ??
            "Análise de custo de produção, margem e CMV."}
        </p>
      </div>

      <div className="mb-6 flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
