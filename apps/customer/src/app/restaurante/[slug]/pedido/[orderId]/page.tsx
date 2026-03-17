"use client";

import { use } from "react";
import Link from "next/link";
import { CheckCircle, Clock, ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";
import { ReviewForm } from "@/components/review-form";

interface PageProps {
  params: Promise<{ slug: string; orderId: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  PREPARING: "Em preparo",
  READY: "Pronto",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED: "Entregue",
  PICKED_UP: "Retirado",
  CANCELLED: "Cancelado",
};

export default function OrderConfirmationPage({ params }: PageProps) {
  const { slug, orderId } = use(params);

  const { data: order, isLoading } = trpc.order.getById.useQuery({
    id: orderId,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-xl font-bold">Pedido não encontrado</h1>
        <Link
          href={`/restaurante/${slug}`}
          className="text-primary hover:underline"
        >
          Voltar ao cardápio
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Link href={`/restaurante/${slug}`} className="p-1">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold">Pedido {order.displayNumber}</h1>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6">
        {/* Sucesso */}
        <div className="flex flex-col items-center rounded-xl bg-white p-6 text-center shadow-sm">
          <CheckCircle className="h-16 w-16 text-green-500" />
          <h2 className="mt-4 text-2xl font-bold">Pedido enviado!</h2>
          <p className="mt-2 text-4xl font-bold text-primary">
            {order.displayNumber}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Guarde este número para acompanhar seu pedido.
          </p>

          <div className="mt-4 flex items-center gap-2 rounded-full bg-yellow-50 px-4 py-2">
            <Clock className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-700">
              Status: {STATUS_LABELS[order.status] ?? order.status}
            </span>
          </div>
        </div>

        {/* Resumo */}
        <div className="mt-5 rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold">Resumo do pedido</h3>
          <div className="space-y-2 text-sm">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span className="text-gray-600">
                  {item.quantity}x {item.productName}
                  {item.variantName && ` (${item.variantName})`}
                </span>
                <span>{formatCurrency(parseFloat(item.totalPrice))}</span>
              </div>
            ))}
            <div className="border-t pt-2">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>{formatCurrency(parseFloat(order.subtotal))}</span>
              </div>
              {parseFloat(order.deliveryFee) > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Entrega</span>
                  <span>
                    {formatCurrency(parseFloat(order.deliveryFee))}
                  </span>
                </div>
              )}
              <div className="mt-1 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">
                  {formatCurrency(parseFloat(order.total))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Avaliação */}
        {order.status === "DELIVERED" || order.status === "PICKED_UP" ? (
          <div className="mt-5">
            <ReviewForm orderId={order.id} tenantId={order.tenantId} />
          </div>
        ) : null}

        {/* Pontos ganhos */}
        {order.loyaltyPointsEarned > 0 && (
          <div className="mt-5 flex items-center gap-3 rounded-xl bg-yellow-50 border border-yellow-200 p-4">
            <span className="text-2xl">⭐</span>
            <p className="text-sm text-yellow-800">
              Você ganhou <strong>{order.loyaltyPointsEarned} pontos</strong> de fidelidade neste pedido!
            </p>
          </div>
        )}

        {/* Voltar */}
        <Link
          href={`/restaurante/${slug}`}
          className="mt-6 block w-full rounded-full border-2 border-primary py-3 text-center font-semibold text-primary transition-colors hover:bg-primary/5"
        >
          Voltar ao cardápio
        </Link>
      </div>
    </div>
  );
}
