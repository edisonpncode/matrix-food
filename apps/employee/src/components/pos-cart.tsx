"use client";

import { formatCurrency } from "@matrix-food/utils";
import { Minus, Plus, Trash2 } from "lucide-react";

export interface POSCartItem {
  id: string; // unique key for cart item
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  unitPrice: number;
  quantity: number;
  customizations: {
    optionId: string;
    groupName: string;
    optionName: string;
    price: number;
  }[];
  notes?: string;
}

interface POSCartProps {
  items: POSCartItem[];
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
}

export function POSCart({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCheckout,
}: POSCartProps) {
  const total = items.reduce((sum, item) => {
    const customizationsTotal = item.customizations.reduce(
      (s, c) => s + c.price,
      0
    );
    return sum + (item.unitPrice + customizationsTotal) * item.quantity;
  }, 0);

  return (
    <div className="flex h-full flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="text-lg font-bold">Carrinho</h2>
        {items.length > 0 && (
          <button
            onClick={onClearCart}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-auto p-4">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Carrinho vazio
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const customizationsTotal = item.customizations.reduce(
                (s, c) => s + c.price,
                0
              );
              const itemTotal =
                (item.unitPrice + customizationsTotal) * item.quantity;

              return (
                <div
                  key={item.id}
                  className="rounded-lg border p-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {item.productName}
                        {item.variantName && (
                          <span className="text-muted-foreground">
                            {" "}
                            ({item.variantName})
                          </span>
                        )}
                      </p>
                      {item.customizations.length > 0 && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.customizations
                            .map((c) => c.optionName)
                            .join(", ")}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="ml-2 text-muted-foreground hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          onUpdateQuantity(item.id, item.quantity - 1)
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-accent"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          onUpdateQuantity(item.id, item.quantity + 1)
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-accent"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="text-sm font-bold">
                      {formatCurrency(itemTotal)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-lg font-bold">Total</span>
          <span className="text-2xl font-bold text-primary">
            {formatCurrency(total)}
          </span>
        </div>
        <button
          onClick={onCheckout}
          disabled={items.length === 0}
          className="w-full rounded-lg bg-primary py-4 text-base font-semibold text-white hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50"
        >
          Finalizar Pedido
        </button>
      </div>
    </div>
  );
}
