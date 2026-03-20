"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Star,
  Gift,
  Users,
  Settings2,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

interface RewardFormData {
  name: string;
  description: string;
  pointsCost: string;
  discountValue: string;
  maxRedemptions: string;
  sortOrder: string;
}

const emptyRewardForm: RewardFormData = {
  name: "",
  description: "",
  pointsCost: "",
  discountValue: "",
  maxRedemptions: "",
  sortOrder: "0",
};

// ============================================
// COMPONENT
// ============================================

export default function FidelidadePage() {
  const [activeTab, setActiveTab] = useState<
    "config" | "rewards" | "customers"
  >("config");
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [rewardForm, setRewardForm] =
    useState<RewardFormData>(emptyRewardForm);

  // Config state
  const [isActive, setIsActive] = useState(false);
  const [spendingBase, setSpendingBase] = useState("1");
  const [pointsPerReal, setPointsPerReal] = useState("1");
  const [pointsName, setPointsName] = useState("Pontos");
  const [minOrderForPoints, setMinOrderForPoints] = useState("");
  const [configLoaded, setConfigLoaded] = useState(false);

  const utils = trpc.useUtils();

  // Queries
  const { data: config, isLoading: loadingConfig } =
    trpc.loyalty.getConfig.useQuery(undefined, {
      onSuccess: (data) => {
        if (data && !configLoaded) {
          setIsActive(data.isActive);
          setSpendingBase(data.spendingBase ?? "1");
          setPointsPerReal(data.pointsPerReal);
          setPointsName(data.pointsName);
          setMinOrderForPoints(data.minOrderForPoints ?? "");
          setConfigLoaded(true);
        }
      },
    });

  const { data: rewards, isLoading: loadingRewards } =
    trpc.loyalty.listRewards.useQuery();

  const { data: customerBalances, isLoading: loadingCustomers } =
    trpc.loyalty.listCustomerBalances.useQuery();

  // Mutations
  const upsertConfig = trpc.loyalty.upsertConfig.useMutation({
    onSuccess: () => {
      utils.loyalty.getConfig.invalidate();
    },
  });

  const createReward = trpc.loyalty.createReward.useMutation({
    onSuccess: () => {
      utils.loyalty.listRewards.invalidate();
      resetRewardForm();
    },
  });

  const updateReward = trpc.loyalty.updateReward.useMutation({
    onSuccess: () => {
      utils.loyalty.listRewards.invalidate();
      resetRewardForm();
    },
  });

  const deleteReward = trpc.loyalty.deleteReward.useMutation({
    onSuccess: () => utils.loyalty.listRewards.invalidate(),
  });

  // Handlers
  function resetRewardForm() {
    setShowRewardForm(false);
    setEditingRewardId(null);
    setRewardForm(emptyRewardForm);
  }

  function handleEditReward(reward: NonNullable<typeof rewards>[number]) {
    setEditingRewardId(reward.id);
    setRewardForm({
      name: reward.name,
      description: reward.description ?? "",
      pointsCost: reward.pointsCost.toString(),
      discountValue: reward.discountValue,
      maxRedemptions: reward.maxRedemptions?.toString() ?? "",
      sortOrder: reward.sortOrder.toString(),
    });
    setShowRewardForm(true);
  }

  function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    upsertConfig.mutate({
      isActive,
      spendingBase,
      pointsPerReal,
      pointsName,
      minOrderForPoints: minOrderForPoints || null,
    });
  }

  function handleSubmitReward(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name: rewardForm.name,
      description: rewardForm.description || undefined,
      pointsCost: parseInt(rewardForm.pointsCost),
      discountValue: rewardForm.discountValue,
      maxRedemptions: rewardForm.maxRedemptions
        ? parseInt(rewardForm.maxRedemptions)
        : null,
      sortOrder: parseInt(rewardForm.sortOrder) || 0,
    };

    if (editingRewardId) {
      updateReward.mutate({ id: editingRewardId, ...data });
    } else {
      createReward.mutate(data);
    }
  }

  const tabs = [
    { id: "config" as const, label: "Configurar", icon: Settings2 },
    { id: "rewards" as const, label: "Recompensas", icon: Gift },
    { id: "customers" as const, label: "Clientes", icon: Users },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Star className="h-7 w-7 text-yellow-500" />
        <h1 className="text-2xl font-bold">Programa de Fidelidade</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ======== Tab: Config ======== */}
      {activeTab === "config" && (
        <div className="rounded-xl border bg-card p-6">
          {loadingConfig ? (
            <p className="text-center text-muted-foreground">Carregando...</p>
          ) : (
            <form onSubmit={handleSaveConfig} className="space-y-6">
              {/* Toggle ativo */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Sistema de Fidelidade</p>
                  <p className="text-sm text-muted-foreground">
                    Clientes ganham pontos a cada pedido e trocam por
                    recompensas
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                    isActive ? "bg-primary" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
                      isActive ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {isActive && (
                <>
                  {/* Regra de pontos */}
                  <div className="rounded-lg border p-4 space-y-4">
                    <p className="font-medium text-sm">Regra de acúmulo de pontos</p>

                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm text-muted-foreground">A cada</span>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium">R$</span>
                        <input
                          type="number"
                          value={spendingBase}
                          onChange={(e) => setSpendingBase(e.target.value)}
                          min="0.01"
                          step="0.01"
                          required
                          className="w-20 rounded-lg border px-2 py-1.5 text-sm text-center"
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">gastos, o cliente ganha</span>
                      <input
                        type="number"
                        value={pointsPerReal}
                        onChange={(e) => setPointsPerReal(e.target.value)}
                        min="1"
                        step="1"
                        required
                        className="w-20 rounded-lg border px-2 py-1.5 text-sm text-center"
                      />
                      <span className="text-sm text-muted-foreground">pontos</span>
                    </div>
                  </div>

                  {/* Nome dos pontos */}
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Nome dos pontos
                    </label>
                    <input
                      type="text"
                      value={pointsName}
                      onChange={(e) => setPointsName(e.target.value)}
                      placeholder="Pontos"
                      maxLength={50}
                      required
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ex: &quot;Pontos&quot;, &quot;Estrelas&quot;,
                      &quot;Moedas&quot;
                    </p>
                  </div>

                  {/* Valor mínimo */}
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Valor mínimo do pedido para ganhar pontos (R$)
                    </label>
                    <input
                      type="number"
                      value={minOrderForPoints}
                      onChange={(e) => setMinOrderForPoints(e.target.value)}
                      placeholder="Sem mínimo"
                      step="0.01"
                      min="0"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>

                  {/* Exemplo */}
                  <div className="rounded-lg bg-yellow-50 p-4">
                    <p className="text-sm font-medium text-yellow-800">
                      Exemplo com suas configurações:
                    </p>
                    <p className="mt-1 text-sm text-yellow-700">
                      Um pedido de{" "}
                      <strong>{formatCurrency(50)}</strong> daria{" "}
                      <strong>
                        {Math.floor(
                          (50 / parseFloat(spendingBase || "1")) *
                            parseFloat(pointsPerReal || "1")
                        )}{" "}
                        {pointsName}
                      </strong>{" "}
                      ao cliente.
                    </p>
                    <p className="mt-0.5 text-xs text-yellow-600">
                      Fórmula: (valor do pedido ÷ R${spendingBase || "1"}) × {pointsPerReal || "1"} {pointsName.toLowerCase()}
                    </p>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={upsertConfig.isPending}
                className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {upsertConfig.isPending
                  ? "Salvando..."
                  : upsertConfig.isSuccess
                  ? "Salvo!"
                  : "Salvar Configurações"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ======== Tab: Rewards ======== */}
      {activeTab === "rewards" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Recompensas que os clientes podem resgatar com pontos
            </p>
            <button
              onClick={() => {
                setRewardForm(emptyRewardForm);
                setEditingRewardId(null);
                setShowRewardForm(true);
              }}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Nova Recompensa
            </button>
          </div>

          {loadingRewards ? (
            <p className="text-center text-muted-foreground">Carregando...</p>
          ) : !rewards || rewards.length === 0 ? (
            <div className="rounded-xl border bg-card p-12 text-center">
              <Gift className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h2 className="mb-2 text-lg font-semibold">
                Nenhuma recompensa
              </h2>
              <p className="text-sm text-muted-foreground">
                Crie recompensas para seus clientes resgatarem com pontos.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rewards.map((reward) => (
                <div
                  key={reward.id}
                  className="flex items-center justify-between rounded-xl border bg-card p-4"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{reward.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          reward.isActive
                            ? "bg-green-100 text-green-600"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {reward.isActive ? "Ativa" : "Inativa"}
                      </span>
                    </div>
                    {reward.description && (
                      <p className="text-sm text-muted-foreground">
                        {reward.description}
                      </p>
                    )}
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-500" />
                        {reward.pointsCost} pontos
                      </span>
                      <span>
                        Desconto:{" "}
                        {formatCurrency(parseFloat(reward.discountValue))}
                      </span>
                      <span>
                        Resgates: {reward.totalRedemptions}
                        {reward.maxRedemptions
                          ? `/${reward.maxRedemptions}`
                          : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditReward(reward)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Excluir esta recompensa?")) {
                          deleteReward.mutate({ id: reward.id });
                        }
                      }}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======== Tab: Customers ======== */}
      {activeTab === "customers" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Clientes com saldo de pontos no seu restaurante
          </p>

          {loadingCustomers ? (
            <p className="text-center text-muted-foreground">Carregando...</p>
          ) : !customerBalances || customerBalances.length === 0 ? (
            <div className="rounded-xl border bg-card p-12 text-center">
              <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h2 className="mb-2 text-lg font-semibold">Nenhum cliente</h2>
              <p className="text-sm text-muted-foreground">
                Quando clientes fizerem pedidos, seus pontos aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border bg-card">
              <div className="grid grid-cols-3 gap-4 border-b px-4 py-3 text-sm font-medium text-muted-foreground">
                <span>Telefone</span>
                <span className="text-center">Pontos</span>
                <span className="text-center">Pedidos</span>
              </div>
              {customerBalances.map((customer) => (
                <div
                  key={customer.customerPhone}
                  className="grid grid-cols-3 gap-4 border-b px-4 py-3 text-sm last:border-b-0"
                >
                  <span className="font-medium">
                    {customer.customerPhone}
                  </span>
                  <span className="text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-0.5 text-yellow-700">
                      <Star className="h-3 w-3" />
                      {customer.totalPoints}
                    </span>
                  </span>
                  <span className="text-center text-muted-foreground">
                    {customer.transactionCount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======== Reward Create/Edit Modal ======== */}
      {showRewardForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {editingRewardId
                  ? "Editar Recompensa"
                  : "Nova Recompensa"}
              </h2>
              <button
                onClick={resetRewardForm}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReward} className="space-y-4">
              {/* Nome */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Nome da recompensa
                </label>
                <input
                  type="text"
                  value={rewardForm.name}
                  onChange={(e) =>
                    setRewardForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Ex: Desconto de R$10"
                  required
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Descrição (opcional)
                </label>
                <input
                  type="text"
                  value={rewardForm.description}
                  onChange={(e) =>
                    setRewardForm((f) => ({
                      ...f,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Ex: Válido em qualquer pedido"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              {/* Custo em pontos */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Custo em pontos
                </label>
                <input
                  type="number"
                  value={rewardForm.pointsCost}
                  onChange={(e) =>
                    setRewardForm((f) => ({
                      ...f,
                      pointsCost: e.target.value,
                    }))
                  }
                  placeholder="Ex: 100"
                  min="1"
                  required
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              {/* Valor do desconto */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Valor do desconto (R$)
                </label>
                <input
                  type="number"
                  value={rewardForm.discountValue}
                  onChange={(e) =>
                    setRewardForm((f) => ({
                      ...f,
                      discountValue: e.target.value,
                    }))
                  }
                  placeholder="Ex: 10.00"
                  step="0.01"
                  min="0.01"
                  required
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              {/* Limite de resgates */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Limite total de resgates (opcional)
                </label>
                <input
                  type="number"
                  value={rewardForm.maxRedemptions}
                  onChange={(e) =>
                    setRewardForm((f) => ({
                      ...f,
                      maxRedemptions: e.target.value,
                    }))
                  }
                  placeholder="Ilimitado"
                  min="1"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={createReward.isPending || updateReward.isPending}
                className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {createReward.isPending || updateReward.isPending
                  ? "Salvando..."
                  : editingRewardId
                  ? "Salvar Alterações"
                  : "Criar Recompensa"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
