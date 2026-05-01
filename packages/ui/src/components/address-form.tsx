"use client";

import * as React from "react";
import { Loader2, Search } from "lucide-react";
import { fetchAddressByCep, formatCep } from "@matrix-food/utils";
import { cn } from "../lib/utils";

export interface AddressValue {
  label?: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  referencePoint?: string;
  lat?: number;
  lng?: number;
}

const EMPTY_ADDRESS: AddressValue = {
  label: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  zipCode: "",
  referencePoint: "",
};

export interface AddressFormProps {
  value?: AddressValue | null;
  onChange?: (value: AddressValue) => void;
  onSave?: (value: AddressValue) => void;
  onCancel?: () => void;
  defaultCity?: string;
  defaultState?: string;
  /** Quando true, usa estilo compacto (POS). Default: estilo cliente (mobile). */
  compact?: boolean;
  /** Esconde o campo "label" (apelido). Default: false. */
  hideLabel?: boolean;
  saveLabel?: string;
  className?: string;
}

const SUGGESTED_LABELS = ["Casa", "Trabalho", "Outro"];

export function AddressForm({
  value,
  onChange,
  onSave,
  onCancel,
  defaultCity,
  defaultState,
  compact = false,
  hideLabel = false,
  saveLabel = "Salvar endereço",
  className,
}: AddressFormProps) {
  const [internal, setInternal] = React.useState<AddressValue>(() => ({
    ...EMPTY_ADDRESS,
    label: "",
    city: defaultCity ?? "",
    state: defaultState ?? "",
    ...(value ?? {}),
  }));
  const [cepLoading, setCepLoading] = React.useState(false);
  const [cepError, setCepError] = React.useState<string | null>(null);

  const update = React.useCallback(
    (patch: Partial<AddressValue>) => {
      setInternal((prev) => {
        const next = { ...prev, ...patch };
        onChange?.(next);
        return next;
      });
    },
    [onChange]
  );

  React.useEffect(() => {
    if (value) {
      setInternal((prev) => ({ ...prev, ...value }));
    }
  }, [value]);

  async function handleCepLookup(rawCep?: string) {
    const cep = (rawCep ?? internal.zipCode).replace(/\D/g, "");
    if (cep.length !== 8) return;
    setCepLoading(true);
    setCepError(null);
    try {
      const result = await fetchAddressByCep(cep);
      if (!result) {
        setCepError("CEP não encontrado");
        return;
      }
      update({
        zipCode: result.zipCode,
        street: result.street || internal.street,
        neighborhood: result.neighborhood || internal.neighborhood,
        city: result.city || internal.city,
        state: result.state || internal.state,
      });
    } finally {
      setCepLoading(false);
    }
  }

  const isValid =
    internal.street.trim() &&
    internal.number.trim() &&
    internal.neighborhood.trim() &&
    internal.city.trim() &&
    internal.state.trim();

  const inputClass = compact
    ? "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
    : "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className={cn("space-y-3", className)}>
      {!hideLabel && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Apelido do endereço
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={internal.label ?? ""}
              onChange={(e) => update({ label: e.target.value })}
              placeholder="Ex: Casa, Trabalho..."
              className={cn(inputClass, "flex-1 min-w-[140px]")}
            />
            {SUGGESTED_LABELS.map((suggested) => (
              <button
                key={suggested}
                type="button"
                onClick={() => update({ label: suggested })}
                className="rounded-full border border-input px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                {suggested}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          CEP
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={internal.zipCode}
            onChange={(e) => {
              const formatted = formatCep(e.target.value);
              update({ zipCode: formatted });
              if (cepError) setCepError(null);
              if (formatted.replace(/\D/g, "").length === 8) {
                handleCepLookup(formatted);
              }
            }}
            onBlur={() => handleCepLookup()}
            placeholder="00000-000"
            inputMode="numeric"
            className={cn(inputClass, "max-w-[160px]")}
          />
          <button
            type="button"
            onClick={() => handleCepLookup()}
            disabled={cepLoading || internal.zipCode.replace(/\D/g, "").length !== 8}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {cepLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Search className="h-3 w-3" />
            )}
            Buscar
          </button>
          {cepError && (
            <span className="self-center text-xs text-red-600">{cepError}</span>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Rua / Avenida *
          </label>
          <input
            type="text"
            value={internal.street}
            onChange={(e) => update({ street: e.target.value })}
            placeholder="Rua / Avenida"
            className={inputClass}
          />
        </div>
        <div className="w-24">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Nº *
          </label>
          <input
            type="text"
            value={internal.number}
            onChange={(e) => update({ number: e.target.value })}
            placeholder="123"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Complemento
          </label>
          <input
            type="text"
            value={internal.complement ?? ""}
            onChange={(e) => update({ complement: e.target.value })}
            placeholder="Apto, bloco..."
            className={inputClass}
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Ponto de referência
          </label>
          <input
            type="text"
            value={internal.referencePoint ?? ""}
            onChange={(e) => update({ referencePoint: e.target.value })}
            placeholder="Próximo a..."
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Bairro *
        </label>
        <input
          type="text"
          value={internal.neighborhood}
          onChange={(e) => update({ neighborhood: e.target.value })}
          placeholder="Bairro"
          className={inputClass}
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Cidade *
          </label>
          <input
            type="text"
            value={internal.city}
            onChange={(e) => update({ city: e.target.value })}
            placeholder="Cidade"
            className={inputClass}
          />
        </div>
        <div className="w-20">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            UF *
          </label>
          <input
            type="text"
            value={internal.state}
            onChange={(e) =>
              update({ state: e.target.value.toUpperCase().slice(0, 2) })
            }
            maxLength={2}
            placeholder="SP"
            className={inputClass}
          />
        </div>
      </div>

      {(onSave || onCancel) && (
        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className={cn(
                "rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent",
                compact && "py-1.5 text-xs"
              )}
            >
              Cancelar
            </button>
          )}
          {onSave && (
            <button
              type="button"
              disabled={!isValid}
              onClick={() => {
                if (!isValid) return;
                const finalLabel = (internal.label ?? "").trim() || "Endereço";
                onSave({ ...internal, label: finalLabel });
              }}
              className={cn(
                "rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50",
                compact && "py-1.5 text-xs"
              )}
            >
              {saveLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
