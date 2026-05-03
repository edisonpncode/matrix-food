"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Save, AlertTriangle, Users } from "lucide-react";

export default function ConfiguracoesPage() {
  const utils = trpc.useUtils();
  const { data: config, isLoading } =
    trpc.superadmin.getSystemConfig.useQuery();

  const [maxInput, setMaxInput] = useState<string>("");
  const [savedFlag, setSavedFlag] = useState(false);

  useEffect(() => {
    if (config) {
      setMaxInput(
        config.maxActiveRestaurants !== null
          ? String(config.maxActiveRestaurants)
          : ""
      );
    }
  }, [config]);

  const updateMutation = trpc.superadmin.updateSystemConfig.useMutation({
    onSuccess: () => {
      utils.superadmin.getSystemConfig.invalidate();
      utils.superadmin.listTenants.invalidate();
      setSavedFlag(true);
      setTimeout(() => setSavedFlag(false), 2500);
    },
  });

  const handleSave = () => {
    const trimmed = maxInput.trim();
    if (trimmed === "") {
      updateMutation.mutate({ maxActiveRestaurants: null });
      return;
    }
    const parsed = parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    updateMutation.mutate({
      maxActiveRestaurants: parsed === 0 ? null : parsed,
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const current = config?.currentActive ?? 0;
  const max = config?.maxActiveRestaurants;
  const wouldExceed =
    max !== null &&
    max !== undefined &&
    Number(maxInput || 0) > 0 &&
    current > Number(maxInput);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="mt-1 text-muted-foreground">
          Ajustes globais do sistema Matrix Food
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Limite de restaurantes ativos</h2>
            <p className="text-sm text-muted-foreground">
              Quantidade máxima de restaurantes que podem operar
              simultaneamente. Cadastros adicionais entram em fila de espera
              até serem aprovados manualmente.
            </p>
          </div>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Ativos agora</div>
            <div className="mt-1 text-2xl font-bold">{current}</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Limite atual</div>
            <div className="mt-1 text-2xl font-bold">
              {max === null || max === undefined ? "—" : max}
            </div>
          </div>
          <div className="rounded-lg border bg-amber-50 p-3">
            <div className="text-xs text-amber-700">Em fila</div>
            <div className="mt-1 text-2xl font-bold text-amber-700">
              {config?.currentWaitlist ?? 0}
            </div>
          </div>
        </div>

        <label className="mb-1.5 block text-sm font-medium">
          Novo limite (deixe vazio ou 0 para sem limite)
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            value={maxInput}
            onChange={(e) => setMaxInput(e.target.value)}
            placeholder="Ex: 50"
            className="w-full max-w-xs rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Salvar
          </button>
        </div>

        {wouldExceed && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Você tem {current} restaurantes ativos, mas está reduzindo o
              limite para {maxInput}. Os restaurantes existentes continuarão
              ativos — apenas novos cadastros entrarão na fila até alguém ser
              suspenso.
            </span>
          </div>
        )}

        {savedFlag && (
          <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            Configuração salva com sucesso.
          </div>
        )}
      </div>
    </div>
  );
}
