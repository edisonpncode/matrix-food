"use client";

import { useMemo, useState } from "react";
import {
  formatCurrency,
  getEnabledPaymentMethods,
  DEFAULT_PAYMENT_METHODS,
  round2,
  splitEvenly,
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
} from "lucide-react";
import type { OrderHeaderData } from "./order-type-header";

const ORDER_TYPE_LABELS: Record<string, { label: string; icon: typeof Store }> = {
  COUNTER: { label: "Balcão", icon: Store },
  TABLE: { label: "Mesa", icon: UtensilsCrossed },
  PICKUP: { label: "Vem Buscar", icon: PackageCheck },
  DELIVERY: { label: "Tele Entrega", icon: Truck },
};

/** Linha individual de pagamento usada no modo split (UI). */
interface SplitLineDraft {
  /** Id local apenas para React keys. */
  uid: string;
  /** Id de PaymentMethodConfig.id (não confundir com code). */
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
  onConfirm: (data: ConfirmPayload) => void;
  onClose: () => void;
  isLoading: boolean;
}

function newUid() {
  return Math.random().toString(36).slice(2, 10);
}

export function POSCheckoutModal({
  subtotal,
  deliveryFee,
  total,
  orderHeader,
  paymentMethods,
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

  // Modo único (forma de pagamento simples)
  const [paymentMethodId, setPaymentMethodId] = useState<string>(initialId);
  const [changeFor, setChangeFor] = useState("");

  // Modo split
  const [splitMode, setSplitMode] = useState(false);
  const [peopleCount, setPeopleCount] = useState(2);
  const [splitLines, setSplitLines] = useState<SplitLineDraft[]>([]);

  const selectedMethod = enabledMethods.find((m) => m.id === paymentMethodId);
  const isTable = orderHeader.orderType === "TABLE";

  function enterSplitMode() {
    // Inicializa com 2 linhas vazias (mesma forma) caso não haja nada.
    if (splitLines.length === 0) {
      const fallback = enabledMethods[0]?.id ?? "";
      setSplitLines([
        { uid: newUid(), methodId: fallback, amount: total.toFixed(2), payerName: "", changeFor: "" },
        { uid: newUid(), methodId: fallback, amount: "0.00", payerName: "", changeFor: "" },
      ]);
    }
    setSplitMode(true);
  }

  function exitSplitMode() {
    setSplitMode(false);
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

  function divideEqually() {
    const n = Math.min(Math.max(peopleCount | 0, 2), 10);
    const fallback = enabledMethods[0]?.id ?? "";
    const amounts = splitEvenly(total, n);
    setSplitLines(
      amounts.map((amt, idx) => ({
        uid: newUid(),
        methodId:
          // Reaproveita a forma da linha anterior (idx) se existir
          splitLines[idx]?.methodId ?? fallback,
        amount: amt.toFixed(2),
        payerName: splitLines[idx]?.payerName ?? "",
        changeFor: "",
      }))
    );
  }

  // Soma das linhas em reais (para validação visual + envio)
  const splitSum = useMemo(() => {
    if (!splitMode) return 0;
    return splitLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  }, [splitMode, splitLines]);

  const splitDiff = round2(total - splitSum);
  const splitOk = splitMode && Math.abs(splitDiff) <= 0.01 && splitLines.length >= 2;

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

    if (splitMode) {
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

      // Primeira linha alimenta os campos legados de orders
      const first = lines[0]!;
      onConfirm({
        paymentMethod: first.method,
        customPaymentLabel: first.customLabel,
        changeFor: first.changeFor != null ? first.changeFor.toFixed(2) : null,
        splitPayments: lines,
      });
      return;
    }

    if (!selectedMethod) return;
    onConfirm({
      paymentMethod: selectedMethod.code,
      customPaymentLabel:
        selectedMethod.code === "OTHER" ? selectedMethod.label : null,
      changeFor:
        selectedMethod.code === "CASH" && changeFor ? changeFor : null,
    });
  }

  const typeInfo = ORDER_TYPE_LABELS[orderHeader.orderType] ?? ORDER_TYPE_LABELS["COUNTER"]!;
  const TypeIcon = typeInfo.icon;
  const canSubmit = isTable
    ? true
    : splitMode
      ? splitOk
      : !!selectedMethod;

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

          {/* Payment area */}
          {isTable ? (
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-sm text-blue-700">
                Pagamento será feito ao fechar a mesa.
              </p>
            </div>
          ) : !splitMode ? (
            // Modo simples — comportamento original
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium">Forma de Pagamento</label>
                {enabledMethods.length > 0 && (
                  <button
                    type="button"
                    onClick={enterSplitMode}
                    className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    <Users className="h-3.5 w-3.5" />
                    Dividir pagamento
                  </button>
                )}
              </div>

              {enabledMethods.length === 0 ? (
                <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                  Nenhuma forma de pagamento ativa. Configure em Configurações &gt; Formas de Pagamento.
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
          ) : (
            // Modo split
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={exitSplitMode}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar para forma única
                </button>
                <span className="text-sm font-medium">Dividir pagamento</span>
              </div>

              {/* Ações rápidas */}
              <div className="rounded-lg border border-border bg-accent/20 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-primary" />
                  <span>Dividir entre</span>
                  <input
                    type="number"
                    min={2}
                    max={10}
                    value={peopleCount}
                    onChange={(e) =>
                      setPeopleCount(Math.min(Math.max(parseInt(e.target.value) || 2, 2), 10))
                    }
                    className="w-14 rounded-md border px-2 py-1 text-center text-sm focus:border-primary focus:outline-none"
                  />
                  <span>pessoas</span>
                  <button
                    type="button"
                    onClick={divideEqually}
                    className="ml-auto rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
                  >
                    Dividir igualmente
                  </button>
                </div>
              </div>

              {/* Linhas */}
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

              {/* Botão de adicionar */}
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

              {/* Status da soma */}
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
            disabled={isLoading || !canSubmit}
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
