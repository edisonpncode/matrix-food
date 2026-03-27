"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Shield, Activity } from "lucide-react";

const tabs = [
  { href: "/restaurante/admin/equipe/funcionarios", label: "Funcionários", icon: Users },
  { href: "/restaurante/admin/equipe/tipos-usuario", label: "Tipos de Usuário", icon: Shield },
  { href: "/restaurante/admin/equipe/log-atividades", label: "Log de Atividades", icon: Activity },
];

export default function EquipeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div>
      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-border">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
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
