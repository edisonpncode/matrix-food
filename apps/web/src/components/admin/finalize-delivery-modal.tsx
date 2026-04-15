"use client";

import { useState, useMemo } from "react";
import { X, AlertTriangle, Check, Loader2 } from "lucide-react";
import { formatCurrency } from "@matrix-food/utils";
import { trpc } from "@/lib/trpc";

interface FinalizeDeliveryModalProps {
  order: {
    id: string;
    displayNumber: string;
    total: number;
    customerName: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "INPUT" | "SHORTAGE" | "SURPLUS";

type ShortageHandling = "DISCOUNT_DRIVER" | "ACCEPT_LOSS";
type SurplusHandling = "ADD_DRIVER" | "ADD_CASH";

export function FinalizeDeliveryModal({
  order,
  onClose,
  onSuccess,
}: FinalizeDeliveryModalProps) {
  const [amountInput, setAmountInput] = useState<string>(order.total.toFixed(2));
  const [step, setStep] = useState<Step>("INPUT");
  const [error, setError] = useState<string | null>(null);

  const finalize = trpc.order.finalizeDelivery.useMutation({
    onSuccess: () => onSuccess(),
    onError: (err) => setError(err.message),
  });

  const amountReceived = useMemo(() => {
    const parsed = parseFloat(amountInput.replace(",", "."));
    return isNaN(parsed) ? 0 : parsed;
  }, [amountInput]);

  const diff = useMemo(() => {
    return Math.round((amountReceived - order.total) * 100) / 100;
  }, [amountReceived, order.total]);

  const isDiscrepant = useMemo(
    () => Math.abs(diff) / order.total > 0.2,
    [diff, order.total]
  );

  function handleInputSubmit() {
    setError(null);
    if (amountReceived < 0) {
      setError("Valor recebido não pode ser negativo.");
      return;
    }

    // Confirmação extra para valores muito discrepantes
    if (isDiscrepant && diff !== 0) {
      const pct = Math.abs((diff / order.total) * 100).toFixed(0);
      const confirmMsg =
        diff > 0
          ? `A sobra é de ${pct}% do valor do pedido. Tem certeza?`
          : `O prejuízo é de ${pct}% do valor do pedido. Tem certeza?`;
      if (!confirm(confirmMsg)) return;
    }

    if (diff === 0) {
      // Fecha direto
      finalize.mutate({ orderId: order.id, amountReceived });
      return;
    }

    if (diff < 0) {
      setStep("SHORTAGE");
    } else {
      setStep("SURPLUS");
    }
  }

  function handleShortageChoice(choice: ShortageHandling) {
    finalize.mutate({
      orderId: order.id,
      amountReceived,
      shortageHandling: choice,
    });
  }

  function handleSurplusChoice(choice: SurplusHandling) {
    finalize.mutate({
      orderId: order.id,
      amountReceived,
      surplusHandling: choice,
    });
  }

  const isLoading = finalize.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Finalizar Entrega</h3>
            <p className="text-sm text-muted-foreground">
              Pedido #{order.displayNumber} — {order.customerName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-accent"
            disabled={isLoading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === "INPUT" && (
          <>
            <div className="mb-4 rounded-lg bg-muted p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Total do pedido:
                </span>
                <span className="text-lg font-bold text-primary">
                  {formatCurrency(order.total)}
                </span>
              </div>
            </div>

            <label className="mb-2 block text-sm font-medium">
              Valor recebido do motoboy
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                R$
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                autoFocus
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full rounded-lg border px-3 py-3 pl-10 text-lg font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="0,00"
              />
            </div>

            {/* Preview do diff */}
            {amountInput && !isNaN(amountReceived) && (
              <div
                className={`mt-3 rounded-md px-3 py-2 text-sm ${
                  diff === 0
                    ? "bg-green-50 text-green-700"
                    : diff < 0
                      ? "bg-red-50 text-red-700"
                      : "bg-blue-50 text-blue-700"
                }`}
              >
                {diff === 0 && <>Valor exato. Ok!</>}
                {diff < 0 && (
                  <>
                    Faltou {formatCurrency(Math.abs(diff))} — você escolherá
                    como tratar no próximo passo.
                  </>
                )}
                {diff > 0 && (
                  <>
                    Sobrou {formatCurrency(diff)} — você escolherá como tratar
                    no próximo passo.
                  </>
                )}
              </div>
            )}

            {error && (
              <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-6 flex gap-2">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 rounded-lg border px-4 py-2.5 text-sm hover:bg-accent disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleInputSubmit}
                disabled={isLoading || !amountInput}
                className="flex flex-[2] items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Confirmar
              </button>
            </div>
          </>
        )}

        {step === "SHORTAGE" && (
          <>
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
              <div className="text-sm text-red-800">
                <p className="font-semibold">Valor recebido inferior ao total.</p>
                <p className="mt-1">
                  Recebido:{" "}
                  <strong>{formatCurrency(amountReceived)}</strong>
                  <br />
                  Total: <strong>{formatCurrency(order.total)}</strong>
                  <br />
                  Diferença:{" "}
                  <strong className="text-red-700">
                    {formatCurrency(Math.abs(diff))}
                  </strong>
                </p>
              </div>
            </div>

            <p className="mb-3 text-sm text-muted-foreground">
              Como deseja tratar a diferença?
            </p>

            <div className="space-y-2">
              <button
                onClick={() => handleShortageChoice("DISCOUNT_DRIVER")}
                disabled={isLoading}
                className="w-full rounded-lg border-2 border-red-200 bg-white p-4 text-left hover:bg-red-50 disabled:opacity-50"
              >
                <div className="font-semibold text-red-700">
                  Descontar do motoboy
                </div>
                <div className="text-xs text-muted-foreground">
                  Desconta do saldo do motoboy. Se o saldo não for suficiente,
                  o restante vira prejuízo do caixa.
                </div>
              </button>

              <button
                onClick={() => handleShortageChoice("ACCEPT_LOSS")}
                disabled={isLoading}
                className="w-full rounded-lg border-2 border-gray-200 bg-white p-4 text-left hover:bg-gray-50 disabled:opacity-50"
              >
                <div className="font-semibold text-gray-700">
                  Aceitar prejuízo
                </div>
                <div className="text-xs text-muted-foreground">
                  Lança a perda direto no caixa. Motoboy não é afetado.
                </div>
              </button>
            </div>

            {error && (
              <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setStep("INPUT")}
                disabled={isLoading}
                className="flex-1 rounded-lg border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
              >
                Voltar
              </button>
            </div>
          </>
        )}

        {step === "SURPLUS" && (
          <>
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold">Valor recebido maior que o total.</p>
                <p className="mt-1">
                  Recebido:{" "}
                  <strong>{formatCurrency(amountReceived)}</strong>
                  <br />
                  Total: <strong>{formatCurrency(order.total)}</strong>
                  <br />
                  Sobra:{" "}
                  <strong className="text-blue-700">
                    {formatCurrency(diff)}
                  </strong>
                </p>
              </div>
            </div>

            <p className="mb-3 text-sm text-muted-foreground">
              Como deseja tratar a sobra?
            </p>

            <div className="space-y-2">
              <button
                onClick={() => handleSurplusChoice("ADD_DRIVER")}
                disabled={isLoading}
                className="w-full rounded-lg border-2 border-purple-200 bg-white p-4 text-left hover:bg-purple-50 disabled:opacity-50"
              >
                <div className="font-semibold text-purple-700">
                  Acrescentar ao motoboy
                </div>
                <div className="text-xs text-muted-foreground">
                  Adiciona a sobra ao saldo do motoboy (bônus/gorjeta).
                </div>
              </button>

              <button
                onClick={() => handleSurplusChoice("ADD_CASH")}
                disabled={isLoading}
                className="w-full rounded-lg border-2 border-green-200 bg-white p-4 text-left hover:bg-green-50 disabled:opacity-50"
              >
                <div className="font-semibold text-green-700">
                  Acrescentar ao caixa
                </div>
                <div className="text-xs text-muted-foreground">
                  Registra a sobra como ajuste positivo no caixa.
                </div>
              </button>
            </div>

            {error && (
              <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setStep("INPUT")}
                disabled={isLoading}
                className="flex-1 rounded-lg border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
              >
                Voltar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
