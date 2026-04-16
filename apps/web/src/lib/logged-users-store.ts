"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Representa um usuário que está "logado" neste dispositivo.
 * Essa lista é persistida em localStorage e permite troca rápida
 * entre operadores usando apenas o PIN.
 *
 * IMPORTANTE: Nunca armazenar senhas ou PINs aqui.
 */
export interface LoggedUser {
  id: string;
  name: string;
  email: string | null;
  photoUrl: string | null;
  role: "OWNER" | "MANAGER" | "CASHIER" | "DELIVERY";
  userTypeId: string | null;
  userTypeName: string | null;
  permissions: Record<string, boolean>;
  /** ISO timestamp da última vez que este usuário foi selecionado */
  lastUsedAt: string;
  /** Se é admin/dono (logou por Firebase) ou funcionário (senha local) */
  kind: "admin" | "staff";
}

const MAX_USERS = 6;

interface LoggedUsersState {
  users: LoggedUser[];
  activeUserId: string | null;

  /** Adiciona ou atualiza um usuário na lista e o define como ativo */
  addUser: (user: Omit<LoggedUser, "lastUsedAt">) => void;
  /** Troca o usuário ativo (assume que já está na lista) */
  setActive: (userId: string) => void;
  /** Remove o usuário ativo da lista. Se sobrar algum, torna-se o novo ativo. */
  logoutActive: () => { nextActiveId: string | null };
  /** Remove todos os usuários da lista */
  logoutAll: () => void;
  /** Apaga um usuário específico */
  removeUser: (userId: string) => void;
  /** Substitui permissões/nome de um usuário (após re-login) */
  updateUser: (userId: string, patch: Partial<LoggedUser>) => void;
  /** Retorna o usuário ativo atual (helper) */
  getActiveUser: () => LoggedUser | null;
}

export const useLoggedUsersStore = create<LoggedUsersState>()(
  persist(
    (set, get) => ({
      users: [],
      activeUserId: null,

      addUser: (user) => {
        const now = new Date().toISOString();
        set((state) => {
          const others = state.users.filter((u) => u.id !== user.id);
          const next = [{ ...user, lastUsedAt: now }, ...others];
          // Limita o número de usuários na lista (MRU)
          const trimmed = next.slice(0, MAX_USERS);
          return {
            users: trimmed,
            activeUserId: user.id,
          };
        });
      },

      setActive: (userId) => {
        const now = new Date().toISOString();
        set((state) => {
          const exists = state.users.some((u) => u.id === userId);
          if (!exists) return state;
          const updated = state.users.map((u) =>
            u.id === userId ? { ...u, lastUsedAt: now } : u
          );
          // Ordena pelo mais recente primeiro (MRU)
          updated.sort(
            (a, b) =>
              new Date(b.lastUsedAt).getTime() -
              new Date(a.lastUsedAt).getTime()
          );
          return { users: updated, activeUserId: userId };
        });
      },

      logoutActive: () => {
        const { users, activeUserId } = get();
        if (!activeUserId) return { nextActiveId: null };
        const remaining = users.filter((u) => u.id !== activeUserId);
        const nextActive = remaining[0]?.id ?? null;
        set({
          users: remaining,
          activeUserId: nextActive,
        });
        return { nextActiveId: nextActive };
      },

      logoutAll: () => {
        set({ users: [], activeUserId: null });
      },

      removeUser: (userId) => {
        set((state) => {
          const remaining = state.users.filter((u) => u.id !== userId);
          const activeId =
            state.activeUserId === userId
              ? (remaining[0]?.id ?? null)
              : state.activeUserId;
          return { users: remaining, activeUserId: activeId };
        });
      },

      updateUser: (userId, patch) => {
        set((state) => ({
          users: state.users.map((u) =>
            u.id === userId ? { ...u, ...patch } : u
          ),
        }));
      },

      getActiveUser: () => {
        const { users, activeUserId } = get();
        if (!activeUserId) return null;
        return users.find((u) => u.id === activeUserId) ?? null;
      },
    }),
    {
      name: "matrix-food-logged-users",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);

/**
 * Hook helper que retorna o usuário ativo reativamente.
 */
export function useActiveUser(): LoggedUser | null {
  return useLoggedUsersStore((s) =>
    s.activeUserId ? (s.users.find((u) => u.id === s.activeUserId) ?? null) : null
  );
}
