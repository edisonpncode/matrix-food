"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  UserPlus,
  LogOut,
  Users as UsersIcon,
  AlertTriangle,
} from "lucide-react";
import {
  useLoggedUsersStore,
  type LoggedUser,
} from "@/lib/logged-users-store";
import { PinPromptModal } from "./pin-prompt-modal";
import { NewLoginModal } from "./new-login-modal";

interface UserSwitcherModalProps {
  onClose: () => void;
}

type InnerModal =
  | { kind: "pin"; user: LoggedUser }
  | { kind: "new-login" }
  | { kind: "confirm-logout-all" }
  | null;

export function UserSwitcherModal({ onClose }: UserSwitcherModalProps) {
  const router = useRouter();
  const users = useLoggedUsersStore((s) => s.users);
  const activeUserId = useLoggedUsersStore((s) => s.activeUserId);
  const logoutActive = useLoggedUsersStore((s) => s.logoutActive);
  const logoutAll = useLoggedUsersStore((s) => s.logoutAll);

  const [inner, setInner] = useState<InnerModal>(null);

  function handleSelectUser(user: LoggedUser) {
    if (user.id === activeUserId) {
      onClose();
      return;
    }
    // Pede PIN para confirmar troca
    setInner({ kind: "pin", user });
  }

  function handleLogout() {
    const { nextActiveId } = logoutActive();
    if (!nextActiveId) {
      // Não há mais ninguém — vai para login
      onClose();
      router.push("/restaurante/login");
    } else {
      onClose();
    }
  }

  function handleLogoutAll() {
    logoutAll();
    onClose();
    router.push("/restaurante/login");
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md rounded-2xl bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Alterar Usuário</h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Lista de usuários logados */}
          <div className="max-h-[50vh] overflow-y-auto px-3 py-3">
            {users.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <p>Nenhum usuário logado neste dispositivo.</p>
                <p className="mt-1">Clique em &ldquo;Novo Login&rdquo; abaixo.</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {users.map((u) => {
                  const isActive = u.id === activeUserId;
                  return (
                    <li key={u.id}>
                      <button
                        onClick={() => handleSelectUser(u)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                          isActive
                            ? "bg-primary/10 border border-primary/30"
                            : "hover:bg-accent"
                        }`}
                      >
                        {u.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={u.photoUrl}
                            alt={u.name}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
                            {u.name
                              .split(" ")
                              .map((p) => p[0])
                              .filter(Boolean)
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {u.name}
                            {isActive && (
                              <span className="ml-2 text-[10px] font-medium text-primary">
                                (ativo)
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {u.userTypeName ?? roleLabel(u.role)}
                            {u.kind === "admin" && " • Proprietário"}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Ações */}
          <div className="border-t border-border p-3 space-y-1.5">
            <button
              onClick={() => setInner({ kind: "new-login" })}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              Novo Login
            </button>

            {users.length > 0 && activeUserId && (
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sair (usuário atual)
              </button>
            )}

            {users.length > 0 && (
              <button
                onClick={() => setInner({ kind: "confirm-logout-all" })}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sair Todos
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Submodal: Pedir PIN para trocar para um usuário da lista */}
      {inner?.kind === "pin" && (
        <PinPromptModal
          user={inner.user}
          onClose={() => setInner(null)}
          onSuccess={() => {
            setInner(null);
            onClose();
          }}
        />
      )}

      {/* Submodal: Novo Login */}
      {inner?.kind === "new-login" && (
        <NewLoginModal
          onClose={() => setInner(null)}
          onSuccess={() => {
            setInner(null);
            onClose();
          }}
        />
      )}

      {/* Submodal: Confirmar Sair Todos */}
      {inner?.kind === "confirm-logout-all" && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setInner(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="mb-2 text-center text-lg font-bold">
              Sair de todos os usuários?
            </h3>
            <p className="mb-5 text-center text-sm text-muted-foreground">
              Todos os usuários logados neste dispositivo serão desconectados.
              Você voltará para a tela de login.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setInner(null)}
                className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleLogoutAll}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
              >
                Sair Todos
              </button>
            </div>
          </div>
        </div>
      )}
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
