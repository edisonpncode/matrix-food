"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
  Loader2,
  Ruler,
} from "lucide-react";
import { ImageUploader } from "@/components/admin/image-uploader";

interface SizeInput {
  name: string;
  maxFlavors: number;
  sortOrder: number;
}

export default function CategoriasPage() {
  const utils = trpc.useUtils();
  const categories = trpc.category.listAllWithSizes.useQuery();
  const createMutation = trpc.category.create.useMutation({
    onSuccess: () => {
      utils.category.listAllWithSizes.invalidate();
      utils.category.listAll.invalidate();
      setShowForm(false);
      resetForm();
    },
  });
  const updateMutation = trpc.category.update.useMutation({
    onSuccess: () => {
      utils.category.listAllWithSizes.invalidate();
      utils.category.listAll.invalidate();
      setEditingId(null);
      resetForm();
    },
  });
  const deleteMutation = trpc.category.delete.useMutation({
    onSuccess: () => {
      utils.category.listAllWithSizes.invalidate();
      utils.category.listAll.invalidate();
    },
  });
  const syncSizesMutation = trpc.category.syncSizes.useMutation({
    onSuccess: () => {
      utils.category.listAllWithSizes.invalidate();
    },
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [hasSizes, setHasSizes] = useState(false);
  const [sizes, setSizes] = useState<SizeInput[]>([]);

  function resetForm() {
    setName("");
    setDescription("");
    setImageUrl(null);
    setHasSizes(false);
    setSizes([]);
  }

  function startEdit(cat: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    hasSizes: boolean;
    sizes: { name: string; maxFlavors: number; sortOrder: number }[];
  }) {
    setEditingId(cat.id);
    setName(cat.name);
    setDescription(cat.description ?? "");
    setImageUrl(cat.imageUrl ?? null);
    setHasSizes(cat.hasSizes);
    setSizes(
      cat.sizes.map((s) => ({
        name: s.name,
        maxFlavors: s.maxFlavors,
        sortOrder: s.sortOrder,
      }))
    );
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, name, description, imageUrl, hasSizes });
      // Sincronizar tamanhos
      if (hasSizes) {
        syncSizesMutation.mutate({ categoryId: editingId, sizes });
      } else {
        syncSizesMutation.mutate({ categoryId: editingId, sizes: [] });
      }
    } else {
      createMutation.mutate({
        name,
        description,
        imageUrl: imageUrl ?? undefined,
        sortOrder: categories.data?.length ?? 0,
        hasSizes,
        sizes: hasSizes ? sizes : undefined,
      });
    }
  }

  function handleToggleActive(id: string, isActive: boolean) {
    updateMutation.mutate({ id, isActive: !isActive });
  }

  function handleDelete(id: string, catName: string) {
    if (
      confirm(
        `Tem certeza que deseja excluir a categoria "${catName}"? Todos os produtos dela também serão excluídos.`
      )
    ) {
      deleteMutation.mutate({ id });
    }
  }

  function addSize() {
    setSizes([
      ...sizes,
      { name: "", maxFlavors: 1, sortOrder: sizes.length },
    ]);
  }

  function updateSize(
    index: number,
    field: keyof SizeInput,
    value: string | number
  ) {
    setSizes(
      sizes.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }

  function removeSize(index: number) {
    setSizes(sizes.filter((_, i) => i !== index));
  }

  const isLoading =
    createMutation.isPending ||
    updateMutation.isPending ||
    syncSizesMutation.isPending;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categorias</h1>
          <p className="mt-1 text-muted-foreground">
            Organize seu cardápio em categorias
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            resetForm();
          }}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Nova Categoria
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 rounded-lg border border-border bg-card p-4"
        >
          <h3 className="mb-3 font-semibold text-foreground">
            {editingId ? "Editar Categoria" : "Nova Categoria"}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Nome *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Pizzas"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Descrição
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: As melhores pizzas da cidade"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-foreground">
                Imagem
              </label>
              <ImageUploader
                value={imageUrl}
                onChange={setImageUrl}
                folder="matrix-food/categories"
              />
            </div>

            {/* Toggle Tamanhos */}
            <div className="sm:col-span-2">
              <label className="flex items-center gap-3 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasSizes}
                  onChange={(e) => setHasSizes(e.target.checked)}
                  className="rounded border-input h-4 w-4"
                />
                <div>
                  <span className="font-medium text-foreground">
                    Categoria com tamanhos
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Ative para categorias como Pizza, onde cada tamanho tem um
                    preço diferente e permite mixar sabores (ex: Pizza Grande com
                    até 3 sabores)
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Tamanhos */}
          {hasSizes && (
            <div className="mt-4 rounded-md border border-amber-300 bg-amber-50/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ruler className="h-4 w-4 text-amber-600" />
                  <h4 className="font-semibold text-amber-800">
                    Tamanhos da Categoria
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={addSize}
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Plus className="h-4 w-4" /> Adicionar Tamanho
                </button>
              </div>

              {sizes.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum tamanho adicionado. Ex: Pequena, Média, Grande,
                  Gigante.
                </p>
              )}

              <div className="space-y-2">
                {sizes.map((size, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-md border border-amber-200 bg-white p-3"
                  >
                    <input
                      type="text"
                      value={size.name}
                      onChange={(e) => updateSize(i, "name", e.target.value)}
                      placeholder="Ex: Grande (8 fatias)"
                      className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    />
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs text-muted-foreground whitespace-nowrap">
                        Máx. sabores:
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={size.maxFlavors}
                        onChange={(e) =>
                          updateSize(i, "maxFlavors", Number(e.target.value))
                        }
                        className="w-14 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-center"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSize(i)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {sizes.length > 0 && (
                <p className="mt-2 text-xs text-amber-600">
                  Os produtos desta categoria terão preços individuais para cada
                  tamanho. O "Máx. sabores" define quantos sabores o cliente pode
                  escolher (ex: Pizza Grande = 3 sabores).
                </p>
              )}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Salvar" : "Criar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                resetForm();
              }}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista de categorias */}
      <div className="mt-6 space-y-2">
        {categories.isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {categories.data?.length === 0 && (
          <div className="rounded-lg border border-dashed border-border py-12 text-center">
            <p className="text-muted-foreground">
              Nenhuma categoria criada ainda.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Clique em "Nova Categoria" para começar.
            </p>
          </div>
        )}

        {categories.data?.map((cat) => (
          <div
            key={cat.id}
            className={`flex items-center gap-3 rounded-lg border border-border bg-card p-4 ${
              !cat.isActive ? "opacity-60" : ""
            }`}
          >
            <GripVertical className="h-5 w-5 shrink-0 cursor-grab text-muted-foreground" />

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-foreground">{cat.name}</h3>
                {cat.hasSizes && (
                  <span className="flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    <Ruler className="h-3 w-3" />
                    {cat.sizes.length} tamanho{cat.sizes.length !== 1 ? "s" : ""}
                  </span>
                )}
                {!cat.isActive && (
                  <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    Inativa
                  </span>
                )}
              </div>
              {cat.description && (
                <p className="text-sm text-muted-foreground">
                  {cat.description}
                </p>
              )}
              {cat.hasSizes && cat.sizes.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {cat.sizes.map((s) => (
                    <span
                      key={s.id}
                      className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700"
                    >
                      {s.name}{" "}
                      <span className="text-amber-500">
                        ({s.maxFlavors} sabor{s.maxFlavors > 1 ? "es" : ""})
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handleToggleActive(cat.id, cat.isActive)}
                className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                title={cat.isActive ? "Desativar" : "Ativar"}
              >
                {cat.isActive ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => startEdit(cat)}
                className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(cat.id, cat.name)}
                className="rounded-md p-2 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                title="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
