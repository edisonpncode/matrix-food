"use client";

import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const activeUser = useActiveUser();
  const setActive = useLoggedUsersStore((s) => s.setActive);
  const logoutAll = useLoggedUsersStore((s) => s.logoutAll);
  const users = useLoggedUsersStore((s) => s.users);

  const { locked, unlock } = useInactivityTimeout({
    timeoutMs: timeoutMinutes * 60 * 1000,
    disabled: !activeUser, // só ativa se houver usuário logado
  });

  /**
   * Logout completo a partir do modal de inatividade:
   *  1. Limpa cookies de sessão no servidor (`/api/logout`).
   *  2. Sai do Firebase (caso o usuário ativo seja o dono/OWNER).
   *  3. Limpa o store local (`logoutAll`) — todos os usuários da máquina.
   *  4. Redireciona para `/restaurante/login`.
   */
  async function handleLogout() {
    // 1) cookies de servidor — não bloqueia se falhar
    try {
      await fetch("/api/logout", { method: "GET" });
    } catch {
      /* ignore */
    }

    // 2) Firebase — best-effort, não bloqueia se já estiver deslogado
    try {
      const { initializeApp, getApps } = await import("firebase/app");
      const { getAuth, signOut } = await import("firebase/auth");
      const firebaseConfig = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      };
      const app =
        getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);
      await signOut(getAuth(app));
    } catch {
      /* ignore */
    }

    // 3) limpa o store local
    logoutAll();

    // 4) leva para o login
    router.push("/restaurante/login");
  }

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
          onLogout={handleLogout}
        />
      )}
    </>
  );
}
