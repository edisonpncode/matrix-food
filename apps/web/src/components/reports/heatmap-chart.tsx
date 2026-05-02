"use client";

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface Props {
  /** Matriz 7×24 (dia da semana × hora). dow 0 = domingo. */
  matrix: number[][];
  /** Hora inicial visível (0..23). Padrão: 6 (esconde madrugada vazia). */
  startHour?: number;
  /** Hora final visível, exclusiva. Padrão: 24. */
  endHour?: number;
}

export function HeatmapChart({ matrix, startHour = 6, endHour = 24 }: Props) {
  const hours = Array.from(
    { length: endHour - startHour },
    (_, i) => startHour + i
  );

  let max = 0;
  for (const row of matrix) {
    for (let h = startHour; h < endHour; h++) {
      const v = row[h] ?? 0;
      if (v > max) max = v;
    }
  }

  function bgFor(value: number) {
    if (max === 0 || value === 0) return "bg-muted";
    const intensity = value / max;
    if (intensity < 0.2) return "bg-primary/15";
    if (intensity < 0.4) return "bg-primary/30";
    if (intensity < 0.6) return "bg-primary/50";
    if (intensity < 0.8) return "bg-primary/70";
    return "bg-primary";
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-1 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-10" />
          {hours.map((h) => (
            <div
              key={h}
              className="w-7 text-center text-muted-foreground"
              title={`${h}h`}
            >
              {h}
            </div>
          ))}
        </div>
        {DAY_LABELS.map((day, dow) => (
          <div key={day} className="flex items-center gap-1">
            <div className="w-10 text-right text-muted-foreground">{day}</div>
            {hours.map((h) => {
              const value = matrix[dow]?.[h] ?? 0;
              return (
                <div
                  key={h}
                  className={`flex h-7 w-7 items-center justify-center rounded ${bgFor(value)} ${value > 0 ? "text-foreground" : "text-muted-foreground/40"}`}
                  title={`${day} ${h}h — ${value} pedido${value === 1 ? "" : "s"}`}
                >
                  {value > 0 ? value : ""}
                </div>
              );
            })}
          </div>
        ))}
        <div className="mt-2 flex items-center gap-2 text-muted-foreground">
          <span>Menor</span>
          <div className="h-3 w-4 rounded bg-primary/15" />
          <div className="h-3 w-4 rounded bg-primary/30" />
          <div className="h-3 w-4 rounded bg-primary/50" />
          <div className="h-3 w-4 rounded bg-primary/70" />
          <div className="h-3 w-4 rounded bg-primary" />
          <span>Maior</span>
        </div>
      </div>
    </div>
  );
}
