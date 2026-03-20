"use client";

import { formatCurrency } from "@matrix-food/utils";

interface ProductVariant {
  id: string;
  name: string;
  price: string;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: string;
  originalPrice: string | null;
  imageUrl: string | null;
  isNew: boolean;
  hasVariants: boolean;
  variants: ProductVariant[];
}

interface ProductCardProps {
  product: Product;
  onClick: () => void;
}

export function ProductCard({ product, onClick }: ProductCardProps) {
  // Determinar preço a exibir
  const displayPrice = product.hasVariants && product.variants.length > 0
    ? parseFloat(product.variants[0]!.price)
    : parseFloat(product.price);

  const hasFromPrice = product.hasVariants && product.variants.length > 1;

  return (
    <button
      onClick={onClick}
      className="flex w-full gap-3 rounded-xl bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Info */}
      <div className="flex flex-1 flex-col justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{product.name}</h3>
            {product.isNew && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                NOVO
              </span>
            )}
          </div>
          {product.description && (
            <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">
              {product.description}
            </p>
          )}
        </div>

        <div className="mt-2 flex items-center gap-2">
          {product.originalPrice && (
            <span className="text-xs text-gray-400 line-through">
              {formatCurrency(parseFloat(product.originalPrice))}
            </span>
          )}
          <span className="font-semibold text-primary">
            {hasFromPrice && "A partir de "}
            {formatCurrency(displayPrice)}
          </span>
        </div>
      </div>

      {/* Image */}
      {product.imageUrl && (
        <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        </div>
      )}
    </button>
  );
}
