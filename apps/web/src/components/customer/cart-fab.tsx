"use client";

import { ShoppingCart } from "lucide-react";
import { useCartStore } from "@/stores/cart-store";
import { formatCurrency } from "@matrix-food/utils";

interface CartFabProps {
  onClick: () => void;
}

export function CartFab({ onClick }: CartFabProps) {
  const itemCount = useCartStore((s) => s.getItemCount());
  const subtotal = useCartStore((s) => s.getSubtotal());

  if (itemCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-lg">
      <button
        onClick={onClick}
        className="flex w-full items-center justify-between rounded-full bg-primary px-6 py-4 text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <ShoppingCart className="h-5 w-5" />
            <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-primary">
              {itemCount}
            </span>
          </div>
          <span className="font-semibold">Ver carrinho</span>
        </div>
        <span className="font-bold">{formatCurrency(subtotal)}</span>
      </button>
    </div>
  );
}
