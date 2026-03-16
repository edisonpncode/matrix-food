"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";
import { Plus, Pencil, Trash2, X, Tag } from "lucide-react";

type PromoType = "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_DELIVERY";

const TYPE_LABELS: Record<PromoType, string> = {
  PERCENTAGE: "Desconto %",
  FIXED_AMOUNT: "Desconto R$",
  FREE_DELIVERY: "Frete Grátis",
};

const TYPE_COLORS: Record<PromoType, string> = {
  PERCENTAGE: "bg-purple-100 text-purple-700",
  FIXED_AMOUNT: "bg-green-100 text-green-700",
  FREE_DELIVERY: "bg-blue-100 text-blue-700",
};

interface PromoFormData {
  code: string;
  description: string;
  type: PromoType;
  value: string;
  minOrderValue: string;
  maxDiscount: string;
  maxUses: string;
  maxUsesPerCustomer: string;
  startDate: string;
  endDate: string;
}

const emptyForm: PromoFormData = {
  code: "",
  description: "",
  type: "PERCENTAGE",
  value: "",
  minOrderValue: "",
  maxDiscount: "",
  maxUses: "",
  maxUsesPerCustomer: "1",
  startDate: "",
  endDate: "",
};

export default function PromocoesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PromoFormData>(emptyForm);

  const utils = trpc.useUtils();
  const { data: promos, isLoading } = trpc.promotion.list.useQuery();

  const createPromo = trpc.promotion.create.useMutation({
    onSuccess: () => {
      utils.promotion.list.invalidate();
      resetForm();
    },
  });

  const updatePromo = trpc.promotion.update.useMutation({
    onSuccess: () => {
      utils.promotion.list.invalidate();
      resetForm();
    },
  });

  const deletePromo = trpc.promotion.delete.useMutation({
    onSuccess: () => utils.promotion.list.invalidate(),
  });

  const togglePromo = trpc.promotion.update.useMutation({
    onSuccess: () => utils.promotion.list.invalidate(),
  });

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function handleEdit(promo: NonNullable<typeof promos>[number]) {
    setEditingId(promo.id);
    setForm({
      code: promo.code,
      description: promo.description ?? "",
      type: promo.type as PromoType,
      value: promo.value,
      minOrderValue: promo.minOrderValue ?? "",
      maxDiscount: promo.maxDiscount ?? "",
      maxUses: promo.maxUses?.toString() ?? "",
      maxUsesPerCustomer: promo.maxUsesPerCustomer.toString(),
      startDate: promo.startDate
        ? new Date(promo.startDate).toISOString().split("T")[0]!
        : "",
      endDate: promo.endDate
        ? new Date(promo.endDate).toISOString().split("T")[0]!
        : "",
    });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const data = {
      code: form.code,
      description: form.description || undefined,
      type: form.type,
      value: form.value,
      minOrderValue: form.minOrderValue || undefined,
      maxDiscount: form.maxDiscount || undefined,
      maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
      maxUsesPerCustomer: parseInt(form.maxUsesPerCustomer) || 1,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
    };

    if (editingId) {
      updatePromo.mutate({ id: editingId, ...data });
    } else {
      createPromo.mutate(data);
    }
  }

  function getPromoStatus(promo: NonNullable<typeof promos>[number]) {
    if (!promo.isActive) return { label: "Inativa", color: "bg-gray-100 text-gray-600" };
    const now = new Date();
    if (promo.endDate && new Date(promo.endDate) < now) return { label: "Expirada", color: "bg-red-100 text-red-600" };
    if (promo.maxUses && promo.usageCount >= promo.maxUses) return { label: "Esgotada", color: "bg-orange-100 text-orange-600" };
    return { label: "Ativa", color: "bg-green-100 text-green-600" };
  }

  function formatPromoValue(type: string, value: string) {
    if (type === "PERCENTAGE") return `${value}%`;
    if (type === "FIXED_AMOUNT") return formatCurrency(parseFloat(value));
    return "Frete Grátis";
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Promoções</h1>
        <button
          onClick={() => {
            setForm(emptyForm);
            setEditingId(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Nova Promoção
        </button>
      </div>

      {/* Promotions List */}
      {!promos || promos.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Tag className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="mb-2 text-lg font-semibold">Nenhuma promoção</h2>
          <p className="text-sm text-muted-foreground">
            Crie promoções para atrair mais clientes.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {promos.map((promo) => {
            const status = getPromoStatus(promo);
            return (
              <div
                key={promo.id}
                className="flex items-center justify-between rounded-xl border bg-card p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-bold">
                        {promo.code}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          TYPE_COLORS[promo.type as PromoType]
                        }`}
                      >
                        {TYPE_LABELS[promo.type as PromoType]}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    {promo.description && (
                      <p className="text-sm text-muted-foreground">
                        {promo.description}
                      </p>
                    )}
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>
                        Valor: {formatPromoValue(promo.type, promo.value)}
                      </span>
                      {promo.minOrderValue && (
                        <span>
                          Min: {formatCurrency(parseFloat(promo.minOrderValue))}
                        </span>
                      )}
                      <span>
                        Usos: {promo.usageCount}
                        {promo.maxUses ? `/${promo.maxUses}` : ""}
                      </span>
                      {promo.endDate && (
                        <span>
                          Até:{" "}
                          {new Date(promo.endDate).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      togglePromo.mutate({
                        id: promo.id,
                        isActive: !promo.isActive,
                      })
                    }
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      promo.isActive
                        ? "bg-red-50 text-red-600 hover:bg-red-100"
                        : "bg-green-50 text-green-600 hover:bg-green-100"
                    }`}
                  >
                    {promo.isActive ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    onClick={() => handleEdit(promo)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Excluir esta promoção?")) {
                        deletePromo.mutate({ id: promo.id });
                      }
                    }}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {editingId ? "Editar Promoção" : "Nova Promoção"}
              </h2>
              <button
                onClick={resetForm}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Code */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Código do cupom
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      code: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="Ex: DESCONTO10"
                  required
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono uppercase"
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Descrição (opcional)
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Ex: 10% de desconto no primeiro pedido"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              {/* Type */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Tipo de desconto
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: "PERCENTAGE", label: "Desconto %" },
                      { value: "FIXED_AMOUNT", label: "Desconto R$" },
                      { value: "FREE_DELIVERY", label: "Frete Grátis" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, type: opt.value }))
                      }
                      className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                        form.type === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Value (not for FREE_DELIVERY) */}
              {form.type !== "FREE_DELIVERY" && (
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Valor{" "}
                    {form.type === "PERCENTAGE" ? "(%)" : "(R$)"}
                  </label>
                  <input
                    type="number"
                    value={form.value}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, value: e.target.value }))
                    }
                    placeholder={
                      form.type === "PERCENTAGE" ? "Ex: 10" : "Ex: 5.00"
                    }
                    step={form.type === "PERCENTAGE" ? "1" : "0.01"}
                    min="0"
                    max={form.type === "PERCENTAGE" ? "100" : undefined}
                    required
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              )}

              {/* Min Order Value */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Valor mínimo do pedido (R$) - opcional
                </label>
                <input
                  type="number"
                  value={form.minOrderValue}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      minOrderValue: e.target.value,
                    }))
                  }
                  placeholder="Sem mínimo"
                  step="0.01"
                  min="0"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              {/* Max Discount (only for PERCENTAGE) */}
              {form.type === "PERCENTAGE" && (
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Desconto máximo (R$) - opcional
                  </label>
                  <input
                    type="number"
                    value={form.maxDiscount}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        maxDiscount: e.target.value,
                      }))
                    }
                    placeholder="Sem limite"
                    step="0.01"
                    min="0"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              )}

              {/* Usage Limits */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Limite total de usos
                  </label>
                  <input
                    type="number"
                    value={form.maxUses}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, maxUses: e.target.value }))
                    }
                    placeholder="Ilimitado"
                    min="1"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Usos por cliente
                  </label>
                  <input
                    type="number"
                    value={form.maxUsesPerCustomer}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        maxUsesPerCustomer: e.target.value,
                      }))
                    }
                    min="1"
                    required
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Data início
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, startDate: e.target.value }))
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Data fim (opcional)
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, endDate: e.target.value }))
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={createPromo.isPending || updatePromo.isPending}
                className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {createPromo.isPending || updatePromo.isPending
                  ? "Salvando..."
                  : editingId
                  ? "Salvar Alterações"
                  : "Criar Promoção"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
