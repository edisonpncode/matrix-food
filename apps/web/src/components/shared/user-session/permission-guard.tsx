"use client";

import { ShieldAlert, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePermissions } from "@/lib/permissions";
import { useDefaultRoute } from "@/lib/default-route";

interface PermissionGuardProps {
  /** Permissão(ões) necessária(s). Se array, usuário precisa ter PELO MENOS UMA. */
  permission: string | readonly string[];
  /** Conteúdo a mostrar quando autorizado */
  children: React.ReactNode;
  /** Conteúdo customizado quando negado. Se não passar, mostra tela padrão. */
  fallback?: React.ReactNode;
  /**
   * URL para botão "voltar" na tela de negação. Se não passar, usa a
   * primeira rota que o usuário REALMENTE tem permissão de acessar
   * (via `useDefaultRoute`). Nunca manda para uma área que ele não pode ver.
   */
  backHref?: string;
}

/**
 * Bloqueia a renderização quando o usuário ativo não tem a permissão.
 * Usar para envolver páginas inteiras ou componentes sensíveis.
 *
 * Dono (OWNER / kind=admin) sempre passa.
 *
 * @example
 *   <PermissionGuard permission="staff.view">
 *     <StaffPage />
 *   </PermissionGuard>
 */
export function PermissionGuard({
  permission,
  children,
  fallback,
  backHref,
}: PermissionGuardProps) {
  const { user, can, canAny } = usePermissions();
  const smartDefault = useDefaultRoute();

  const allowed = Array.isArray(permission)
    ? canAny(permission)
    : can(permission as string);

  if (allowed) return <>{children}</>;

  if (fallback !== undefined) return <>{fallback}</>;

  // Se nenhum `backHref` foi passado, usa a primeira rota que o usuário
  // realmente pode acessar — nunca o Dashboard por padrão, porque o
  // funcionário pode não ter `dashboard.view`.
  const targetHref = backHref ?? smartDefault;
  const isDashboard = targetHref === "/restaurante/admin";

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
          <ShieldAlert className="h-7 w-7 text-amber-600" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-foreground">
          Acesso restrito
        </h2>
        <p className="mb-5 text-sm text-muted-foreground">
          {user
            ? `Seu perfil (${user.userTypeName ?? user.role}) não tem permissão para acessar esta área. Fale com o dono do restaurante para liberar o acesso.`
            : "Você precisa estar logado para acessar esta área."}
        </p>
        <Link
          href={targetHref}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {isDashboard ? "Voltar ao Dashboard" : "Voltar para minha área"}
        </Link>
      </div>
    </div>
  );
}
