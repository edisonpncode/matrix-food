"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, ChefHat, Calculator, History, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatDateTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function IngredienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const ingredientQ = trpc.ingredient.getById.useQuery({ id });
  const historyQ = trpc.ingredient.getCostHistory.useQuery({ id, limit: 30 });

  const ing = ingredientQ.data;

  if (ingredientQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ing) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center">
        <p className="text-muted-foreground">Ingrediente não encontrado.</p>
        <Link
          href="/restaurante/admin/ingredientes"
          className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </div>
    );
  }

  const unitCost = Number(ing.unitCost);
  const purchaseQty = Number(ing.purchaseQuantity);
  const purchasePrice = Number(ing.purchasePrice);
  const wastePercent = Number(ing.wastePercent);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Link
          href="/restaurante/admin/ingredientes"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para ingredientes
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-foreground">
          {ing.name}
          {ing.isComposite && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 text-xs font-medium">
              <ChefHat className="h-3 w-3" />
              Sub-receita
            </span>
          )}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Detalhes de custo, ficha de compra e histórico.
        </p>
      </div>

      {/* Cards principais */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Calculator className="h-3 w-3" />
            Custo unitário
          </div>
          <div className="text-xl font-semibold text-foreground tabular-nums mt-1">
            {formatBRL(unitCost)} <span className="text-sm font-normal text-muted-foreground">/{ing.unit}</span>
          </div>
        </div>

        {!ing.isComposite ? (
          <>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Última compra</div>
              <div className="text-base text-foreground mt-1">
                {purchaseQty > 0 ? (
                  <>
                    {purchaseQty} {ing.unit} por {formatBRL(purchasePrice)}
                  </>
                ) : (
                  <span className="text-muted-foreground italic">
                    Não cadastrada
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Perda no processo</div>
              <div className="text-base text-foreground mt-1">
                {(wastePercent * 100).toFixed(1)}%
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg border border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 p-4 col-span-2">
              <div className="text-xs text-muted-foreground">Receita (rendimento líquido)</div>
              <div className="text-base text-foreground mt-1">
                Rende {ing.yieldQuantity ? Number(ing.yieldQuantity) : "—"} {ing.unit} (perda {(wastePercent * 100).toFixed(1)}%)
              </div>
            </div>
          </>
        )}
      </div>

      {/* Componentes (se composite) */}
      {ing.isComposite && ing.recipeItems.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
            <ChefHat className="h-5 w-5 text-amber-600" />
            Componentes da receita
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                  <th className="py-2 px-2 text-left">Componente</th>
                  <th className="py-2 px-2 text-right">Quantidade</th>
                  <th className="py-2 px-2 text-right">Custo unitário</th>
                  <th className="py-2 px-2 text-right">Total na receita</th>
                </tr>
              </thead>
              <tbody>
                {ing.recipeItems.map((item) => {
                  const lineCost =
                    Number(item.quantity) * Number(item.childUnitCost);
                  return (
                    <tr key={item.id} className="border-b border-border/50">
                      <td className="py-2 px-2 font-medium">{item.childName}</td>
                      <td className="py-2 px-2 text-right tabular-nums">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                        {formatBRL(Number(item.childUnitCost))}/{item.childUnit}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums font-medium">
                        {formatBRL(lineCost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Histórico de custo */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
          <History className="h-5 w-5 text-blue-600" />
          Histórico de custo
        </h2>
        {historyQ.isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !historyQ.data || historyQ.data.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Sem histórico ainda. Edite o ingrediente para começar a registrar
            mudanças de custo.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                  <th className="py-2 px-2 text-left">Data</th>
                  <th className="py-2 px-2 text-right">Quantidade</th>
                  <th className="py-2 px-2 text-right">Preço</th>
                  <th className="py-2 px-2 text-right">Perda</th>
                  <th className="py-2 px-2 text-right">Custo unitário</th>
                  <th className="py-2 px-2 text-left">Nota</th>
                </tr>
              </thead>
              <tbody>
                {historyQ.data.map((h) => (
                  <tr key={h.id} className="border-b border-border/50">
                    <td className="py-2 px-2 text-xs whitespace-nowrap">
                      {formatDateTime(h.changedAt)}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {Number(h.purchaseQuantity)}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {formatBRL(Number(h.purchasePrice))}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                      {(Number(h.wastePercent) * 100).toFixed(1)}%
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums font-medium">
                      {formatBRL(Number(h.unitCost))}
                    </td>
                    <td className="py-2 px-2 text-xs text-muted-foreground">
                      {h.note ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
