"use client";

import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface Props {
  title: string;
  /** Texto auxiliar opcional abaixo do título. */
  description?: string;
  /** Altura do conteúdo, em pixels. Padrão: 280. */
  height?: number;
  loading?: boolean;
  error?: string | null;
  /** Quando os dados estão vazios, exibe esta mensagem em vez do conteúdo. */
  emptyMessage?: string;
  isEmpty?: boolean;
  children: ReactNode;
}

export function ChartContainer({
  title,
  description,
  height = 280,
  loading,
  error,
  emptyMessage = "Sem dados para o período selecionado.",
  isEmpty,
  children,
}: Props) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4">
        <h3 className="font-semibold">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>

      {loading ? (
        <div
          className="flex items-center justify-center"
          style={{ height }}
        >
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : error ? (
        <div
          className="flex flex-col items-center justify-center gap-2 text-sm text-red-600"
          style={{ height }}
        >
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      ) : isEmpty ? (
        <div
          className="flex items-center justify-center text-sm text-muted-foreground"
          style={{ height }}
        >
          {emptyMessage}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
