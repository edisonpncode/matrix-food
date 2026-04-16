"use client";

import { useInactivityTimeout } from "@/lib/use-inactivity-timeout";
import { useActiveUser, useLoggedUsersStore } from "@/lib/logged-users-store";
import { RequirePinModal } from "./require-pin-modal";

interface InactivityGuardProps {
  /** Tempo em minutos antes de bloquear (default 15) */
  timeoutMinutes?: number;
  children: React.ReactNode;
}

/**
 * Envolve o conteúdo (admin) e bloqueia com um modal de PIN após N
 * minutos de inatividade. Ao desbloquear, a sessão do usuário atual
 * segue ativa. Se o PIN for de outro usuário, troca o ativo.
 */
export function InactivityGuard({
  timeoutMinutes = 15,
  children,
}: InactivityGuardProps) {
  const activeUser = useActiveUser();
  const setActive = useLoggedUsersStore((s) => s.setActive);
  const users = useLoggedUsersStore((s) => s.users);

  const { locked, unlock } = useInactivityTimeout({
    timeoutMs: timeoutMinutes * 60 * 1000,
    disabled: !activeUser, // só ativa se houver usuário logado
  });

  return (
    <>
      {children}
      {locked && (
        <RequirePinModal
          title="Sessão bloqueada por inatividade"
          description={
            activeUser
              ? `Informe seu PIN (${activeUser.name}) para continuar.`
              : "Informe seu PIN para continuar."
          }
          action="Desbloquear sessão (timeout)"
          reason={`${timeoutMinutes} min de inatividade`}
          blocking
          onSuccess={(user) => {
            // Se o PIN pertencer a outro usuário da lista, troca o ativo
            const exists = users.some((u) => u.id === user.id);
            if (exists) setActive(user.id);
            unlock();
          }}
        />
      )}
    </>
  );
}
