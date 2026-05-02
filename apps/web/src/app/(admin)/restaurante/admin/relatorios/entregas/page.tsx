"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Bike, MapPin, Clock, DollarSign } from "lucide-react";
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

const DeliveryHeatMap = dynamic(
  () =>
    import("@/components/reports/delivery-heat-map").then(
      (m) => m.DeliveryHeatMap
    ),
  { ssr: false, loading: () => null }
);

function fmtMin(value: number): string {
  if (!value || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)} min`;
}

export default function EntregasReportPage() {
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset("last30"));
  const isoRange = useMemo(() => rangeToISO(range), [range]);

  const timingsQ = trpc.reports.delivery.deliveryTimings.useQuery(isoRange);
  const heatmapQ = trpc.reports.delivery.deliveryHeatmap.useQuery(isoRange);
  const motoboyQ = trpc.reports.delivery.motoboyEarnings.useQuery(isoRange);
  const areasQ = trpc.reports.delivery.topDeliveryAreas.useQuery(isoRange);

  const totalDeliveries = useMemo(
    () => areasQ.data?.reduce((sum, a) => sum + a.orders, 0) ?? 0,
    [areasQ.data]
  );
  const totalDeliveryFee = useMemo(
    () => areasQ.data?.reduce((sum, a) => sum + a.deliveryFee, 0) ?? 0,
    [areasQ.data]
  );
  const avgDeliveryTime = useMemo(() => {
    if (!timingsQ.data || timingsQ.data.length === 0) return 0;
    const total = timingsQ.data.reduce(
      (sum, t) => sum + t.avgMinutes * t.orders,
      0
    );
    const count = timingsQ.data.reduce((sum, t) => sum + t.orders, 0);
    return count > 0 ? total / count : 0;
  }, [timingsQ.data]);

  function handleExport(format: ExportFormat) {
    if (format !== "csv") return;
    const rows = areasQ.data ?? [];
    exportRowsAsCsv(
      `entregas_areas_${isoRange.from.slice(0, 10)}_${isoRange.to.slice(0, 10)}.csv`,
      [
        { header: "Área", accessor: (r) => r.areaName },
        { header: "Pedidos", accessor: (r) => r.orders },
        {
          header: "Receita (R$)",
          accessor: (r) => r.revenue.toFixed(2).replace(".", ","),
        },
        {
          header: "Taxa entrega (R$)",
          accessor: (r) => r.deliveryFee.toFixed(2).replace(".", ","),
        },
      ],
      rows
    );
  }

  return (
    <ReportShell
      title="Relatório de Entregas"
      description="Tempo, áreas, ganhos de motoboys e mapa de calor."
      filters={<DateRangePicker value={range} onChange={setRange} />}
      actions={
        <ExportButton
          formats={["csv"]}
          onExport={handleExport}
          disabled={!areasQ.data || areasQ.data.length === 0}
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Entregas"
          value={totalDeliveries}
          icon={Bike}
          iconColor="text-cyan-600"
          iconBg="bg-cyan-50"
          loading={areasQ.isLoading}
        />
        <KpiCard
          title="Tempo médio"
          value={fmtMin(avgDeliveryTime)}
          icon={Clock}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
          loading={timingsQ.isLoading}
          isText
        />
        <KpiCard
          title="Áreas atendidas"
          value={areasQ.data?.length ?? 0}
          icon={MapPin}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          loading={areasQ.isLoading}
        />
        <KpiCard
          title="Taxa de entrega total"
          value={formatCurrency(totalDeliveryFee)}
          icon={DollarSign}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          loading={areasQ.isLoading}
          isText
        />
      </div>

      <ChartContainer
        title="Mapa de calor de entregas"
        description="Onde seus clientes pedem. Pontos maiores = mais pedidos."
        loading={heatmapQ.isLoading}
        isEmpty={!heatmapQ.data || heatmapQ.data.points.length === 0}
        height={520}
      >
        {heatmapQ.data && <DeliveryHeatMap points={heatmapQ.data.points} />}
      </ChartContainer>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartContainer
          title="Top áreas por volume"
          loading={areasQ.isLoading}
          isEmpty={!areasQ.data || areasQ.data.length === 0}
          height={400}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3">Área</th>
                  <th className="py-2 pr-3 text-right">Pedidos</th>
                  <th className="py-2 pr-3 text-right">Receita</th>
                  <th className="py-2 pr-3 text-right">Taxa entrega</th>
                </tr>
              </thead>
              <tbody>
                {areasQ.data?.map((a) => (
                  <tr key={a.areaId ?? a.areaName} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{a.areaName}</td>
                    <td className="py-2 pr-3 text-right">{a.orders}</td>
                    <td className="py-2 pr-3 text-right">
                      {formatCurrency(a.revenue)}
                    </td>
                    <td className="py-2 pr-3 text-right text-muted-foreground">
                      {formatCurrency(a.deliveryFee)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartContainer>

        <ChartContainer
          title="Tempo médio por área"
          description="Áreas mais lentas precisam de revisão de logística."
          loading={timingsQ.isLoading}
          isEmpty={!timingsQ.data || timingsQ.data.length === 0}
          height={400}
        >
          <div className="space-y-2">
            {timingsQ.data?.map((t) => (
              <div
                key={t.areaId ?? t.areaName}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{t.areaName}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.orders} entregas
                  </p>
                </div>
                <span className="text-lg font-bold">{fmtMin(t.avgMinutes)}</span>
              </div>
            ))}
          </div>
        </ChartContainer>
      </div>

      <ChartContainer
        title="Ganhos por motoboy"
        description="Total acumulado de comissões e pagamentos."
        loading={motoboyQ.isLoading}
        isEmpty={!motoboyQ.data || motoboyQ.data.length === 0}
        height={400}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3">Motoboy</th>
                <th className="py-2 pr-3 text-right">Lançamentos</th>
                <th className="py-2 pr-3 text-right">Comissão</th>
                <th className="py-2 pr-3 text-right">Pago (payout)</th>
                <th className="py-2 pr-3 text-right">Saldo total</th>
              </tr>
            </thead>
            <tbody>
              {motoboyQ.data?.map((m) => (
                <tr key={m.motoboyId} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">{m.name}</td>
                  <td className="py-2 pr-3 text-right">{m.entries}</td>
                  <td className="py-2 pr-3 text-right text-green-600">
                    {formatCurrency(m.commission)}
                  </td>
                  <td className="py-2 pr-3 text-right text-red-600">
                    {formatCurrency(m.payouts)}
                  </td>
                  <td className="py-2 pr-3 text-right font-semibold">
                    {formatCurrency(m.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartContainer>
    </ReportShell>
  );
}
