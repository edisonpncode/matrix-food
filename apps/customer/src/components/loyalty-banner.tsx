"use client";

import { Star } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface LoyaltyBannerProps {
  tenantId: string;
}

export function LoyaltyBanner({ tenantId }: LoyaltyBannerProps) {
  const { data: config } = trpc.loyalty.getPublicConfig.useQuery(
    { tenantId },
    { enabled: !!tenantId }
  );

  if (!config) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-3">
      <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 p-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100">
          <Star className="h-5 w-5 text-yellow-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-yellow-800">
            Programa de Fidelidade
          </p>
          <p className="text-xs text-yellow-700">
            Ganhe {config.pointsPerReal} {config.pointsName.toLowerCase()} a
            cada R$1 gasto e troque por descontos!
          </p>
        </div>
      </div>
    </div>
  );
}
