"use client";

import { useState, useEffect } from "react";
import { X, Minus, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useCartStore } from "@/stores/cart-store";
import { QuantitySelector } from "./quantity-selector";
import { formatCurrency } from "@matrix-food/utils";

interface ProductDetailModalProps {
  productId: string;
  tenantId: string;
  onClose: () => void;
}

export function ProductDetailModal({
  productId,
  tenantId,
  onClose,
}: ProductDetailModalProps) {
  const addItem = useCartStore((s) => s.addItem);

  const { data: product, isLoading } = trpc.product.getPublic.useQuery({
    id: productId,
    tenantId,
  });

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null
  );
  const [selectedOptions, setSelectedOptions] = useState<
    Map<string, Set<string>>
  >(new Map());
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  // Ingredientes: { ingredientId → { quantity (QUANTITY type) | state (DESCRIPTION type) } }
  const [ingredientSelections, setIngredientSelections] = useState<
    Map<string, { quantity?: number; state?: string }>
  >(new Map());

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
        <div className="w-full max-w-lg rounded-t-2xl bg-white p-8 sm:rounded-2xl">
          <div className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    onClose();
    return null;
  }

  const variants = product.variants ?? [];
  const groups = product.customizationGroups ?? [];
  const productIngredients = (product as { ingredients?: Array<{
    ingredientId: string;
    ingredientName: string;
    ingredientType: "QUANTITY" | "DESCRIPTION";
    defaultQuantity: number;
    defaultState: string;
    additionalPrice: string;
  }> }).ingredients ?? [];

  // Initialize ingredient selections from defaults (once)
  useEffect(() => {
    if (productIngredients.length > 0 && ingredientSelections.size === 0) {
      const defaults = new Map<string, { quantity?: number; state?: string }>();
      productIngredients.forEach((ing) => {
        if (ing.ingredientType === "QUANTITY") {
          defaults.set(ing.ingredientId, { quantity: ing.defaultQuantity });
        } else {
          defaults.set(ing.ingredientId, { state: ing.defaultState });
        }
      });
      setIngredientSelections(defaults);
    }
  }, [productIngredients.length]);

  // Auto-select first variant
  const activeVariantId =
    selectedVariantId ?? (variants.length > 0 ? variants[0]!.id : null);
  const activeVariant = variants.find((v) => v.id === activeVariantId);

  // Calcular preço
  const basePrice = activeVariant
    ? parseFloat(activeVariant.price)
    : parseFloat(product.price);

  let customizationsPrice = 0;
  selectedOptions.forEach((optionIds, groupId) => {
    const group = groups.find((g) => g.id === groupId);
    if (group) {
      optionIds.forEach((optId) => {
        const opt = group.options.find((o) => o.id === optId);
        if (opt) customizationsPrice += parseFloat(opt.price);
      });
    }
  });

  // Calcular preço extra dos ingredientes
  let ingredientsPrice = 0;
  ingredientSelections.forEach((selection, ingredientId) => {
    const ing = productIngredients.find((i) => i.ingredientId === ingredientId);
    if (!ing) return;
    const addPrice = parseFloat(ing.additionalPrice);
    if (ing.ingredientType === "QUANTITY") {
      const chosen = selection.quantity ?? ing.defaultQuantity;
      if (chosen > ing.defaultQuantity) {
        ingredientsPrice += (chosen - ing.defaultQuantity) * addPrice;
      }
    } else {
      const chosen = selection.state ?? ing.defaultState;
      if (chosen === "MAIS") ingredientsPrice += addPrice;
      if (chosen === "COM" && ing.defaultState === "SEM") ingredientsPrice += addPrice;
    }
  });

  const totalPrice = (basePrice + customizationsPrice + ingredientsPrice) * quantity;

  function toggleOption(groupId: string, optionId: string, maxSelections: number) {
    setSelectedOptions((prev) => {
      const newMap = new Map(prev);
      const current = new Set(newMap.get(groupId) ?? []);

      if (current.has(optionId)) {
        current.delete(optionId);
      } else {
        if (maxSelections === 1) {
          current.clear();
        } else if (current.size >= maxSelections) {
          return prev; // Max reached
        }
        current.add(optionId);
      }

      newMap.set(groupId, current);
      return newMap;
    });
  }

  function handleAddToCart() {
    if (!product) return;
    const customizations = Array.from(selectedOptions.entries()).flatMap(
      ([groupId, optionIds]) => {
        const group = groups.find((g) => g.id === groupId);
        if (!group) return [];
        return Array.from(optionIds).map((optId) => {
          const opt = group.options.find((o) => o.id === optId)!;
          return {
            groupName: group.name,
            optionName: opt.name,
            optionId: opt.id,
            price: parseFloat(opt.price),
          };
        });
      }
    );

    // Build ingredient modifications for cart
    const ingredientMods: Array<{
      ingredientId: string;
      ingredientName: string;
      modification: string;
      price: number;
      quantity?: number;
      state?: string;
    }> = [];

    ingredientSelections.forEach((selection, ingredientId) => {
      const ing = productIngredients.find(
        (i) => i.ingredientId === ingredientId
      );
      if (!ing) return;
      const addPrice = parseFloat(ing.additionalPrice);

      if (ing.ingredientType === "QUANTITY") {
        const chosen = selection.quantity ?? ing.defaultQuantity;
        if (chosen === ing.defaultQuantity) return; // no change
        let modification: string;
        let price = 0;
        if (chosen === 0) {
          modification = `SEM ${ing.ingredientName}`;
        } else if (chosen > ing.defaultQuantity) {
          const diff = chosen - ing.defaultQuantity;
          modification = `+${diff} ${ing.ingredientName}`;
          price = diff * addPrice;
        } else {
          const diff = ing.defaultQuantity - chosen;
          modification = `-${diff} ${ing.ingredientName}`;
        }
        ingredientMods.push({
          ingredientId,
          ingredientName: ing.ingredientName,
          modification,
          price,
          quantity: chosen,
        });
      } else {
        const chosen = selection.state ?? ing.defaultState;
        if (chosen === ing.defaultState) return; // no change
        let price = 0;
        if (chosen === "MAIS") price = addPrice;
        if (chosen === "COM" && ing.defaultState === "SEM") price = addPrice;
        ingredientMods.push({
          ingredientId,
          ingredientName: ing.ingredientName,
          modification: `${chosen} ${ing.ingredientName}`,
          price,
          state: chosen,
        });
      }
    });

    addItem({
      productId: product.id,
      productName: product.name,
      variantId: activeVariantId,
      variantName: activeVariant?.name ?? null,
      unitPrice: basePrice,
      customizations,
      ingredientModifications: ingredientMods,
      quantity,
      notes,
    });

    onClose();
  }

  // Verificar se todos os grupos obrigatórios estão preenchidos
  const requiredGroupsMet = groups.every((group) => {
    if (!group.isRequired) return true;
    const selected = selectedOptions.get(group.id);
    return selected && selected.size >= group.minSelections;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image */}
        {product.imageUrl && (
          <div className="relative h-56 w-full">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-full w-full object-cover"
            />
            <button
              onClick={onClose}
              className="absolute right-3 top-3 rounded-full bg-white/90 p-2 shadow"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className="p-5">
          {/* Header */}
          {!product.imageUrl && (
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-xl font-bold">{product.name}</h2>
              <button onClick={onClose} className="p-1">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
          )}

          {product.imageUrl && (
            <h2 className="text-xl font-bold">{product.name}</h2>
          )}

          {product.description && (
            <p className="mt-1 text-sm text-gray-500">{product.description}</p>
          )}

          {/* Variantes */}
          {variants.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-gray-700">
                Escolha o tamanho
              </h3>
              <div className="mt-2 space-y-2">
                {variants.map((v) => (
                  <label
                    key={v.id}
                    className={`flex cursor-pointer items-center justify-between rounded-lg border-2 p-3 transition-colors ${
                      v.id === activeVariantId
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="variant"
                        checked={v.id === activeVariantId}
                        onChange={() => setSelectedVariantId(v.id)}
                        className="accent-primary"
                      />
                      <span className="font-medium">{v.name}</span>
                    </div>
                    <span className="font-semibold text-primary">
                      {formatCurrency(parseFloat(v.price))}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Grupos de personalização */}
          {groups.map((group) => (
            <div key={group.id} className="mt-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">
                  {group.name}
                </h3>
                <div className="flex items-center gap-2">
                  {group.isRequired && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                      OBRIGATÓRIO
                    </span>
                  )}
                  {group.maxSelections > 1 && (
                    <span className="text-xs text-gray-400">
                      Até {group.maxSelections}
                    </span>
                  )}
                </div>
              </div>
              {group.description && (
                <p className="mt-0.5 text-xs text-gray-400">
                  {group.description}
                </p>
              )}
              <div className="mt-2 space-y-1">
                {group.options.map((opt) => {
                  const isSelected =
                    selectedOptions.get(group.id)?.has(opt.id) ?? false;
                  const optPrice = parseFloat(opt.price);
                  return (
                    <label
                      key={opt.id}
                      className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 transition-colors ${
                        isSelected ? "bg-primary/5" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type={
                            group.maxSelections === 1 ? "radio" : "checkbox"
                          }
                          name={`group-${group.id}`}
                          checked={isSelected}
                          onChange={() =>
                            toggleOption(
                              group.id,
                              opt.id,
                              group.maxSelections
                            )
                          }
                          className="accent-primary"
                        />
                        <span className="text-sm">{opt.name}</span>
                      </div>
                      {optPrice > 0 && (
                        <span className="text-sm text-gray-500">
                          +{formatCurrency(optPrice)}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Ingredientes */}
          {productIngredients.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-gray-700">
                Ingredientes
              </h3>
              <div className="mt-2 space-y-2">
                {productIngredients.map((ing) => {
                  const selection = ingredientSelections.get(ing.ingredientId);
                  const addPrice = parseFloat(ing.additionalPrice);

                  if (ing.ingredientType === "QUANTITY") {
                    const currentQty = selection?.quantity ?? ing.defaultQuantity;
                    const extraQty = Math.max(0, currentQty - ing.defaultQuantity);
                    return (
                      <div
                        key={ing.ingredientId}
                        className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-gray-50"
                      >
                        <div>
                          <span className="text-sm">{ing.ingredientName}</span>
                          {addPrice > 0 && (
                            <span className="ml-1 text-xs text-gray-400">
                              ({formatCurrency(addPrice)}/un)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {extraQty > 0 && addPrice > 0 && (
                            <span className="text-xs text-primary font-medium">
                              +{formatCurrency(extraQty * addPrice)}
                            </span>
                          )}
                          <div className="flex items-center gap-1 rounded-full border border-gray-200">
                            <button
                              type="button"
                              onClick={() => {
                                const newMap = new Map(ingredientSelections);
                                newMap.set(ing.ingredientId, {
                                  quantity: Math.max(0, currentQty - 1),
                                });
                                setIngredientSelections(newMap);
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span
                              className={`w-6 text-center text-sm font-medium ${
                                currentQty === 0 ? "text-red-500" : ""
                              }`}
                            >
                              {currentQty}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const newMap = new Map(ingredientSelections);
                                newMap.set(ing.ingredientId, {
                                  quantity: currentQty + 1,
                                });
                                setIngredientSelections(newMap);
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // DESCRIPTION type
                  const currentState = selection?.state ?? ing.defaultState;
                  const states = ["SEM", "MENOS", "COM", "MAIS"] as const;
                  return (
                    <div
                      key={ing.ingredientId}
                      className="rounded-lg px-3 py-2.5 hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm">{ing.ingredientName}</span>
                        {addPrice > 0 &&
                          ((currentState === "MAIS") ||
                            (currentState === "COM" && ing.defaultState === "SEM")) && (
                            <span className="text-xs text-primary font-medium">
                              +{formatCurrency(addPrice)}
                            </span>
                          )}
                      </div>
                      <div className="flex gap-1">
                        {states.map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => {
                              const newMap = new Map(ingredientSelections);
                              newMap.set(ing.ingredientId, { state: st });
                              setIngredientSelections(newMap);
                            }}
                            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                              currentState === st
                                ? st === "SEM"
                                  ? "bg-red-500 text-white"
                                  : st === "MENOS"
                                    ? "bg-amber-500 text-white"
                                    : st === "COM"
                                      ? "bg-green-500 text-white"
                                      : "bg-blue-500 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Observações */}
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-gray-700">
              Alguma observação?
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Sem cebola, bem passado..."
              rows={2}
              className="mt-2 w-full rounded-lg border border-gray-200 p-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Quantidade + Adicionar */}
          <div className="mt-5 flex items-center justify-between">
            <QuantitySelector value={quantity} onChange={setQuantity} />
            <button
              onClick={handleAddToCart}
              disabled={!requiredGroupsMet}
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              Adicionar {formatCurrency(totalPrice)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
