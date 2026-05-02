/**
 * Helpers de período para a área de Relatórios.
 *
 * Convenção: `from` é inclusivo (>= from); `to` é exclusivo (< to).
 * Datas são representadas em UTC ISO string. As funções calculam ranges
 * com base no fuso local do servidor onde rodam, usando JS Date.
 */

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "mtd"
  | "ytd"
  | "custom";

export interface DateRange {
  from: Date;
  to: Date;
  preset: DateRangePreset;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

export function rangeFromPreset(preset: DateRangePreset): DateRange {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);

  switch (preset) {
    case "today":
      return { from: today, to: tomorrow, preset };
    case "yesterday":
      return { from: addDays(today, -1), to: today, preset };
    case "last7":
      return { from: addDays(today, -6), to: tomorrow, preset };
    case "last30":
      return { from: addDays(today, -29), to: tomorrow, preset };
    case "mtd":
      return {
        from: new Date(today.getFullYear(), today.getMonth(), 1),
        to: tomorrow,
        preset,
      };
    case "ytd":
      return {
        from: new Date(today.getFullYear(), 0, 1),
        to: tomorrow,
        preset,
      };
    case "custom":
      return { from: addDays(today, -6), to: tomorrow, preset: "custom" };
  }
}

export function rangeToISO(range: DateRange): { from: string; to: string } {
  return { from: range.from.toISOString(), to: range.to.toISOString() };
}

export function previousRange(range: DateRange): DateRange {
  const ms = range.to.getTime() - range.from.getTime();
  return {
    from: new Date(range.from.getTime() - ms),
    to: new Date(range.from.getTime()),
    preset: "custom",
  };
}

export const PRESET_LABELS: Record<DateRangePreset, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  last7: "Últimos 7 dias",
  last30: "Últimos 30 dias",
  mtd: "Mês até hoje",
  ytd: "Ano até hoje",
  custom: "Personalizado",
};

export function formatRangeLabel(range: DateRange): string {
  if (range.preset !== "custom") return PRESET_LABELS[range.preset];
  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const lastDay = addDays(range.to, -1);
  return `${fmt(range.from)} – ${fmt(lastDay)}`;
}
