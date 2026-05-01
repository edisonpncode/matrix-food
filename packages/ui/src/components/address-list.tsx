"use client";

import * as React from "react";
import { Check, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "../lib/utils";
import type { AddressValue } from "./address-form";

export interface AddressListProps {
  addresses: AddressValue[];
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
  onAddNew?: () => void;
  onEdit?: (index: number) => void;
  onRemove?: (index: number) => void;
  emptyMessage?: string;
  compact?: boolean;
  className?: string;
}

export function AddressList({
  addresses,
  selectedIndex,
  onSelect,
  onAddNew,
  onEdit,
  onRemove,
  emptyMessage = "Nenhum endereço salvo.",
  compact = false,
  className,
}: AddressListProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {addresses.length === 0 ? (
        <p className={cn("text-sm text-muted-foreground", compact && "text-xs")}>
          {emptyMessage}
        </p>
      ) : (
        addresses.map((addr, index) => {
          const isSelected = selectedIndex === index;
          return (
            <div
              key={index}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-input bg-background hover:bg-accent",
                onSelect && "cursor-pointer",
                compact && "p-2 text-sm"
              )}
              onClick={() => onSelect?.(index)}
              role={onSelect ? "button" : undefined}
              tabIndex={onSelect ? 0 : undefined}
              onKeyDown={(e) => {
                if (onSelect && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onSelect(index);
                }
              }}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border",
                  isSelected
                    ? "border-primary bg-primary text-white"
                    : "border-muted-foreground/40"
                )}
              >
                {isSelected && <Check className="h-3 w-3" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                  <span className="font-medium truncate">
                    {addr.label || "Endereço"}
                  </span>
                </div>
                <p className={cn("mt-0.5 text-muted-foreground", compact ? "text-xs" : "text-sm")}>
                  {addr.street}, {addr.number}
                  {addr.complement ? ` — ${addr.complement}` : ""}
                </p>
                <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
                  {addr.neighborhood} · {addr.city}/{addr.state}
                  {addr.zipCode ? ` · CEP ${addr.zipCode}` : ""}
                </p>
                {addr.referencePoint && (
                  <p className={cn("italic text-muted-foreground", compact ? "text-xs" : "text-sm")}>
                    Ref: {addr.referencePoint}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                {onEdit && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(index);
                    }}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Editar endereço"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {onRemove && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(index);
                    }}
                    className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    aria-label="Remover endereço"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}

      {onAddNew && (
        <button
          type="button"
          onClick={onAddNew}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:bg-primary/5 hover:text-primary",
            compact && "py-2 text-xs"
          )}
        >
          <Plus className="h-4 w-4" />
          Adicionar novo endereço
        </button>
      )}
    </div>
  );
}
