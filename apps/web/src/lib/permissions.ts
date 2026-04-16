"use client";

import { useCallback } from "react";
import { useActiveUser, type LoggedUser } from "@/lib/logged-users-store";

/**
 * Verifica se um usuário tem determinada permissão.
 *
 * Regras:
 * - Dono/Administrador (role === "OWNER" OU kind === "admin") → sempre tem acesso total
 * - Caso contrário, checa o objeto `permissions[key]` vindo do userType
 *
 * Se nenhum usuário está ativo, retorna false (bloqueia).
 */
export function can(
  user: LoggedUser | null | undefined,
  permission: string
): boolean {
  if (!user) return false;
  // Admin/Dono sempre tem tudo
  if (user.role === "OWNER" || user.kind === "admin") return true;
  return user.permissions?.[permission] === true;
}

/**
 * Verifica se o usuário tem pelo menos UMA das permissões passadas.
 */
export function canAny(
  user: LoggedUser | null | undefined,
  permissions: readonly string[]
): boolean {
  if (!user) return false;
  if (user.role === "OWNER" || user.kind === "admin") return true;
  return permissions.some((p) => user.permissions?.[p] === true);
}

/**
 * Verifica se o usuário tem TODAS as permissões passadas.
 */
export function canAll(
  user: LoggedUser | null | undefined,
  permissions: readonly string[]
): boolean {
  if (!user) return false;
  if (user.role === "OWNER" || user.kind === "admin") return true;
  return permissions.every((p) => user.permissions?.[p] === true);
}

/**
 * Hook React para verificar permissão do usuário ativo.
 *
 * @example
 *   const canCancel = useCan("orders.cancel");
 *   if (!canCancel) return null;
 */
export function useCan(permission: string): boolean {
  const user = useActiveUser();
  return can(user, permission);
}

/**
 * Hook React que retorna múltiplas checagens de permissão.
 * Mais eficiente do que chamar useCan várias vezes.
 */
export function usePermissions(): {
  user: LoggedUser | null;
  can: (permission: string) => boolean;
  canAny: (permissions: readonly string[]) => boolean;
  canAll: (permissions: readonly string[]) => boolean;
  /** True se o usuário é dono/admin e tem acesso total */
  isAdmin: boolean;
} {
  const user = useActiveUser();
  const isAdmin = !!user && (user.role === "OWNER" || user.kind === "admin");

  // Callbacks estabilizados por `user` — evita que consumidores com
  // `useMemo([can])` recalculem a cada render, o que em conjunto com
  // `setState` em `useEffect` pode gerar loops de renderização.
  const canFn = useCallback((p: string) => can(user, p), [user]);
  const canAnyFn = useCallback(
    (ps: readonly string[]) => canAny(user, ps),
    [user]
  );
  const canAllFn = useCallback(
    (ps: readonly string[]) => canAll(user, ps),
    [user]
  );

  return {
    user,
    isAdmin,
    can: canFn,
    canAny: canAnyFn,
    canAll: canAllFn,
  };
}
