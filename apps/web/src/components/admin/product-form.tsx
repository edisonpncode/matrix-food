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
  pointsPrice: number | null;
  sortOrder: number;
  isActive: boolean;
}

interface SizePriceInput {
  sizeId: string;
  sizeName: string;
  price: string;
  pointsPrice: number | null;
}


interface ProductIngredientItem {
  ingredientId: string;
  ingredientName: string;
  ingredientType: "QUANTITY" | "DESCRIPTION";
  defaultQuantity: number;
  maxQuantity: number | null;
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
  pointsPrice: number | null;
  categoryId: string;
  imageUrl: string | null;
  isNew: boolean;
  hasVariants: boolean;
  isActive: boolean;
  variants: Variant[];
  sizePrices?: { sizeId: string; sizeName?: string; price: string; pointsPrice: number | null }[];
  ingredients?: Array<{
    ingredientId: string;
    ingredientName: string;
    ingredientType: "QUANTITY" | "DESCRIPTION";
    defaultQuantity: number;
    maxQuantity: number | null;
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

  // Buscar config de fidelidade pra decidir se mostra campos de pontos
  const loyaltyConfigQuery = trpc.loyalty.getConfig.useQuery();
  const loyaltyEnabled = loyaltyConfigQuery.data?.isActive ?? false;
  const pointsLabel = loyaltyConfigQuery.data?.pointsName ?? "Pontos";

  // Form state
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [price, setPrice] = useState(product?.price ?? "0");
  const [originalPrice, setOriginalPrice] = useState(
    product?.originalPrice ?? ""
  );
  const [pointsPrice, setPointsPrice] = useState<string>(
    product?.pointsPrice != null ? String(product.pointsPrice) : ""
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

  const [productIngredientsList, setProductIngredientsList] = useState<
    ProductIngredientItem[]
  >(
    (product?.ingredients ?? []).map((ing) => ({
      ingredientId: ing.ingredientId,
      ingredientName: ing.ingredientName,
      ingredientType: ing.ingredientType,
      defaultQuantity: ing.defaultQuantity,
      maxQuantity: ing.maxQuantity,
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
            pointsPrice: existing?.pointsPrice ?? null,
          };
        })
      );
    } else {
      setSizePrices([]);
    }
  }, [categoryId, categoriesQuery.data]);

  const createMutation = trpc.product.create.useMutation();
  const updateMutation = trpc.product.update.useMutation();
  const syncVariantsMutation = trpc.product.syncVariants.useMutation();
  const syncSizePricesMutation = trpc.product.syncSizePrices.useMutation();
  const syncIngredientsMutation = trpc.product.syncIngredients.useMutation();

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    syncVariantsMutation.isPending ||
    syncSizePricesMutation.isPending ||
    syncIngredientsMutation.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const pointsPriceParsed = pointsPrice ? parseInt(pointsPrice, 10) : null;
    const cleanPoints = pointsPriceParsed && pointsPriceParsed > 0 ? pointsPriceParsed : null;

    try {
      if (isEditing) {
        const promises: Promise<unknown>[] = [
          updateMutation.mutateAsync({
            id: product.id,
            name,
            description: description || null,
            categoryId,
            price,
            originalPrice: originalPrice || null,
            pointsPrice: loyaltyEnabled ? cleanPoints : null,
            imageUrl,
            isNew,
            hasVariants: categoryHasSizes ? false : hasVariants,
          }),
        ];

        if (categoryHasSizes) {
          promises.push(
            syncSizePricesMutation.mutateAsync({
              productId: product.id,
              sizePrices: sizePrices.map((sp) => ({
                sizeId: sp.sizeId,
                price: sp.price,
                pointsPrice: loyaltyEnabled ? sp.pointsPrice : null,
              })),
            })
          );
        } else if (hasVariants) {
          promises.push(
            syncVariantsMutation.mutateAsync({
              productId: product.id,
              variants: variants.map((v) => ({
                ...v,
                pointsPrice: loyaltyEnabled ? v.pointsPrice : null,
              })),
            })
          );
        }

        promises.push(
          syncIngredientsMutation.mutateAsync({
            productId: product.id,
            ingredients: productIngredientsList.map((ing, i) => ({
              ingredientId: ing.ingredientId,
              defaultQuantity: ing.defaultQuantity,
              maxQuantity: ing.ingredientType === "QUANTITY" ? ing.maxQuantity : null,
              defaultState: (ing.defaultState === "SEM" ? "SEM" : "COM") as "COM" | "SEM",
              additionalPrice: ing.additionalPrice,
              weightGrams: ing.weightGrams,
              sortOrder: i,
            })),
          })
        );

        await Promise.all(promises);
        utils.product.listAll.invalidate();
        utils.product.getById.invalidate({ id: product.id });
      } else {
        await createMutation.mutateAsync({
          name,
          description: description || undefined,
          categoryId,
          price,
          originalPrice: originalPrice || undefined,
          pointsPrice: loyaltyEnabled ? cleanPoints : null,
          imageUrl: imageUrl ?? undefined,
          isNew,
          hasVariants: categoryHasSizes ? false : hasVariants,
          variants: categoryHasSizes
            ? []
            : variants.map((v) => ({
                ...v,
                pointsPrice: loyaltyEnabled ? v.pointsPrice : null,
              })),
          sizePrices: categoryHasSizes
            ? sizePrices.map((sp) => ({
                sizeId: sp.sizeId,
                price: sp.price,
                pointsPrice: loyaltyEnabled ? sp.pointsPrice : null,
              }))
            : [],
          ingredients: productIngredientsList.map((ing, i) => ({
            ingredientId: ing.ingredientId,
            defaultQuantity: ing.defaultQuantity,
            maxQuantity: ing.ingredientType === "QUANTITY" ? ing.maxQuantity : null,
            defaultState: (ing.defaultState === "SEM" ? "SEM" : "COM") as "COM" | "SEM",
            additionalPrice: ing.additionalPrice,
            weightGrams: ing.weightGrams,
            sortOrder: i,
          })),
        });
        utils.product.listAll.invalidate();
      }

      router.push("/restaurante/admin/produtos");
    } catch (err) {
      console.error("Erro ao salvar produto:", err);
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
        pointsPrice: null,
        sortOrder: variants.length,
        isActive: true,
      },
    ]);
  }

  function updateVariant(
    index: number,
    field: keyof Variant,
    value: string | number | boolean | null
  ) {
    setVariants(
      variants.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  }

  function removeVariant(index: number) {
    setVariants(variants.filter((_, i) => i !== index));
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
                  className="flex flex-wrap items-center gap-4 rounded-md border border-amber-200 bg-amber-50/30 p-3"
                >
                  <div className="min-w-[140px] flex-1">
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
                  {loyaltyEnabled && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-muted-foreground">{pointsLabel}</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={sp.pointsPrice ?? ""}
                        onChange={(e) => {
                          const updated = [...sizePrices];
                          updated[i] = {
                            ...sp,
                            pointsPrice: e.target.value
                              ? parseInt(e.target.value, 10)
                              : null,
                          };
                          setSizePrices(updated);
                        }}
                        placeholder="Opcional"
                        className="w-24 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Quando o cliente pedir uma pizza com vários sabores, o preço será o
            do sabor mais caro selecionado.
            {loyaltyEnabled && ` Preencha "${pointsLabel}" para permitir resgate por fidelidade.`}
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
                Preço (R$) {loyaltyEnabled && pointsPrice ? "" : "*"}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {loyaltyEnabled && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Deixe 0 se o produto só pode ser comprado com pontos
                </p>
              )}
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
            {loyaltyEnabled && (
              <div className="sm:col-span-2 mt-2 border-t border-border pt-4">
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Valor em {pointsLabel.toLowerCase()} (opcional)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={pointsPrice}
                  onChange={(e) => setPointsPrice(e.target.value)}
                  placeholder={`Ex: 500 ${pointsLabel.toLowerCase()}`}
                  className="w-40 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Se preenchido, cliente pode trocar este produto pelo seu saldo de fidelidade.
                </p>
              </div>
            )}
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
                className="flex flex-wrap items-center gap-3 rounded-md border border-input p-3"
              >
                <input
                  type="text"
                  value={v.name}
                  onChange={(e) => updateVariant(i, "name", e.target.value)}
                  placeholder="Ex: Grande (8 fatias)"
                  className="min-w-[140px] flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                />
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={v.price}
                    onChange={(e) => updateVariant(i, "price", e.target.value)}
                    placeholder="Preço"
                    className="w-24 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  />
                </div>
                {loyaltyEnabled && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{pointsLabel}</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={v.pointsPrice ?? ""}
                      onChange={(e) =>
                        updateVariant(
                          i,
                          "pointsPrice",
                          e.target.value ? parseInt(e.target.value, 10) : null
                        )
                      }
                      placeholder="Opcional"
                      className="w-24 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    />
                  </div>
                )}
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
          {loyaltyEnabled && variants.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Variante com {pointsLabel.toLowerCase()} preenchidos pode ser resgatada pelo cliente.
              Deixe R$ 0 se a variante só aceita {pointsLabel.toLowerCase()}.
            </p>
          )}
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
                      {ing.ingredientType === "QUANTITY" ? "Quantidade" : "Descrição"}
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

                <div className="flex flex-wrap gap-3">
                  {ing.ingredientType === "QUANTITY" ? (
                    <>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground whitespace-nowrap">
                          Qtd padrao
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={ing.defaultQuantity}
                          onChange={(e) => {
                            setProductIngredientsList((prev) =>
                              prev.map((item, i) =>
                                i === index
                                  ? { ...item, defaultQuantity: parseInt(e.target.value) || 0 }
                                  : item
                              )
                            );
                          }}
                          className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm text-center"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label
                          className="text-xs text-muted-foreground whitespace-nowrap"
                          title="Quantidade maxima que o cliente pode pedir (incluindo o que ja vai por padrao). Deixe vazio para nao limitar."
                        >
                          Qtd max
                        </label>
                        <input
                          type="number"
                          min={ing.defaultQuantity || 0}
                          value={ing.maxQuantity ?? ""}
                          placeholder="—"
                          onChange={(e) => {
                            const raw = e.target.value;
                            const parsed = raw === "" ? null : parseInt(raw);
                            setProductIngredientsList((prev) =>
                              prev.map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      maxQuantity:
                                        parsed === null || Number.isNaN(parsed)
                                          ? null
                                          : parsed,
                                    }
                                  : item
                              )
                            );
                          }}
                          className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm text-center"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground whitespace-nowrap">
                        Padrao
                      </label>
                      <select
                        value={ing.defaultState}
                        onChange={(e) => {
                          setProductIngredientsList((prev) =>
                            prev.map((item, i) =>
                              i === index
                                ? { ...item, defaultState: e.target.value }
                                : item
                            )
                          );
                        }}
                        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                      >
                        <option value="COM">COM</option>
                        <option value="SEM">SEM</option>
                      </select>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">
                      Preco extra (R$)
                    </label>
                    <input
                      type="text"
                      value={ing.additionalPrice}
                      onChange={(e) => {
                        setProductIngredientsList((prev) =>
                          prev.map((item, i) =>
                            i === index
                              ? { ...item, additionalPrice: e.target.value }
                              : item
                          )
                        );
                      }}
                      className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm text-center"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">
                      Peso (g)
                    </label>
                    <input
                      type="text"
                      value={ing.weightGrams ?? ""}
                      onChange={(e) => {
                        setProductIngredientsList((prev) =>
                          prev.map((item, i) =>
                            i === index
                              ? { ...item, weightGrams: e.target.value || null }
                              : item
                          )
                        );
                      }}
                      className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm text-center"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Buscar e adicionar ingrediente */}
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={ingredientSearch}
                onChange={(e) => {
                  setIngredientSearch(e.target.value);
                  setShowIngredientDropdown(true);
                }}
                onFocus={() => setShowIngredientDropdown(true)}
                placeholder="Buscar ingrediente..."
                className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm"
              />
            </div>
          </div>

          {showIngredientDropdown && ingredientSearch.trim() && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card shadow-lg max-h-48 overflow-y-auto">
              {(() => {
                const addedIds = new Set(
                  productIngredientsList.map((pi) => pi.ingredientId)
                );
                const filtered = (ingredientsQuery.data ?? [])
                  .filter(
                    (ing) =>
                      ing.isActive &&
                      !addedIds.has(ing.id) &&
                      ing.name
                        .toLowerCase()
                        .includes(ingredientSearch.toLowerCase())
                  );

                const exactMatch = (ingredientsQuery.data ?? []).some(
                  (ing) =>
                    ing.name.toLowerCase() ===
                    ingredientSearch.trim().toLowerCase()
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
                              maxQuantity: null,
                              defaultState:
                                ing.type === "DESCRIPTION" ? "COM" : "COM",
                              additionalPrice: "0",
                              weightGrams: null,
                              sortOrder: productIngredientsList.length,
                            },
                          ]);
                          setIngredientSearch("");
                          setShowIngredientDropdown(false);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-accent"
                      >
                        <span>{ing.name}</span>
                        <span
                          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            ing.type === "QUANTITY"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          }`}
                        >
                          {ing.type === "QUANTITY" ? "Quantidade" : "Descrição"}
                        </span>
                      </button>
                    ))}
                    {filtered.length === 0 && !exactMatch && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewIngredientName(ingredientSearch.trim());
                          setShowCreateIngredientDialog(true);
                          setShowIngredientDropdown(false);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-primary hover:bg-accent"
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
      </section>

      {/* Dialog para criar ingrediente */}
      {showCreateIngredientDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Novo Ingrediente</h3>
              <button
                type="button"
                onClick={() => setShowCreateIngredientDialog(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
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
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Tipo</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setNewIngredientType("QUANTITY")}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      newIngredientType === "QUANTITY"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input bg-background text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <div className="font-semibold">Quantidade</div>
                    <div className="text-xs mt-1 opacity-70">ovo, queijo, bife</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewIngredientType("DESCRIPTION")}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      newIngredientType === "DESCRIPTION"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input bg-background text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <div className="font-semibold">Descricao</div>
                    <div className="text-xs mt-1 opacity-70">maionese, milho</div>
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={quickCreateIngredient.isPending || !newIngredientName.trim()}
                  onClick={async () => {
                    const result = await quickCreateIngredient.mutateAsync({
                      name: newIngredientName.trim(),
                      type: newIngredientType,
                    });
                    if (result) {
                      setProductIngredientsList([
                        ...productIngredientsList,
                        {
                          ingredientId: result.id,
                          ingredientName: result.name,
                          ingredientType: result.type,
                          defaultQuantity:
                            result.type === "QUANTITY" ? 1 : 0,
                          maxQuantity: null,
                          defaultState:
                            result.type === "DESCRIPTION" ? "COM" : "COM",
                          additionalPrice: "0",
                          weightGrams: null,
                          sortOrder: productIngredientsList.length,
                        },
                      ]);
                    }
                    setShowCreateIngredientDialog(false);
                    setIngredientSearch("");
                  }}
                  className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {quickCreateIngredient.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Criar
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateIngredientDialog(false)}
                  className="rounded-md border border-input px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
          onClick={() => router.push("/restaurante/admin/produtos")}
          className="rounded-md border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
