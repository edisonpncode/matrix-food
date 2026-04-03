"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Plus, Trash2, Loader2, Ruler, Search, X } from "lucide-react";
import { ImageUploader } from "./image-uploader";

interface Variant {
  name: string;
  price: string;
  originalPrice: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface SizePriceInput {
  sizeId: string;
  sizeName: string;
  price: string;
}

interface CustomizationOption {
  name: string;
  price: string;
  sortOrder: number;
  isActive: boolean;
}

interface CustomizationGroup {
  name: string;
  description: string | null;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  sortOrder: number;
  options: CustomizationOption[];
}

interface ProductIngredientItem {
  ingredientId: string;
  ingredientName: string;
  ingredientType: "QUANTITY" | "DESCRIPTION";
  defaultQuantity: number;
  defaultState: string;
  additionalPrice: string;
  weightGrams: string | null;
  sortOrder: number;
}

interface ProductData {
  id: string;
  name: string;
  description: string | null;
  price: string;
  originalPrice: string | null;
  categoryId: string;
  imageUrl: string | null;
  isNew: boolean;
  hasVariants: boolean;
  isActive: boolean;
  variants: Variant[];
  sizePrices?: { sizeId: string; sizeName?: string; price: string }[];
  customizationGroups: (CustomizationGroup & { id?: string })[];
  ingredients?: Array<{
    ingredientId: string;
    ingredientName: string;
    ingredientType: "QUANTITY" | "DESCRIPTION";
    defaultQuantity: number;
    defaultState: string;
    additionalPrice: string;
    weightGrams: string | null;
    sortOrder: number;
  }>;
}

export function ProductForm({ product }: { product?: ProductData }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const categoriesQuery = trpc.category.listAllWithSizes.useQuery();

  const ingredientsQuery = trpc.ingredient.list.useQuery();
  const quickCreateIngredient = trpc.ingredient.create.useMutation({
    onSuccess: () => {
      utils.ingredient.list.invalidate();
    },
  });

  const isEditing = !!product;

  // Form state
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [price, setPrice] = useState(product?.price ?? "0");
  const [originalPrice, setOriginalPrice] = useState(
    product?.originalPrice ?? ""
  );
  const [imageUrl, setImageUrl] = useState<string | null>(
    product?.imageUrl ?? null
  );
  const [isNew, setIsNew] = useState(product?.isNew ?? false);
  const [hasVariants, setHasVariants] = useState(product?.hasVariants ?? false);
  const [variants, setVariants] = useState<Variant[]>(
    product?.variants ?? []
  );
  const [sizePrices, setSizePrices] = useState<SizePriceInput[]>([]);
  const [groups, setGroups] = useState<CustomizationGroup[]>(
    (product?.customizationGroups ?? []).map((g) => ({
      name: g.name,
      description: g.description || "",
      minSelections: g.minSelections,
      maxSelections: g.maxSelections,
      isRequired: g.isRequired,
      sortOrder: g.sortOrder,
      options: g.options.map((o) => ({
        name: o.name,
        price: o.price,
        sortOrder: o.sortOrder,
        isActive: o.isActive,
      })),
    }))
  );

  const [productIngredientsList, setProductIngredientsList] = useState<
    ProductIngredientItem[]
  >(
    (product?.ingredients ?? []).map((ing) => ({
      ingredientId: ing.ingredientId,
      ingredientName: ing.ingredientName,
      ingredientType: ing.ingredientType,
      defaultQuantity: ing.defaultQuantity,
      defaultState: ing.defaultState,
      additionalPrice: ing.additionalPrice,
      weightGrams: ing.weightGrams,
      sortOrder: ing.sortOrder,
    }))
  );
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [showIngredientDropdown, setShowIngredientDropdown] = useState(false);
  const [showCreateIngredientDialog, setShowCreateIngredientDialog] =
    useState(false);
  const [newIngredientName, setNewIngredientName] = useState("");
  const [newIngredientType, setNewIngredientType] = useState<
    "QUANTITY" | "DESCRIPTION"
  >("QUANTITY");

  // Detectar se a categoria selecionada tem tamanhos
  const selectedCategory = categoriesQuery.data?.find(
    (c) => c.id === categoryId
  );
  const categoryHasSizes =
    selectedCategory?.hasSizes && (selectedCategory?.sizes?.length ?? 0) > 0;

  // Quando a categoria muda, inicializar os preços por tamanho
  useEffect(() => {
    if (categoryHasSizes && selectedCategory?.sizes) {
      const existingPrices = product?.sizePrices ?? [];
      setSizePrices(
        selectedCategory.sizes.map((s) => {
          const existing = existingPrices.find((ep) => ep.sizeId === s.id);
          return {
            sizeId: s.id,
            sizeName: s.name,
            price: existing?.price ?? "0",
          };
        })
      );
    } else {
      setSizePrices([]);
    }
  }, [categoryId, categoriesQuery.data]);

  const createMutation = trpc.product.create.useMutation({
    onSuccess: () => {
      utils.product.listAll.invalidate();
      router.push("/produtos");
    },
  });

  const updateMutation = trpc.product.update.useMutation({
    onSuccess: () => {
      utils.product.listAll.invalidate();
      utils.product.getById.invalidate({ id: product!.id });
    },
  });

  const syncVariantsMutation = trpc.product.syncVariants.useMutation({
    onSuccess: () => utils.product.getById.invalidate({ id: product!.id }),
  });

  const syncSizePricesMutation = trpc.product.syncSizePrices.useMutation({
    onSuccess: () => utils.product.getById.invalidate({ id: product!.id }),
  });

  const syncCustomizationsMutation =
    trpc.product.syncCustomizations.useMutation({
      onSuccess: () => utils.product.getById.invalidate({ id: product!.id }),
    });

  const syncIngredientsMutation = trpc.product.syncIngredients.useMutation({
    onSuccess: () => utils.product.getById.invalidate({ id: product!.id }),
  });

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    syncVariantsMutation.isPending ||
    syncSizePricesMutation.isPending ||
    syncCustomizationsMutation.isPending ||
    syncIngredientsMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (isEditing) {
      // Atualizar produto base
      updateMutation.mutate({
        id: product.id,
        name,
        description: description || null,
        categoryId,
        price,
        originalPrice: originalPrice || null,
        imageUrl,
        isNew,
        hasVariants: categoryHasSizes ? false : hasVariants,
      });

      if (categoryHasSizes) {
        // Sincronizar preços por tamanho
        syncSizePricesMutation.mutate({
          productId: product.id,
          sizePrices: sizePrices.map((sp) => ({
            sizeId: sp.sizeId,
            price: sp.price,
          })),
        });
      } else if (hasVariants) {
        // Sincronizar variantes
        syncVariantsMutation.mutate({
          productId: product.id,
          variants,
        });
      }

      // Sincronizar personalizações
      const groupsForApi = groups.map((g) => ({
        ...g,
        description: g.description ?? undefined,
      }));
      syncCustomizationsMutation.mutate({
        productId: product.id,
        groups: groupsForApi,
      });

      // Sincronizar ingredientes
      syncIngredientsMutation.mutate({
        productId: product.id,
        ingredients: productIngredientsList.map((ing, i) => ({
          ingredientId: ing.ingredientId,
          defaultQuantity: ing.defaultQuantity,
          defaultState: ing.defaultState as "COM" | "SEM",
          additionalPrice: ing.additionalPrice,
          weightGrams: ing.weightGrams,
          sortOrder: i,
        })),
      });
    } else {
      const groupsForApi = groups.map((g) => ({
        ...g,
        description: g.description ?? undefined,
      }));
      createMutation.mutate({
        name,
        description: description || undefined,
        categoryId,
        price,
        originalPrice: originalPrice || undefined,
        imageUrl: imageUrl ?? undefined,
        isNew,
        hasVariants: categoryHasSizes ? false : hasVariants,
        variants: categoryHasSizes ? [] : variants,
        sizePrices: categoryHasSizes
          ? sizePrices.map((sp) => ({ sizeId: sp.sizeId, price: sp.price }))
          : [],
        customizationGroups: groupsForApi,
        ingredients: productIngredientsList.map((ing, i) => ({
          ingredientId: ing.ingredientId,
          defaultQuantity: ing.defaultQuantity,
          defaultState: ing.defaultState as "COM" | "SEM",
          additionalPrice: ing.additionalPrice,
          weightGrams: ing.weightGrams,
          sortOrder: i,
        })),
      });
    }
  }

  // --- Variants helpers ---
  function addVariant() {
    setVariants([
      ...variants,
      {
        name: "",
        price: "0",
        originalPrice: null,
        sortOrder: variants.length,
        isActive: true,
      },
    ]);
  }

  function updateVariant(
    index: number,
    field: keyof Variant,
    value: string | number | boolean
  ) {
    setVariants(
      variants.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  }

  function removeVariant(index: number) {
    setVariants(variants.filter((_, i) => i !== index));
  }

  // --- Customization groups helpers ---
  function addGroup() {
    setGroups([
      ...groups,
      {
        name: "",
        description: "",
        minSelections: 0,
        maxSelections: 5,
        isRequired: false,
        sortOrder: groups.length,
        options: [],
      },
    ]);
  }

  function updateGroup(
    index: number,
    field: keyof CustomizationGroup,
    value: string | number | boolean | CustomizationOption[]
  ) {
    setGroups(
      groups.map((g, i) => (i === index ? { ...g, [field]: value } : g))
    );
  }

  function removeGroup(index: number) {
    setGroups(groups.filter((_, i) => i !== index));
  }

  function addOption(groupIndex: number) {
    setGroups(
      groups.map((g, i) =>
        i === groupIndex
          ? {
              ...g,
              options: [
                ...g.options,
                {
                  name: "",
                  price: "0",
                  sortOrder: g.options.length,
                  isActive: true,
                },
              ],
            }
          : g
      )
    );
  }

  function updateOption(
    groupIndex: number,
    optIndex: number,
    field: keyof CustomizationOption,
    value: string | number | boolean
  ) {
    setGroups(
      groups.map((g, gi) =>
        gi === groupIndex
          ? {
              ...g,
              options: g.options.map((o, oi) =>
                oi === optIndex ? { ...o, [field]: value } : o
              ),
            }
          : g
      )
    );
  }

  function removeOption(groupIndex: number, optIndex: number) {
    setGroups(
      groups.map((g, gi) =>
        gi === groupIndex
          ? {
              ...g,
              options: g.options.filter((_, i) => i !== optIndex),
            }
          : g
      )
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      {/* Dados básicos */}
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Dados do Produto
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-foreground">
              Nome *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                categoryHasSizes
                  ? "Ex: Margherita, Calabresa, 4 Queijos"
                  : "Ex: X-Burger Clássico"
              }
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-foreground">
              Descrição
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                categoryHasSizes
                  ? "Ex: Molho de tomate, mussarela e manjericão fresco"
                  : "Descreva o produto..."
              }
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-foreground">
              Imagem
            </label>
            <ImageUploader
              value={imageUrl}
              onChange={setImageUrl}
              folder="matrix-food/products"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Categoria *
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Selecione...</option>
              {categoriesQuery.data?.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                  {cat.hasSizes ? " (com tamanhos)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isNew}
                onChange={(e) => setIsNew(e.target.checked)}
                className="rounded border-input"
              />
              <span className="font-medium text-foreground">Tag "Novo"</span>
            </label>
            {!categoryHasSizes && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hasVariants}
                  onChange={(e) => setHasVariants(e.target.checked)}
                  className="rounded border-input"
                />
                <span className="font-medium text-foreground">
                  Tem tamanhos/variantes
                </span>
              </label>
            )}
          </div>
        </div>
      </section>

      {/* Info: categoria com tamanhos */}
      {categoryHasSizes && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <Ruler className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Categoria com tamanhos
            </p>
            <p className="text-xs text-amber-600">
              Esta categoria ({selectedCategory?.name}) tem tamanhos
              pré-definidos. Defina o preço deste sabor para cada tamanho
              abaixo. Não é necessário criar variantes manualmente.
            </p>
          </div>
        </div>
      )}

      {/* Preço por tamanho (categoria com sizes) */}
      {categoryHasSizes && sizePrices.length > 0 && (
        <section className="rounded-lg border border-amber-300 bg-card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Ruler className="h-5 w-5 text-amber-600" />
            Preço por Tamanho
          </h2>
          <div className="space-y-3">
            {sizePrices.map((sp, i) => {
              const sizeInfo = selectedCategory?.sizes?.find(
                (s) => s.id === sp.sizeId
              );
              return (
                <div
                  key={sp.sizeId}
                  className="flex items-center gap-4 rounded-md border border-amber-200 bg-amber-50/30 p-3"
                >
                  <div className="flex-1">
                    <span className="text-sm font-medium text-foreground">
                      {sp.sizeName}
                    </span>
                    {sizeInfo && sizeInfo.maxFlavors > 1 && (
                      <span className="ml-2 text-xs text-amber-600">
                        (até {sizeInfo.maxFlavors} sabores)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-muted-foreground">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={sp.price}
                      onChange={(e) => {
                        const updated = [...sizePrices];
                        updated[i] = { ...sp, price: e.target.value };
                        setSizePrices(updated);
                      }}
                      className="w-24 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Quando o cliente pedir uma pizza com vários sabores, o preço será o
            do sabor mais caro selecionado.
          </p>
        </section>
      )}

      {/* Preço simples (sem variantes e sem sizes) */}
      {!hasVariants && !categoryHasSizes && (
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Preço</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Preço (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Preço original (riscado)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                placeholder="Opcional - ex: 39.90"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Se preenchido, aparece riscado ao lado do preço atual
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Variantes manuais (só se não é categoria com sizes) */}
      {hasVariants && !categoryHasSizes && (
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Variantes / Tamanhos
            </h2>
            <button
              type="button"
              onClick={addVariant}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <Plus className="h-4 w-4" /> Adicionar
            </button>
          </div>
          {variants.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma variante. Clique em "Adicionar" acima.
            </p>
          )}
          <div className="space-y-3">
            {variants.map((v, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-md border border-input p-3"
              >
                <input
                  type="text"
                  value={v.name}
                  onChange={(e) => updateVariant(i, "name", e.target.value)}
                  placeholder="Ex: Grande (8 fatias)"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={v.price}
                  onChange={(e) => updateVariant(i, "price", e.target.value)}
                  placeholder="Preço"
                  className="w-24 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeVariant(i)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Ingredientes */}
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Ingredientes
          </h2>
          <p className="text-sm text-muted-foreground">
            Ingredientes que compõem este produto (maionese, queijo, ovo, etc.)
          </p>
        </div>

        {/* Lista de ingredientes adicionados */}
        {productIngredientsList.length > 0 && (
          <div className="space-y-3 mb-4">
            {productIngredientsList.map((ing, index) => (
              <div
                key={ing.ingredientId}
                className="rounded-md border border-input p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground">
                      {ing.ingredientName}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        ing.ingredientType === "QUANTITY"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      }`}
                    >
                      {ing.ingredientType === "QUANTITY" ? "QTD" : "DESC"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setProductIngredientsList(
                        productIngredientsList.filter((_, i) => i !== index)
                      )
                    }
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  {ing.ingredientType === "QUANTITY" ? (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        Qtd padrão
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={ing.defaultQuantity}
                        onChange={(e) => {
                          const updated = [...productIngredientsList];
                          updated[index] = {
                            ...ing,
                            defaultQuantity: Number(e.target.value),
                          };
                          setProductIngredientsList(updated);
                        }}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        Padrão
                      </label>
                      <select
                        value={ing.defaultState}
                        onChange={(e) => {
                          const updated = [...productIngredientsList];
                          updated[index] = {
                            ...ing,
                            defaultState: e.target.value,
                          };
                          setProductIngredientsList(updated);
                        }}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                      >
                        <option value="COM">COM</option>
                        <option value="SEM">SEM</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Preço extra (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={ing.additionalPrice}
                      onChange={(e) => {
                        const updated = [...productIngredientsList];
                        updated[index] = {
                          ...ing,
                          additionalPrice: e.target.value,
                        };
                        setProductIngredientsList(updated);
                      }}
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Peso (g) - opcional
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={ing.weightGrams ?? ""}
                      onChange={(e) => {
                        const updated = [...productIngredientsList];
                        updated[index] = {
                          ...ing,
                          weightGrams: e.target.value || null,
                        };
                        setProductIngredientsList(updated);
                      }}
                      placeholder="Ex: 30"
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Combobox para adicionar ingrediente */}
        <div className="relative">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={ingredientSearch}
              onChange={(e) => {
                setIngredientSearch(e.target.value);
                setShowIngredientDropdown(true);
              }}
              onFocus={() => setShowIngredientDropdown(true)}
              placeholder="Buscar ou criar ingrediente..."
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {showIngredientDropdown && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
              {(() => {
                const existingIds = new Set(
                  productIngredientsList.map((pi) => pi.ingredientId)
                );
                const filtered = (ingredientsQuery.data ?? [])
                  .filter((ing) => ing.isActive)
                  .filter((ing) => !existingIds.has(ing.id))
                  .filter((ing) =>
                    ing.name
                      .toLowerCase()
                      .includes(ingredientSearch.toLowerCase())
                  );

                const exactMatch = (ingredientsQuery.data ?? []).some(
                  (ing) =>
                    ing.name.toLowerCase() ===
                    ingredientSearch.toLowerCase().trim()
                );

                return (
                  <>
                    {filtered.map((ing) => (
                      <button
                        key={ing.id}
                        type="button"
                        onClick={() => {
                          setProductIngredientsList([
                            ...productIngredientsList,
                            {
                              ingredientId: ing.id,
                              ingredientName: ing.name,
                              ingredientType: ing.type,
                              defaultQuantity:
                                ing.type === "QUANTITY" ? 1 : 0,
                              defaultState: "COM",
                              additionalPrice: "0",
                              weightGrams: null,
                              sortOrder: productIngredientsList.length,
                            },
                          ]);
                          setIngredientSearch("");
                          setShowIngredientDropdown(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                      >
                        <span>{ing.name}</span>
                        <span
                          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs ${
                            ing.type === "QUANTITY"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          }`}
                        >
                          {ing.type === "QUANTITY" ? "QTD" : "DESC"}
                        </span>
                      </button>
                    ))}
                    {filtered.length === 0 && !ingredientSearch.trim() && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        Digite para buscar ou criar
                      </div>
                    )}
                    {ingredientSearch.trim() && !exactMatch && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewIngredientName(ingredientSearch.trim());
                          setShowCreateIngredientDialog(true);
                          setShowIngredientDropdown(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-accent text-left border-t border-border"
                      >
                        <Plus className="h-4 w-4" />
                        Criar &quot;{ingredientSearch.trim()}&quot;
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Dialog para criar ingrediente inline */}
        {showCreateIngredientDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Novo Ingrediente</h3>
                <button
                  type="button"
                  onClick={() => setShowCreateIngredientDialog(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nome</label>
                  <input
                    type="text"
                    value={newIngredientName}
                    onChange={(e) => setNewIngredientName(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Tipo</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setNewIngredientType("QUANTITY")}
                      className={`flex-1 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors ${
                        newIngredientType === "QUANTITY"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input bg-background text-muted-foreground"
                      }`}
                    >
                      <div className="font-semibold text-xs">Quantidade</div>
                      <div className="text-xs mt-0.5 opacity-70">
                        ovo, queijo, bife
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewIngredientType("DESCRIPTION")}
                      className={`flex-1 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors ${
                        newIngredientType === "DESCRIPTION"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input bg-background text-muted-foreground"
                      }`}
                    >
                      <div className="font-semibold text-xs">Descrição</div>
                      <div className="text-xs mt-0.5 opacity-70">
                        maionese, milho
                      </div>
                    </button>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    disabled={
                      !newIngredientName.trim() ||
                      quickCreateIngredient.isPending
                    }
                    onClick={async () => {
                      const created = await quickCreateIngredient.mutateAsync({
                        name: newIngredientName.trim(),
                        type: newIngredientType,
                      });
                      if (created) {
                        setProductIngredientsList([
                          ...productIngredientsList,
                          {
                            ingredientId: created.id,
                            ingredientName: created.name,
                            ingredientType: created.type,
                            defaultQuantity:
                              created.type === "QUANTITY" ? 1 : 0,
                            defaultState: "COM",
                            additionalPrice: "0",
                            weightGrams: null,
                            sortOrder: productIngredientsList.length,
                          },
                        ]);
                      }
                      setShowCreateIngredientDialog(false);
                      setIngredientSearch("");
                      setNewIngredientName("");
                    }}
                    className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {quickCreateIngredient.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : (
                      "Criar"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateIngredientDialog(false)}
                    className="rounded-md border border-input px-4 py-2 text-sm font-medium text-muted-foreground"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Personalizações */}
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Personalizações
            </h2>
            <p className="text-sm text-muted-foreground">
              Adicionais, remover ingredientes, escolher molho, etc.
            </p>
          </div>
          <button
            type="button"
            onClick={addGroup}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <Plus className="h-4 w-4" /> Novo Grupo
          </button>
        </div>

        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum grupo de personalização.
          </p>
        )}

        <div className="space-y-4">
          {groups.map((group, gi) => (
            <div
              key={gi}
              className="rounded-md border border-input p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 grid gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    value={group.name}
                    onChange={(e) => updateGroup(gi, "name", e.target.value)}
                    placeholder="Nome do grupo (ex: Adicionais)"
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      value={group.minSelections}
                      onChange={(e) =>
                        updateGroup(gi, "minSelections", Number(e.target.value))
                      }
                      className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      title="Mínimo"
                    />
                    <span className="self-center text-sm text-muted-foreground">
                      a
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={group.maxSelections}
                      onChange={(e) =>
                        updateGroup(gi, "maxSelections", Number(e.target.value))
                      }
                      className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      title="Máximo"
                    />
                    <span className="self-center text-xs text-muted-foreground">
                      seleções
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeGroup(gi)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={group.isRequired}
                  onChange={(e) =>
                    updateGroup(gi, "isRequired", e.target.checked)
                  }
                />
                <span className="text-foreground">
                  Obrigatório (cliente deve escolher)
                </span>
              </label>

              {/* Opções */}
              <div className="ml-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Opções
                  </span>
                  <button
                    type="button"
                    onClick={() => addOption(gi)}
                    className="text-xs text-primary hover:underline"
                  >
                    + Opção
                  </button>
                </div>
                {group.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt.name}
                      onChange={(e) =>
                        updateOption(gi, oi, "name", e.target.value)
                      }
                      placeholder="Ex: Bacon"
                      className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={opt.price}
                        onChange={(e) =>
                          updateOption(gi, oi, "price", e.target.value)
                        }
                        className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeOption(gi, oi)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Botões */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending || !name.trim() || !categoryId}
          className="flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEditing ? "Salvar Alterações" : "Criar Produto"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/produtos")}
          className="rounded-md border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
