"use client";

import { useMemo, useState } from "react";
import {
  formatCurrency,
  getEnabledPaymentMethods,
  DEFAULT_PAYMENT_METHODS,
  round2,
  type PaymentMethodCode,
  type PaymentMethodConfig,
} from "@matrix-food/utils";
import {
  X,
  Store,
  UtensilsCrossed,
  PackageCheck,
  Truck,
  MapPin,
  User,
  Users,
  Plus,
  ArrowLeft,
  Trash2,
  CheckCircle2,
  AlertCircle,
  SplitSquareHorizontal,
} from "lucide-react";
import type { OrderHeaderData } from "./order-type-header";
import type { POSCartItem } from "./pos-cart";
import {
  POSSplitByPersonWizard,
  type SplitLineOut,
} from "./pos-split-by-person-wizard";
import { DiscountSection, type DiscountValue } from "./discount-section";

const ORDER_TYPE_LABELS: Record<string, { label: string; icon: typeof Store }> = {
  COUNTER: { label: "Balcão", icon: Store },
  TABLE: { label: "Mesa", icon: UtensilsCrossed },
  PICKUP: { label: "Vem Buscar", icon: PackageCheck },
  DELIVERY: { label: "Tele Entrega", icon: Truck },
};

/** Linha individual de pagamento usada no modo "Mais formas" (UI). */
interface SplitLineDraft {
  uid: string;
  methodId: string;
  amount: string;
  payerName: string;
  changeFor: string;
}

export interface ConfirmPayload {
  paymentMethod: PaymentMethodCode;
  customPaymentLabel: string | null;
  changeFor: string | null;
  splitPayments?: Array<{
    method: PaymentMethodCode;
    customLabel: string | null;
    amount: number;
    payerName: string | null;
    changeFor: number | null;
  }>;
}

interface POSCheckoutModalProps {
  subtotal: number;
  deliveryFee: number;
  total: number;
  orderHeader: OrderHeaderData;
  paymentMethods?: PaymentMethodConfig[] | null;
  /** Itens do carrinho — necessário para o modo "Dividir por item". */
  items: POSCartItem[];
  /** Desconto manual aplicado no pedido (valor em R$ + motivo). */
  discount?: DiscountValue;
  onDiscountChange?: (next: DiscountValue) => void;
  onConfirm: (data: ConfirmPayload) => void;
  onClose: () => void;
  isLoading: boolean;
}

type PaymentMode = "single" | "multi-form" | "by-person";

function newUid() {
  return Math.random().toString(36).slice(2, 10);
}

export function POSCheckoutModal({
  subtotal,
  deliveryFee,
  total,
  orderHeader,
  paymentMethods,
  items,
  discount,
  onDiscountChange,
  onConfirm,
  onClose,
  isLoading,
}: POSCheckoutModalProps) {
  const enabledMethods = getEnabledPaymentMethods(
    paymentMethods ?? DEFAULT_PAYMENT_METHODS
  );

  const initialId = enabledMethods.find((m) => m.code === "CASH")?.id
    ?? enabledMethods[0]?.id
    ?? "";

  const [mode, setMode] = useState<PaymentMode>("single");

  // Modo "single"
  const [paymentMethodId, setPaymentMethodId] = useState<string>(initialId);
  const [changeFor, setChangeFor] = useState("");

  // Modo "multi-form" (várias formas — mesma pessoa pagando)
  const [splitLines, setSplitLines] = useState<SplitLineDraft[]>([]);

  const selectedMethod = enabledMethods.find((m) => m.id === paymentMethodId);
  const isTable = orderHeader.orderType === "TABLE";

  function enterMultiFormMode() {
    if (splitLines.length === 0) {
      const fallback = enabledMethods[0]?.id ?? "";
      setSplitLines([
        { uid: newUid(), methodId: fallback, amount: total.toFixed(2), payerName: "", changeFor: "" },
        { uid: newUid(), methodId: fallback, amount: "0.00", payerName: "", changeFor: "" },
      ]);
    }
    setMode("multi-form");
  }

  function exitToSingle() {
    setMode("single");
  }

  function addLine() {
    if (splitLines.length >= 10) return;
    const fallback = enabledMethods[0]?.id ?? "";
    setSplitLines((prev) => [
      ...prev,
      { uid: newUid(), methodId: fallback, amount: "0.00", payerName: "", changeFor: "" },
    ]);
  }

  function removeLine(uid: string) {
    setSplitLines((prev) => (prev.length <= 2 ? prev : prev.filter((l) => l.uid !== uid)));
  }

  function updateLine(uid: string, patch: Partial<SplitLineDraft>) {
    setSplitLines((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  }

  // Soma das linhas do modo "multi-form"
  const splitSum = useMemo(() => {
    if (mode !== "multi-form") return 0;
    return splitLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  }, [mode, splitLines]);

  const splitDiff = round2(total - splitSum);
  const splitOk =
    mode === "multi-form" && Math.abs(splitDiff) <= 0.01 && splitLines.length >= 2;

  function handleByPersonConfirm(lines: SplitLineOut[]) {
    if (lines.length === 0) return;
    const first = lines[0]!;
    onConfirm({
      paymentMethod: first.method,
      customPaymentLabel: first.customLabel,
      changeFor: first.changeFor != null ? first.changeFor.toFixed(2) : null,
      splitPayments: lines,
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Mesa não escolhe pagamento na criação
    if (isTable) {
      onConfirm({
        paymentMethod: "CASH" as PaymentMethodCode,
        customPaymentLabel: null,
        changeFor: null,
      });
      return;
    }

    if (mode === "multi-form") {
      if (!splitOk) return;
      const lines = splitLines.map((l) => {
        const cfg = enabledMethods.find((m) => m.id === l.methodId);
        if (!cfg) {
          throw new Error("Forma de pagamento inválida em uma das linhas");
        }
        const amount = round2(parseFloat(l.amount) || 0);
        const cf = parseFloat(l.changeFor);
        return {
          method: cfg.code,
          customLabel: cfg.code === "OTHER" ? cfg.label : null,
          amount,
          payerName: l.payerName.trim() || null,
          changeFor: cfg.code === "CASH" && !Number.isNaN(cf) && cf > 0 ? round2(cf) : null,
        };
      });

      const first = lines[0]!;
      onConfirm({
        paymentMethod: first.method,
        customPaymentLabel: first.customLabel,
        changeFor: first.changeFor != null ? first.changeFor.toFixed(2) : null,
        splitPayments: lines,
      });
      return;
    }

    // single
    if (!selectedMethod) return;
    onConfirm({
      paymentMethod: selectedMethod.code,
      customPaymentLabel:
        selectedMethod.code === "OTHER" ? selectedMethod.label : null,
      changeFor:
        selectedMethod.code === "CASH" && changeFor ? changeFor : null,
    });
  }

  const typeInfo =
    ORDER_TYPE_LABELS[orderHeader.orderType] ?? ORDER_TYPE_LABELS["COUNTER"]!;
  const TypeIcon = typeInfo.icon;
  const canSubmit = isTable
    ? true
    : mode === "multi-form"
      ? splitOk
      : !!selectedMethod;

  // O wizard "by-person" tem seu próprio botão de confirmar dentro dele,
  // então o footer do modal (Total + Confirmar) some quando ele está ativo.
  const showFooter = mode !== "by-person";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-2xl bg-card shadow-xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 flex-shrink-0">
          <h2 className="text-xl font-bold">Finalizar Pedido</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4 overflow-y-auto">
          {/* Order Summary */}
          <div className="rounded-lg border border-border bg-accent/30 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <TypeIcon className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">
                {typeInfo.label}
                {orderHeader.orderType === "TABLE" && orderHeader.tableNumber
                  ? ` ${orderHeader.tableNumber}`
                  : ""}
              </span>
            </div>

            {orderHeader.customerName && orderHeader.customerName !== "Balcão" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                <span>{orderHeader.customerName}</span>
                {orderHeader.customerPhone && (
                  <span className="text-xs">• {orderHeader.customerPhone}</span>
                )}
              </div>
            )}

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

          {/* Desconto manual — só aparece se o parent decidir tratar desconto */}
          {onDiscountChange && discount && !isTable && (
            <DiscountSection
              subtotal={subtotal}
              value={discount}
              onChange={onDiscountChange}
              disabled={isLoading}
            />
          )}

          {/* Payment area */}
          {isTable ? (
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-sm text-blue-700">
                Pagamento será feito ao fechar a mesa.
              </p>
            </div>
          ) : mode === "single" ? (
            // Modo simples — comportamento original com 2 atalhos discretos
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                Forma de Pagamento
              </label>

              {enabledMethods.length === 0 ? (
                <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                  Nenhuma forma de pagamento ativa. Configure em Configurações &gt; Formas de Pagamento.
                </p>
              ) : (
                <>
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

                  {/* Atalhos pra modos avançados */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={enterMultiFormMode}
                      className="flex-1 rounded-lg border border-border bg-accent/30 px-3 py-2 text-xs font-medium text-foreground hover:bg-accent flex items-center justify-center gap-1.5"
                    >
                      <SplitSquareHorizontal className="h-3.5 w-3.5" />
                      Mais formas
                    </button>
                    {items.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setMode("by-person")}
                        className="flex-1 rounded-lg border border-border bg-accent/30 px-3 py-2 text-xs font-medium text-foreground hover:bg-accent flex items-center justify-center gap-1.5"
                      >
                        <Users className="h-3.5 w-3.5" />
                        Dividir entre pessoas
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : mode === "multi-form" ? (
            // Modo split de formas (mesma pessoa, várias formas de pagamento)
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={exitToSingle}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar para forma única
                </button>
                <span className="text-sm font-medium">Várias formas</span>
              </div>

              <div className="space-y-2">
                {splitLines.map((line, idx) => {
                  const cfg = enabledMethods.find((m) => m.id === line.methodId);
                  const isCash = cfg?.code === "CASH";
                  return (
                    <div
                      key={line.uid}
                      className="rounded-lg border border-border bg-card p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Pagamento {idx + 1}
                        </span>
                        {splitLines.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeLine(line.uid)}
                            className="text-muted-foreground hover:text-red-600"
                            aria-label="Remover linha"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-[1fr_110px] gap-2">
                        <select
                          value={line.methodId}
                          onChange={(e) => updateLine(line.uid, { methodId: e.target.value })}
                          className="rounded-md border px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                        >
                          {enabledMethods.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.amount}
                          onChange={(e) => updateLine(line.uid, { amount: e.target.value })}
                          placeholder="0,00"
                          className="rounded-md border px-2 py-1.5 text-sm text-right focus:border-primary focus:outline-none"
                        />
                      </div>

                      <input
                        type="text"
                        value={line.payerName}
                        onChange={(e) => updateLine(line.uid, { payerName: e.target.value })}
                        placeholder="Nome do pagador (opcional)"
                        maxLength={100}
                        className="w-full rounded-md border px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                      />

                      {isCash && (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.changeFor}
                          onChange={(e) => updateLine(line.uid, { changeFor: e.target.value })}
                          placeholder="Troco para (opcional)"
                          className="w-full rounded-md border px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {splitLines.length < 10 && (
                <button
                  type="button"
                  onClick={addLine}
                  className="flex w-full items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar forma
                </button>
              )}

              <div
                className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
                  splitOk
                    ? "bg-green-50 text-green-700"
                    : "bg-amber-50 text-amber-800"
                }`}
              >
                {splitOk ? (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                )}
                <div className="flex-1 flex items-center justify-between">
                  <span>
                    {splitOk
                      ? "Total fechado"
                      : splitDiff > 0
                        ? `Falta ${formatCurrency(splitDiff)}`
                        : `Excede em ${formatCurrency(Math.abs(splitDiff))}`}
                  </span>
                  <span className="font-medium">
                    {formatCurrency(splitSum)} / {formatCurrency(total)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            // Modo "Dividir entre pessoas" (wizard)
            <POSSplitByPersonWizard
              items={items}
              total={total}
              enabledMethods={enabledMethods}
              onConfirm={handleByPersonConfirm}
              onCancel={exitToSingle}
              isLoading={isLoading}
            />
          )}

          {showFooter && (
            <>
              {/* Total breakdown */}
              <div className="space-y-1">
                {(deliveryFee > 0 || (discount?.amount ?? 0) > 0) && (
                  <>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {(discount?.amount ?? 0) > 0 && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Desconto</span>
                        <span>-{formatCurrency(discount!.amount)}</span>
                      </div>
                    )}
                    {deliveryFee > 0 && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Taxa de entrega</span>
                        <span>{formatCurrency(deliveryFee)}</span>
                      </div>
                    )}
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
                disabled={isLoading || !canSubmit}
                className="w-full rounded-lg bg-primary py-4 text-base font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {isLoading
                  ? "Processando..."
                  : isTable
                    ? "Abrir Mesa"
                    : "Confirmar Pedido"}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
