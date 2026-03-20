"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { ProductForm } from "@/components/admin/product-form";
import { Loader2 } from "lucide-react";

export default function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const product = trpc.product.getById.useQuery({ id });

  if (product.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!product.data) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Produto não encontrado.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Editar Produto</h1>
      <p className="mt-1 text-muted-foreground">{product.data.name}</p>
      <div className="mt-6">
        <ProductForm product={product.data} />
      </div>
    </div>
  );
}
