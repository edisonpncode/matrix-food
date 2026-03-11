"use client";

import { ProductForm } from "@/components/product-form";

export default function NovoProdutoPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Novo Produto</h1>
      <p className="mt-1 text-muted-foreground">
        Adicione um novo item ao seu cardápio
      </p>
      <div className="mt-6">
        <ProductForm />
      </div>
    </div>
  );
}
