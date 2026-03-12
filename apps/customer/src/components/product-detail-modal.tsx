"use client";

import { useState } from "react";
import { X } from "lucide-react";
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

  const totalPrice = (basePrice + customizationsPrice) * quantity;

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

    addItem({
      productId: product.id,
      productName: product.name,
      variantId: activeVariantId,
      variantName: activeVariant?.name ?? null,
      unitPrice: basePrice,
      customizations,
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
