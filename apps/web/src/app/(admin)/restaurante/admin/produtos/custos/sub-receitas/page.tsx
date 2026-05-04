"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChefHat,
  Plus,
  Trash2,
  Loader2,
  Calculator,
  Pencil,
  X,
  ArrowLeft,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  CostHelp,
  convertToBaseUnit,
  displayInPreferredUnit,
} from "@/components/admin/cost-help";

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

const WASTE_PRESETS = [0, 0.05, 0.1, 0.15, 0.2, 0.3];

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

export default function SubReceitasPage() {
  const utils = trpc.useUtils();
  const ingredientsQ = trpc.ingredient.list.useQuery();

  const setCompositeMutation = trpc.ingredient.setComposite.useMutation({
    onSuccess: () => utils.ingredient.list.invalidate(),
  });
  const syncRecipeMutation = trpc.ingredient.syncRecipe.useMutation({
    onSuccess: () => utils.ingredient.list.invalidate(),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [unit, setUnit] = useState<BaseUnit>("g");
  const [yieldInputQty, setYieldInputQty] = useState("");
  const [yieldInputUnit, setYieldInputUnit] = useState<InputUnit>("g");
  const [wastePercent, setWastePercent] = useState("0");
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const [promoteIngredientId, setPromoteIngredientId] = useState<string>("");

  // Composites do tenant
  const composites = useMemo(
    () => (ingredientsQ.data ?? []).filter((i) => i.isComposite && i.isActive),
    [ingredientsQ.data]
  );

  // Ingredientes que ainda não são composite — candidatos para promover
  const nonComposites = useMemo(
    () => (ingredientsQ.data ?? []).filter((i) => !i.isComposite && i.isActive),
    [ingredientsQ.data]
  );

  // Cálculo ao vivo do custo do composto
  const liveCost = useMemo(() => {
    const yieldBase = convertToBaseUnit(yieldInputQty || 0, yieldInputUnit);
    if (yieldBase.quantity <= 0) return 0;
    let total = 0;
    for (const it of items) {
      total += Number(it.quantity) * Number(it.childUnitCost);
    }
    const w = Math.min(Math.max(Number(wastePercent || 0), 0), 0.99);
    const eff = yieldBase.quantity * (1 - w);
    return eff > 0 ? total / eff : 0;
  }, [items, yieldInputQty, yieldInputUnit, wastePercent]);

  // Carrega recipe items quando edita
  const editingDetailQ = trpc.ingredient.getById.useQuery(
    { id: editingId ?? "" },
    { enabled: !!editingId }
  );

  useEffect(() => {
    if (!editingId || !editingDetailQ.data) return;
    const ing = editingDetailQ.data;
    setUnit(ing.unit as BaseUnit);
    setWastePercent(ing.wastePercent ?? "0");
    if (ing.yieldQuantity) {
      const display = displayInPreferredUnit(
        Number(ing.yieldQuantity),
        ing.unit as BaseUnit
      );
      setYieldInputQty(String(display.value));
      setYieldInputUnit(display.label as InputUnit);
    }
    setItems(
      (ing.recipeItems ?? []).map((it) => ({
        childIngredientId: it.childIngredientId,
        childName: it.childName,
        childUnit: it.childUnit as BaseUnit,
        childUnitCost: it.childUnitCost,
        quantity: it.quantity,
        unit: it.unit as BaseUnit,
      }))
    );
  }, [editingId, editingDetailQ.data]);

  function startEdit(id: string) {
    setEditingId(id);
  }

  function cancelEdit() {
    setEditingId(null);
    setItems([]);
    setYieldInputQty("");
    setWastePercent("0");
  }

  function unitOptionsFor(baseUnit: BaseUnit): InputUnit[] {
    if (baseUnit === "g") return ["kg", "g"];
    if (baseUnit === "ml") return ["L", "ml"];
    return ["un"];
  }

  async function promoteToComposite() {
    if (!promoteIngredientId) return;
    const ing = nonComposites.find((i) => i.id === promoteIngredientId);
    if (!ing) return;
    await setCompositeMutation.mutateAsync({
      id: ing.id,
      isComposite: true,
      yieldQuantity: "0",
      wastePercent: "0",
    });
    setShowPromoteDialog(false);
    setPromoteIngredientId("");
    setEditingId(ing.id);
  }

  async function unsetComposite(id: string) {
    if (
      !confirm(
        "Voltar a ser ingrediente simples? A receita atual será apagada."
      )
    )
      return;
    await setCompositeMutation.mutateAsync({ id, isComposite: false });
    if (editingId === id) cancelEdit();
  }

  async function saveRecipe() {
    if (!editingId) return;
    const yieldBase = convertToBaseUnit(yieldInputQty || 0, yieldInputUnit);
    if (yieldBase.quantity <= 0) {
      alert("Defina o rendimento da receita.");
      return;
    }
    if (items.length === 0) {
      alert("Adicione ao menos um componente.");
      return;
    }
    try {
      await setCompositeMutation.mutateAsync({
        id: editingId,
        isComposite: true,
        yieldQuantity: String(yieldBase.quantity),
        wastePercent: wastePercent || "0",
      });
      await syncRecipeMutation.mutateAsync({
        parentIngredientId: editingId,
        items: items.map((it, idx) => ({
          childIngredientId: it.childIngredientId,
          quantity: it.quantity,
          unit: it.unit,
          sortOrder: idx,
        })),
      });
      cancelEdit();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Erro ao salvar receita.");
    }
  }

  // Componentes disponíveis (não pode ser ele mesmo, nem já adicionado)
  const availableComponents = useMemo(() => {
    if (!ingredientsQ.data) return [];
    const usedIds = new Set(items.map((i) => i.childIngredientId));
    return ingredientsQ.data
      .filter((ing) => ing.isActive)
      .filter((ing) => !usedIds.has(ing.id))
      .filter((ing) => editingId !== ing.id);
  }, [ingredientsQ.data, items, editingId]);

  const isSaving = setCompositeMutation.isPending || syncRecipeMutation.isPending;

  // Modo edição
  if (editingId) {
    const ing = ingredientsQ.data?.find((i) => i.id === editingId);
    return (
      <div className="space-y-4">
        <button
          onClick={cancelEdit}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        <div className="rounded-lg border border-amber-300 bg-amber-50/30 dark:bg-amber-950/20 p-5 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-amber-600" />
            Receita: {ing?.name ?? "..."}
          </h2>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium mb-1">
                Unidade-base
              </label>
              <select
                value={unit}
                onChange={(e) => {
                  const u = e.target.value as BaseUnit;
                  setUnit(u);
                  setYieldInputUnit(unitOptionsFor(u)[0]!);
                }}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                <option value="g">gramas (g)</option>
                <option value="ml">mililitros (ml)</option>
                <option value="un">unidade (un)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Rendimento
              </label>
              <div className="flex gap-1">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={yieldInputQty}
                  onChange={(e) => setYieldInputQty(e.target.value)}
                  placeholder="800"
                  className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                />
                <select
                  value={yieldInputUnit}
                  onChange={(e) =>
                    setYieldInputUnit(e.target.value as InputUnit)
                  }
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                >
                  {unitOptionsFor(unit).map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="flex items-center gap-1 text-xs font-medium mb-1">
                Perda no processo <CostHelp topic="waste" />
              </label>
              <select
                value={wastePercent}
                onChange={(e) => setWastePercent(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                {WASTE_PRESETS.map((v) => (
                  <option key={v} value={String(v)}>
                    {(v * 100).toFixed(0)}%
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
                onClick={() => setPickerOpen((v) => !v)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Plus className="h-3 w-3" /> Adicionar
              </button>
            </div>

            {pickerOpen && (
              <div className="rounded-md border border-border bg-card max-h-48 overflow-y-auto">
                {availableComponents.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">
                    Nenhum ingrediente disponível.
                  </p>
                ) : (
                  availableComponents.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setItems((prev) => [
                          ...prev,
                          {
                            childIngredientId: c.id,
                            childName: c.name,
                            childUnit: (c.unit ?? "un") as BaseUnit,
                            childUnitCost: c.unitCost ?? "0",
                            quantity: "0",
                            unit: (c.unit ?? "un") as BaseUnit,
                          },
                        ]);
                        setPickerOpen(false);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent text-left"
                    >
                      <span>{c.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatBRL(Number(c.unitCost))}/{c.unit}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}

            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Nenhum componente. Clique em &quot;Adicionar&quot;.
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((it, i) => {
                  const lineCost = Number(it.quantity) * Number(it.childUnitCost);
                  return (
                    <div
                      key={it.childIngredientId}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-background p-2"
                    >
                      <span className="flex-1 min-w-[120px] text-sm font-medium">
                        {it.childName}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={it.quantity}
                        onChange={(e) => {
                          const v = e.target.value;
                          setItems((prev) =>
                            prev.map((p, idx) =>
                              idx === i ? { ...p, quantity: v } : p
                            )
                          );
                        }}
                        className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm text-center"
                      />
                      <span className="text-xs text-muted-foreground">
                        {it.unit}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        × {formatBRL(Number(it.childUnitCost))} ={" "}
                        {formatBRL(lineCost)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setItems((prev) => prev.filter((_, idx) => idx !== i))
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

          {liveCost > 0 && (
            <div className="flex items-center gap-2 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2">
              <Calculator className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm text-emerald-800 dark:text-emerald-300">
                Custo unitário calculado:{" "}
                <strong>{formatBRL(liveCost)}</strong> por {unit}
              </span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={saveRecipe}
              disabled={isSaving || items.length === 0 || !yieldInputQty}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar receita
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-md border border-input px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Lista de sub-receitas
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          Matérias-primas preparadas a partir de outros insumos.
          <CostHelp topic="composite" />
        </p>
        <button
          onClick={() => setShowPromoteDialog(true)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Nova sub-receita
        </button>
      </div>

      {ingredientsQ.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : composites.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          <ChefHat className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium">Nenhuma sub-receita ainda</p>
          <p className="text-sm mt-2">
            Use sub-receitas para massas, molhos caseiros e proteínas
            preparadas. O custo é calculado automaticamente a partir dos
            componentes.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card divide-y divide-border">
          {composites.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-accent/20"
            >
              <div className="flex items-center gap-3">
                <ChefHat className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <Link
                    href={`/restaurante/admin/produtos/custos/insumos/${c.id}`}
                    className="font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {c.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {Number(c.yieldQuantity ?? 0)} {c.unit} de rendimento ·
                    perda {(Number(c.wastePercent) * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm tabular-nums">
                  {formatBRL(Number(c.unitCost))}/{c.unit}
                </span>
                <button
                  onClick={() => startEdit(c.id)}
                  className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Editar receita"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => unsetComposite(c.id)}
                  className="rounded-md p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                  title="Voltar a ser ingrediente simples"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog de promover ingrediente para sub-receita */}
      {showPromoteDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowPromoteDialog(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-lg font-semibold">Nova sub-receita</h3>
              <button
                onClick={() => setShowPromoteDialog(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Escolha um ingrediente já cadastrado para transformar em
              sub-receita. O custo dele passará a ser calculado a partir dos
              componentes da receita.
            </p>
            <select
              value={promoteIngredientId}
              onChange={(e) => setPromoteIngredientId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-4"
            >
              <option value="">Selecione um ingrediente...</option>
              {nonComposites.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowPromoteDialog(false)}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
              >
                Cancelar
              </button>
              <button
                onClick={promoteToComposite}
                disabled={!promoteIngredientId || setCompositeMutation.isPending}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {setCompositeMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Continuar
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Não tem o ingrediente cadastrado?{" "}
              <Link
                href="/restaurante/admin/ingredientes"
                className="text-primary hover:underline"
              >
                Cadastre primeiro em Ingredientes
              </Link>
              .
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
