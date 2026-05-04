"use client";

import { useState } from "react";
import Image from "next/image";
import { X, ShieldAlert, Loader2, ArrowLeft, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";
import { RequirePinModal } from "@/components/shared/user-session/require-pin-modal";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Dono",
  MANAGER: "Gerente",
  CASHIER: "Caixa",
  DELIVERY: "Motoboy",
};

export interface AuthorizerResult {
  authorizerId: string;
  authorizerName: string;
}

interface SelectAuthorizerModalProps {
  /** Valor do desconto em R$ exibido para contexto */
  discountAmount: number;
  /** Texto curto para o log: "Pedido novo", "Fechamento de mesa", etc. */
  contextLabel: string;
  onClose: () => void;
  onAuthorized: (result: AuthorizerResult) => void;
}

export function SelectAuthorizerModal({
  discountAmount,
  contextLabel,
  onClose,
  onAuthorized,
}: SelectAuthorizerModalProps) {
  const authorizersQuery = trpc.staff.listAuthorizers.useQuery();
  const [selected, setSelected] = useState<{
    id: string;
    name: string;
  } | null>(null);

  if (selected) {
    return (
      <RequirePinModal
        title={`Autorização: ${selected.name}`}
        description={`Confirme o PIN para autorizar desconto de ${formatCurrency(
          discountAmount
        )}.`}
        action="Autorizar desconto manual"
        reason={`${contextLabel} - ${formatCurrency(discountAmount)} de desconto`}
        userId={selected.id}
        onClose={() => setSelected(null)}
        onSuccess={(user) => {
          onAuthorized({ authorizerId: user.id, authorizerName: user.name });
        }}
      />
    );
  }

  const authorizers = authorizersQuery.data ?? [];
  const isLoading = authorizersQuery.isLoading;

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <h3 className="text-lg font-bold">Autorização necessária</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-6">
          <p className="text-sm text-muted-foreground">
            Você não tem permissão para aplicar desconto. Escolha um gerente ou
            dono para autorizar com PIN.
          </p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Desconto solicitado:{" "}
            <span className="font-semibold">
              {formatCurrency(discountAmount)}
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando autorizadores...
            </div>
          ) : authorizers.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Nenhum gerente ou dono cadastrado com PIN. Cadastre em Equipe →
              Funcionários para liberar autorizações.
            </div>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {authorizers.map((u) => {
                const initial = u.name.trim().charAt(0).toUpperCase() || "?";
                const roleLabel =
                  u.userTypeName ?? ROLE_LABELS[u.role] ?? u.role;
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelected({ id: u.id, name: u.name })
                      }
                      className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left hover:border-primary hover:bg-primary/5"
                    >
                      {u.photoUrl ? (
                        <Image
                          src={u.photoUrl}
                          alt={u.name}
                          width={36}
                          height={36}
                          className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {initial}
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">
                          {u.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {roleLabel}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
