"use client";

import { X, Trash2, AlertTriangle } from "lucide-react";
import { useCartStore } from "@/stores/cart-store";
import { QuantitySelector } from "./quantity-selector";
import { formatCurrency } from "@matrix-food/utils";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
  minOrder?: number;
}

export function CartDrawer({
  open,
  onClose,
  onCheckout,
  minOrder = 0,
}: CartDrawerProps) {
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const clearCart = useCartStore((s) => s.clearCart);
  const subtotal = useCartStore((s) => s.getSubtotal());

  const isBelowMinimum = minOrder > 0 && subtotal < minOrder;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Drawer */}
      <div
        className="relative flex w-full max-w-md flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-bold">Seu pedido</h2>
          <button onClick={onClose} className="p-1">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <p className="py-8 text-center text-gray-400">
              Seu carrinho esta vazio.
            </p>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold">{item.productName}</p>
                      {item.variantName && (
                        <p className="text-xs text-gray-500">
                          {item.variantName}
                        </p>
                      )}
                      {item.customizations.length > 0 && (
                        <div className="mt-1">
                          {item.customizations.map((c, i) => (
                            <p key={i} className="text-xs text-gray-400">
                              + {c.optionName}
                              {c.price > 0 &&
                                ` (${formatCurrency(c.price)})`}
                            </p>
                          ))}
                        </div>
                      )}
                      {item.notes && (
                        <p className="mt-1 text-xs italic text-gray-400">
                          {item.notes}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <QuantitySelector
                      value={item.quantity}
                      onChange={(q) => updateQuantity(item.id, q)}
                      min={0}
                    />
                    <span className="font-semibold text-primary">
                      {formatCurrency(item.itemTotal)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t p-5">
            {/* Aviso pedido minimo */}
            {isBelowMinimum && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-yellow-600" />
                <p className="text-xs text-yellow-800">
                  Pedido minimo:{" "}
                  <strong>{formatCurrency(minOrder)}</strong>. Faltam{" "}
                  <strong>{formatCurrency(minOrder - subtotal)}</strong>.
                </p>
              </div>
            )}

            <div className="mb-2 flex items-center justify-between">
              <button
                onClick={clearCart}
                className="text-sm text-red-500 hover:text-red-600"
              >
                Limpar carrinho
              </button>
              <div className="text-right">
                <p className="text-sm text-gray-500">Subtotal</p>
                <p className="text-xl font-bold text-primary">
                  {formatCurrency(subtotal)}
                </p>
              </div>
            </div>
            <button
              onClick={onCheckout}
              disabled={isBelowMinimum}
              className="mt-3 w-full rounded-full bg-primary py-3.5 text-center font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isBelowMinimum ? "Pedido abaixo do minimo" : "Fazer pedido"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
