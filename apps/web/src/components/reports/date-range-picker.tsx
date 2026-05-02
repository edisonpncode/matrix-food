"use client";

import { useState, useEffect, useRef } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import {
  PRESET_LABELS,
  formatRangeLabel,
  rangeFromPreset,
  type DateRange,
  type DateRangePreset,
} from "@/lib/reports/date-presets";

const PRESETS: DateRangePreset[] = [
  "today",
  "yesterday",
  "last7",
  "last30",
  "mtd",
  "ytd",
  "custom",
];

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function DateRangePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
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

  function handlePreset(preset: DateRangePreset) {
    onChange(rangeFromPreset(preset));
    if (preset !== "custom") setOpen(false);
  }

  function handleCustomChange(field: "from" | "to", iso: string) {
    if (!iso) return;
    const d = new Date(iso + "T00:00:00");
    if (Number.isNaN(d.getTime())) return;
    if (field === "from") {
      onChange({ ...value, from: d, preset: "custom" });
    } else {
      const to = new Date(d);
      to.setDate(to.getDate() + 1);
      onChange({ ...value, to, preset: "custom" });
    }
  }

  const customFromISO = value.from.toISOString().slice(0, 10);
  const customToDate = new Date(value.to);
  customToDate.setDate(customToDate.getDate() - 1);
  const customToISO = customToDate.toISOString().slice(0, 10);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
      >
        <Calendar className="h-4 w-4" />
        <span>{formatRangeLabel(value)}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-lg border bg-card p-2 shadow-lg">
          <div className="space-y-1">
            {PRESETS.map((preset) => {
              const active = value.preset === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePreset(preset)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  <span>{PRESET_LABELS[preset]}</span>
                </button>
              );
            })}
          </div>

          {value.preset === "custom" && (
            <div className="mt-2 space-y-2 border-t pt-2">
              <label className="block text-xs font-medium text-muted-foreground">
                De
                <input
                  type="date"
                  value={customFromISO}
                  onChange={(e) => handleCustomChange("from", e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
                />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Até
                <input
                  type="date"
                  value={customToISO}
                  onChange={(e) => handleCustomChange("to", e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
