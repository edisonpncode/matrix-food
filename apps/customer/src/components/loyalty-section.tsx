"use client";

import { useState } from "react";
import { Star, Gift, ChevronDown, ChevronUp, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";

interface LoyaltySectionProps {
  tenantId: string;
  customerPhone: string;
  onRewardApplied: (discount: number, rewardName: string) => void;
  onRewardRemoved: () => void;
  appliedReward: { name: string; discount: number } | null;
}

export function LoyaltySection({
  tenantId,
  customerPhone,
  onRewardApplied,
  onRewardRemoved,
  appliedReward,
}: LoyaltySectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);

  // Buscar configuração de fidelidade
  const { data: config } = trpc.loyalty.getPublicConfig.useQuery(
    { tenantId },
    { enabled: !!tenantId }
  );

  // Buscar saldo do cliente (se tiver telefone)
  const { data: balance, refetch: refetchBalance } =
    trpc.loyalty.getBalance.useQuery(
      { tenantId, customerPhone },
      { enabled: !!tenantId && !!customerPhone && customerPhone.length >= 8 }
    );

  // Buscar recompensas disponíveis
  const { data: rewards } = trpc.loyalty.listPublicRewards.useQuery(
    { tenantId },
    { enabled: !!tenantId && expanded }
  );

  const redeemReward = trpc.loyalty.redeemReward.useMutation();

  // Se fidelidade não está ativa ou não tem telefone, não mostra nada
  if (!config || !customerPhone || customerPhone.length < 8) {
    return null;
  }

  async function handleRedeem(rewardId: string) {
    setIsRedeeming(true);
    try {
      const result = await redeemReward.mutateAsync({
        tenantId,
        customerPhone,
        rewardId,
      });
      onRewardApplied(
        parseFloat(result.discountValue),
        result.rewardName
      );
      refetchBalance();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erro ao resgatar recompensa";
      alert(message);
    } finally {
      setIsRedeeming(false);
    }
  }

  const currentBalance = balance?.balance ?? 0;
  const pointsName = balance?.pointsName ?? config.pointsName;

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500" />
          <h2 className="font-semibold">Programa de Fidelidade</h2>
        </div>
        <div className="flex items-center gap-2">
          {currentBalance > 0 && (
            <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-sm font-medium text-yellow-700">
              {currentBalance} {pointsName}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Applied reward */}
      {appliedReward && (
        <div className="mt-3 flex items-center justify-between rounded-lg border-2 border-yellow-200 bg-yellow-50 p-3">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="text-sm font-medium text-yellow-700">
                {appliedReward.name} aplicado!
              </p>
              <p className="text-xs text-yellow-600">
                -{formatCurrency(appliedReward.discount)} de desconto
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRewardRemoved}
            className="text-xs font-medium text-yellow-600 hover:text-yellow-800"
          >
            Remover
          </button>
        </div>
      )}

      {/* Expanded content */}
      {expanded && !appliedReward && (
        <div className="mt-3 space-y-3">
          {/* Balance info */}
          {currentBalance > 0 ? (
            <div className="rounded-lg bg-gradient-to-r from-yellow-50 to-orange-50 p-3">
              <p className="text-sm text-gray-700">
                Seu saldo:{" "}
                <span className="font-bold text-yellow-700">
                  {currentBalance} {pointsName}
                </span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Faça pedidos para acumular {pointsName.toLowerCase()} e trocar por
              recompensas!
            </p>
          )}

          {/* Available rewards */}
          {rewards && rewards.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase">
                Recompensas disponíveis
              </p>
              {rewards.map((reward) => {
                const canRedeem = currentBalance >= reward.pointsCost;
                return (
                  <div
                    key={reward.id}
                    className={`flex items-center justify-between rounded-lg border p-3 ${
                      canRedeem
                        ? "border-yellow-200 bg-yellow-50/50"
                        : "opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Gift className="h-4 w-4 text-yellow-500" />
                      <div>
                        <p className="text-sm font-medium">{reward.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {reward.pointsCost} {pointsName} ={" "}
                          {formatCurrency(parseFloat(reward.discountValue))} de
                          desconto
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!canRedeem || isRedeeming}
                      onClick={() => handleRedeem(reward.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                        canRedeem
                          ? "bg-yellow-500 text-white hover:bg-yellow-600"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {isRedeeming ? "..." : canRedeem ? "Resgatar" : "Pontos insuf."}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
