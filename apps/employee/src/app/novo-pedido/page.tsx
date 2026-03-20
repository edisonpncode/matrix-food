"use client";

import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";
import { POSCart, type POSCartItem } from "@/components/pos-cart";
import { POSCheckoutModal } from "@/components/pos-checkout-modal";
import { Minus, Plus, X, Package, Tag, Gift, Calendar, Clock } from "lucide-react";

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

interface SizePrice {
  id: string;
  sizeId: string;
  price: string;
  sizeName: string;
  maxFlavors: number;
}

interface Product {
  id: string;
  name: string;
  price: string;
  imageUrl: string | null;
  categoryId: string;
  variants: ProductVariant[];
  customizationGroups: CustomizationGroup[];
  sizePrices: SizePrice[];
}

interface ComboPromo {
  id: string;
  code: string;
  description: string | null;
  type: string;
  bundlePrice: string | null;
  daysOfWeek: number[] | null;
  timeStart: string | null;
  timeEnd: string | null;
  items: {
    productId: string | null;
    categoryId: string | null;
    quantity: number;
    role: string;
    productName: string | null;
    categoryName: string | null;
  }[];
}

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

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
  const [appliedPromos, setAppliedPromos] = useState<{
    id: string;
    code: string;
    description: string;
    discount: number;
    bundlePrice?: number;
  }[]>([]);
  const [showPromos, setShowPromos] = useState(false);
  const [choiceCombo, setChoiceCombo] = useState<NonNullable<typeof promos>[number] | null>(null);
  const [choiceSelections, setChoiceSelections] = useState<Record<string, number>>({});

  // Pizza sizes & flavors
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(null);
  const [pizzaFlavors, setPizzaFlavors] = useState<
    { productId: string; productName: string; sizePrice: number }[]
  >([]);

  // Fluxo de personalização do combo (item por item)
  const [comboQueue, setComboQueue] = useState<{
    promo: NonNullable<typeof promos>[number];
    promoInstanceId: string;
    pendingItems: { product: Product; index: number; total: number }[];
    completedItems: POSCartItem[];
  } | null>(null);
  const [comboCustomizing, setComboCustomizing] = useState<{
    product: Product;
    index: number;
    total: number;
    selectedVariant: string | null;
    selectedCustomizations: Record<string, string[]>;
  } | null>(null);

  const { data: categories } = trpc.category.listAll.useQuery();
  const { data: products } = trpc.product.listForPOS.useQuery();
  const { data: promos } = trpc.promotion.list.useQuery();

  const createOrder = trpc.order.createFromPOS.useMutation({
    onSuccess: (data) => {
      alert(`Pedido ${data.displayNumber} criado com sucesso!`);
      setCartItems([]);
      setShowCheckout(false);
      setAppliedPromos([]);
    },
  });

  // Filtrar promoções ativas e válidas para hoje
  const activePromos = useMemo(() => {
    if (!promos) return [];
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    return promos.filter((p) => {
      if (!p.isActive) return false;
      if (p.endDate && new Date(p.endDate) < now) return false;
      if (p.startDate && new Date(p.startDate) > now) return false;
      if (p.daysOfWeek && (p.daysOfWeek as number[]).length > 0) {
        if (!(p.daysOfWeek as number[]).includes(currentDay)) return false;
      }
      if (p.timeStart && p.timeEnd) {
        if (currentTime < p.timeStart || currentTime > p.timeEnd) return false;
      }
      return true;
    });
  }, [promos]);

  const filteredProducts = selectedCategory
    ? products?.filter((p) => p.categoryId === selectedCategory)
    : products;

  function handleSelectProduct(product: Product) {
    // Products with sizePrices always open modal
    if (product.sizePrices && product.sizePrices.length > 0) {
      setSelectedProduct(product);
      setSelectedSizeId(product.sizePrices[0]!.id);
      setSelectedVariant(null);
      setSelectedCustomizations({});
      setQuantity(1);
      // Pre-select this product as first flavor
      const firstSize = product.sizePrices[0]!;
      setPizzaFlavors([
        {
          productId: product.id,
          productName: product.name,
          sizePrice: parseFloat(firstSize.price),
        },
      ]);
      return;
    }

    if (
      product.variants.length === 0 &&
      product.customizationGroups.length === 0
    ) {
      addToCart(product, null, null, []);
    } else {
      setSelectedProduct(product);
      setSelectedVariant(
        product.variants.length > 0 ? product.variants[0]!.id : null
      );
      setSelectedCustomizations({});
      setQuantity(1);
      setSelectedSizeId(null);
      setPizzaFlavors([]);
    }
  }

  function addToCart(
    product: Product,
    variantId: string | null,
    variantName: string | null,
    customizations: POSCartItem["customizations"],
    options?: {
      sizeName?: string;
      sizePrice?: number;
      flavorNames?: string[];
      displayName?: string;
    }
  ) {
    let unitPrice: number;

    if (options?.sizePrice != null) {
      unitPrice = options.sizePrice;
    } else {
      const variant = variantId
        ? product.variants.find((v) => v.id === variantId)
        : null;
      unitPrice = variant
        ? parseFloat(variant.price)
        : parseFloat(product.price);
    }

    const newItem: POSCartItem = {
      id: `${product.id}-${variantId ?? "base"}-${Date.now()}`,
      productId: product.id,
      productName: options?.displayName ?? product.name,
      variantId,
      variantName: variantName ?? null,
      unitPrice,
      quantity,
      customizations,
      sizeName: options?.sizeName,
      flavorNames: options?.flavorNames,
    };

    setCartItems((prev) => [...prev, newItem]);
    setSelectedProduct(null);
    setSelectedSizeId(null);
    setPizzaFlavors([]);
    setQuantity(1);
  }

  // Aplicar combo: adiciona todos os itens do combo ao carrinho
  function applyCombo(promo: NonNullable<typeof promos>[number]) {
    if (!products) return;

    // Se tem itens CHOICE, abre modal de seleção
    const hasChoiceItems = (promo.items || []).some((i) => i.role === "CHOICE");
    if (hasChoiceItems && promo.maxChoices) {
      setChoiceCombo(promo);
      setChoiceSelections({});
      setShowPromos(false);
      return;
    }

    // Combo simples: adiciona todos os itens REQUIRED
    applyComboDirectly(promo, {});
  }

  function applyComboDirectly(
    promo: NonNullable<typeof promos>[number],
    choices: Record<string, number>
  ) {
    if (!products) return;

    // Montar lista de produtos para personalizar (um por um)
    const pendingItems: { product: Product; index: number; total: number }[] = [];
    let counter = 0;

    // Itens REQUIRED
    for (const item of promo.items || []) {
      if (item.role === "CHOICE") continue;

      let product: Product | undefined;
      if (item.productId) {
        product = products.find((p) => p.id === item.productId) as Product | undefined;
      } else if (item.categoryId) {
        product = products.find((p) => p.categoryId === item.categoryId) as Product | undefined;
      }

      if (product) {
        for (let i = 0; i < item.quantity; i++) {
          counter++;
          pendingItems.push({ product, index: counter, total: 0 });
        }
      }
    }

    // Itens CHOICE selecionados
    for (const [productId, qty] of Object.entries(choices)) {
      if (qty <= 0) continue;
      const product = products.find((p) => p.id === productId) as Product | undefined;
      if (product) {
        for (let i = 0; i < qty; i++) {
          counter++;
          pendingItems.push({ product, index: counter, total: 0 });
        }
      }
    }

    // Atualizar total em cada item
    pendingItems.forEach((item) => {
      item.total = counter;
    });

    if (pendingItems.length === 0) return;

    // Gerar ID único para esta instância de promo
    const promoInstanceId = `promo-${promo.id}-${Date.now()}`;

    // Iniciar fluxo de personalização
    setComboQueue({
      promo,
      promoInstanceId,
      pendingItems: pendingItems.slice(1), // restantes
      completedItems: [],
    });

    // Abrir personalização do primeiro item
    const first = pendingItems[0]!;
    setComboCustomizing({
      product: first.product,
      index: first.index,
      total: first.total,
      selectedVariant:
        first.product.variants.length > 0 ? first.product.variants[0]!.id : null,
      selectedCustomizations: {},
    });

    setChoiceCombo(null);
    setChoiceSelections({});
    setShowPromos(false);
  }

  // Confirmar personalização de um item do combo e ir pro próximo
  function confirmComboItem() {
    if (!comboCustomizing || !comboQueue) return;

    const { product, selectedVariant: sv, selectedCustomizations: sc } = comboCustomizing;

    const variant = sv ? product.variants.find((v) => v.id === sv) : null;
    const unitPrice = variant ? parseFloat(variant.price) : parseFloat(product.price);

    const customizations: POSCartItem["customizations"] = [];
    for (const [groupId, optionIds] of Object.entries(sc)) {
      const group = product.customizationGroups.find((g) => g.id === groupId);
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

    // Gerar ID único para esta aplicação de promo
    const promoInstanceId = comboQueue.promoInstanceId;

    const newItem: POSCartItem = {
      id: `combo-${product.id}-${Date.now()}-${comboCustomizing.index}`,
      productId: product.id,
      productName: product.name,
      variantId: sv,
      variantName: variant?.name ?? null,
      unitPrice,
      quantity: 1,
      customizations,
      promoId: promoInstanceId,
    };

    const updatedCompleted = [...comboQueue.completedItems, newItem];

    if (comboQueue.pendingItems.length > 0) {
      // Próximo item
      const [next, ...rest] = comboQueue.pendingItems;
      setComboQueue({
        ...comboQueue,
        pendingItems: rest,
        completedItems: updatedCompleted,
      });
      setComboCustomizing({
        product: next!.product,
        index: next!.index,
        total: next!.total,
        selectedVariant:
          next!.product.variants.length > 0
            ? next!.product.variants[0]!.id
            : null,
        selectedCustomizations: {},
      });
    } else {
      // Todos os itens customizados - adicionar ao carrinho (sem substituir)
      setCartItems((prev) => [...prev, ...updatedCompleted]);

      const subtotal = updatedCompleted.reduce((s, i) => {
        const custTotal = i.customizations.reduce((cs, c) => cs + c.price, 0);
        return s + (i.unitPrice + custTotal) * i.quantity;
      }, 0);
      const bundlePrice = comboQueue.promo.bundlePrice
        ? parseFloat(comboQueue.promo.bundlePrice)
        : subtotal;
      const discount = Math.max(0, subtotal - bundlePrice);

      setAppliedPromos((prev) => [
        ...prev,
        {
          id: promoInstanceId,
          code: comboQueue.promo.code,
          description:
            comboQueue.promo.description || `Combo ${comboQueue.promo.code}`,
          discount,
          bundlePrice,
        },
      ]);

      setComboQueue(null);
      setComboCustomizing(null);
    }
  }

  // Pular personalização (adicionar sem customizações)
  function skipComboItemCustomization() {
    if (!comboCustomizing || !comboQueue) return;
    // Limpar customizações e confirmar
    setComboCustomizing((prev) =>
      prev ? { ...prev, selectedCustomizations: {} } : null
    );
    // Pequeno delay para o state atualizar — ou chamar direto
    confirmComboItem();
  }

  function toggleComboCustomization(
    groupId: string,
    optionId: string,
    maxSelections: number
  ) {
    if (!comboCustomizing) return;
    setComboCustomizing((prev) => {
      if (!prev) return prev;
      const current = prev.selectedCustomizations[groupId] ?? [];
      let updated: string[];
      if (current.includes(optionId)) {
        updated = current.filter((id) => id !== optionId);
      } else if (maxSelections === 1) {
        updated = [optionId];
      } else if (current.length >= maxSelections) {
        return prev;
      } else {
        updated = [...current, optionId];
      }
      return {
        ...prev,
        selectedCustomizations: {
          ...prev.selectedCustomizations,
          [groupId]: updated,
        },
      };
    });
  }

  // Funções para o modal de escolha
  function getChoiceTotalQty() {
    return Object.values(choiceSelections).reduce((s, q) => s + q, 0);
  }

  function updateChoice(productId: string, delta: number) {
    if (!choiceCombo) return;
    const maxChoices = choiceCombo.maxChoices ?? 0;
    const currentTotal = getChoiceTotalQty();

    setChoiceSelections((prev) => {
      const current = prev[productId] ?? 0;
      const newQty = current + delta;
      if (newQty < 0) return prev;
      if (delta > 0 && currentTotal >= maxChoices) return prev;
      if (newQty === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: newQty };
    });
  }

  // Produtos elegíveis para CHOICE do combo ativo
  const choiceProducts = useMemo(() => {
    if (!choiceCombo || !products) return [];
    const choiceItems = (choiceCombo.items || []).filter((i) => i.role === "CHOICE");

    const eligibleProducts: Product[] = [];
    for (const item of choiceItems) {
      if (item.productId) {
        const p = products.find((pr) => pr.id === item.productId) as Product | undefined;
        if (p && !eligibleProducts.find((ep) => ep.id === p.id)) {
          eligibleProducts.push(p);
        }
      } else if (item.categoryId) {
        const catProducts = products.filter((pr) => pr.categoryId === item.categoryId) as Product[];
        for (const p of catProducts) {
          if (!eligibleProducts.find((ep) => ep.id === p.id)) {
            eligibleProducts.push(p);
          }
        }
      }
    }
    return eligibleProducts;
  }, [choiceCombo, products]);

  function handleAddFromModal() {
    if (!selectedProduct) return;

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

    // Pizza with sizePrices flow
    if (selectedProduct.sizePrices && selectedProduct.sizePrices.length > 0 && selectedSizeId) {
      const selectedSize = selectedProduct.sizePrices.find(
        (sp) => sp.id === selectedSizeId
      );
      if (!selectedSize) return;

      const flavorNames = pizzaFlavors.map((f) => f.productName);
      // Price = highest price among all selected flavors for the chosen size
      const highestPrice = Math.max(...pizzaFlavors.map((f) => f.sizePrice));

      const displayName =
        pizzaFlavors.length > 1
          ? `Pizza ${selectedSize.sizeName} - ${flavorNames.join(", ")}`
          : selectedProduct.name;

      addToCart(selectedProduct, null, null, customizations, {
        sizeName: selectedSize.sizeName,
        sizePrice: highestPrice,
        flavorNames: flavorNames.length > 1 ? flavorNames : undefined,
        displayName,
      });
      return;
    }

    // Normal variant flow
    const variant = selectedVariant
      ? selectedProduct.variants.find((v) => v.id === selectedVariant)
      : null;

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

  // Calcular totais separando combo de regular (mesma lógica do POSCart)
  const getItemTotal = (item: POSCartItem) => {
    const custTotal = item.customizations.reduce((s, c) => s + c.price, 0);
    return (item.unitPrice + custTotal) * item.quantity;
  };

  const regularItems = cartItems.filter((i) => !i.promoId);
  const regularSubtotal = regularItems.reduce((s, i) => s + getItemTotal(i), 0);

  // Total de todas as promos: preço base + adicionais de cada
  const promosTotal = appliedPromos.reduce((total, promo) => {
    const promoItems = cartItems.filter((i) => i.promoId === promo.id);
    const extrasTotal = promoItems.reduce(
      (s, i) => s + i.customizations.reduce((cs, c) => cs + c.price, 0) * i.quantity,
      0
    );
    return total + (promo.bundlePrice ?? 0) + extrasTotal;
  }, 0);

  const finalTotal = promosTotal + regularSubtotal;

  return (
    <div className="-m-6 flex h-screen">
      {/* Products Area */}
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Novo Pedido</h1>

          {/* Promos Button */}
          {activePromos.length > 0 && (
            <button
              onClick={() => setShowPromos(true)}
              className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 animate-pulse"
            >
              <Tag className="h-4 w-4" />
              {activePromos.length} Promo{activePromos.length > 1 ? "s" : ""} Ativa{activePromos.length > 1 ? "s" : ""}
            </button>
          )}
        </div>

        {/* Active Promos Banner */}
        {activePromos.length > 0 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {activePromos
              .filter((p) => p.type === "COMBO" || p.type === "BUY_X_GET_Y")
              .map((promo) => (
                <button
                  key={promo.id}
                  onClick={() => applyCombo(promo)}
                  className="flex-shrink-0 flex items-center gap-2 rounded-xl border-2 border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-medium text-orange-800 transition-all hover:border-orange-500 hover:bg-orange-100 hover:shadow-md active:scale-95"
                >
                  <Package className="h-4 w-4 text-orange-600" />
                  <div className="text-left">
                    <div className="font-bold">{promo.code.replace(/-/g, " ")}</div>
                    <div className="text-xs text-orange-600">
                      {promo.description || ""}
                      {promo.bundlePrice &&
                        ` — ${formatCurrency(parseFloat(promo.bundlePrice))}`}
                    </div>
                  </div>
                </button>
              ))}
          </div>
        )}

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
                {(product as Product).sizePrices && (product as Product).sizePrices.length > 0
                  ? `A partir de ${formatCurrency(
                      Math.min(
                        ...(product as Product).sizePrices.map((sp) =>
                          parseFloat(sp.price)
                        )
                      )
                    )}`
                  : product.variants.length > 0
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
          appliedPromos={appliedPromos}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onClearCart={() => {
            setCartItems([]);
            setAppliedPromos([]);
          }}
          onCheckout={() => setShowCheckout(true)}
          onRemovePromo={(promoId) => {
            // Remover a promo e seus itens do carrinho
            setAppliedPromos((prev) => prev.filter((p) => p.id !== promoId));
            setCartItems((prev) => prev.filter((i) => i.promoId !== promoId));
          }}
        />
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (() => {
        const hasSizes = selectedProduct.sizePrices && selectedProduct.sizePrices.length > 0;
        const currentSize = hasSizes
          ? selectedProduct.sizePrices.find((sp) => sp.id === selectedSizeId)
          : null;
        const currentMaxFlavors = currentSize?.maxFlavors ?? 1;
        // Products from the same category that also have sizePrices (for multi-flavor)
        const sameCategoryPizzas = hasSizes && currentMaxFlavors > 1 && products
          ? (products as Product[]).filter(
              (p) =>
                p.categoryId === selectedProduct.categoryId &&
                p.id !== selectedProduct.id &&
                p.sizePrices &&
                p.sizePrices.length > 0
            )
          : [];
        // Calculate current display price
        const displayPrice = hasSizes && currentSize
          ? pizzaFlavors.length > 0
            ? Math.max(...pizzaFlavors.map((f) => f.sizePrice))
            : parseFloat(currentSize.price)
          : selectedVariant
            ? parseFloat(
                selectedProduct.variants.find((v) => v.id === selectedVariant)?.price ?? selectedProduct.price
              )
            : parseFloat(selectedProduct.price);

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl max-h-[90vh] flex flex-col">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{selectedProduct.name}</h3>
              <button
                onClick={() => {
                  setSelectedProduct(null);
                  setSelectedSizeId(null);
                  setPizzaFlavors([]);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Size Prices (Pizza) */}
              {hasSizes && (
                <div className="mb-4">
                  <p className="mb-2 text-sm font-medium">Tamanho</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.sizePrices.map((sp) => (
                      <button
                        key={sp.id}
                        onClick={() => {
                          setSelectedSizeId(sp.id);
                          // Update current product's sizePrice in flavors and reset extra flavors
                          setPizzaFlavors([
                            {
                              productId: selectedProduct.id,
                              productName: selectedProduct.name,
                              sizePrice: parseFloat(sp.price),
                            },
                          ]);
                        }}
                        className={`rounded-lg border-2 px-4 py-2 text-sm font-medium ${
                          selectedSizeId === sp.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border"
                        }`}
                      >
                        {sp.sizeName} - {formatCurrency(parseFloat(sp.price))}
                        {sp.maxFlavors > 1 && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (até {sp.maxFlavors} sabores)
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Multi-flavor section (Pizza) */}
              {hasSizes && currentMaxFlavors > 1 && (
                <div className="mb-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium">
                      Sabores (máx {currentMaxFlavors})
                    </p>
                    <span
                      className={`text-xs font-bold ${
                        pizzaFlavors.length >= currentMaxFlavors
                          ? "text-green-600"
                          : "text-muted-foreground"
                      }`}
                    >
                      {pizzaFlavors.length} / {currentMaxFlavors}
                    </span>
                  </div>

                  {/* Current product (flavor #1, always selected) */}
                  <div className="mb-1 flex w-full items-center justify-between rounded-lg border-2 border-primary bg-primary/10 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-white">
                        1
                      </div>
                      <span className="font-medium">{selectedProduct.name}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {formatCurrency(parseFloat(currentSize!.price))}
                    </span>
                  </div>

                  {/* Other products from same category */}
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {sameCategoryPizzas.map((p) => {
                      const isFlavorSelected = pizzaFlavors.some(
                        (f) => f.productId === p.id
                      );
                      // Find the same size for this product
                      const matchingSize = currentSize
                        ? p.sizePrices.find(
                            (sp) => sp.sizeId === currentSize.sizeId
                          )
                        : null;
                      if (!matchingSize) return null;

                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            if (isFlavorSelected) {
                              // Remove flavor
                              setPizzaFlavors((prev) =>
                                prev.filter((f) => f.productId !== p.id)
                              );
                            } else if (pizzaFlavors.length < currentMaxFlavors) {
                              // Add flavor
                              setPizzaFlavors((prev) => [
                                ...prev,
                                {
                                  productId: p.id,
                                  productName: p.name,
                                  sizePrice: parseFloat(matchingSize.price),
                                },
                              ]);
                            }
                          }}
                          disabled={
                            !isFlavorSelected &&
                            pizzaFlavors.length >= currentMaxFlavors
                          }
                          className={`flex w-full items-center justify-between rounded-lg border-2 px-3 py-2 text-sm transition-colors ${
                            isFlavorSelected
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50 disabled:opacity-40"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isFlavorSelected && (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-white">
                                {pizzaFlavors.findIndex(
                                  (f) => f.productId === p.id
                                ) + 1}
                              </div>
                            )}
                            <span>{p.name}</span>
                          </div>
                          <span className="text-muted-foreground">
                            {formatCurrency(parseFloat(matchingSize.price))}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Price info */}
                  {pizzaFlavors.length > 1 && (
                    <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Preço = maior valor entre os sabores:{" "}
                      <span className="font-bold">
                        {formatCurrency(
                          Math.max(...pizzaFlavors.map((f) => f.sizePrice))
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Regular Variants (non-pizza) */}
              {!hasSizes && selectedProduct.variants.length > 0 && (
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

              {/* Customization Groups */}
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
            </div>

            {/* Quantity + Add button */}
            <div className="mt-4">
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

              <button
                onClick={handleAddFromModal}
                className="w-full rounded-lg bg-primary py-3 text-base font-semibold text-white hover:bg-primary/90"
              >
                Adicionar ao Carrinho — {formatCurrency(displayPrice * quantity)}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Promos Modal */}
      {showPromos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Promoções Ativas Hoje</h3>
              <button
                onClick={() => setShowPromos(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[60vh] space-y-3 overflow-y-auto">
              {activePromos.map((promo) => {
                const isCombo = promo.type === "COMBO" || promo.type === "BUY_X_GET_Y";
                const daysText = promo.daysOfWeek
                  ? (promo.daysOfWeek as number[]).map((d) => DAY_NAMES[d]).join(", ")
                  : "Todos os dias";

                return (
                  <div
                    key={promo.id}
                    className="rounded-xl border-2 border-border bg-card p-4 transition-all hover:border-primary"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          {isCombo ? (
                            <Package className="h-5 w-5 text-orange-600" />
                          ) : promo.type === "BUY_X_GET_Y" ? (
                            <Gift className="h-5 w-5 text-pink-600" />
                          ) : (
                            <Tag className="h-5 w-5 text-purple-600" />
                          )}
                          <span className="font-bold">
                            {promo.code.replace(/-/g, " ")}
                          </span>
                        </div>

                        {promo.description && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {promo.description}
                          </p>
                        )}

                        {/* Itens do combo */}
                        {promo.items && promo.items.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {promo.items.map((item, idx) => (
                              <span
                                key={idx}
                                className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                                  item.role === "FREE"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {item.quantity}x{" "}
                                {item.productName || item.categoryName || "Item"}
                                {item.role === "FREE" && " 🎁"}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                          {promo.bundlePrice && (
                            <span className="font-bold text-green-600">
                              {formatCurrency(parseFloat(promo.bundlePrice))}
                            </span>
                          )}
                          {!isCombo && promo.type === "PERCENTAGE" && (
                            <span className="font-bold text-green-600">
                              {promo.value}% OFF
                            </span>
                          )}
                          {!isCombo && promo.type === "FIXED_AMOUNT" && (
                            <span className="font-bold text-green-600">
                              -{formatCurrency(parseFloat(promo.value))}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {daysText}
                          </span>
                          {promo.timeStart && promo.timeEnd && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {promo.timeStart}-{promo.timeEnd}
                            </span>
                          )}
                        </div>
                      </div>

                      {isCombo && (
                        <button
                          onClick={() => applyCombo(promo)}
                          className="flex-shrink-0 rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600"
                        >
                          Aplicar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {activePromos.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma promoção ativa no momento
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Combo Item Customization Modal */}
      {comboCustomizing && comboQueue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
            {/* Header com progresso */}
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-primary">
                    Item {comboCustomizing.index} de{" "}
                    {comboCustomizing.total} — {comboQueue.promo.code.replace(/-/g, " ")}
                  </p>
                  <h3 className="text-lg font-bold">
                    {comboCustomizing.product.name}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setComboCustomizing(null);
                    setComboQueue(null);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {/* Progress bar */}
              <div className="mt-2 h-1.5 rounded-full bg-accent">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${(comboCustomizing.index / comboCustomizing.total) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="max-h-[55vh] overflow-y-auto">
              {/* Variants */}
              {comboCustomizing.product.variants.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-sm font-medium">Tamanho</p>
                  <div className="flex flex-wrap gap-2">
                    {comboCustomizing.product.variants.map((v) => (
                      <button
                        key={v.id}
                        onClick={() =>
                          setComboCustomizing((prev) =>
                            prev ? { ...prev, selectedVariant: v.id } : prev
                          )
                        }
                        className={`rounded-lg border-2 px-4 py-2 text-sm font-medium ${
                          comboCustomizing.selectedVariant === v.id
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

              {/* Customization Groups */}
              {comboCustomizing.product.customizationGroups.map((group) => (
                <div key={group.id} className="mb-4">
                  <p className="mb-2 text-sm font-medium">
                    {group.name}
                    {group.isRequired && (
                      <span className="ml-1 text-xs text-red-500">
                        *obrigatório
                      </span>
                    )}
                    <span className="ml-1 text-xs text-muted-foreground">
                      (máx {group.maxSelections})
                    </span>
                  </p>
                  <div className="space-y-1">
                    {group.options.map((option) => {
                      const isSelected = (
                        comboCustomizing.selectedCustomizations[group.id] ?? []
                      ).includes(option.id);
                      return (
                        <button
                          key={option.id}
                          onClick={() =>
                            toggleComboCustomization(
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

              {/* Se não tem personalizações */}
              {comboCustomizing.product.customizationGroups.length === 0 &&
                comboCustomizing.product.variants.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Este item não possui personalizações
                  </p>
                )}
            </div>

            {/* Botões */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={confirmComboItem}
                className="flex-1 rounded-lg bg-primary py-3 text-base font-semibold text-white hover:bg-primary/90"
              >
                {comboCustomizing.index < comboCustomizing.total
                  ? `Confirmar → Próximo (${comboCustomizing.index + 1}/${comboCustomizing.total})`
                  : "Confirmar e Finalizar Combo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Choice Combo Modal */}
      {choiceCombo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  {choiceCombo.code.replace(/-/g, " ")}
                </h3>
                {choiceCombo.description && (
                  <p className="text-sm text-muted-foreground">
                    {choiceCombo.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => setChoiceCombo(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-3 flex items-center justify-between rounded-lg bg-orange-50 px-4 py-2">
              <span className="text-sm font-medium text-orange-800">
                Escolha {choiceCombo.maxChoices} itens
              </span>
              <span
                className={`text-sm font-bold ${
                  getChoiceTotalQty() === (choiceCombo.maxChoices ?? 0)
                    ? "text-green-600"
                    : "text-orange-600"
                }`}
              >
                {getChoiceTotalQty()} / {choiceCombo.maxChoices}
              </span>
            </div>

            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {choiceProducts.map((product) => {
                const qty = choiceSelections[product.id] ?? 0;
                return (
                  <div
                    key={product.id}
                    className={`flex items-center justify-between rounded-xl border-2 p-3 transition-colors ${
                      qty > 0 ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-xl">
                          🍔
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(parseFloat(product.price))}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateChoice(product.id, -1)}
                        disabled={qty === 0}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-accent disabled:opacity-30"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-bold">
                        {qty}
                      </span>
                      <button
                        onClick={() => updateChoice(product.id, 1)}
                        disabled={
                          getChoiceTotalQty() >= (choiceCombo.maxChoices ?? 0)
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-accent disabled:opacity-30"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {choiceCombo.bundlePrice && (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-green-50 px-4 py-2">
                <span className="text-sm font-medium text-green-800">
                  Preço do combo
                </span>
                <span className="text-lg font-bold text-green-700">
                  {formatCurrency(parseFloat(choiceCombo.bundlePrice))}
                </span>
              </div>
            )}

            <button
              onClick={() =>
                applyComboDirectly(choiceCombo, choiceSelections)
              }
              disabled={
                getChoiceTotalQty() !== (choiceCombo.maxChoices ?? 0)
              }
              className="mt-4 w-full rounded-lg bg-primary py-3 text-base font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {getChoiceTotalQty() === (choiceCombo.maxChoices ?? 0)
                ? "Adicionar ao Carrinho"
                : `Selecione mais ${(choiceCombo.maxChoices ?? 0) - getChoiceTotalQty()} item(ns)`}
            </button>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <POSCheckoutModal
          total={finalTotal}
          onConfirm={handleCheckout}
          onClose={() => setShowCheckout(false)}
          isLoading={createOrder.isPending}
        />
      )}
    </div>
  );
}
