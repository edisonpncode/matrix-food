"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Plus, Pencil, Check, X } from "lucide-react";

export default function PlanosPage() {
  const utils = trpc.useUtils();
  const { data: plans, isLoading } = trpc.billing.listPlans.useQuery();
  const createPlan = trpc.billing.createPlan.useMutation({
    onSuccess: () => {
      utils.billing.listPlans.invalidate();
      setShowForm(false);
      resetForm();
    },
  });
  const updatePlan = trpc.billing.updatePlan.useMutation({
    onSuccess: () => {
      utils.billing.listPlans.invalidate();
      setEditingId(null);
    },
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    freeOrdersLimit: 0,
    percentageFee: 5,
    minMonthlyFee: "",
    isDefault: false,
  });

  function resetForm() {
    setForm({
      name: "",
      description: "",
      freeOrdersLimit: 0,
      percentageFee: 5,
      minMonthlyFee: "",
      isDefault: false,
    });
  }

  function handleCreate() {
    createPlan.mutate({
      name: form.name,
      description: form.description || undefined,
      freeOrdersLimit: form.freeOrdersLimit,
      percentageFee: form.percentageFee,
      minMonthlyFee: form.minMonthlyFee ? Number(form.minMonthlyFee) : undefined,
      isDefault: form.isDefault,
    });
  }

  function startEdit(plan: NonNullable<typeof plans>[number]) {
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      description: plan.description || "",
      freeOrdersLimit: plan.freeOrdersLimit,
      percentageFee: Number(plan.percentageFee),
      minMonthlyFee: plan.minMonthlyFee || "",
      isDefault: plan.isDefault,
    });
  }

  function handleUpdate() {
    if (!editingId) return;
    updatePlan.mutate({
      id: editingId,
      name: form.name,
      description: form.description || undefined,
      freeOrdersLimit: form.freeOrdersLimit,
      percentageFee: form.percentageFee,
      minMonthlyFee: form.minMonthlyFee ? Number(form.minMonthlyFee) : null,
      isDefault: form.isDefault,
    });
  }

  function toggleActive(plan: NonNullable<typeof plans>[number]) {
    updatePlan.mutate({ id: plan.id, isActive: !plan.isActive });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Planos de Cobrança</h1>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            resetForm();
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo Plano
        </button>
      </div>

      {/* Formulário */}
      {(showForm || editingId) && (
        <div className="rounded-xl border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">
            {editingId ? "Editar Plano" : "Novo Plano"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Nome</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Ex: Plano Básico"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Descrição</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Descrição do plano"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Pedidos grátis/mês
              </label>
              <input
                type="number"
                min={0}
                value={form.freeOrdersLimit}
                onChange={(e) =>
                  setForm({ ...form, freeOrdersLimit: Number(e.target.value) })
                }
                className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Taxa (%) sobre vendas
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={form.percentageFee}
                onChange={(e) =>
                  setForm({ ...form, percentageFee: Number(e.target.value) })
                }
                className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Mensalidade mínima (R$)
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.minMonthlyFee}
                onChange={(e) =>
                  setForm({ ...form, minMonthlyFee: e.target.value })
                }
                className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Deixe vazio para sem mínimo"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) =>
                    setForm({ ...form, isDefault: e.target.checked })
                  }
                  className="accent-primary"
                />
                Plano padrão para novos restaurantes
              </label>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={editingId ? handleUpdate : handleCreate}
              disabled={!form.name || createPlan.isPending || updatePlan.isPending}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {editingId ? "Salvar" : "Criar"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                resetForm();
              }}
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              <X className="h-4 w-4" />
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans?.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-xl border p-5 ${
              !plan.isActive ? "opacity-60" : ""
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold">{plan.name}</h3>
              <div className="flex gap-1">
                {plan.isDefault && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Padrão
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    plan.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {plan.isActive ? "Ativo" : "Inativo"}
                </span>
              </div>
            </div>
            {plan.description && (
              <p className="mb-3 text-sm text-muted-foreground">
                {plan.description}
              </p>
            )}
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Pedidos grátis:</span>{" "}
                <strong>{plan.freeOrdersLimit}/mês</strong>
              </p>
              <p>
                <span className="text-muted-foreground">Taxa:</span>{" "}
                <strong>{plan.percentageFee}%</strong> sobre vendas
              </p>
              {plan.minMonthlyFee && (
                <p>
                  <span className="text-muted-foreground">Mínimo:</span>{" "}
                  <strong>R$ {Number(plan.minMonthlyFee).toFixed(2)}</strong>/mês
                </p>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => startEdit(plan)}
                className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                <Pencil className="h-3 w-3" />
                Editar
              </button>
              <button
                onClick={() => toggleActive(plan)}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                {plan.isActive ? "Desativar" : "Ativar"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {plans?.length === 0 && (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            Nenhum plano criado ainda. Clique em &quot;Novo Plano&quot; para começar.
          </p>
        </div>
      )}
    </div>
  );
}
