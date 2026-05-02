"use client";

import { useMemo, useState } from "react";
import {
  MessageCircle,
  Send,
  Inbox,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
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
  TEXT: "Texto",
  TEMPLATE: "Template",
  IMAGE: "Imagem",
  AUDIO: "Áudio",
  VIDEO: "Vídeo",
  DOCUMENT: "Documento",
  SYSTEM: "Sistema",
  INTERACTIVE: "Interativo",
};

export default function ComunicacaoReportPage() {
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset("last30"));
  const isoRange = useMemo(() => rangeToISO(range), [range]);

  const statsQ = trpc.reports.communications.whatsappStats.useQuery(isoRange);
  const conversionsQ =
    trpc.reports.communications.morpheuConversions.useQuery(isoRange);

  function handleExport(format: ExportFormat) {
    if (format !== "csv") return;
    const rows = statsQ.data?.byType ?? [];
    exportRowsAsCsv(
      `whatsapp_${isoRange.from.slice(0, 10)}_${isoRange.to.slice(0, 10)}.csv`,
      [
        { header: "Tipo", accessor: (r) => TYPE_LABELS[r.type] ?? r.type },
        { header: "Quantidade", accessor: (r) => r.count },
      ],
      rows
    );
  }

  return (
    <ReportShell
      title="Relatório de Comunicação"
      description="Mensagens WhatsApp via Morpheu e conversões em pedido."
      filters={<DateRangePicker value={range} onChange={setRange} />}
      actions={
        <ExportButton
          formats={["csv"]}
          onExport={handleExport}
          disabled={!statsQ.data || statsQ.data.byType.length === 0}
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Mensagens totais"
          value={statsQ.data?.total ?? 0}
          icon={MessageCircle}
          iconColor="text-teal-600"
          iconBg="bg-teal-50"
          loading={statsQ.isLoading}
        />
        <KpiCard
          title="Enviadas"
          value={statsQ.data?.outbound ?? 0}
          icon={Send}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
          loading={statsQ.isLoading}
        />
        <KpiCard
          title="Recebidas"
          value={statsQ.data?.inbound ?? 0}
          icon={Inbox}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          loading={statsQ.isLoading}
        />
        <KpiCard
          title="Taxa de leitura"
          value={
            statsQ.data ? `${statsQ.data.readRate.toFixed(1)}%` : "—"
          }
          icon={CheckCircle2}
          iconColor="text-green-600"
          iconBg="bg-green-50"
          loading={statsQ.isLoading}
          subtitle={
            statsQ.data
              ? `${statsQ.data.read} lidas de ${statsQ.data.outbound} enviadas`
              : undefined
          }
          isText
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartContainer
          title="Status das mensagens enviadas"
          loading={statsQ.isLoading}
          isEmpty={!statsQ.data || statsQ.data.outbound === 0}
          height={240}
        >
          <div className="space-y-3">
            <StatusRow
              label="Entregues"
              value={statsQ.data?.delivered ?? 0}
              total={statsQ.data?.outbound ?? 0}
              color="bg-blue-500"
            />
            <StatusRow
              label="Lidas"
              value={statsQ.data?.read ?? 0}
              total={statsQ.data?.outbound ?? 0}
              color="bg-green-500"
            />
            <StatusRow
              label="Falharam"
              value={statsQ.data?.failed ?? 0}
              total={statsQ.data?.outbound ?? 0}
              color="bg-red-500"
              icon={AlertTriangle}
            />
          </div>
        </ChartContainer>

        <ChartContainer
          title="Conversões em pedido"
          description="Telefones que receberam mensagem e fizeram pedido depois."
          loading={conversionsQ.isLoading}
          isEmpty={
            !conversionsQ.data || conversionsQ.data.contacted === 0
          }
          height={240}
        >
          {conversionsQ.data && (
            <div className="space-y-4 text-center">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Taxa de conversão
                </p>
                <p className="text-5xl font-bold text-primary">
                  {conversionsQ.data.conversionRate.toFixed(1)}%
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Contactados</p>
                  <p className="mt-1 text-2xl font-bold">
                    {conversionsQ.data.contacted}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Pediram</p>
                  <p className="mt-1 text-2xl font-bold text-green-600">
                    {conversionsQ.data.converted}
                  </p>
                </div>
              </div>
            </div>
          )}
        </ChartContainer>
      </div>

      <ChartContainer
        title="Mensagens por tipo"
        loading={statsQ.isLoading}
        isEmpty={!statsQ.data || statsQ.data.byType.length === 0}
        height={300}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {statsQ.data?.byType.map((t) => (
            <div key={t.type} className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">
                {TYPE_LABELS[t.type] ?? t.type}
              </p>
              <p className="mt-1 text-2xl font-bold">{t.count}</p>
            </div>
          ))}
        </div>
      </ChartContainer>
    </ReportShell>
  );
}

function StatusRow({
  label,
  value,
  total,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  icon?: typeof AlertTriangle;
}) {
  const share = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="flex items-center gap-1 font-medium">
          {Icon && <Icon className="h-3.5 w-3.5 text-red-500" />}
          {label}
        </span>
        <span className="text-muted-foreground">
          {value} ({share.toFixed(1)}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(share, 100)}%` }}
        />
      </div>
    </div>
  );
}
