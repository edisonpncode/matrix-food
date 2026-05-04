"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Calculator,
  Crown,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Package,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";
import {
  KpiCard,
  ChartContainer,
  ExportButton,
  type ExportFormat,
} from "@/components/reports";
import { exportRowsAsCsv } from "@/lib/exporters/csv";

type SortBy =
  | "marginPercentAsc"
  | "marginPercentDesc"
  | "profitDesc"
  | "name";

const SORT_LABELS: Record<SortBy, string> = {
  marginPercentAsc: "Pior margem primeiro",
  marginPercentDesc: "Melhor margem primeiro",
  profitDesc: "Maior lucro (R$)",
  name: "Nome",
};

function MarginPill({
  marginPercent,
  hasCost,
}: {
  marginPercent: number;
  hasCost: boolean;
}) {
  if (!hasCost) {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        Sem custo
      </span>
    );
  }
  let cls = "bg-red-100 text-red-700";
  if (marginPercent >= 60) cls = "bg-emerald-100 text-emerald-700";
  else if (marginPercent >= 30) cls = "bg-amber-100 text-amber-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${cls}`}
    >
      {marginPercent.toFixed(1)}%
    </span>
  );
}

export default function CustoProdutosPage() {
  const [sortBy, setSortBy] = useState<SortBy>("marginPercentAsc");
  const [onlyNegative, setOnlyNegative] = useState(false);
  const [belowMargin, setBelowMargin] = useState<string>("");

  const summaryQ = trpc.reports.profitability.summary.useQuery();
  const productsQ = trpc.reports.profitability.productMargins.useQuery({
    sortBy,
    onlyNegative,
    belowMarginPct: belowMargin ? Number(belowMargin) : undefined,
  });
  const byCategoryQ = trpc.reports.profitability.byCategory.useQuery();
  const customQ = trpc.reports.profitability.customizationMargins.useQuery();

  const summary = summaryQ.data;

  function handleExport(format: ExportFormat) {
    if (format !== "csv") return;
    const rows = productsQ.data ?? [];
    exportRowsAsCsv(
      `custo_produtos_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { header: "Produto", accessor: (r) => r.name },
        { header: "Categoria", accessor: (r) => r.categoryName },
        {
          header: "Preço (R$)",
          accessor: (r) => r.sellPrice.toFixed(2).replace(".", ","),
        },
        { header: "Custo (R$)", accessor: (r) => r.cost.toFixed(2).replace(".", ",") },
        {
          header: "Lucro (R$)",
          accessor: (r) => r.profitBRL.toFixed(2).replace(".", ","),
        },
        { header: "Margem (%)", accessor: (r) => r.marginPercent.toFixed(2) },
        { header: "Markup (%)", accessor: (r) => r.markupPercent.toFixed(2) },
      ],
      rows
    );
  }

  const negativeCustomizations = useMemo(
    () => (customQ.data ?? []).filter((c) => c.profitBRL < 0).length,
    [customQ.data]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-3">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="rounded-md border bg-card px-3 py-2 text-sm"
        >
          {(Object.keys(SORT_LABELS) as SortBy[]).map((k) => (
            <option key={k} value={k}>
              {SORT_LABELS[k]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyNegative}
            onChange={(e) => setOnlyNegative(e.target.checked)}
            className="rounded border-input"
          />
          Apenas margem negativa
        </label>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Margem &lt;</span>
          <input
            type="number"
            min="0"
            max="100"
            step="5"
            value={belowMargin}
            onChange={(e) => setBelowMargin(e.target.value)}
            placeholder="ex: 30"
            className="w-20 rounded-md border bg-card px-2 py-1 text-sm"
          />
          <span className="text-muted-foreground">%</span>
        </div>
        <ExportButton
          formats={["csv"]}
          onExport={handleExport}
          disabled={!productsQ.data || productsQ.data.length === 0}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard
          title="Produtos com custo"
          value={summary ? `${summary.productsWithCost}/${summary.totalProducts}` : "—"}
          icon={Package}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          loading={summaryQ.isLoading}
          isText
        />
        <KpiCard
          title="Margem média"
          value={
            summary ? `${summary.averageMarginPercent.toFixed(1)}%` : "—"
          }
          icon={Calculator}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          loading={summaryQ.isLoading}
          isText
        />
        <KpiCard
          title="Margem abaixo de 30%"
          value={summary?.belowThreshold ?? 0}
          icon={AlertTriangle}
          iconColor="text-red-600"
          iconBg="bg-red-50"
          loading={summaryQ.isLoading}
          subtitle={
            summary && summary.belowThreshold > 0
              ? "Reveja preço ou ingredientes"
              : "Tudo certo!"
          }
        />
        <KpiCard
          title="Campeão de margem"
          value={summary?.bestProduct?.name ?? "—"}
          icon={Crown}
          iconColor="text-yellow-600"
          iconBg="bg-yellow-50"
          subtitle={
            summary?.bestProduct
              ? `${summary.bestProduct.marginPercent.toFixed(1)}%`
              : undefined
          }
          loading={summaryQ.isLoading}
          isText
        />
      </div>

      <ChartContainer
        title={`Produtos (${productsQ.data?.length ?? 0})`}
        description="Lista ordenada — produtos sem custo cadastrado aparecem ao final."
        loading={productsQ.isLoading}
        isEmpty={!productsQ.data || productsQ.data.length === 0}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                <th className="py-2 px-2 text-left">Produto</th>
                <th className="py-2 px-2 text-left">Categoria</th>
                <th className="py-2 px-2 text-right">Preço</th>
                <th className="py-2 px-2 text-right">Custo (CMV)</th>
                <th className="py-2 px-2 text-right">Lucro</th>
                <th className="py-2 px-2 text-right">Margem</th>
                <th className="py-2 px-2 text-right">Markup</th>
              </tr>
            </thead>
            <tbody>
              {(productsQ.data ?? []).map((p) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-accent/30">
                  <td className="py-2 px-2">
                    <Link
                      href={`/restaurante/admin/produtos/${p.id}`}
                      className="text-foreground hover:text-primary hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="py-2 px-2 text-muted-foreground">{p.categoryName}</td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {formatCurrency(p.sellPrice)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {p.hasCost ? formatCurrency(p.cost) : "—"}
                  </td>
                  <td
                    className={`py-2 px-2 text-right tabular-nums font-medium ${
                      !p.hasCost
                        ? "text-muted-foreground"
                        : p.profitBRL >= 0
                          ? "text-emerald-700"
                          : "text-red-600"
                    }`}
                  >
                    {p.hasCost ? formatCurrency(p.profitBRL) : "—"}
                  </td>
                  <td className="py-2 px-2 text-right">
                    <MarginPill
                      marginPercent={p.marginPercent}
                      hasCost={p.hasCost}
                    />
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                    {p.hasCost ? `${p.markupPercent.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartContainer>

      <ChartContainer
        title="Margem média por categoria"
        description="Margem ponderada considerando o preço base de cada produto."
        loading={byCategoryQ.isLoading}
        isEmpty={!byCategoryQ.data || byCategoryQ.data.length === 0}
      >
        <div className="space-y-2">
          {(byCategoryQ.data ?? []).map((cat) => (
            <div
              key={cat.categoryId ?? "_none"}
              className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2"
            >
              <div>
                <span className="font-medium text-foreground">
                  {cat.categoryName}
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  {cat.productCount} produto{cat.productCount === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs tabular-nums">
                <span className="text-muted-foreground">
                  CMV {formatCurrency(cat.totalCost)} / Receita{" "}
                  {formatCurrency(cat.totalRevenue)}
                </span>
                <MarginPill
                  marginPercent={cat.averageMarginPercent}
                  hasCost={true}
                />
              </div>
            </div>
          ))}
        </div>
      </ChartContainer>

      {customQ.data && customQ.data.length > 0 && (
        <ChartContainer
          title="Adicionais (custo vs preço)"
          description={
            negativeCustomizations > 0
              ? `${negativeCustomizations} adicional(is) com prejuízo. Reveja o preço.`
              : "Todos os adicionais têm margem positiva."
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                  <th className="py-2 px-2 text-left">Adicional</th>
                  <th className="py-2 px-2 text-left">Produto</th>
                  <th className="py-2 px-2 text-right">Preço</th>
                  <th className="py-2 px-2 text-right">Custo</th>
                  <th className="py-2 px-2 text-right">Lucro</th>
                  <th className="py-2 px-2 text-right">Margem</th>
                </tr>
              </thead>
              <tbody>
                {customQ.data.map((c) => (
                  <tr key={c.id} className="border-b border-border/50">
                    <td className="py-2 px-2 font-medium">
                      {c.optionName}
                      <span className="text-xs text-muted-foreground ml-2">
                        ({c.groupName})
                      </span>
                    </td>
                    <td className="py-2 px-2 text-muted-foreground">
                      {c.productName}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {formatCurrency(c.price)}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {formatCurrency(c.unitCost)}
                    </td>
                    <td
                      className={`py-2 px-2 text-right tabular-nums font-medium ${
                        c.profitBRL >= 0 ? "text-emerald-700" : "text-red-600"
                      }`}
                    >
                      {formatCurrency(c.profitBRL)}
                      {c.profitBRL < 0 && (
                        <TrendingDown className="inline h-3 w-3 ml-1" />
                      )}
                      {c.profitBRL > 0 && (
                        <TrendingUp className="inline h-3 w-3 ml-1" />
                      )}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <MarginPill
                        marginPercent={c.marginPercent}
                        hasCost={c.unitCost > 0}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartContainer>
      )}
    </div>
  );
}
