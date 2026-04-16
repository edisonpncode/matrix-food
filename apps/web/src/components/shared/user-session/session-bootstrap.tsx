"use client";

import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useLoggedUsersStore } from "@/lib/logged-users-store";

/**
 * Componente invisível que garante que, ao entrar no admin/POS, o
 * `logged-users-store` (Zustand/localStorage) já tenha o usuário
 * autenticado via Firebase populado.
 *
 * Problema que resolve: o usuário loga em `/restaurante/login`
 * (Firebase) e cai no admin — mas a lista de "usuários logados" vive
 * no localStorage e só era preenchida pelo `NewLoginModal`. Sem esse
 * bootstrap, a sidebar filtrava tudo achando que ninguém tem permissões.
 *
 * Estratégia:
 *   1) Se já existe um `activeUserId` na store, não faz nada.
 *   2) Caso contrário, chama `trpc.staff.getCurrent` — o backend devolve
 *      o `tenantUser` correspondente ao firebaseUid do contexto (ou o
 *      OWNER do tenant como fallback em dev).
 *   3) Adiciona o usuário na store, tornando-o ativo.
 */
export function SessionBootstrap() {
  const activeUserId = useLoggedUsersStore((s) => s.activeUserId);
  const addUser = useLoggedUsersStore((s) => s.addUser);
  const didPopulate = useRef(false);

  const query = trpc.staff.getCurrent.useQuery(undefined, {
    // Só roda se não temos ninguém ativo e ainda não populamos nesta montagem.
    enabled: !activeUserId && !didPopulate.current,
    retry: 1,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeUserId) {
      // Já tem alguém ativo — nada a fazer.
      return;
    }
    if (query.isError) {
      console.warn(
        "[SessionBootstrap] Falha ao buscar usuário atual:",
        query.error?.message
      );
      return;
    }
    if (!query.data) {
      // Ainda carregando, ou backend devolveu null (sem OWNER no tenant).
      if (query.isFetched && query.data === null) {
        console.warn(
          "[SessionBootstrap] staff.getCurrent retornou null — não há OWNER no tenant."
        );
      }
      return;
    }
    if (didPopulate.current) return;
    didPopulate.current = true;

    const u = query.data;
    console.info(
      "[SessionBootstrap] Populando usuário ativo:",
      u.name,
      `(${u.role})`
    );
    addUser({
      id: u.id,
      name: u.name,
      email: u.email ?? null,
      photoUrl: u.photoUrl ?? null,
      role: u.role,
      userTypeId: u.userTypeId ?? null,
      userTypeName: u.userTypeName ?? null,
      permissions: u.permissions ?? {},
      kind: u.kind,
    });
  }, [
    activeUserId,
    query.data,
    query.isError,
    query.isFetched,
    query.error,
    addUser,
  ]);

  return null;
}
