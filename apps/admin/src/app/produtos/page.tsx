"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Tag,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

export default function ProdutosPage() {
  const utils = trpc.useUtils();
  const categories = trpc.category.listAll.useQuery();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(
    undefined
  );
  const products = trpc.product.listAll.useQuery({
    categoryId: selectedCategory,
  });

  const deleteMutation = trpc.product.delete.useMutation({
    onSuccess: () => utils.product.listAll.invalidate(),
  });
  const updateMutation = trpc.product.update.useMutation({
    onSuccess: () => utils.product.listAll.invalidate(),
  });

  function handleDelete(id: string, name: string) {
    if (confirm(`Excluir o produto "${name}"?`)) {
      deleteMutation.mutate({ id });
    }
  }

  function handleToggleActive(id: string, isActive: boolean) {
    updateMutation.mutate({ id, isActive: !isActive });
  }

  function formatPrice(price: string) {
    return Number(price).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
          <p className="mt-1 text-muted-foreground">
            Gerencie os itens do seu cardápio
          </p>
        </div>
        <Link
          href="/produtos/novo"
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo Produto
        </Link>
      </div>

      {/* Filtro por categoria */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedCategory(undefined)}
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            !selectedCategory
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          Todos
        </button>
        {categories.data?.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              selectedCategory === cat.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Lista de produtos */}
      <div className="mt-4 space-y-2">
        {products.isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {products.data?.length === 0 && (
          <div className="rounded-lg border border-dashed border-border py-12 text-center">
            <p className="text-muted-foreground">Nenhum produto encontrado.</p>
            <Link
              href="/produtos/novo"
              className="mt-2 inline-block text-sm text-primary hover:underline"
            >
              Criar primeiro produto
            </Link>
          </div>
        )}

        {products.data?.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            categoryName={
              categories.data?.find((c) => c.id === product.categoryId)?.name
            }
            formatPrice={formatPrice}
            onToggleActive={handleToggleActive}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}

function ProductCard({
  product,
  categoryName,
  formatPrice,
  onToggleActive,
  onDelete,
}: {
  product: {
    id: string;
    name: string;
    description: string | null;
    price: string;
    originalPrice: string | null;
    isActive: boolean;
    isNew: boolean;
    hasVariants: boolean;
    imageUrl: string | null;
  };
  categoryName?: string;
  formatPrice: (price: string) => string;
  onToggleActive: (id: string, isActive: boolean) => void;
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <div
      className={`flex items-center gap-4 rounded-lg border border-border bg-card p-4 ${
        !product.isActive ? "opacity-60" : ""
      }`}
    >
      {/* Imagem placeholder */}
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full rounded-md object-cover"
          />
        ) : (
          <Tag className="h-6 w-6" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-foreground truncate">
            {product.name}
          </h3>
          {product.isNew && (
            <span className="rounded bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-600">
              NOVO
            </span>
          )}
          {!product.isActive && (
            <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              Inativo
            </span>
          )}
        </div>
        {product.description && (
          <p className="mt-0.5 text-sm text-muted-foreground truncate">
            {product.description}
          </p>
        )}
        {categoryName && (
          <p className="text-xs text-muted-foreground">{categoryName}</p>
        )}
      </div>

      {/* Preço */}
      <div className="text-right shrink-0">
        {product.hasVariants ? (
          <span className="text-sm text-muted-foreground">Com variantes</span>
        ) : (
          <>
            {product.originalPrice && (
              <span className="text-xs text-muted-foreground line-through block">
                {formatPrice(product.originalPrice)}
              </span>
            )}
            <span className="font-semibold text-foreground">
              {formatPrice(product.price)}
            </span>
          </>
        )}
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onToggleActive(product.id, product.isActive)}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          title={product.isActive ? "Desativar" : "Ativar"}
        >
          {product.isActive ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
        </button>
        <Link
          href={`/produtos/${product.id}`}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Editar"
        >
          <Pencil className="h-4 w-4" />
        </Link>
        <button
          onClick={() => onDelete(product.id, product.name)}
          className="rounded-md p-2 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
          title="Excluir"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
