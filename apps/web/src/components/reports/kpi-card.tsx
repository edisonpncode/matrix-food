import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  title: string;
  value: string | number;
  /** Variação percentual vs período comparado (ex: 12.4 ou -8.1). Omitir para esconder. */
  delta?: number | null;
  /** Texto explicativo do delta (ex: "vs semana passada"). */
  deltaLabel?: string;
  icon?: LucideIcon;
  /** Cor do ícone. Aceita classe Tailwind, ex: "text-primary". */
  iconColor?: string;
  /** Cor de fundo do ícone. Aceita classe Tailwind, ex: "bg-primary/10". */
  iconBg?: string;
  /** Texto pequeno abaixo do valor. */
  subtitle?: string;
  loading?: boolean;
  /** Quando o valor é texto (R$, %, etc) e não número grande. */
  isText?: boolean;
}

export function KpiCard({
  title,
  value,
  delta,
  deltaLabel,
  icon: Icon,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
  subtitle,
  loading,
  isText,
}: Props) {
  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-3 w-20 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const hasDelta = delta !== undefined && delta !== null && Number.isFinite(delta);
  const isPositive = hasDelta && delta! > 0;
  const isNegative = hasDelta && delta! < 0;
  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  const trendColor = isPositive
    ? "text-green-600"
    : isNegative
      ? "text-red-600"
      : "text-muted-foreground";

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p
            className={`mt-1 ${isText ? "text-2xl" : "text-3xl"} font-bold leading-tight`}
          >
            {value}
          </p>
          {hasDelta && (
            <p className={`mt-1 flex items-center gap-1 text-xs ${trendColor}`}>
              <TrendIcon className="h-3.5 w-3.5" />
              <span className="font-medium">
                {delta! > 0 ? "+" : ""}
                {delta!.toFixed(1)}%
              </span>
              {deltaLabel && <span className="text-muted-foreground">{deltaLabel}</span>}
            </p>
          )}
          {!hasDelta && subtitle && (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={`shrink-0 rounded-lg ${iconBg} p-2.5`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        )}
      </div>
    </div>
  );
}
