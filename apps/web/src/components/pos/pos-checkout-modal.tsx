"use client";

import { useState } from "react";
import { formatCurrency } from "@matrix-food/utils";
import {
  X,
  Store,
  UtensilsCrossed,
  PackageCheck,
  Truck,
  MapPin,
  User,
} from "lucide-react";
import type { OrderHeaderData } from "./order-type-header";

type PaymentMethod = "PIX" | "CASH" | "CREDIT_CARD" | "DEBIT_CARD";

const PAYMENT_METHODS = [
  { value: "CASH" as const, label: "Dinheiro" },
  { value: "PIX" as const, label: "PIX" },
  { value: "CREDIT_CARD" as const, label: "Crédito" },
  { value: "DEBIT_CARD" as const, label: "Débito" },
];

const ORDER_TYPE_LABELS: Record<string, { label: string; icon: typeof Store }> = {
  COUNTER: { label: "Balcão", icon: Store },
  TABLE: { label: "Mesa", icon: UtensilsCrossed },
  PICKUP: { label: "Vem Buscar", icon: PackageCheck },
  DELIVERY: { label: "Tele Entrega", icon: Truck },
};

interface POSCheckoutModalProps {
  subtotal: number;
  deliveryFee: number;
  total: number;
  orderHeader: OrderHeaderData;
  onConfirm: (data: {
    paymentMethod: PaymentMethod;
    changeFor: string | null;
  }) => void;
  onClose: () => void;
  isLoading: boolean;
}

export function POSCheckoutModal({
  subtotal,
  deliveryFee,
  total,
  orderHeader,
  onConfirm,
  onClose,
  isLoading,
}: POSCheckoutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [changeFor, setChangeFor] = useState("");

  const isTable = orderHeader.orderType === "TABLE";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onConfirm({
      paymentMethod: isTable ? undefined as unknown as PaymentMethod : paymentMethod,
      changeFor: paymentMethod === "CASH" && changeFor ? changeFor : null,
    });
  }

  const typeInfo = ORDER_TYPE_LABELS[orderHeader.orderType] ?? ORDER_TYPE_LABELS["COUNTER"]!;
  const TypeIcon = typeInfo.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-xl font-bold">Finalizar Pedido</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Order Summary */}
          <div className="rounded-lg border border-border bg-accent/30 p-3 space-y-2">
            {/* Type badge */}
            <div className="flex items-center gap-2">
              <TypeIcon className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">
                {typeInfo.label}
                {orderHeader.orderType === "TABLE" && orderHeader.tableNumber
                  ? ` ${orderHeader.tableNumber}`
                  : ""}
              </span>
            </div>

            {/* Customer info */}
            {orderHeader.customerName && orderHeader.customerName !== "Balcão" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                <span>{orderHeader.customerName}</span>
                {orderHeader.customerPhone && (
                  <span className="text-xs">• {orderHeader.customerPhone}</span>
                )}
              </div>
            )}

            {/* Delivery address */}
            {orderHeader.orderType === "DELIVERY" && orderHeader.deliveryAddress && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  {orderHeader.deliveryAddress.street}, {orderHeader.deliveryAddress.number}
                  {orderHeader.deliveryAddress.complement
                    ? ` - ${orderHeader.deliveryAddress.complement}`
                    : ""}
                  {orderHeader.deliveryAddress.referencePoint
                    ? ` (${orderHeader.deliveryAddress.referencePoint})`
                    : ""}
                </span>
              </div>
            )}
          </div>

          {/* Payment Method - not shown for TABLE (payment at close) */}
          {isTable ? (
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-sm text-blue-700">
                Pagamento será feito ao fechar a mesa.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-sm font-medium">Forma de Pagamento</label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPaymentMethod(opt.value)}
                    className={`rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                      paymentMethod === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Change for cash */}
              {paymentMethod === "CASH" && (
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
          )}

          {/* Total breakdown */}
          <div className="space-y-1">
            {deliveryFee > 0 && (
              <>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Taxa de entrega</span>
                  <span>{formatCurrency(deliveryFee)}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between rounded-lg bg-accent p-3">
              <span className="text-lg font-bold">Total</span>
              <span className="text-2xl font-bold text-primary">
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          {/* Confirm Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-primary py-4 text-base font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading
              ? "Processando..."
              : isTable
                ? "Abrir Mesa"
                : "Confirmar Pedido"}
          </button>
        </form>
      </div>
    </div>
  );
}
