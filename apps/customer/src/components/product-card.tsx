"use client";

import { Gift } from "lucide-react";
import { formatCurrency } from "@matrix-food/utils";
import { usePointsAvailable } from "@/lib/use-points-available";

interface ProductVariant {
  id: string;
  name: string;
  price: string;
  pointsPrice: number | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: string;
  originalPrice: string | null;
  pointsPrice: number | null;
  imageUrl: string | null;
  isNew: boolean;
  hasVariants: boolean;
  variants: ProductVariant[];
}

interface ProductCardProps {
  product: Product;
  tenantId: string;
  onClick: () => void;
}

export function ProductCard({ product, tenantId, onClick }: ProductCardProps) {
  const points = usePointsAvailable(tenantId);

  // Determinar preço a exibir
  const displayPrice = product.hasVariants && product.variants.length > 0
    ? parseFloat(product.variants[0]!.price)
    : parseFloat(product.price);

  const hasFromPrice = product.hasVariants && product.variants.length > 1;

  // Detectar se produto aceita resgate por pontos e qual o menor pointsPrice (a partir de)
  const variantPoints = product.variants
    .map((v) => v.pointsPrice)
    .filter((p): p is number => p != null && p > 0);

  const minPointsPrice =
    variantPoints.length > 0
      ? Math.min(...variantPoints)
      : product.pointsPrice ?? null;

  const hasPointsPrice = minPointsPrice != null && minPointsPrice > 0;
  const isPointsOnly = hasPointsPrice && displayPrice <= 0;
  const hasFromPoints = variantPoints.length > 1;

  // Saldo insuficiente para o menor custo (só aplica se cliente está identificado)
  const insufficient =
    points.enabled &&
    points.hasCustomer &&
    hasPointsPrice &&
    minPointsPrice! > points.available;

  return (
    <button
      onClick={onClick}
      className="flex w-full gap-3 rounded-xl bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Info */}
      <div className="flex flex-1 flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-gray-900">{product.name}</h3>
            {product.isNew && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                NOVO
              </span>
            )}
            {hasPointsPrice && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                <Gift className="h-3 w-3" />
                RESGATE
              </span>
            )}
          </div>
          {product.description && (
            <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">
              {product.description}
            </p>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          {product.originalPrice && (
            <span className="text-xs text-gray-400 line-through">
              {formatCurrency(parseFloat(product.originalPrice))}
            </span>
          )}
          {!isPointsOnly && (
            <span className="font-semibold text-primary">
              {hasFromPrice && "A partir de "}
              {formatCurrency(displayPrice)}
            </span>
          )}
          {hasPointsPrice && (
            <span
              className={`inline-flex items-center gap-1 text-sm font-semibold ${
                insufficient
                  ? "text-gray-400 line-through decoration-1"
                  : "text-amber-600"
              }`}
              title={
                insufficient
                  ? `Saldo insuficiente (você tem ${points.available} ${points.pointsName})`
                  : undefined
              }
            >
              <Gift className="h-3.5 w-3.5" />
              {hasFromPoints && "a partir de "}
              {minPointsPrice} Pts
            </span>
          )}
        </div>
        {isPointsOnly && insufficient && (
          <p className="mt-1 text-xs text-gray-500">
            Faltam {minPointsPrice! - points.available} {points.pointsName} para resgatar
          </p>
        )}
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
