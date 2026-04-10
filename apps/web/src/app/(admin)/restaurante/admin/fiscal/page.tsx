"use client";

import { trpc } from "@/lib/trpc";
import Link from "next/link";
import {
  FileText,
  Settings,
  History,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Loader2,
  Ban,
} from "lucide-react";

const STATUS_BADGE: Record<
  string,
  { label: string; color: string; icon: typeof CheckCircle }
> = {
  AUTHORIZED: {
    label: "Autorizada",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle,
  },
  REJECTED: {
    label: "Rejeitada",
    color: "bg-red-100 text-red-700",
    icon: XCircle,
  },
  ERROR: {
    label: "Erro",
    color: "bg-orange-100 text-orange-700",
    icon: AlertTriangle,
  },
  PENDING: {
    label: "Pendente",
    color: "bg-yellow-100 text-yellow-700",
    icon: Clock,
  },
  PROCESSING: {
    label: "Processando",
    color: "bg-blue-100 text-blue-700",
    icon: Loader2,
  },
  CANCELLED: {
    label: "Cancelada",
    color: "bg-gray-100 text-gray-500",
    icon: Ban,
  },
};

const PROVIDER_LABELS: Record<string, string> = {
  FOCUS_NFE: "Focus NFe",
  WEBMANIA: "Webmania",
  NUVEM_FISCAL: "Nuvem Fiscal",
  SAFEWEB: "SafeWeb",
};

export default function FiscalDashboardPage() {
  const config = trpc.fiscal.getConfig.useQuery();
  const stats = trpc.fiscal.getStats.useQuery();
  const recentDocs = trpc.fiscal.list.useQuery({ page: 1, perPage: 10 });

  if (config.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasConfig = !!config.data;
  const isActive = config.data?.isActive ?? false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Nota Fiscal</h1>
          <p className="text-muted-foreground">
            Gerencie a emissão de NFC-e do seu restaurante
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/restaurante/admin/fiscal/configuracao"
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Settings className="h-4 w-4" />
            Configuração
          </Link>
          <Link
            href="/restaurante/admin/fiscal/historico"
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <History className="h-4 w-4" />
            Histórico
          </Link>
        </div>
      </div>

      {/* Status Card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full ${
                isActive
                  ? "bg-green-100 text-green-600"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                {isActive ? "Fiscal Ativo" : "Fiscal Inativo"}
              </h2>
              {hasConfig ? (
                <p className="text-sm text-muted-foreground">
                  Provedor: {PROVIDER_LABELS[config.data!.provider] || config.data!.provider}
                  {" · "}
                  Modo: {config.data!.emissionMode === "AUTOMATIC" ? "Automático" : "Manual"}
                  {" · "}
                  Ambiente: {config.data!.ambiente === 1 ? "Produção" : "Homologação"}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Configure a emissão de notas fiscais para começar
                </p>
              )}
            </div>
          </div>
          {!hasConfig && (
            <Link
              href="/restaurante/admin/fiscal/configuracao"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Configurar Agora
            </Link>
          )}
        </div>
      </div>

      {/* Alert for errors */}
      {stats.data && (stats.data.error > 0 || stats.data.rejected > 0) && (
        <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
              Atenção: Existem{" "}
              {stats.data.error > 0 && (
                <span>{stats.data.error} documento(s) com erro</span>
              )}
              {stats.data.error > 0 && stats.data.rejected > 0 && " e "}
              {stats.data.rejected > 0 && (
                <span>{stats.data.rejected} rejeitado(s)</span>
              )}
            </p>
          </div>
          <Link
            href="/restaurante/admin/fiscal/historico?status=ERROR"
            className="text-sm font-medium text-orange-600 underline hover:no-underline"
          >
            Ver detalhes
          </Link>
        </div>
      )}

      {/* Stats */}
      {hasConfig && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {[
            {
              label: "Emitidas Hoje",
              value: stats.data?.authorizedToday ?? 0,
              color: "text-green-600",
            },
            {
              label: "Total Autorizadas",
              value: stats.data?.authorized ?? 0,
              color: "text-green-600",
            },
            {
              label: "Pendentes",
              value: stats.data?.pending ?? 0,
              color: "text-yellow-600",
            },
            {
              label: "Com Erro",
              value: stats.data?.error ?? 0,
              color: "text-orange-600",
            },
            {
              label: "Canceladas",
              value: stats.data?.cancelled ?? 0,
              color: "text-gray-500",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-border bg-card p-4"
            >
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Recent Documents */}
      {hasConfig && recentDocs.data && recentDocs.data.documents.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h3 className="font-semibold">Documentos Recentes</h3>
            <Link
              href="/restaurante/admin/fiscal/historico"
              className="text-sm text-primary hover:underline"
            >
              Ver todos
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-6 py-3 font-medium">NFC-e</th>
                  <th className="px-6 py-3 font-medium">Data</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Chave de Acesso</th>
                  <th className="px-6 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {recentDocs.data.documents.map((doc) => {
                  const badge = STATUS_BADGE[doc.status] || {
                    label: doc.status,
                    color: "bg-gray-100 text-gray-600",
                    icon: Clock,
                  };
                  const BadgeIcon = badge.icon;
                  return (
                    <tr
                      key={doc.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-6 py-3 font-medium">
                        {doc.numeroNfce
                          ? `#${doc.numeroNfce}`
                          : "-"}
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">
                        {new Date(doc.createdAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.color}`}
                        >
                          <BadgeIcon className="h-3 w-3" />
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-muted-foreground">
                        {doc.chaveAcesso
                          ? `${doc.chaveAcesso.slice(0, 10)}...${doc.chaveAcesso.slice(-6)}`
                          : "-"}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          {doc.danfeUrl && (
                            <a
                              href={doc.danfeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              DANFE
                            </a>
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
      )}

      {/* Empty state */}
      {hasConfig &&
        recentDocs.data &&
        recentDocs.data.documents.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
            <FileText className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-lg font-medium text-muted-foreground">
              Nenhuma nota fiscal emitida
            </p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              As notas aparecerão aqui quando forem emitidas
            </p>
          </div>
        )}
    </div>
  );
}
