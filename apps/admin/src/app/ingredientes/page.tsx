"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

export default function IngredientesPage() {
  const utils = trpc.useUtils();
  const ingredientsList = trpc.ingredient.list.useQuery();
  const createMutation = trpc.ingredient.create.useMutation({
    onSuccess: () => {
      utils.ingredient.list.invalidate();
      setShowForm(false);
      resetForm();
    },
  });
  const updateMutation = trpc.ingredient.update.useMutation({
    onSuccess: () => {
      utils.ingredient.list.invalidate();
      setEditingId(null);
      resetForm();
    },
  });
  const deleteMutation = trpc.ingredient.delete.useMutation({
    onSuccess: () => {
      utils.ingredient.list.invalidate();
    },
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<"QUANTITY" | "DESCRIPTION">("QUANTITY");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setType("QUANTITY");
  }

  function startEdit(ingredient: {
    id: string;
    name: string;
    type: "QUANTITY" | "DESCRIPTION";
  }) {
    setEditingId(ingredient.id);
    setName(ingredient.name);
    setType(ingredient.type);
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingId) {
      updateMutation.mutate({ id: editingId, name: name.trim(), type });
    } else {
      createMutation.mutate({ name: name.trim(), type });
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ingredientes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie os ingredientes compartilhados entre seus produtos
          </p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo Ingrediente
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingId ? "Editar Ingrediente" : "Novo Ingrediente"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Nome
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Queijo, Maionese, Ovo..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Tipo
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setType("QUANTITY")}
                  className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
                    type === "QUANTITY"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <div className="font-semibold">Quantidade</div>
                  <div className="text-xs mt-1 opacity-70">
                    Para itens contáveis: ovo, queijo, bife
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setType("DESCRIPTION")}
                  className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
                    type === "DESCRIPTION"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <div className="font-semibold">Descrição</div>
                  <div className="text-xs mt-1 opacity-70">
                    Para itens descritivos: maionese, milho, ervilha
                  </div>
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
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
                className="rounded-md border border-input px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="rounded-lg border border-border bg-card">
        {ingredientsList.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !ingredientsList.data?.length ? (
          <div className="py-12 text-center text-muted-foreground">
            <p>Nenhum ingrediente cadastrado</p>
            <p className="text-sm mt-1">
              Clique em &quot;Novo Ingrediente&quot; para começar
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {ingredientsList.data
              .filter((ing) => ing.isActive)
              .map((ingredient) => (
                <div
                  key={ingredient.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-foreground">
                      {ingredient.name}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        ingredient.type === "QUANTITY"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      }`}
                    >
                      {ingredient.type === "QUANTITY"
                        ? "Quantidade"
                        : "Descrição"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {ingredient.productCount}{" "}
                      {ingredient.productCount === 1 ? "produto" : "produtos"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(ingredient)}
                      className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {deleteConfirmId === ingredient.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            deleteMutation.mutate({ id: ingredient.id });
                            setDeleteConfirmId(null);
                          }}
                          className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(ingredient.id)}
                        className="rounded-md p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                        title="Desativar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
