"use client";

import { useState } from "react";
import { ChevronDown, User as UserIcon } from "lucide-react";
import { useActiveUser } from "@/lib/logged-users-store";
import { UserSwitcherModal } from "./user-switcher-modal";

interface UserIndicatorProps {
  collapsed?: boolean;
}

/**
 * Exibe a foto + nome + tipo do usuário ativo abaixo do nome da empresa.
 * Clicar abre o UserSwitcherModal para alterar usuário.
 */
export function UserIndicator({ collapsed = false }: UserIndicatorProps) {
  const activeUser = useActiveUser();
  const [open, setOpen] = useState(false);

  if (!activeUser) {
    // Sem usuário ativo — mostra botão para fazer login
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title={collapsed ? "Entrar" : undefined}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
            <UserIcon className="h-4 w-4 text-muted-foreground" />
          </div>
          {!collapsed && (
            <span className="flex-1 text-left font-medium">Entrar</span>
          )}
        </button>
        {open && <UserSwitcherModal onClose={() => setOpen(false)} />}
      </>
    );
  }

  const initials = activeUser.name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent transition-colors"
        title={collapsed ? `${activeUser.name} — Alterar usuário` : "Alterar usuário"}
      >
        <div className="relative shrink-0">
          {activeUser.photoUrl ? (
            <img
              src={activeUser.photoUrl}
              alt={activeUser.name}
              className="h-7 w-7 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
              {initials}
            </div>
          )}
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-semibold text-foreground leading-tight">
                {activeUser.name}
              </p>
              <p className="truncate text-[10px] text-muted-foreground leading-tight">
                {activeUser.userTypeName ?? roleLabel(activeUser.role)}
              </p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
          </>
        )}
      </button>
      {open && <UserSwitcherModal onClose={() => setOpen(false)} />}
    </>
  );
}

function roleLabel(role: string): string {
  switch (role) {
    case "OWNER":
      return "Proprietário";
    case "MANAGER":
      return "Gerente";
    case "CASHIER":
      return "Caixa";
    case "DELIVERY":
      return "Entregador";
    default:
      return role;
  }
}
