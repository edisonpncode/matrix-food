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
 *
 * Roda em silêncio — qualquer erro é absorvido, pois não queremos
 * bloquear o render do admin caso o tRPC ainda não esteja pronto.
 */
export function SessionBootstrap() {
  const activeUserId = useLoggedUsersStore((s) => s.activeUserId);
  const addUser = useLoggedUsersStore((s) => s.addUser);
  const ran = useRef(false);

  // Só pede ao backend se realmente não temos ninguém ativo.
  const { data } = trpc.staff.getCurrent.useQuery(undefined, {
    enabled: !activeUserId && !ran.current,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!data || ran.current || activeUserId) return;
    ran.current = true;
    addUser({
      id: data.id,
      name: data.name,
      email: data.email ?? null,
      photoUrl: data.photoUrl ?? null,
      role: data.role,
      userTypeId: data.userTypeId ?? null,
      userTypeName: data.userTypeName ?? null,
      permissions: data.permissions ?? {},
      kind: data.kind,
    });
  }, [data, addUser, activeUserId]);

  return null;
}
