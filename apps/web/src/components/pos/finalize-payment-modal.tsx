"use client";

import { useState } from "react";
import {
  formatCurrency,
  getEnabledPaymentMethods,
  DEFAULT_PAYMENT_METHODS,
  type PaymentMethodCode,
  type PaymentMethodConfig,
} from "@matrix-food/utils";
import { X, Utensils, ShoppingBag, User } from "lucide-react";

interface FinalizePaymentModalProps {
  order: {
    id: string;
    displayNumber: string;
    type: "TABLE" | "PICKUP";
    total: number;
    customerName?: string | null;
    tableNumber?: number | null;
  };
  paymentMethods?: PaymentMethodConfig[] | null;
  onConfirm: (data: {
    paymentMethod: PaymentMethodCode;
    customPaymentLabel: string | null;
    changeFor: number | null;
  }) => void;
  onClose: () => void;
  isLoading: boolean;
  errorMessage?: string | null;
}

export function FinalizePaymentModal({
  order,
  paymentMethods,
  onConfirm,
  onClose,
  isLoading,
  errorMessage,
}: FinalizePaymentModalProps) {
  const enabledMethods = getEnabledPaymentMethods(
    paymentMethods ?? DEFAULT_PAYMENT_METHODS
  );

  const initialId =
    enabledMethods.find((m) => m.code === "PIX")?.id ??
    enabledMethods[0]?.id ??
    "";

  const [paymentMethodId, setPaymentMethodId] = useState<string>(initialId);
  const [changeFor, setChangeFor] = useState("");

  const selectedMethod = enabledMethods.find((m) => m.id === paymentMethodId);

  const isTable = order.type === "TABLE";
  const TypeIcon = isTable ? Utensils : ShoppingBag;
  const typeLabel = isTable ? "Mesa" : "Vem Buscar";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMethod) return;
    const parsedChange =
      selectedMethod.code === "CASH" && changeFor
        ? parseFloat(changeFor.replace(",", "."))
        : null;
    onConfirm({
      paymentMethod: selectedMethod.code,
      customPaymentLabel:
        selectedMethod.code === "OTHER" ? selectedMethod.label : null,
      changeFor:
        parsedChange != null && !isNaN(parsedChange) && parsedChange > 0
          ? parsedChange
          : null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-xl font-bold">Fechar Pedido</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          <div className="space-y-2 rounded-lg border border-border bg-accent/30 p-3">
            <div className="flex items-center gap-2">
              <TypeIcon className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">
                {typeLabel}
                {isTable && order.tableNumber ? ` ${order.tableNumber}` : ""} ·
                Pedido #{order.displayNumber}
              </span>
            </div>
            {order.customerName && order.customerName !== "Balcão" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                <span>{order.customerName}</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium">
              Forma de Pagamento
            </label>
            {enabledMethods.length === 0 ? (
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                Nenhuma forma de pagamento ativa. Configure em Configurações
                &gt; Formas de Pagamento.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {enabledMethods.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPaymentMethodId(opt.id)}
                    className={`rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                      paymentMethodId === opt.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {selectedMethod?.code === "CASH" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Troco para (R$)
                </label>
                <input
                  type="number"
                  value={changeFor}
                  onChange={(e) => setChangeFor(e.target.value)}
                  placeholder="Sem troco"
                  step="0.01"
                  min="0"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg bg-accent p-3">
            <span className="text-lg font-bold">Total</span>
            <span className="text-2xl font-bold text-primary">
              {formatCurrency(order.total)}
            </span>
          </div>

          {errorMessage && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !selectedMethod}
            className="w-full rounded-lg bg-primary py-4 text-base font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? "Processando..." : "Confirmar Pagamento"}
          </button>
        </form>
      </div>
    </div>
  );
}
