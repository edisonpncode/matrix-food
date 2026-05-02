"use client";

import { useState, useEffect, useRef } from "react";
import { Download, FileSpreadsheet, FileText, Image as ImageIcon, ChevronDown } from "lucide-react";

export type ExportFormat = "csv" | "xlsx" | "pdf" | "png";

interface FormatMeta {
  label: string;
  icon: typeof Download;
}

const META: Record<ExportFormat, FormatMeta> = {
  csv: { label: "CSV", icon: FileSpreadsheet },
  xlsx: { label: "Excel (.xlsx)", icon: FileSpreadsheet },
  pdf: { label: "PDF", icon: FileText },
  png: { label: "Imagem (PNG)", icon: ImageIcon },
};

interface Props {
  formats?: ExportFormat[];
  onExport: (format: ExportFormat) => void | Promise<void>;
  disabled?: boolean;
}

export function ExportButton({
  formats = ["csv"],
  onExport,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busyFormat, setBusyFormat] = useState<ExportFormat | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function handleExport(format: ExportFormat) {
    setBusyFormat(format);
    try {
      await onExport(format);
      setOpen(false);
    } finally {
      setBusyFormat(null);
    }
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || busyFormat !== null}
        className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
      >
        <Download className="h-4 w-4" />
        <span>Exportar</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-52 rounded-lg border bg-card p-1 shadow-lg">
          {formats.map((format) => {
            const meta = META[format];
            const Icon = meta.icon;
            const busy = busyFormat === format;
            return (
              <button
                key={format}
                type="button"
                onClick={() => handleExport(format)}
                disabled={busy}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span>{meta.label}</span>
                {busy && (
                  <div className="ml-auto h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
