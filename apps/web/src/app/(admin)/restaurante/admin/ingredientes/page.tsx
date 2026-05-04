"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Plus, Pencil, Trash2, Loader2, Calculator, ChefHat, History } from "lucide-react";
import {
  CostHelp,
  convertToBaseUnit,
  displayInPreferredUnit,
} from "@/components/admin/cost-help";
import { computeIngredientUnitCost } from "@matrix-food/utils";

type IngredientType = "QUANTITY" | "DESCRIPTION";
type BaseUnit = "g" | "ml" | "un";
type InputUnit = "kg" | "g" | "L" | "ml" | "un" | "pacote";

interface RecipeItem {
  childIngredientId: string;
  childName: string;
  childUnit: BaseUnit;
  childUnitCost: string;
  quantity: string;
  unit: BaseUnit;
}

function scrollToTop() {
  const main = document.querySelector("main");
  if (main) main.scrollTop = 0;
  window.scrollTo(0, 0);
}

const WASTE_PRESETS: { label: string; value: number }[] = [
  { label: "Sem perda", value: 0 },
  { label: "Pouca (5%)", value: 0.05 },
  { label: "Média (15%)", value: 0.15 },
  { label: "Alta (30%)", value: 0.3 },
];

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

export default function IngredientesPage() {
  const utils = trpc.useUtils();
  const ingredientsList = trpc.ingredient.list.useQuery();

  const createMutation = trpc.ingredient.create.useMutation({
    onSuccess: () => {
      utils.ingredient.list.invalidate();
      closeForm();
      scrollToTop();
    },
  });
  const updateMutation = trpc.ingredient.update.useMutation({
    onSuccess: () => {
      utils.ingredient.list.invalidate();
      closeForm();
      scrollToTop();
    },
  });
  const setCompositeMutation = trpc.ingredient.setComposite.useMutation({
    onSuccess: () => utils.ingredient.list.invalidate(),
  });
  const syncRecipeMutation = trpc.ingredient.syncRecipe.useMutation({
    onSuccess: () => utils.ingredient.list.invalidate(),
  });
  const deleteMutation = trpc.ingredient.delete.useMutation({
    onSuccess: () => utils.ingredient.list.invalidate(),
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Campos do formulário
  const [name, setName] = useState("");
  const [type, setType] = useState<IngredientType>("QUANTITY");
  const [unit, setUnit] = useState<BaseUnit>("un");
  const [purchaseInputQty, setPurchaseInputQty] = useState("");
  const [purchaseInputUnit, setPurchaseInputUnit] = useState<InputUnit>("un");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [wastePercent, setWastePercent] = useState("0");

  // Sub-receita
  const [isComposite, setIsComposite] = useState(false);
  const [yieldQuantity, setYieldQuantity] = useState("");
  const [yieldInputUnit, setYieldInputUnit] = useState<InputUnit>("g");
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  const [recipeItemPickerOpen, setRecipeItemPickerOpen] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Cálculo ao vivo do custo unitário (folha)
  const livePurchase = useMemo(() => {
    const { quantity, unit: baseUnit } = convertToBaseUnit(
      purchaseInputQty || 0,
      purchaseInputUnit
    );
    return { quantity, unit: baseUnit };
  }, [purchaseInputQty, purchaseInputUnit]);

  const liveUnitCost = useMemo(() => {
    if (isComposite) return 0;
    if (!purchasePrice || livePurchase.quantity <= 0) return 0;
    return computeIngredientUnitCost({
      purchaseQuantity: livePurchase.quantity,
      purchasePrice,
      wastePercent: wastePercent || "0",
    });
  }, [isComposite, livePurchase.quantity, purchasePrice, wastePercent]);

  // Cálculo ao vivo do custo do composto
  const liveCompositeCost = useMemo(() => {
    if (!isComposite) return 0;
    const { quantity: yieldQ } = convertToBaseUnit(
      yieldQuantity || 0,
      yieldInputUnit
    );
    if (yieldQ <= 0) return 0;
    let total = 0;
    for (const item of recipeItems) {
      total += Number(item.quantity) * Number(item.childUnitCost);
    }
    const waste = Math.min(Math.max(Number(wastePercent || 0), 0), 0.99);
    const effective = yieldQ * (1 - waste);
    return effective > 0 ? total / effective : 0;
  }, [isComposite, recipeItems, yieldQuantity, yieldInputUnit, wastePercent]);

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setName("");
    setType("QUANTITY");
    setUnit("un");
    setPurchaseInputQty("");
    setPurchaseInputUnit("un");
    setPurchasePrice("");
    setWastePercent("0");
    setIsComposite(false);
    setYieldQuantity("");
    setYieldInputUnit("g");
    setRecipeItems([]);
  }

  function startEdit(ingredient: {
    id: string;
    name: string;
    type: IngredientType;
    unit: BaseUnit;
    purchaseQuantity: string;
    purchasePrice: string;
    wastePercent: string;
    isComposite: boolean;
    yieldQuantity: string | null;
  }) {
    setEditingId(ingredient.id);
    setName(ingredient.name);
    setType(ingredient.type);
    setUnit(ingredient.unit);

    const purchaseQty = Number(ingredient.purchaseQuantity);
    const display = displayInPreferredUnit(purchaseQty, ingredient.unit);
    setPurchaseInputQty(display.value > 0 ? String(display.value) : "");
    setPurchaseInputUnit(display.label as InputUnit);
    setPurchasePrice(
      Number(ingredient.purchasePrice) > 0 ? ingredient.purchasePrice : ""
    );
    setWastePercent(ingredient.wastePercent ?? "0");

    setIsComposite(ingredient.isComposite);
    if (ingredient.yieldQuantity) {
      const ydisp = displayInPreferredUnit(
        Number(ingredient.yieldQuantity),
        ingredient.unit
      );
      setYieldQuantity(String(ydisp.value));
      setYieldInputUnit(ydisp.label as InputUnit);
    } else {
      setYieldQuantity("");
      setYieldInputUnit(ingredient.unit === "un" ? "un" : ingredient.unit === "g" ? "g" : "ml");
    }

    // Carregar sub-receita do ingrediente em edição
    if (ingredient.isComposite) {
      utils.ingredient.getById.fetch({ id: ingredient.id }).then((data) => {
        if (data?.recipeItems) {
          setRecipeItems(
            data.recipeItems.map((it) => ({
              childIngredientId: it.childIngredientId,
              childName: it.childName,
              childUnit: it.childUnit as BaseUnit,
              childUnitCost: it.childUnitCost,
              quantity: it.quantity,
              unit: it.unit as BaseUnit,
            }))
          );
        }
      });
    } else {
      setRecipeItems([]);
    }

    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const purchaseQtyBase = livePurchase.quantity;
    const baseUnit: BaseUnit = isComposite ? unit : livePurchase.unit;

    const payload = {
      name: name.trim(),
      type,
      unit: baseUnit,
      purchaseQuantity: String(purchaseQtyBase || 0),
      purchasePrice: purchasePrice || "0",
      wastePercent: wastePercent || "0",
    };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, ...payload });

        if (isComposite) {
          const { quantity: yieldQ } = convertToBaseUnit(
            yieldQuantity || 0,
            yieldInputUnit
          );
          await setCompositeMutation.mutateAsync({
            id: editingId,
            isComposite: true,
            yieldQuantity: String(yieldQ),
            wastePercent: wastePercent || "0",
          });
          await syncRecipeMutation.mutateAsync({
            parentIngredientId: editingId,
            items: recipeItems.map((it, idx) => ({
              childIngredientId: it.childIngredientId,
              quantity: it.quantity,
              unit: it.unit,
              sortOrder: idx,
            })),
          });
        } else {
          await setCompositeMutation.mutateAsync({
            id: editingId,
            isComposite: false,
          });
        }
        utils.ingredient.list.invalidate();
        closeForm();
      } else {
        const created = await createMutation.mutateAsync(payload);
        if (created && isComposite) {
          const { quantity: yieldQ } = convertToBaseUnit(
            yieldQuantity || 0,
            yieldInputUnit
          );
          await setCompositeMutation.mutateAsync({
            id: created.id,
            isComposite: true,
            yieldQuantity: String(yieldQ),
            wastePercent: wastePercent || "0",
          });
          await syncRecipeMutation.mutateAsync({
            parentIngredientId: created.id,
            items: recipeItems.map((it, idx) => ({
              childIngredientId: it.childIngredientId,
              quantity: it.quantity,
              unit: it.unit,
              sortOrder: idx,
            })),
          });
          utils.ingredient.list.invalidate();
          closeForm();
        }
      }
    } catch (err) {
      console.error("Erro ao salvar ingrediente:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Erro ao salvar. Tente novamente."
      );
    }
  }

  // Para o picker de componentes da sub-receita
  const availableComponents = useMemo(() => {
    if (!ingredientsList.data) return [];
    const usedIds = new Set(recipeItems.map((r) => r.childIngredientId));
    return ingredientsList.data
      .filter((ing) => ing.isActive)
      .filter((ing) => !usedIds.has(ing.id))
      .filter((ing) => editingId !== ing.id); // não pode usar a si mesmo
  }, [ingredientsList.data, recipeItems, editingId]);

  const isLoading =
    createMutation.isPending ||
    updateMutation.isPending ||
    setCompositeMutation.isPending ||
    syncRecipeMutation.isPending;

  // Validar se pode submeter
  const canSubmit = useMemo(() => {
    if (!name.trim()) return false;
    if (isComposite && recipeItems.length === 0) return false;
    if (isComposite && (!yieldQuantity || Number(yieldQuantity) <= 0)) return false;
    return true;
  }, [name, isComposite, recipeItems.length, yieldQuantity]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ingredientes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Cadastre insumos com preço, perda e calcule o custo unitário
            automaticamente.
          </p>
        </div>
        <button
          onClick={() => {
            closeForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo Ingrediente
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-border bg-card p-6 space-y-6"
        >
          <h2 className="text-lg font-semibold">
            {editingId ? "Editar Ingrediente" : "Novo Ingrediente"}
          </h2>

          {/* Dados básicos */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Queijo mussarela, Massa de pizza, Caixa pizza grande"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Tipo</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setType("QUANTITY")}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                    type === "QUANTITY"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  Quantidade
                  <div className="text-[10px] opacity-70 mt-0.5">ovo, queijo, bife</div>
                </button>
                <button
                  type="button"
                  onClick={() => setType("DESCRIPTION")}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                    type === "DESCRIPTION"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  Descrição
                  <div className="text-[10px] opacity-70 mt-0.5">maionese, milho</div>
                </button>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-2">
                Unidade-base <CostHelp topic="unit" />
              </label>
              <div className="flex gap-2">
                {(["g", "ml", "un"] as BaseUnit[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => {
                      setUnit(u);
                      // sincroniza unidade de compra default com a base
                      if (u === "g") setPurchaseInputUnit("kg");
                      else if (u === "ml") setPurchaseInputUnit("L");
                      else setPurchaseInputUnit("un");
                    }}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      unit === u
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input bg-background text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {u === "g" ? "Gramas" : u === "ml" ? "Mililitros" : "Unidade"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Toggle composite */}
          <div className="flex items-center gap-3 rounded-md border border-border bg-accent/40 p-3">
            <input
              type="checkbox"
              id="isComposite"
              checked={isComposite}
              onChange={(e) => setIsComposite(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="isComposite" className="flex-1 text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                <ChefHat className="h-4 w-4 text-amber-600" />
                É uma sub-receita / matéria-prima preparada
                <CostHelp topic="composite" />
              </span>
              <span className="text-xs text-muted-foreground">
                Ex: massa de pizza, bife marinado, molho da casa
              </span>
            </label>
          </div>

          {/* Compra (só folha) */}
          {!isComposite && (
            <div className="rounded-md border border-border p-4 space-y-4">
              <h3 className="text-sm font-semibold">Compra</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Comprei
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={purchaseInputQty}
                      onChange={(e) => setPurchaseInputQty(e.target.value)}
                      placeholder="1"
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <select
                      value={purchaseInputUnit}
                      onChange={(e) =>
                        setPurchaseInputUnit(e.target.value as InputUnit)
                      }
                      className="rounded-md border border-input bg-background px-2 py-2 text-sm"
                    >
                      {unit === "g" && (
                        <>
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                        </>
                      )}
                      {unit === "ml" && (
                        <>
                          <option value="L">L</option>
                          <option value="ml">ml</option>
                        </>
                      )}
                      {unit === "un" && (
                        <>
                          <option value="un">un</option>
                          <option value="pacote">pacote</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    Por R$
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    placeholder="30.00"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1 text-xs font-medium mb-1">
                    Perda no processo <CostHelp topic="waste" />
                  </label>
                  <select
                    value={wastePercent}
                    onChange={(e) => setWastePercent(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {WASTE_PRESETS.map((p) => (
                      <option key={p.value} value={String(p.value)}>
                        {p.label}
                      </option>
                    ))}
                    {/* permite valor manual fora dos presets */}
                    {!WASTE_PRESETS.some(
                      (p) => String(p.value) === wastePercent
                    ) &&
                      wastePercent && (
                        <option value={wastePercent}>
                          Personalizado ({(Number(wastePercent) * 100).toFixed(1)}%)
                        </option>
                      )}
                  </select>
                </div>
              </div>

              {liveUnitCost > 0 && (
                <div className="flex items-center gap-2 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2">
                  <Calculator className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm text-emerald-800 dark:text-emerald-300">
                    Custo unitário:{" "}
                    <strong>{formatBRL(liveUnitCost)}</strong> por {unit}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Sub-receita (só composite) */}
          {isComposite && (
            <div className="rounded-md border border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ChefHat className="h-4 w-4 text-amber-600" />
                Receita
              </h3>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Produção líquida (rendimento)
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={yieldQuantity}
                      onChange={(e) => setYieldQuantity(e.target.value)}
                      placeholder="800"
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <select
                      value={yieldInputUnit}
                      onChange={(e) =>
                        setYieldInputUnit(e.target.value as InputUnit)
                      }
                      className="rounded-md border border-input bg-background px-2 py-2 text-sm"
                    >
                      {unit === "g" && (
                        <>
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                        </>
                      )}
                      {unit === "ml" && (
                        <>
                          <option value="L">L</option>
                          <option value="ml">ml</option>
                        </>
                      )}
                      {unit === "un" && <option value="un">un</option>}
                    </select>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Quanto rende essa receita pronta?
                  </p>
                </div>

                <div>
                  <label className="flex items-center gap-1 text-xs font-medium mb-1">
                    Perda no processo <CostHelp topic="waste" />
                  </label>
                  <select
                    value={wastePercent}
                    onChange={(e) => setWastePercent(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {WASTE_PRESETS.map((p) => (
                      <option key={p.value} value={String(p.value)}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Componentes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                    Componentes
                  </h4>
                  <button
                    type="button"
                    onClick={() => setRecipeItemPickerOpen((v) => !v)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus className="h-3 w-3" /> Adicionar componente
                  </button>
                </div>

                {recipeItemPickerOpen && (
                  <div className="rounded-md border border-border bg-card max-h-48 overflow-y-auto">
                    {availableComponents.length === 0 ? (
                      <p className="p-3 text-xs text-muted-foreground">
                        Nenhum ingrediente disponível. Cadastre os componentes
                        primeiro.
                      </p>
                    ) : (
                      availableComponents.map((ing) => (
                        <button
                          key={ing.id}
                          type="button"
                          onClick={() => {
                            setRecipeItems((prev) => [
                              ...prev,
                              {
                                childIngredientId: ing.id,
                                childName: ing.name,
                                childUnit: ing.unit as BaseUnit,
                                childUnitCost: ing.unitCost,
                                quantity: "0",
                                unit: ing.unit as BaseUnit,
                              },
                            ]);
                            setRecipeItemPickerOpen(false);
                          }}
                          className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent text-left"
                        >
                          <span>{ing.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatBRL(Number(ing.unitCost))}/{ing.unit}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {recipeItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Nenhum componente adicionado.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {recipeItems.map((item, i) => {
                      const lineCost =
                        Number(item.quantity) * Number(item.childUnitCost);
                      return (
                        <div
                          key={item.childIngredientId}
                          className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-background p-2"
                        >
                          <span className="flex-1 min-w-[120px] text-sm font-medium">
                            {item.childName}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.quantity}
                            onChange={(e) => {
                              const v = e.target.value;
                              setRecipeItems((prev) =>
                                prev.map((p, idx) =>
                                  idx === i ? { ...p, quantity: v } : p
                                )
                              );
                            }}
                            className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm text-center"
                            placeholder="0"
                          />
                          <span className="text-xs text-muted-foreground">
                            {item.unit}
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            = {formatBRL(lineCost)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setRecipeItems((prev) =>
                                prev.filter((_, idx) => idx !== i)
                              )
                            }
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {liveCompositeCost > 0 && (
                <div className="flex items-center gap-2 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2">
                  <Calculator className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm text-emerald-800 dark:text-emerald-300">
                    Custo unitário calculado:{" "}
                    <strong>{formatBRL(liveCompositeCost)}</strong> por {unit}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isLoading || !canSubmit}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Salvar" : "Criar"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-md border border-input px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* List */}
      <div className="rounded-lg border border-border bg-card">
        {ingredientsList.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !ingredientsList.data?.length ? (
          <div className="py-12 text-center text-muted-foreground">
            <p>Nenhum ingrediente cadastrado</p>
            <p className="text-sm mt-1">
              Clique em &quot;Novo Ingrediente&quot; para começar
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {ingredientsList.data
              .filter((ing) => ing.isActive)
              .map((ingredient) => {
                const unitCost = Number(ingredient.unitCost);
                const hasCost = unitCost > 0;

                return (
                  <div
                    key={ingredient.id}
                    className="flex items-center justify-between px-4 py-3 gap-3"
                  >
                    <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                      <Link
                        href={`/restaurante/admin/ingredientes/${ingredient.id}`}
                        className="font-medium text-foreground hover:text-primary hover:underline truncate"
                      >
                        {ingredient.name}
                      </Link>
                      {ingredient.isComposite && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 text-[10px] font-medium">
                          <ChefHat className="h-3 w-3" />
                          Sub-receita
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          ingredient.type === "QUANTITY"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}
                      >
                        {ingredient.type === "QUANTITY"
                          ? "Quantidade"
                          : "Descrição"}
                      </span>

                      {hasCost ? (
                        <span className="text-xs text-foreground tabular-nums">
                          {formatBRL(unitCost)}/{ingredient.unit}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Custo não cadastrado
                        </span>
                      )}

                      <span className="text-xs text-muted-foreground">
                        {ingredient.productCount}{" "}
                        {ingredient.productCount === 1 ? "produto" : "produtos"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Link
                        href={`/restaurante/admin/ingredientes/${ingredient.id}`}
                        className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="Histórico"
                      >
                        <History className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => startEdit(ingredient)}
                        className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {deleteConfirmId === ingredient.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              deleteMutation.mutate({ id: ingredient.id });
                              setDeleteConfirmId(null);
                            }}
                            className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(ingredient.id)}
                          className="rounded-md p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                          title="Desativar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
