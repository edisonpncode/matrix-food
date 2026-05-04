"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Calculator, History, Save, Search, ChefHat } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  CostHelp,
  convertToBaseUnit,
  displayInPreferredUnit,
} from "@/components/admin/cost-help";
import { computeIngredientUnitCost } from "@matrix-food/utils";

type BaseUnit = "g" | "ml" | "un";
type InputUnit = "kg" | "g" | "L" | "ml" | "un" | "pacote";

interface DraftRow {
  id: string;
  name: string;
  isComposite: boolean;
  unit: BaseUnit;
  inputQty: string;
  inputUnit: InputUnit;
  purchasePrice: string;
  wastePercent: string;
  /** snapshot do unitCost atual no banco (read-only para composites) */
  unitCost: string;
  dirty: boolean;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

const WASTE_PRESETS = [0, 0.05, 0.1, 0.15, 0.2, 0.3];

export default function InsumosPage() {
  const utils = trpc.useUtils();
  const ingredientsQ = trpc.ingredient.list.useQuery();

  const updateMutation = trpc.ingredient.update.useMutation({
    onSuccess: () => utils.ingredient.list.invalidate(),
  });

  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [search, setSearch] = useState("");
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  // Hidrata os drafts a partir dos ingredientes do banco
  useEffect(() => {
    if (!ingredientsQ.data) return;
    const next: Record<string, DraftRow> = {};
    for (const ing of ingredientsQ.data) {
      // Preserva drafts dirty já em edição (não sobrescreve)
      if (drafts[ing.id]?.dirty) {
        next[ing.id] = drafts[ing.id]!;
        continue;
      }
      const unit = (ing.unit ?? "un") as BaseUnit;
      const display = displayInPreferredUnit(Number(ing.purchaseQuantity), unit);
      next[ing.id] = {
        id: ing.id,
        name: ing.name,
        isComposite: ing.isComposite,
        unit,
        inputQty: display.value > 0 ? String(display.value) : "",
        inputUnit: display.label as InputUnit,
        purchasePrice:
          Number(ing.purchasePrice) > 0 ? ing.purchasePrice : "",
        wastePercent: ing.wastePercent ?? "0",
        unitCost: ing.unitCost ?? "0",
        dirty: false,
      };
    }
    setDrafts(next);
  }, [ingredientsQ.data]); // drafts intencionalmente fora — só hidrata do servidor

  function patchDraft(id: string, patch: Partial<DraftRow>) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id]!, ...patch, dirty: true },
    }));
  }

  function unitOptionsFor(baseUnit: BaseUnit): InputUnit[] {
    if (baseUnit === "g") return ["kg", "g"];
    if (baseUnit === "ml") return ["L", "ml"];
    return ["un", "pacote"];
  }

  // Custo unitário calculado ao vivo a partir do draft
  function liveUnitCost(d: DraftRow): number {
    if (d.isComposite) return Number(d.unitCost);
    if (!d.inputQty || !d.purchasePrice) return Number(d.unitCost);
    const base = convertToBaseUnit(d.inputQty, d.inputUnit);
    return computeIngredientUnitCost({
      purchaseQuantity: base.quantity,
      purchasePrice: d.purchasePrice,
      wastePercent: d.wastePercent || "0",
    });
  }

  async function saveRow(d: DraftRow) {
    if (d.isComposite) return;
    setSavingIds((prev) => new Set(prev).add(d.id));
    try {
      const base = convertToBaseUnit(d.inputQty || 0, d.inputUnit);
      const original = ingredientsQ.data?.find((i) => i.id === d.id);
      if (!original) return;
      await updateMutation.mutateAsync({
        id: d.id,
        name: original.name,
        type: original.type,
        unit: d.unit,
        purchaseQuantity: String(base.quantity),
        purchasePrice: d.purchasePrice || "0",
        wastePercent: d.wastePercent || "0",
      });
      setDrafts((prev) => ({
        ...prev,
        [d.id]: { ...prev[d.id]!, dirty: false },
      }));
    } catch (err) {
      console.error("Erro ao salvar insumo:", err);
      alert(
        err instanceof Error ? err.message : "Erro ao salvar."
      );
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(d.id);
        return next;
      });
    }
  }

  const filtered = useMemo(() => {
    const all = ingredientsQ.data ?? [];
    const term = search.trim().toLowerCase();
    return all
      .filter((i) => i.isActive)
      .filter((i) => !term || i.name.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ingredientsQ.data, search]);

  const dirtyCount = Object.values(drafts).filter((d) => d.dirty).length;

  if (ingredientsQ.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ingredientsQ.data?.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        <p>Nenhum ingrediente cadastrado ainda.</p>
        <p className="text-sm mt-2">
          Cadastre os ingredientes primeiro em{" "}
          <Link
            href="/restaurante/admin/ingredientes"
            className="text-primary hover:underline"
          >
            Ingredientes
          </Link>
          , depois preencha aqui o preço e a perda de cada um.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar insumo..."
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <CostHelp topic="waste" />
          {dirtyCount > 0 && (
            <span className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-1">
              {dirtyCount} alteração{dirtyCount === 1 ? "" : "ões"} não salva{dirtyCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <th className="py-2.5 px-3 text-left">Insumo</th>
              <th className="py-2.5 px-3 text-left">Unidade</th>
              <th className="py-2.5 px-3 text-left">Comprou</th>
              <th className="py-2.5 px-3 text-left">Por R$</th>
              <th className="py-2.5 px-3 text-left">Perda</th>
              <th className="py-2.5 px-3 text-right">Custo unitário</th>
              <th className="py-2.5 px-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ing) => {
              const d = drafts[ing.id];
              if (!d) return null;
              const live = liveUnitCost(d);
              const saving = savingIds.has(d.id);
              return (
                <tr key={ing.id} className="border-b border-border/50 hover:bg-accent/20">
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/restaurante/admin/produtos/custos/insumos/${ing.id}`}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {ing.name}
                      </Link>
                      {d.isComposite && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 text-[10px] font-medium"
                          title="Sub-receita: custo calculado a partir dos componentes"
                        >
                          <ChefHat className="h-3 w-3" />
                          Sub-receita
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    {d.isComposite ? (
                      <span className="text-xs text-muted-foreground">
                        {d.unit}
                      </span>
                    ) : (
                      <select
                        value={d.unit}
                        onChange={(e) => {
                          const newUnit = e.target.value as BaseUnit;
                          const newOpts = unitOptionsFor(newUnit);
                          patchDraft(d.id, {
                            unit: newUnit,
                            inputUnit: newOpts[0]!,
                          });
                        }}
                        className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                      >
                        <option value="g">gramas (g)</option>
                        <option value="ml">mililitros (ml)</option>
                        <option value="un">unidade (un)</option>
                      </select>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {d.isComposite ? (
                      <span className="text-xs text-muted-foreground italic">
                        —
                      </span>
                    ) : (
                      <div className="flex gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={d.inputQty}
                          onChange={(e) =>
                            patchDraft(d.id, { inputQty: e.target.value })
                          }
                          placeholder="1"
                          className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm"
                        />
                        <select
                          value={d.inputUnit}
                          onChange={(e) =>
                            patchDraft(d.id, {
                              inputUnit: e.target.value as InputUnit,
                            })
                          }
                          className="rounded-md border border-input bg-background px-1 py-1 text-xs"
                        >
                          {unitOptionsFor(d.unit).map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {d.isComposite ? (
                      <span className="text-xs text-muted-foreground italic">
                        —
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={d.purchasePrice}
                          onChange={(e) =>
                            patchDraft(d.id, { purchasePrice: e.target.value })
                          }
                          placeholder="0,00"
                          className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm"
                        />
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {d.isComposite ? (
                      <span className="text-xs text-muted-foreground">
                        {(Number(d.wastePercent) * 100).toFixed(1)}%
                      </span>
                    ) : (
                      <select
                        value={
                          WASTE_PRESETS.includes(Number(d.wastePercent))
                            ? d.wastePercent
                            : "custom"
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "custom") return;
                          patchDraft(d.id, { wastePercent: v });
                        }}
                        className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                      >
                        {WASTE_PRESETS.map((v) => (
                          <option key={v} value={String(v)}>
                            {(v * 100).toFixed(0)}%
                          </option>
                        ))}
                        {!WASTE_PRESETS.includes(Number(d.wastePercent)) && (
                          <option value="custom">
                            {(Number(d.wastePercent) * 100).toFixed(1)}%
                          </option>
                        )}
                      </select>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums">
                    {live > 0 ? (
                      <div className="flex items-center justify-end gap-1">
                        <Calculator className="h-3 w-3 text-emerald-600" />
                        <span
                          className={`font-medium ${
                            d.dirty ? "text-amber-700" : "text-foreground"
                          }`}
                        >
                          {formatBRL(live)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          /{d.unit}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        Sem dados
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/restaurante/admin/produtos/custos/insumos/${ing.id}`}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="Ver histórico"
                      >
                        <History className="h-4 w-4" />
                      </Link>
                      {!d.isComposite && (
                        <button
                          type="button"
                          onClick={() => saveRow(d)}
                          disabled={!d.dirty || saving}
                          className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-30 flex items-center gap-1"
                          title="Salvar alterações"
                        >
                          {saving ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Save className="h-3 w-3" />
                          )}
                          {d.dirty ? "Salvar" : "Salvo"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
