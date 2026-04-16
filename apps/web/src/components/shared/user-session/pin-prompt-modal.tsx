"use client";

import { useState, useRef, useEffect } from "react";
import { X, KeyRound, Loader2 } from "lucide-react";
import {
  useLoggedUsersStore,
  type LoggedUser,
} from "@/lib/logged-users-store";
import { trpc } from "@/lib/trpc";

interface PinPromptModalProps {
  user: LoggedUser;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Modal que pede PIN para trocar para o usuário escolhido.
 * Quando confirmado, atualiza o usuário ativo no store.
 */
export function PinPromptModal({
  user,
  onClose,
  onSuccess,
}: PinPromptModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const setActive = useLoggedUsersStore((s) => s.setActive);
  const updateUser = useLoggedUsersStore((s) => s.updateUser);

  const verify = trpc.staff.verifyPin.useMutation({
    onSuccess: (data) => {
      // Verifica se o PIN é realmente do usuário escolhido
      if (data.id !== user.id) {
        setError("Este PIN não pertence ao usuário selecionado.");
        setPin("");
        return;
      }
      // Atualiza permissões/foto mais recentes
      updateUser(user.id, {
        name: data.name,
        photoUrl: data.photoUrl,
        userTypeId: data.userTypeId,
        userTypeName: data.userTypeName,
        permissions: data.permissions,
      });
      setActive(user.id);
      onSuccess();
    },
    onError: (err) => {
      setError(err.message || "PIN inválido.");
      setPin("");
      inputRef.current?.focus();
    },
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pin.length < 4) return;
    setError(null);
    verify.mutate({ pin });
  }

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">PIN de Acesso</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-5 flex flex-col items-center text-center">
            {user.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.photoUrl}
                alt={user.name}
                className="mb-3 h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                {initials}
              </div>
            )}
            <p className="font-semibold">{user.name}</p>
            <p className="text-xs text-muted-foreground">
              {user.userTypeName ?? user.role}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block text-sm font-medium">
              Informe o PIN (4-6 dígitos)
            </label>
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-center text-2xl font-mono tracking-widest outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="••••"
            />
            {error && (
              <p className="text-center text-sm text-red-600">{error}</p>
            )}
            <button
              type="submit"
              disabled={pin.length < 4 || verify.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              {verify.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                "Confirmar"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
