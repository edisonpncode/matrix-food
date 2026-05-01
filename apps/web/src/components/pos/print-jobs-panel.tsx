"use client";

import { useState } from "react";
import { Printer, AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";

const RECEIPT_LABELS: Record<string, string> = {
  CUSTOMER: "Cliente",
  KITCHEN: "Cozinha",
  DELIVERY: "Entrega",
};

const TRIGGER_LABELS: Record<string, string> = {
  AUTO_NEW_ORDER: "Pedido novo (auto)",
  AUTO_CONFIRMED: "Aprovação (auto)",
  MANUAL: "Manual",
};

function formatTime(date: Date | string) {
  return new Date(date).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface PrintJobsPanelProps {
  orderId: string;
}

/**
 * Painel colapsável que mostra o histórico de tentativas de impressão
 * de um pedido. Permite tentar de novo as impressões que falharam.
 */
export function PrintJobsPanel({ orderId }: PrintJobsPanelProps) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const jobsQuery = trpc.printJobs.listByOrder.useQuery(
    { orderId },
    { enabled: open, refetchInterval: open ? 5000 : false }
  );

  const retryMutation = trpc.printJobs.retry.useMutation({
    onSuccess: () => {
      utils.printJobs.listByOrder.invalidate({ orderId });
      utils.printJobs.failedCountsByOrders.invalidate();
    },
  });

  const jobs = jobsQuery.data ?? [];
  const failedCount = jobs.filter((j) => j.status === "FAILED").length;
  const successCount = jobs.filter((j) => j.status === "SUCCESS").length;

  return (
    <div className="rounded-lg border border-border bg-muted/30 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left font-medium hover:bg-accent/50"
      >
        <span className="flex items-center gap-1.5">
          <Printer className="h-3.5 w-3.5" />
          Histórico de impressão
          {jobs.length > 0 && !open && (
            <span className="text-muted-foreground">({jobs.length})</span>
          )}
        </span>
        <span className="flex items-center gap-1">
          {failedCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              {failedCount} falha{failedCount > 1 ? "s" : ""}
            </span>
          )}
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-3 py-2">
          {jobsQuery.isLoading ? (
            <p className="py-2 text-center text-muted-foreground">Carregando...</p>
          ) : jobs.length === 0 ? (
            <p className="py-2 text-center text-muted-foreground">
              Nenhuma impressão registrada para este pedido.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {jobs.map((job) => {
                const isFailed = job.status === "FAILED";
                const isSuccess = job.status === "SUCCESS";
                const isPending = job.status === "PENDING";
                return (
                  <li
                    key={job.id}
                    className={`rounded-md border p-2 ${
                      isFailed
                        ? "border-red-200 bg-red-50"
                        : isSuccess
                          ? "border-green-200 bg-green-50"
                          : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {isSuccess && (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                        )}
                        {isFailed && (
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                        )}
                        {isPending && (
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                        )}
                        <span className="truncate font-medium">
                          {RECEIPT_LABELS[job.receiptType] ?? job.receiptType}
                          {" — "}
                          <span className="text-muted-foreground">
                            {job.printerName}
                          </span>
                        </span>
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatTime(job.attemptedAt)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{TRIGGER_LABELS[job.trigger] ?? job.trigger}</span>
                      {job.attempts > 1 && (
                        <span>• {job.attempts} tentativas</span>
                      )}
                    </div>
                    {isFailed && (
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <p className="line-clamp-2 text-[10px] text-red-700">
                          {job.errorMessage ?? "Erro desconhecido"}
                        </p>
                        <button
                          type="button"
                          onClick={() => retryMutation.mutate({ jobId: job.id })}
                          disabled={retryMutation.isPending}
                          className="flex shrink-0 items-center gap-1 rounded border border-red-300 bg-white px-2 py-1 text-[10px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          <RefreshCw
                            className={`h-3 w-3 ${retryMutation.isPending ? "animate-spin" : ""}`}
                          />
                          Tentar de novo
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {successCount > 0 && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              {successCount} impressão(ões) com sucesso.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
