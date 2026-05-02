import type { ReactNode } from "react";

interface Props {
  title: string;
  description?: string;
  /** Slot para filtros (DateRangePicker, selects). Renderiza no topo direito. */
  filters?: ReactNode;
  /** Slot para botões de ação (ex: ExportButton). */
  actions?: ReactNode;
  children: ReactNode;
}

export function ReportShell({ title, description, filters, actions, children }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filters}
          {actions}
        </div>
      </div>
      {children}
    </div>
  );
}
