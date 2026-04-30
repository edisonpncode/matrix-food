"use client";

import { useState, useRef, useEffect } from "react";
import { X, ShieldAlert, Loader2, LogOut } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface RequirePinModalProps {
  /** Título do modal. Ex: "Autorização necessária" */
  title?: string;
  /** Descrição / motivo. Ex: "Confirme o PIN para cancelar este pedido" */
  description?: string;
  /** Rótulo da ação, gravado no activity log. Ex: "Cancelar pedido #123" */
  action: string;
  /** Motivo adicional gravado no log */
  reason?: string;
  /** Fecha o modal sem autorizar */
  onClose?: () => void;
  /** Chamado com os dados do usuário que autorizou */
  onSuccess: (user: {
    id: string;
    name: string;
    role: string;
    permissions: Record<string, boolean>;
  }) => void;
  /** Se true, não mostra botão de fechar (uso bloqueante, ex: timeout) */
  blocking?: boolean;
  /**
   * Se passado, mostra um botão "Sair" abaixo do Confirmar — útil em
   * modais bloqueantes (timeout) onde o usuário pode querer abandonar
   * a sessão e voltar para a tela de login em vez de digitar o PIN.
   */
  onLogout?: () => void | Promise<void>;
}

/**
 * Modal que pede PIN para autorizar uma ação sensível ou desbloquear sessão.
 * Registra a autorização no Activity Log via trpc.staff.authorizeAction.
 */
export function RequirePinModal({
  title = "Autorização necessária",
  description = "Informe o PIN para continuar.",
  action,
  reason,
  onClose,
  onSuccess,
  blocking = false,
  onLogout,
}: RequirePinModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const authorize = trpc.staff.authorizeAction.useMutation({
    onSuccess: (data) => {
      onSuccess(data.user);
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
    authorize.mutate({ pin, action, reason });
  }

  async function handleLogout() {
    if (!onLogout || loggingOut) return;
    setLoggingOut(true);
    try {
      await onLogout();
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onClick={blocking ? undefined : onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <h3 className="text-lg font-bold">{title}</h3>
          </div>
          {!blocking && onClose && (
            <button
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="p-6">
          <p className="mb-4 text-sm text-muted-foreground">{description}</p>

          <form onSubmit={handleSubmit} className="space-y-3">
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
              disabled={pin.length < 4 || authorize.isPending || loggingOut}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              {authorize.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                "Confirmar"
              )}
            </button>
          </form>

          {onLogout && (
            <>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">ou</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut || authorize.isPending}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-50 transition-colors"
              >
                {loggingOut ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saindo...
                  </>
                ) : (
                  <>
                    <LogOut className="h-4 w-4" />
                    Sair e voltar para o login
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
