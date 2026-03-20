"use client";

import { useState } from "react";
import { formatCurrency } from "@matrix-food/utils";
import { X } from "lucide-react";

interface POSCheckoutModalProps {
  total: number;
  onConfirm: (data: {
    type: "DELIVERY" | "PICKUP" | "DINE_IN";
    paymentMethod: "PIX" | "CASH" | "CREDIT_CARD" | "DEBIT_CARD";
    customerName: string;
    changeFor: string | null;
  }) => void;
  onClose: () => void;
  isLoading: boolean;
}

export function POSCheckoutModal({
  total,
  onConfirm,
  onClose,
  isLoading,
}: POSCheckoutModalProps) {
  const [type, setType] = useState<"DELIVERY" | "PICKUP" | "DINE_IN">(
    "DINE_IN"
  );
  const [paymentMethod, setPaymentMethod] = useState<
    "PIX" | "CASH" | "CREDIT_CARD" | "DEBIT_CARD"
  >("CASH");
  const [customerName, setCustomerName] = useState("Balcão");
  const [changeFor, setChangeFor] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onConfirm({
      type,
      paymentMethod,
      customerName: customerName || "Balcão",
      changeFor: paymentMethod === "CASH" && changeFor ? changeFor : null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Finalizar Pedido</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Name */}
          <div>
            <label className="mb-1 block text-sm font-medium">Cliente</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Balcão"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          {/* Order Type */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Tipo do Pedido
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: "DINE_IN", label: "Mesa" },
                  { value: "PICKUP", label: "Retirada" },
                  { value: "DELIVERY", label: "Entrega" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={`rounded-lg border-2 px-3 py-3 text-sm font-medium transition-colors ${
                    type === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Forma de Pagamento
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: "CASH", label: "Dinheiro" },
                  { value: "PIX", label: "PIX" },
                  { value: "CREDIT_CARD", label: "Crédito" },
                  { value: "DEBIT_CARD", label: "Débito" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPaymentMethod(opt.value)}
                  className={`rounded-lg border-2 px-3 py-3 text-sm font-medium transition-colors ${
                    paymentMethod === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Change For (if cash) */}
          {paymentMethod === "CASH" && (
            <div>
              <label className="mb-1 block text-sm font-medium">
                Troco para (R$)
              </label>
              <input
                type="number"
                value={changeFor}
                onChange={(e) => setChangeFor(e.target.value)}
                placeholder="Sem troco"
                step="0.01"
                min="0"
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          )}

          {/* Total */}
          <div className="rounded-lg bg-accent p-4 text-center">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-3xl font-bold text-primary">
              {formatCurrency(total)}
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-primary py-4 text-base font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? "Processando..." : "Confirmar Pedido"}
          </button>
        </form>
      </div>
    </div>
  );
}
