"use client";

import { useState } from "react";
import { Tag, X, AlertCircle } from "lucide-react";
import { formatCurrency } from "@matrix-food/utils";

export interface DiscountValue {
  amount: number;
  reason: string;
}

interface DiscountSectionProps {
  subtotal: number;
  value: DiscountValue;
  onChange: (next: DiscountValue) => void;
  disabled?: boolean;
}

type Mode = "BRL" | "PERCENT";

export function DiscountSection({
  subtotal,
  value,
  onChange,
  disabled,
}: DiscountSectionProps) {
  const [open, setOpen] = useState(value.amount > 0);
  const [mode, setMode] = useState<Mode>("BRL");
  const [rawValue, setRawValue] = useState<string>(
    value.amount > 0 ? value.amount.toFixed(2) : ""
  );

  function commit(next: { amountBRL: number; reason: string }) {
    const capped =
      Math.round(Math.min(Math.max(0, next.amountBRL), subtotal) * 100) / 100;
    onChange({ amount: capped, reason: next.reason });
  }

  function handleValueChange(input: string) {
    const sanitized = input.replace(",", ".").replace(/[^\d.]/g, "");
    setRawValue(sanitized);
    const num = parseFloat(sanitized);
    if (Number.isNaN(num)) {
      commit({ amountBRL: 0, reason: value.reason });
      return;
    }
    const amountBRL = mode === "BRL" ? num : (subtotal * num) / 100;
    commit({ amountBRL, reason: value.reason });
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    const num = parseFloat(rawValue);
    if (Number.isNaN(num)) return;
    const amountBRL = next === "BRL" ? num : (subtotal * num) / 100;
    commit({ amountBRL, reason: value.reason });
  }

  function clear() {
    setOpen(false);
    setRawValue("");
    setMode("BRL");
    onChange({ amount: 0, reason: "" });
  }

  const exceeds = value.amount > subtotal && subtotal > 0;
  const canShowApplied = value.amount > 0 && !exceeds;

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled || subtotal <= 0}
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-accent/20 px-3 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50 disabled:hover:border-border disabled:hover:text-muted-foreground"
      >
        <Tag className="h-4 w-4" />
        Aplicar desconto
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-accent/20 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          Desconto manual
        </span>
        <button
          type="button"
          onClick={clear}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Remover desconto"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-[100px_1fr] gap-2">
        <div className="flex overflow-hidden rounded-md border border-border">
          <button
            type="button"
            onClick={() => switchMode("BRL")}
            className={`flex-1 px-2 py-1.5 text-xs font-semibold transition-colors ${
              mode === "BRL"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-accent"
            }`}
          >
            R$
          </button>
          <button
            type="button"
            onClick={() => switchMode("PERCENT")}
            className={`flex-1 px-2 py-1.5 text-xs font-semibold transition-colors ${
              mode === "PERCENT"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-accent"
            }`}
          >
            %
          </button>
        </div>
        <input
          type="text"
          inputMode="decimal"
          value={rawValue}
          onChange={(e) => handleValueChange(e.target.value)}
          placeholder={mode === "BRL" ? "0,00" : "0"}
          className="w-full rounded-md border border-border px-3 py-1.5 text-right text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <input
        type="text"
        value={value.reason}
        onChange={(e) =>
          onChange({ amount: value.amount, reason: e.target.value })
        }
        placeholder="Motivo (opcional)"
        maxLength={200}
        className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />

      {exceeds ? (
        <div className="flex items-center gap-1.5 text-xs text-amber-700">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Desconto não pode ser maior que o subtotal.</span>
        </div>
      ) : canShowApplied ? (
        <div className="text-xs text-muted-foreground">
          Desconto aplicado:{" "}
          <span className="font-semibold text-foreground">
            -{formatCurrency(value.amount)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
