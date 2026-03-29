"use client";

import { ProductCard } from "./product-card";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: string;
  originalPrice: string | null;
  imageUrl: string | null;
  isNew: boolean;
  hasVariants: boolean;
  variants: {
    id: string;
    name: string;
    price: string;
    originalPrice: string | null;
  }[];
}

interface CategorySectionProps {
  id: string;
  name: string;
  products: Product[];
  onProductClick: (productId: string) => void;
}

export function CategorySection({
  id,
  name,
  products,
  onProductClick,
}: CategorySectionProps) {
  if (products.length === 0) return null;

  return (
    <section id={`category-${id}`} data-category-id={id}>
      <h2 className="mb-3 text-lg font-bold text-gray-900">{name}</h2>
      <div className="space-y-3">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onClick={() => onProductClick(product.id)}
          />
        ))}
      </div>
    </section>
  );
}
