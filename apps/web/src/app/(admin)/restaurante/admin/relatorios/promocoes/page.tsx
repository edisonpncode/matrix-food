"use client";

import { useMemo, useState } from "react";
import { Tag, TrendingUp, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";
import {
  ReportShell,
  DateRangePicker,
  KpiCard,
  ChartContainer,
  ExportButton,
  type ExportFormat,
} from "@/components/reports";
import {
  rangeFromPreset,
  rangeToISO,
  type DateRange,
} from "@/lib/reports/date-presets";
import { exportRowsAsCsv } from "@/lib/exporters/csv";

const TYPE_LABELS: Record<string, string> = {
  PERCENTAGE: "Percentual",
  FIXED_AMOUNT: "Valor fixo",
  FREE_DELIVERY: "Frete grátis",
  COMBO: "Combo",
  BUY_X_GET_Y: "Compre X leve Y",
};

export default function PromocoesReportPage() {
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset("last30"));
  const isoRange = useMemo(() => rangeToISO(range), [range]);

  const usageQ = trpc.reports.promotions.promotionUsage.useQuery(isoRange);
  const roiQ = trpc.reports.promotions.promotionROI.useQuery(isoRange);

  const totals = useMemo(() => {
    if (!usageQ.data) return { uses: 0, discount: 0, customers: 0 };
    return usageQ.data.reduce(
      (acc, p) => ({
        uses: acc.uses + p.uses,
        discount: acc.discount + p.totalDiscount,
        customers: acc.customers + p.uniqueCustomers,
      }),
      { uses: 0, discount: 0, customers: 0 }
    );
  }, [usageQ.data]);

  function handleExport(format: ExportFormat) {
    if (format !== "csv") return;
    const rows = roiQ.data ?? [];
    exportRowsAsCsv(
      `promocoes_${isoRange.from.slice(0, 10)}_${isoRange.to.slice(0, 10)}.csv`,
      [
        { header: "Código", accessor: (r) => r.code },
        { header: "Usos", accessor: (r) => r.uses },
        {
          header: "Desconto (R$)",
          accessor: (r) => r.totalDiscount.toFixed(2).replace(".", ","),
        },
        {
          header: "Receita atribuída (R$)",
          accessor: (r) => r.attributedRevenue.toFixed(2).replace(".", ","),
        },
        { header: "ROI", accessor: (r) => r.roi.toFixed(2).replace(".", ",") },
      ],
      rows
    );
  }

  return (
    <ReportShell
      title="Relatório de Promoções"
      description="Uso de cupons, ROI e desconto concedido."
      filters={<DateRangePicker value={range} onChange={setRange} />}
      actions={
        <ExportButton
          formats={["csv"]}
          onExport={handleExport}
          disabled={!roiQ.data || roiQ.data.length === 0}
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          title="Usos totais"
          value={totals.uses}
          icon={Tag}
          iconColor="text-pink-600"
          iconBg="bg-pink-50"
          loading={usageQ.isLoading}
        />
        <KpiCard
          title="Desconto concedido"
          value={formatCurrency(totals.discount)}
          icon={TrendingUp}
          iconColor="text-orange-600"
          iconBg="bg-orange-50"
          loading={usageQ.isLoading}
          isText
        />
        <KpiCard
          title="Clientes únicos"
          value={totals.customers}
          icon={Users}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          loading={usageQ.isLoading}
        />
      </div>

      <ChartContainer
        title="ROI por promoção"
        description="ROI = receita atribuída ÷ desconto concedido. Maior é melhor."
        loading={roiQ.isLoading}
        isEmpty={!roiQ.data || roiQ.data.length === 0}
        height={400}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3">Código</th>
                <th className="py-2 pr-3 text-right">Usos</th>
                <th className="py-2 pr-3 text-right">Desconto</th>
                <th className="py-2 pr-3 text-right">Receita</th>
                <th className="py-2 pr-3 text-right">ROI</th>
              </tr>
            </thead>
            <tbody>
              {roiQ.data?.map((p) => {
                const roiColor =
                  p.roi >= 5
                    ? "text-green-600"
                    : p.roi >= 2
                      ? "text-blue-600"
                      : "text-amber-600";
                return (
                  <tr key={p.promotionId} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-mono font-medium">{p.code}</td>
                    <td className="py-2 pr-3 text-right">{p.uses}</td>
                    <td className="py-2 pr-3 text-right text-red-600">
                      {formatCurrency(p.totalDiscount)}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {formatCurrency(p.attributedRevenue)}
                    </td>
                    <td className={`py-2 pr-3 text-right font-bold ${roiColor}`}>
                      {p.roi.toFixed(1)}×
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartContainer>

      <ChartContainer
        title="Uso detalhado de cada promoção"
        loading={usageQ.isLoading}
        isEmpty={!usageQ.data || usageQ.data.length === 0}
        height={400}
      >
        <div className="space-y-3">
          {usageQ.data?.map((p) => (
            <div key={p.promotionId} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono font-bold text-primary">{p.code}</p>
                  {p.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {p.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tipo: {TYPE_LABELS[p.type] ?? p.type}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{p.uses}</p>
                  <p className="text-xs text-muted-foreground">usos</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Desconto</p>
                  <p className="font-semibold text-red-600">
                    {formatCurrency(p.totalDiscount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Clientes</p>
                  <p className="font-semibold">{p.uniqueCustomers}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ChartContainer>
    </ReportShell>
  );
}
