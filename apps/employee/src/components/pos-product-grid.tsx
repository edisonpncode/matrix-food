"use client";

import { formatCurrency } from "@matrix-food/utils";

interface Product {
  id: string;
  name: string;
  price: string;
  imageUrl: string | null;
  variants: { id: string; name: string; price: string }[];
  customizationGroups: {
    id: string;
    name: string;
    minSelections: number;
    maxSelections: number;
    isRequired: boolean;
    options: { id: string; name: string; price: string }[];
  }[];
}

interface Category {
  id: string;
  name: string;
}

interface POSProductGridProps {
  categories: Category[];
  products: Product[];
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  onSelectProduct: (product: Product) => void;
}

export function POSProductGrid({
  categories,
  products,
  selectedCategory,
  onSelectCategory,
  onSelectProduct,
}: POSProductGridProps) {
  const filteredProducts = selectedCategory
    ? products.filter((_p) => {
        // Products come with categoryId from the query
        return true; // Will be filtered by the parent
      })
    : products;

  return (
    <div className="flex flex-col gap-4">
      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => onSelectCategory(null)}
          className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            selectedCategory === null
              ? "bg-primary text-primary-foreground"
              : "bg-accent text-accent-foreground hover:bg-accent/80"
          }`}
        >
          Todos
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              selectedCategory === cat.id
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-accent-foreground hover:bg-accent/80"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {filteredProducts.map((product) => (
          <button
            key={product.id}
            onClick={() => onSelectProduct(product)}
            className="flex flex-col items-center rounded-xl border-2 border-border bg-card p-4 text-center transition-all hover:border-primary hover:shadow-md active:scale-95"
          >
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="mb-2 h-16 w-16 rounded-lg object-cover"
              />
            ) : (
              <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-lg bg-accent text-2xl">
                🍔
              </div>
            )}
            <span className="text-sm font-medium leading-tight">
              {product.name}
            </span>
            <span className="mt-1 text-sm font-bold text-primary">
              {product.variants.length > 0
                ? `A partir de ${formatCurrency(
                    parseFloat(product.variants[0]!.price)
                  )}`
                : formatCurrency(parseFloat(product.price))}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
