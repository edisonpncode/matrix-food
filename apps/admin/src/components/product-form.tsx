"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Plus, Trash2, Loader2, GripVertical } from "lucide-react";

interface Variant {
  name: string;
  price: string;
  originalPrice: string | null;
  sortOrder: number;
  isActive: boolean;
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
  customizationGroups: (CustomizationGroup & { id?: string })[];
}

export function ProductForm({ product }: { product?: ProductData }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const categories = trpc.category.listAll.useQuery();

  const isEditing = !!product;

  // Form state
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [price, setPrice] = useState(product?.price ?? "0");
  const [originalPrice, setOriginalPrice] = useState(
    product?.originalPrice ?? ""
  );
  const [isNew, setIsNew] = useState(product?.isNew ?? false);
  const [hasVariants, setHasVariants] = useState(product?.hasVariants ?? false);
  const [variants, setVariants] = useState<Variant[]>(
    product?.variants ?? []
  );
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

  const syncCustomizationsMutation =
    trpc.product.syncCustomizations.useMutation({
      onSuccess: () => utils.product.getById.invalidate({ id: product!.id }),
    });

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    syncVariantsMutation.isPending ||
    syncCustomizationsMutation.isPending;

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
        isNew,
        hasVariants,
      });
      // Sincronizar variantes
      syncVariantsMutation.mutate({
        productId: product.id,
        variants,
      });
      // Sincronizar personalizações
      const groupsForApi = groups.map((g) => ({
        ...g,
        description: g.description ?? undefined,
      }));
      syncCustomizationsMutation.mutate({
        productId: product.id,
        groups: groupsForApi,
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
        isNew,
        hasVariants,
        variants,
        customizationGroups: groupsForApi,
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

  function updateVariant(index: number, field: keyof Variant, value: string | number | boolean) {
    setVariants(variants.map((v, i) => i === index ? { ...v, [field]: value } : v));
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
    setGroups(groups.map((g, i) => i === index ? { ...g, [field]: value } : g));
  }

  function removeGroup(index: number) {
    setGroups(groups.filter((_, i) => i !== index));
  }

  function addOption(groupIndex: number) {
    setGroups(groups.map((g, i) => i === groupIndex ? {
      ...g,
      options: [...g.options, { name: "", price: "0", sortOrder: g.options.length, isActive: true }],
    } : g));
  }

  function updateOption(
    groupIndex: number,
    optIndex: number,
    field: keyof CustomizationOption,
    value: string | number | boolean
  ) {
    setGroups(groups.map((g, gi) => gi === groupIndex ? {
      ...g,
      options: g.options.map((o, oi) => oi === optIndex ? { ...o, [field]: value } : o),
    } : g));
  }

  function removeOption(groupIndex: number, optIndex: number) {
    setGroups(groups.map((g, gi) => gi === groupIndex ? {
      ...g,
      options: g.options.filter((_, i) => i !== optIndex),
    } : g));
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
              placeholder="Ex: X-Burger Clássico"
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
              placeholder="Descreva o produto..."
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
              {categories.data?.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
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
              <span className="font-medium text-foreground">
                Tag "Novo"
              </span>
            </label>
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
          </div>
        </div>
      </section>

      {/* Preço (só se não tem variantes) */}
      {!hasVariants && (
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

      {/* Variantes */}
      {hasVariants && (
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
