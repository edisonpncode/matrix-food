"use client";

import { trpc } from "@/lib/trpc";
import { Tag } from "lucide-react";

interface PromoBannerProps {
  tenantId: string;
}

export function PromoBanner({ tenantId }: PromoBannerProps) {
  const { data: promos } = trpc.promotion.listPublic.useQuery({ tenantId });

  if (!promos || promos.length === 0) return null;

  function formatPromoText(promo: NonNullable<typeof promos>[number]) {
    if (promo.description) return promo.description;
    switch (promo.type) {
      case "PERCENTAGE":
        return `${promo.value}% de desconto com o código ${promo.code}`;
      case "FIXED_AMOUNT":
        return `R$ ${parseFloat(promo.value).toFixed(2)} de desconto com o código ${promo.code}`;
      case "FREE_DELIVERY":
        return `Frete grátis com o código ${promo.code}`;
      default:
        return `Use o código ${promo.code}`;
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-3">
      <div className="space-y-2">
        {promos.map((promo) => (
          <div
            key={promo.code}
            className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-3"
          >
            <Tag className="h-5 w-5 flex-shrink-0 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium text-primary">
                {formatPromoText(promo)}
              </p>
              {promo.minOrderValue && (
                <p className="text-xs text-primary/70">
                  Pedido mínimo R$ {parseFloat(promo.minOrderValue).toFixed(2)}
                </p>
              )}
            </div>
            <span className="rounded-md bg-primary/20 px-2 py-1 font-mono text-xs font-bold text-primary">
              {promo.code}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
