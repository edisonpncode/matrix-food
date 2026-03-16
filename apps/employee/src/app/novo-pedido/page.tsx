"use client";

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";
import { POSCart, type POSCartItem } from "@/components/pos-cart";
import { POSCheckoutModal } from "@/components/pos-checkout-modal";
import { Minus, Plus, X } from "lucide-react";

interface ProductVariant {
  id: string;
  name: string;
  price: string;
}

interface CustomizationOption {
  id: string;
  name: string;
  price: string;
}

interface CustomizationGroup {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  options: CustomizationOption[];
}

interface Product {
  id: string;
  name: string;
  price: string;
  imageUrl: string | null;
  categoryId: string;
  variants: ProductVariant[];
  customizationGroups: CustomizationGroup[];
}

export default function NovoPedidoPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<POSCartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [selectedCustomizations, setSelectedCustomizations] = useState<
    Record<string, string[]>
  >({});
  const [quantity, setQuantity] = useState(1);

  const { data: categories } = trpc.category.list.useQuery();
  const { data: products } = trpc.product.list.useQuery();

  const createOrder = trpc.order.createFromPOS.useMutation({
    onSuccess: (data) => {
      alert(`Pedido ${data.displayNumber} criado com sucesso!`);
      setCartItems([]);
      setShowCheckout(false);
    },
  });

  const filteredProducts = selectedCategory
    ? products?.filter((p) => p.categoryId === selectedCategory)
    : products;

  function handleSelectProduct(product: Product) {
    if (
      product.variants.length === 0 &&
      product.customizationGroups.length === 0
    ) {
      // Simple product - add directly
      addToCart(product, null, null, []);
    } else {
      // Has variants or customizations - open modal
      setSelectedProduct(product);
      setSelectedVariant(
        product.variants.length > 0 ? product.variants[0]!.id : null
      );
      setSelectedCustomizations({});
      setQuantity(1);
    }
  }

  function addToCart(
    product: Product,
    variantId: string | null,
    variantName: string | null,
    customizations: POSCartItem["customizations"]
  ) {
    const variant = variantId
      ? product.variants.find((v) => v.id === variantId)
      : null;
    const unitPrice = variant
      ? parseFloat(variant.price)
      : parseFloat(product.price);

    const newItem: POSCartItem = {
      id: `${product.id}-${variantId ?? "base"}-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      variantId,
      variantName: variantName ?? variant?.name ?? null,
      unitPrice,
      quantity,
      customizations,
    };

    setCartItems((prev) => [...prev, newItem]);
    setSelectedProduct(null);
    setQuantity(1);
  }

  function handleAddFromModal() {
    if (!selectedProduct) return;

    const variant = selectedVariant
      ? selectedProduct.variants.find((v) => v.id === selectedVariant)
      : null;

    const customizations: POSCartItem["customizations"] = [];
    for (const [groupId, optionIds] of Object.entries(
      selectedCustomizations
    )) {
      const group = selectedProduct.customizationGroups.find(
        (g) => g.id === groupId
      );
      if (!group) continue;
      for (const optionId of optionIds) {
        const option = group.options.find((o) => o.id === optionId);
        if (!option) continue;
        customizations.push({
          optionId: option.id,
          groupName: group.name,
          optionName: option.name,
          price: parseFloat(option.price),
        });
      }
    }

    addToCart(
      selectedProduct,
      selectedVariant,
      variant?.name ?? null,
      customizations
    );
  }

  function toggleCustomization(groupId: string, optionId: string, maxSelections: number) {
    setSelectedCustomizations((prev) => {
      const current = prev[groupId] ?? [];
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      }
      if (maxSelections === 1) {
        return { ...prev, [groupId]: [optionId] };
      }
      if (current.length >= maxSelections) return prev;
      return { ...prev, [groupId]: [...current, optionId] };
    });
  }

  const handleUpdateQuantity = useCallback(
    (itemId: string, qty: number) => {
      if (qty <= 0) {
        setCartItems((prev) => prev.filter((i) => i.id !== itemId));
      } else {
        setCartItems((prev) =>
          prev.map((i) => (i.id === itemId ? { ...i, quantity: qty } : i))
        );
      }
    },
    []
  );

  const handleRemoveItem = useCallback((itemId: string) => {
    setCartItems((prev) => prev.filter((i) => i.id !== itemId));
  }, []);

  function handleCheckout(data: {
    type: "DELIVERY" | "PICKUP" | "DINE_IN";
    paymentMethod: "PIX" | "CASH" | "CREDIT_CARD" | "DEBIT_CARD";
    customerName: string;
    changeFor: string | null;
  }) {
    createOrder.mutate({
      type: data.type,
      customerName: data.customerName,
      customerPhone: "",
      paymentMethod: data.paymentMethod,
      changeFor: data.changeFor,
      items: cartItems.map((item) => ({
        productId: item.productId,
        productVariantId: item.variantId,
        quantity: item.quantity,
        customizations: item.customizations.map((c) => ({
          customizationGroupName: c.groupName,
          customizationOptionName: c.optionName,
          optionId: c.optionId,
        })),
      })),
    });
  }

  const cartTotal = cartItems.reduce((sum, item) => {
    const customizationsTotal = item.customizations.reduce(
      (s, c) => s + c.price,
      0
    );
    return sum + (item.unitPrice + customizationsTotal) * item.quantity;
  }, 0);

  return (
    <div className="-m-6 flex h-screen">
      {/* Products Area */}
      <div className="flex-1 overflow-auto p-6">
        <h1 className="mb-4 text-2xl font-bold">Novo Pedido</h1>

        {/* Category Tabs */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              selectedCategory === null
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-accent-foreground hover:bg-accent/80"
            }`}
          >
            Todos
          </button>
          {categories?.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                selectedCategory === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-accent-foreground hover:bg-accent/80"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filteredProducts?.map((product) => (
            <button
              key={product.id}
              onClick={() => handleSelectProduct(product as Product)}
              className="flex flex-col items-center rounded-xl border-2 border-border bg-card p-4 text-center transition-all hover:border-primary hover:shadow-md active:scale-95"
            >
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="mb-2 h-16 w-16 rounded-lg object-cover"
                />
              ) : (
                <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-lg bg-accent text-2xl">
                  🍔
                </div>
              )}
              <span className="text-sm font-medium leading-tight">
                {product.name}
              </span>
              <span className="mt-1 text-sm font-bold text-primary">
                {product.variants.length > 0
                  ? `${formatCurrency(parseFloat(product.variants[0]!.price))}`
                  : formatCurrency(parseFloat(product.price))}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-80 flex-shrink-0">
        <POSCart
          items={cartItems}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onClearCart={() => setCartItems([])}
          onCheckout={() => setShowCheckout(true)}
        />
      </div>

      {/* Product Detail Modal (variants/customizations) */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{selectedProduct.name}</h3>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Variants */}
            {selectedProduct.variants.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-sm font-medium">Tamanho</p>
                <div className="flex flex-wrap gap-2">
                  {selectedProduct.variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(v.id)}
                      className={`rounded-lg border-2 px-4 py-2 text-sm font-medium ${
                        selectedVariant === v.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border"
                      }`}
                    >
                      {v.name} - {formatCurrency(parseFloat(v.price))}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Customizations */}
            {selectedProduct.customizationGroups.map((group) => (
              <div key={group.id} className="mb-4">
                <p className="mb-2 text-sm font-medium">
                  {group.name}
                  {group.isRequired && (
                    <span className="ml-1 text-xs text-red-500">
                      *obrigatório
                    </span>
                  )}
                </p>
                <div className="space-y-1">
                  {group.options.map((option) => {
                    const isSelected = (
                      selectedCustomizations[group.id] ?? []
                    ).includes(option.id);
                    return (
                      <button
                        key={option.id}
                        onClick={() =>
                          toggleCustomization(
                            group.id,
                            option.id,
                            group.maxSelections
                          )
                        }
                        className={`flex w-full items-center justify-between rounded-lg border-2 px-3 py-2 text-sm ${
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "border-border"
                        }`}
                      >
                        <span>{option.name}</span>
                        {parseFloat(option.price) > 0 && (
                          <span className="text-muted-foreground">
                            +{formatCurrency(parseFloat(option.price))}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Quantity */}
            <div className="mb-4 flex items-center justify-center gap-4">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-lg border-2 hover:bg-accent"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="text-xl font-bold">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border-2 hover:bg-accent"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Add Button */}
            <button
              onClick={handleAddFromModal}
              className="w-full rounded-lg bg-primary py-3 text-base font-semibold text-white hover:bg-primary/90"
            >
              Adicionar ao Carrinho
            </button>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <POSCheckoutModal
          total={cartTotal}
          onConfirm={handleCheckout}
          onClose={() => setShowCheckout(false)}
          isLoading={createOrder.isPending}
        />
      )}
    </div>
  );
}
