"use client";

import { Star, Plus } from "lucide-react";
import { formatCurrency } from "@matrix-food/utils";

interface LoyaltyProgressModalProps {
  amountNeeded: number;
  pointsName: string;
  reason: "next-point" | "min-order";
  onAddMore: () => void;
  onClose: () => void;
}

export function LoyaltyProgressModal({
  amountNeeded,
  pointsName,
  reason,
  onAddMore,
  onClose,
}: LoyaltyProgressModalProps) {
  const singular = pointsName.toLowerCase().replace(/s$/, "");

  const title =
    reason === "min-order"
      ? `Faltam ${formatCurrency(amountNeeded)} para começar a ganhar ${pointsName.toLowerCase()}!`
      : `Falta pouco para mais 1 ${singular}!`;

  const description =
    reason === "min-order"
      ? `Adicione mais ${formatCurrency(amountNeeded)} em produtos e seu pedido começa a acumular ${pointsName.toLowerCase()} de fidelidade.`
      : `Adicione mais ${formatCurrency(amountNeeded)} em produtos para ganhar mais 1 ${singular} de fidelidade neste pedido.`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-100 to-orange-100">
          <Star className="h-8 w-8 text-yellow-600" />
        </div>

        <h2 className="text-lg font-bold text-gray-900">{title}</h2>

        <p className="mt-2 text-sm text-gray-600">{description}</p>

        <button
          onClick={onAddMore}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-white transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Adicionar mais produtos
        </button>

        <button
          onClick={onClose}
          className="mt-2 w-full rounded-full py-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
        >
          Continuar mesmo assim
        </button>
      </div>
    </div>
  );
}
