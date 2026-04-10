"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Ban,
  RefreshCw,
  FileText,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const STATUS_CONFIG = {
  ALL: { label: "Todos", color: "" },
  AUTHORIZED: {
    label: "Autorizadas",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle,
  },
  REJECTED: {
    label: "Rejeitadas",
    color: "bg-red-100 text-red-700",
    icon: XCircle,
  },
  ERROR: {
    label: "Com Erro",
    color: "bg-orange-100 text-orange-700",
    icon: AlertTriangle,
  },
  PENDING: {
    label: "Pendentes",
    color: "bg-yellow-100 text-yellow-700",
    icon: Clock,
  },
  PROCESSING: {
    label: "Processando",
    color: "bg-blue-100 text-blue-700",
    icon: Loader2,
  },
  CANCELLED: {
    label: "Canceladas",
    color: "bg-gray-100 text-gray-500",
    icon: Ban,
  },
} as const;

type StatusFilter = keyof typeof STATUS_CONFIG;

export default function FiscalHistoricoPage() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const docs = trpc.fiscal.list.useQuery({
    status:
      statusFilter === "ALL"
        ? undefined
        : (statusFilter as
            | "PENDING"
            | "PROCESSING"
            | "AUTHORIZED"
            | "REJECTED"
            | "CANCELLED"
            | "ERROR"),
    page,
    perPage: 20,
  });

  const retryMutation = trpc.fiscal.retry.useMutation({
    onSuccess: () => {
      utils.fiscal.list.invalidate();
      utils.fiscal.getStats.invalidate();
      setToast({ type: "success", message: "Reenvio iniciado!" });
      setTimeout(() => setToast(null), 3000);
    },
    onError: (err) => {
      setToast({ type: "error", message: err.message });
      setTimeout(() => setToast(null), 5000);
    },
  });

  const cancelMutation = trpc.fiscal.cancel.useMutation({
    onSuccess: () => {
      utils.fiscal.list.invalidate();
      utils.fiscal.getStats.invalidate();
      setCancelId(null);
      setCancelReason("");
      setToast({ type: "success", message: "NFC-e cancelada com sucesso!" });
      setTimeout(() => setToast(null), 3000);
    },
    onError: (err) => {
      setToast({ type: "error", message: err.message });
      setTimeout(() => setToast(null), 5000);
    },
  });

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          {toast.message}
        </div>
      )}

      {/* Cancel modal */}
      {cancelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Cancelar NFC-e</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Informe o motivo do cancelamento (mínimo 15 caracteres).
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ex: Erro na emissão, pedido cancelado pelo cliente..."
              rows={3}
              className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setCancelId(null);
                  setCancelReason("");
                }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Voltar
              </button>
              <button
                onClick={() =>
                  cancelMutation.mutate({
                    documentId: cancelId,
                    justificativa: cancelReason,
                  })
                }
                disabled={
                  cancelReason.length < 15 || cancelMutation.isPending
                }
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {cancelMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Cancelar NFC-e
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <button
          onClick={() => router.push("/restaurante/admin/fiscal")}
          className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <h1 className="text-2xl font-bold">Histórico de Notas Fiscais</h1>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1">
        {(Object.keys(STATUS_CONFIG) as StatusFilter[]).map((key) => (
          <button
            key={key}
            onClick={() => {
              setStatusFilter(key);
              setPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {STATUS_CONFIG[key].label}
          </button>
        ))}
      </div>

      {/* Table */}
      {docs.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : docs.data && docs.data.documents.length > 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">NFC-e</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Chave de Acesso</th>
                  <th className="px-4 py-3 font-medium">Erro</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {docs.data.documents.map((doc) => {
                  const statusKey = doc.status as keyof typeof STATUS_CONFIG;
                  const cfg =
                    statusKey !== "ALL"
                      ? STATUS_CONFIG[statusKey]
                      : STATUS_CONFIG.PENDING;
                  const Icon =
                    "icon" in cfg
                      ? cfg.icon
                      : Clock;
                  return (
                    <tr
                      key={doc.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">
                        {doc.numeroNfce ? `#${doc.numeroNfce}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(doc.createdAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${"color" in cfg ? cfg.color : ""}`}
                        >
                          <Icon className="h-3 w-3" />
                          {"label" in cfg ? cfg.label : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {doc.chaveAcesso
                          ? `${doc.chaveAcesso.slice(0, 10)}...${doc.chaveAcesso.slice(-6)}`
                          : "-"}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-xs text-red-500">
                        {doc.errorMessage || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {doc.danfeUrl && (
                            <a
                              href={doc.danfeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              DANFE
                            </a>
                          )}
                          {(doc.status === "ERROR" ||
                            doc.status === "REJECTED") && (
                            <button
                              onClick={() =>
                                retryMutation.mutate({
                                  documentId: doc.id,
                                })
                              }
                              disabled={retryMutation.isPending}
                              className="flex items-center gap-1 text-xs text-orange-600 hover:underline"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Reenviar
                            </button>
                          )}
                          {doc.status === "AUTHORIZED" && (
                            <button
                              onClick={() => setCancelId(doc.id)}
                              className="flex items-center gap-1 text-xs text-red-500 hover:underline"
                            >
                              <Ban className="h-3 w-3" />
                              Cancelar
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

          {/* Pagination */}
          {docs.data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Página {docs.data.page} de {docs.data.totalPages} ({docs.data.total}{" "}
                documentos)
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-border p-2 hover:bg-accent disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() =>
                    setPage(Math.min(docs.data!.totalPages, page + 1))
                  }
                  disabled={page >= docs.data.totalPages}
                  className="rounded-lg border border-border p-2 hover:bg-accent disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <FileText className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-medium text-muted-foreground">
            Nenhum documento encontrado
          </p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            {statusFilter !== "ALL"
              ? `Não há documentos com status "${STATUS_CONFIG[statusFilter].label}"`
              : "As notas fiscais emitidas aparecerão aqui"}
          </p>
        </div>
      )}
    </div>
  );
}
