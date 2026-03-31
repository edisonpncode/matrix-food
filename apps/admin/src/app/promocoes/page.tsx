"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Tag,
  Package,
  Gift,
  Truck,
  Calendar,
  Clock,
  Image,
} from "lucide-react";

type PromoType =
  | "PERCENTAGE"
  | "FIXED_AMOUNT"
  | "FREE_DELIVERY"
  | "COMBO"
  | "BUY_X_GET_Y";

const TYPE_LABELS: Record<PromoType, string> = {
  PERCENTAGE: "Desconto %",
  FIXED_AMOUNT: "Desconto R$",
  FREE_DELIVERY: "Frete Grátis",
  COMBO: "Combo",
  BUY_X_GET_Y: "Compre e Ganhe",
};

const TYPE_COLORS: Record<PromoType, string> = {
  PERCENTAGE: "bg-purple-100 text-purple-700",
  FIXED_AMOUNT: "bg-green-100 text-green-700",
  FREE_DELIVERY: "bg-blue-100 text-blue-700",
  COMBO: "bg-orange-100 text-orange-700",
  BUY_X_GET_Y: "bg-pink-100 text-pink-700",
};

const TYPE_ICONS: Record<PromoType, React.ElementType> = {
  PERCENTAGE: Tag,
  FIXED_AMOUNT: Tag,
  FREE_DELIVERY: Truck,
  COMBO: Package,
  BUY_X_GET_Y: Gift,
};

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface ComboItem {
  productId: string | null;
  categoryId: string | null;
  quantity: number;
  role: "REQUIRED" | "FREE" | "CHOICE";
  specialPrice: string | null;
  sortOrder: number;
  // display helpers
  productName?: string;
  categoryName?: string;
}

interface PromoFormData {
  code: string;
  description: string;
  type: PromoType;
  value: string;
  bundlePrice: string;
  maxChoices: string;
  daysOfWeek: number[];
  timeStart: string;
  timeEnd: string;
  imageUrl: string;
  minOrderValue: string;
  maxDiscount: string;
  maxUses: string;
  maxUsesPerCustomer: string;
  startDate: string;
  endDate: string;
  items: ComboItem[];
}

const emptyForm: PromoFormData = {
  code: "",
  description: "",
  type: "PERCENTAGE",
  value: "",
  bundlePrice: "",
  maxChoices: "",
  daysOfWeek: [],
  timeStart: "",
  timeEnd: "",
  imageUrl: "",
  minOrderValue: "",
  maxDiscount: "",
  maxUses: "",
  maxUsesPerCustomer: "",
  startDate: "",
  endDate: "",
  items: [],
};

export default function PromocoesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PromoFormData>(emptyForm);

  const utils = trpc.useUtils();
  const { data: promos, isLoading } = trpc.promotion.list.useQuery();
  const { data: allProducts } = trpc.product.listAll.useQuery({});
  const { data: allCategories } = trpc.category.listAll.useQuery();

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
      bundlePrice: promo.bundlePrice ?? "",
      maxChoices: promo.maxChoices?.toString() ?? "",
      daysOfWeek: (promo.daysOfWeek as number[]) ?? [],
      timeStart: promo.timeStart ?? "",
      timeEnd: promo.timeEnd ?? "",
      imageUrl: promo.imageUrl ?? "",
      minOrderValue: promo.minOrderValue ?? "",
      maxDiscount: promo.maxDiscount ?? "",
      maxUses: promo.maxUses?.toString() ?? "",
      maxUsesPerCustomer: promo.maxUsesPerCustomer?.toString() ?? "",
      startDate: promo.startDate
        ? new Date(promo.startDate).toISOString().split("T")[0]!
        : "",
      endDate: promo.endDate
        ? new Date(promo.endDate).toISOString().split("T")[0]!
        : "",
      items: (promo.items || []).map((item) => ({
        productId: item.productId,
        categoryId: item.categoryId,
        quantity: item.quantity,
        role: item.role as "REQUIRED" | "FREE" | "CHOICE",
        specialPrice: item.specialPrice,
        sortOrder: item.sortOrder,
        productName: item.productName ?? undefined,
        categoryName: item.categoryName ?? undefined,
      })),
    });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const data = {
      code: form.code,
      description: form.description || undefined,
      type: form.type,
      value: form.value || "0",
      bundlePrice: form.bundlePrice || undefined,
      maxChoices: form.maxChoices ? parseInt(form.maxChoices) : undefined,
      daysOfWeek: form.daysOfWeek.length > 0 ? form.daysOfWeek : undefined,
      timeStart: form.timeStart || undefined,
      timeEnd: form.timeEnd || undefined,
      imageUrl: form.imageUrl || undefined,
      minOrderValue: form.minOrderValue || undefined,
      maxDiscount: form.maxDiscount || undefined,
      maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
      maxUsesPerCustomer: form.maxUsesPerCustomer
        ? parseInt(form.maxUsesPerCustomer)
        : 1,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      items:
        form.type === "COMBO" || form.type === "BUY_X_GET_Y"
          ? form.items.map((item, idx) => ({
              productId: item.productId,
              categoryId: item.categoryId,
              quantity: item.quantity,
              role: item.role as "REQUIRED" | "FREE" | "CHOICE",
              specialPrice: item.specialPrice,
              sortOrder: idx,
            }))
          : undefined,
    };

    if (editingId) {
      updatePromo.mutate({ id: editingId, ...data });
    } else {
      createPromo.mutate(data);
    }
  }

  function toggleDay(day: number) {
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(day)
        ? f.daysOfWeek.filter((d) => d !== day)
        : [...f.daysOfWeek, day],
    }));
  }

  function addComboItem(role: "REQUIRED" | "FREE" | "CHOICE" = "REQUIRED") {
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        {
          productId: null,
          categoryId: null,
          quantity: 1,
          role,
          specialPrice: null,
          sortOrder: f.items.length,
        },
      ],
    }));
  }

  function updateComboItem(index: number, updates: Partial<ComboItem>) {
    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) =>
        i === index ? { ...item, ...updates } : item
      ),
    }));
  }

  function removeComboItem(index: number) {
    setForm((f) => ({
      ...f,
      items: f.items.filter((_, i) => i !== index),
    }));
  }

  function getPromoStatus(promo: NonNullable<typeof promos>[number]) {
    if (!promo.isActive)
      return { label: "Inativa", color: "bg-gray-100 text-gray-600" };
    const now = new Date();
    if (promo.endDate && new Date(promo.endDate) < now)
      return { label: "Expirada", color: "bg-red-100 text-red-600" };
    if (promo.maxUses && promo.usageCount >= promo.maxUses)
      return { label: "Esgotada", color: "bg-orange-100 text-orange-600" };
    return { label: "Ativa", color: "bg-green-100 text-green-600" };
  }

  function formatPromoValue(promo: NonNullable<typeof promos>[number]) {
    if (promo.type === "COMBO" && promo.bundlePrice && promo.maxChoices)
      return `Escolha ${promo.maxChoices} por ${formatCurrency(parseFloat(promo.bundlePrice))}`;
    if (promo.type === "COMBO" && promo.bundlePrice)
      return `Combo ${formatCurrency(parseFloat(promo.bundlePrice))}`;
    if (promo.type === "BUY_X_GET_Y") return "Compre e Ganhe";
    if (promo.type === "PERCENTAGE") return `${promo.value}%`;
    if (promo.type === "FIXED_AMOUNT")
      return formatCurrency(parseFloat(promo.value));
    return "Frete Grátis";
  }

  function formatDays(days: number[] | null) {
    if (!days || days.length === 0) return null;
    if (days.length === 7) return "Todos os dias";
    return days.map((d) => DAY_NAMES[d]).join(", ");
  }

  const isComboType = form.type === "COMBO" || form.type === "BUY_X_GET_Y";

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
        <div>
          <h1 className="text-2xl font-bold">Promoções</h1>
          <p className="text-sm text-muted-foreground">
            Crie cupons, combos e promoções especiais
          </p>
        </div>
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
            Crie promoções, combos e ofertas para atrair mais clientes.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {promos.map((promo) => {
            const status = getPromoStatus(promo);
            const Icon = TYPE_ICONS[promo.type as PromoType] || Tag;
            const daysText = formatDays(promo.daysOfWeek as number[] | null);

            return (
              <div
                key={promo.id}
                className="rounded-xl border bg-card p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg ${
                        TYPE_COLORS[promo.type as PromoType]
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
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

                      {/* Combo items */}
                      {promo.items && promo.items.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {promo.items.map((item, idx) => (
                            <span
                              key={idx}
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                                item.role === "FREE"
                                  ? "bg-green-100 text-green-700"
                                  : item.role === "CHOICE"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {item.role === "CHOICE" ? "" : `${item.quantity}x `}
                              {item.productName ||
                                item.categoryName ||
                                "Item"}
                              {item.role === "FREE" && " 🎁"}
                              {item.role === "CHOICE" && " 🔄"}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {formatPromoValue(promo)}
                        </span>
                        {daysText && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {daysText}
                          </span>
                        )}
                        {promo.timeStart && promo.timeEnd && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {promo.timeStart}-{promo.timeEnd}
                          </span>
                        )}
                        {promo.minOrderValue && (
                          <span>
                            Min:{" "}
                            {formatCurrency(
                              parseFloat(promo.minOrderValue)
                            )}
                          </span>
                        )}
                        <span>
                          Usos: {promo.usageCount}
                          {promo.maxUses ? `/${promo.maxUses}` : ""}
                        </span>
                        {promo.endDate && (
                          <span>
                            Até:{" "}
                            {new Date(promo.endDate).toLocaleDateString(
                              "pt-BR"
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
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
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl">
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

            <form
              onSubmit={handleSubmit}
              className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"
            >
              {/* Tipo de Promoção */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Tipo de promoção
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {(
                    [
                      { value: "COMBO", label: "Combo", icon: Package },
                      {
                        value: "BUY_X_GET_Y",
                        label: "Compre e Ganhe",
                        icon: Gift,
                      },
                      {
                        value: "PERCENTAGE",
                        label: "Desconto %",
                        icon: Tag,
                      },
                      {
                        value: "FIXED_AMOUNT",
                        label: "Desconto R$",
                        icon: Tag,
                      },
                      {
                        value: "FREE_DELIVERY",
                        label: "Frete Grátis",
                        icon: Truck,
                      },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          type: opt.value,
                          items:
                            opt.value === "COMBO" || opt.value === "BUY_X_GET_Y"
                              ? f.items
                              : [],
                        }))
                      }
                      className={`flex flex-col items-center gap-1 rounded-lg border-2 px-2 py-3 text-xs font-medium transition-colors ${
                        form.type === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <opt.icon className="h-5 w-5" />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Code + Description */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Código / Nome
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
                    placeholder="Ex: SEGUNDA-BURGER"
                    required
                    className="w-full rounded-lg border px-3 py-2 text-sm font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Descrição
                  </label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Ex: 2 Hambúrgueres + 2 Refris"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* === COMBO / BUY_X_GET_Y: Items builder === */}
              {isComboType && (
                <div className="rounded-lg border bg-accent/30 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      {form.type === "COMBO"
                        ? "🍔 Itens do Combo"
                        : "🎁 Compre e Ganhe"}
                    </h3>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => addComboItem("REQUIRED")}
                        className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
                      >
                        <Plus className="h-3 w-3" />
                        {form.type === "BUY_X_GET_Y"
                          ? "Item Obrigatório"
                          : "Adicionar Item"}
                      </button>
                      {form.type === "BUY_X_GET_Y" && (
                        <button
                          type="button"
                          onClick={() => addComboItem("FREE")}
                          className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                        >
                          <Gift className="h-3 w-3" />
                          Item Grátis
                        </button>
                      )}
                      {form.type === "COMBO" && (
                        <button
                          type="button"
                          onClick={() => addComboItem("CHOICE")}
                          className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          <Plus className="h-3 w-3" />
                          Opção de Escolha
                        </button>
                      )}
                    </div>
                  </div>

                  {form.items.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground py-4">
                      Adicione os itens que farão parte{" "}
                      {form.type === "COMBO"
                        ? "do combo"
                        : "da promoção"}
                    </p>
                  )}

                  <div className="space-y-2">
                    {form.items.map((item, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 rounded-lg border bg-card p-3 ${
                          item.role === "FREE"
                            ? "border-green-300"
                            : item.role === "CHOICE"
                            ? "border-blue-300"
                            : ""
                        }`}
                      >
                        {item.role === "FREE" && (
                          <span className="text-sm">🎁</span>
                        )}
                        {item.role === "CHOICE" && (
                          <span className="text-sm">🔄</span>
                        )}

                        {/* Quantity */}
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            updateComboItem(idx, {
                              quantity: parseInt(e.target.value) || 1,
                            })
                          }
                          min="1"
                          className="w-14 rounded-md border px-2 py-1.5 text-center text-sm"
                        />
                        <span className="text-xs text-muted-foreground">
                          x
                        </span>

                        {/* Product or Category selector */}
                        <select
                          value={
                            item.productId
                              ? `product:${item.productId}`
                              : item.categoryId
                              ? `category:${item.categoryId}`
                              : ""
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val.startsWith("product:")) {
                              const pid = val.replace("product:", "");
                              const prod = allProducts?.find(
                                (p) => p.id === pid
                              );
                              updateComboItem(idx, {
                                productId: pid,
                                categoryId: null,
                                productName: prod?.name,
                                categoryName: undefined,
                              });
                            } else if (val.startsWith("category:")) {
                              const cid = val.replace("category:", "");
                              const cat = allCategories?.find(
                                (c) => c.id === cid
                              );
                              updateComboItem(idx, {
                                productId: null,
                                categoryId: cid,
                                productName: undefined,
                                categoryName: cat?.name,
                              });
                            }
                          }}
                          className="flex-1 rounded-md border px-2 py-1.5 text-sm"
                        >
                          <option value="">Selecione...</option>
                          <optgroup label="📂 Categorias (qualquer item)">
                            {allCategories?.map((cat) => (
                              <option
                                key={`cat-${cat.id}`}
                                value={`category:${cat.id}`}
                              >
                                Qualquer {cat.name}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="🍔 Produtos específicos">
                            {allProducts?.map((prod) => (
                              <option
                                key={`prod-${prod.id}`}
                                value={`product:${prod.id}`}
                              >
                                {prod.name} -{" "}
                                {formatCurrency(parseFloat(prod.price))}
                              </option>
                            ))}
                          </optgroup>
                        </select>

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => removeComboItem(idx)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Bundle Price (only for COMBO) */}
                  {form.type === "COMBO" && form.items.length > 0 && (
                    <div className="mt-3">
                      <label className="mb-1 block text-sm font-medium">
                        💰 Preço do Combo (R$)
                      </label>
                      <input
                        type="number"
                        value={form.bundlePrice}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            bundlePrice: e.target.value,
                          }))
                        }
                        placeholder="Ex: 69.90"
                        step="0.01"
                        min="0"
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        O cliente paga esse valor fixo pelos itens do combo
                      </p>
                    </div>
                  )}

                  {/* Max Choices - for CHOICE items */}
                  {form.type === "COMBO" &&
                    form.items.some((i) => i.role === "CHOICE") && (
                      <div className="mt-3">
                        <label className="mb-1 block text-sm font-medium">
                          🔄 Quantos itens o cliente pode escolher?
                        </label>
                        <input
                          type="number"
                          value={form.maxChoices}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              maxChoices: e.target.value,
                            }))
                          }
                          placeholder="Ex: 3"
                          min="1"
                          className="w-full rounded-lg border px-3 py-2 text-sm"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Ex: &quot;3 xis por R$29&quot; — o cliente escolhe 3
                          itens entre as opções marcadas com 🔄
                        </p>
                      </div>
                    )}
                </div>
              )}

              {/* Value (not for combos or FREE_DELIVERY) */}
              {!isComboType && form.type !== "FREE_DELIVERY" && (
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Valor {form.type === "PERCENTAGE" ? "(%)" : "(R$)"}
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

              {/* === Dias da Semana === */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  <Calendar className="mr-1 inline h-4 w-4" />
                  Dias válidos (deixe vazio = todos)
                </label>
                <div className="flex gap-2">
                  {DAY_NAMES.map((day, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className={`flex-1 rounded-lg border-2 py-2 text-center text-xs font-medium transition-colors ${
                        form.daysOfWeek.includes(idx)
                          ? "border-primary bg-primary text-white"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* === Horário === */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    <Clock className="mr-1 inline h-4 w-4" />
                    Horário início
                  </label>
                  <input
                    type="time"
                    value={form.timeStart}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, timeStart: e.target.value }))
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Horário fim
                  </label>
                  <input
                    type="time"
                    value={form.timeEnd}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, timeEnd: e.target.value }))
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Image URL */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  <Image className="mr-1 inline h-4 w-4" />
                  URL da imagem/banner (opcional)
                </label>
                <input
                  type="url"
                  value={form.imageUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, imageUrl: e.target.value }))
                  }
                  placeholder="https://..."
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              {/* Min Order + Max Discount */}
              {!isComboType && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Pedido mínimo (R$)
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
                  {form.type === "PERCENTAGE" && (
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Desconto máximo (R$)
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
                    placeholder="Ilimitado"
                    min="1"
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
                      setForm((f) => ({
                        ...f,
                        startDate: e.target.value,
                      }))
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
