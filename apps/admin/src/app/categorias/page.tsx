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
} from "lucide-react";

export default function CategoriasPage() {
  const utils = trpc.useUtils();
  const categories = trpc.category.listAll.useQuery();
  const createMutation = trpc.category.create.useMutation({
    onSuccess: () => {
      utils.category.listAll.invalidate();
      setShowForm(false);
      resetForm();
    },
  });
  const updateMutation = trpc.category.update.useMutation({
    onSuccess: () => {
      utils.category.listAll.invalidate();
      setEditingId(null);
      resetForm();
    },
  });
  const deleteMutation = trpc.category.delete.useMutation({
    onSuccess: () => utils.category.listAll.invalidate(),
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function resetForm() {
    setName("");
    setDescription("");
  }

  function startEdit(cat: { id: string; name: string; description: string | null }) {
    setEditingId(cat.id);
    setName(cat.name);
    setDescription(cat.description ?? "");
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, name, description });
    } else {
      createMutation.mutate({
        name,
        description,
        sortOrder: (categories.data?.length ?? 0),
      });
    }
  }

  function handleToggleActive(id: string, isActive: boolean) {
    updateMutation.mutate({ id, isActive: !isActive });
  }

  function handleDelete(id: string, name: string) {
    if (confirm(`Tem certeza que deseja excluir a categoria "${name}"? Todos os produtos dela também serão excluídos.`)) {
      deleteMutation.mutate({ id });
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending;

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
                placeholder="Ex: Hambúrgueres"
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
                placeholder="Ex: Os melhores hambúrgueres artesanais"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
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
