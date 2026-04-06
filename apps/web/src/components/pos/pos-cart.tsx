"use client";

import { formatCurrency } from "@matrix-food/utils";
import { Minus, Plus, Trash2, Package, X } from "lucide-react";

export interface POSCartItem {
  id: string;
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
  promoId?: string; // ID da promo a que pertence (undefined = item avulso)
  sizeName?: string; // Nome do tamanho da pizza (ex: "Grande")
  flavorNames?: string[]; // Nomes dos sabores da pizza
  ingredientModifications?: {
    ingredientId: string;
    ingredientName: string;
    modification: string;
    price: number;
    quantity?: number;
    state?: string;
  }[];
}

export interface AppliedPromo {
  id: string; // ID unico desta aplica de promo
  code: string;
  description: string;
  discount: number;
  bundlePrice?: number;
}

interface POSCartProps {
  items: POSCartItem[];
  appliedPromos: AppliedPromo[];
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  onRemovePromo: (promoId: string) => void;
}

function getItemExtras(item: POSCartItem) {
  return item.customizations.reduce((s, c) => s + c.price, 0) * item.quantity;
}

function getItemTotal(item: POSCartItem) {
  const custTotal = item.customizations.reduce((s, c) => s + c.price, 0);
  return (item.unitPrice + custTotal) * item.quantity;
}

function CartItemRow({
  item,
  onUpdateQuantity,
  onRemoveItem,
  showPrice,
  compact,
}: {
  item: POSCartItem;
  onUpdateQuantity: (id: string, qty: number) => void;
  onRemoveItem: (id: string) => void;
  showPrice: boolean;
  compact?: boolean;
}) {
  const itemTotal = getItemTotal(item);

  return (
    <div className={compact ? "py-1.5" : "rounded-lg border p-3"}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className={`font-medium leading-tight ${compact ? "text-xs" : "text-sm"}`}>
            {item.quantity > 1 && (
              <span className="text-primary font-bold">{item.quantity}x </span>
            )}
            {item.productName}
            {item.variantName && (
              <span className="text-muted-foreground"> ({item.variantName})</span>
            )}
            {item.sizeName && (
              <span className="text-muted-foreground"> ({item.sizeName})</span>
            )}
          </p>
          {item.flavorNames && item.flavorNames.length > 1 && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              Sabores: {item.flavorNames.join(", ")}
            </p>
          )}
          {item.customizations.length > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              {item.customizations.map((c) => c.optionName).join(", ")}
            </p>
          )}
          {item.ingredientModifications && item.ingredientModifications.length > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              {item.ingredientModifications.map((m) => m.modification).join(", ")}
            </p>
          )}
          {item.notes && (
            <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400 truncate">
              OBS: {item.notes}
            </p>
          )}
        </div>
        {!compact && (
          <button
            onClick={() => onRemoveItem(item.id)}
            className="ml-2 flex-shrink-0 text-muted-foreground hover:text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {!compact && (
        <div className="mt-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
              className="flex h-7 w-7 items-center justify-center rounded-md border hover:bg-accent"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-5 text-center text-xs font-medium">
              {item.quantity}
            </span>
            <button
              onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-md border hover:bg-accent"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
          {showPrice && (
            <span className="text-sm font-bold">{formatCurrency(itemTotal)}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function POSCart({
  items,
  appliedPromos,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCheckout,
  onRemovePromo,
}: POSCartProps) {
  // Separar itens por promo e itens avulsos
  const regularItems = items.filter((i) => !i.promoId);

  // Agrupar itens de combo por promoId
  const promoGroups = appliedPromos.map((promo) => {
    const promoItems = items.filter((i) => i.promoId === promo.id);
    const extrasTotal = promoItems.reduce((s, i) => s + getItemExtras(i), 0);
    return { promo, items: promoItems, extrasTotal };
  });

  // Calcular totais
  const regularSubtotal = regularItems.reduce((s, i) => s + getItemTotal(i), 0);
  const promosTotal = promoGroups.reduce(
    (s, g) => s + (g.promo.bundlePrice ?? 0) + g.extrasTotal,
    0
  );
  const grandTotal = promosTotal + regularSubtotal;

  const hasItems = items.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="text-lg font-bold">Carrinho</h2>
        {hasItems && (
          <button
            onClick={onClearCart}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-auto p-3">
        {!hasItems ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Carrinho vazio
          </p>
        ) : (
          <div className="space-y-3">
            {/* Combo Groups */}
            {promoGroups.map((group) =>
              group.items.length > 0 ? (
                <div
                  key={group.promo.id}
                  className="rounded-xl border-2 border-orange-300 bg-orange-50/50 overflow-hidden"
                >
                  {/* Combo Header */}
                  <div className="flex items-center justify-between bg-orange-100 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-bold text-orange-800">
                        {group.promo.code.replace(/-/g, " ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-orange-700">
                        {formatCurrency(group.promo.bundlePrice ?? 0)}
                      </span>
                      <button
                        onClick={() => onRemovePromo(group.promo.id)}
                        className="text-orange-400 hover:text-orange-700"
                        title="Remover combo"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Combo Items (compact, sem preco individual) */}
                  <div className="divide-y divide-orange-200 px-3">
                    {group.items.map((item) => (
                      <CartItemRow
                        key={item.id}
                        item={item}
                        onUpdateQuantity={onUpdateQuantity}
                        onRemoveItem={onRemoveItem}
                        showPrice={false}
                        compact
                      />
                    ))}
                  </div>

                  {/* Total dos adicionais */}
                  {group.extrasTotal > 0 && (
                    <div className="flex items-center justify-between border-t border-orange-200 px-3 py-1.5">
                      <span className="text-xs text-orange-600">Adicionais</span>
                      <span className="text-xs font-bold text-orange-700">
                        +{formatCurrency(group.extrasTotal)}
                      </span>
                    </div>
                  )}
                </div>
              ) : null
            )}

            {/* Regular Items (fora do combo) */}
            {regularItems.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                onUpdateQuantity={onUpdateQuantity}
                onRemoveItem={onRemoveItem}
                showPrice
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-lg font-bold">Total</span>
          <span className="text-2xl font-bold text-primary">
            {formatCurrency(grandTotal)}
          </span>
        </div>
        <button
          onClick={onCheckout}
          disabled={!hasItems}
          className="w-full rounded-lg bg-primary py-4 text-base font-semibold text-white hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50"
        >
          Finalizar Pedido
        </button>
      </div>
    </div>
  );
}
