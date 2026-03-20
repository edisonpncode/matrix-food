"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Tag, X, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useCartStore } from "@/stores/cart-store";
import { formatCurrency } from "@matrix-food/utils";
import { LoyaltySection } from "./loyalty-section";

interface Tenant {
  id: string;
  slug: string;
  name: string;
  paymentMethodsAccepted: string[] | null;
  deliverySettings: {
    deliveryFee: number;
    estimatedMinutes: { min: number; max: number };
  } | null;
}

interface CheckoutFormProps {
  tenant: Tenant;
  onBack: () => void;
}

const PAYMENT_LABELS: Record<string, string> = {
  PIX: "PIX",
  CASH: "Dinheiro",
  CREDIT_CARD: "Cartão de Crédito",
  DEBIT_CARD: "Cartão de Débito",
};

export function CheckoutForm({ tenant, onBack }: CheckoutFormProps) {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.getSubtotal());
  const clearCart = useCartStore((s) => s.clearCart);

  const [orderType, setOrderType] = useState<"DELIVERY" | "PICKUP">(
    "DELIVERY"
  );
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState({
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zipCode: "",
  });
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [changeFor, setChangeFor] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discountAmount: number;
    description: string | null;
  } | null>(null);
  const [appliedReward, setAppliedReward] = useState<{
    name: string;
    discount: number;
  } | null>(null);

  const createOrder = trpc.order.create.useMutation();

  const deliveryFee =
    orderType === "DELIVERY"
      ? tenant.deliverySettings?.deliveryFee ?? 0
      : 0;
  const discount = appliedPromo?.discountAmount ?? 0;
  const loyaltyDiscount = appliedReward?.discount ?? 0;
  const total = subtotal + deliveryFee - discount - loyaltyDiscount;

  const paymentMethods = tenant.paymentMethodsAccepted ?? [
    "PIX",
    "CASH",
    "CREDIT_CARD",
    "DEBIT_CARD",
  ];

  const validatePromo = trpc.promotion.validate.useQuery(
    {
      tenantId: tenant.id,
      code: promoCode.trim(),
      subtotal,
      deliveryFee,
      customerPhone: customerPhone || undefined,
    },
    { enabled: false }
  );

  async function handleApplyPromo() {
    if (!promoCode.trim()) return;
    setPromoError("");

    const result = await validatePromo.refetch();
    const data = result.data;

    if (!data || !data.valid) {
      setPromoError(data?.error ?? "Código inválido");
      setAppliedPromo(null);
      return;
    }

    setAppliedPromo({
      code: promoCode.trim().toUpperCase(),
      discountAmount: data.discountAmount ?? 0,
      description: data.description ?? null,
    });
    setPromoError("");
  }

  function handleRemovePromo() {
    setAppliedPromo(null);
    setPromoCode("");
    setPromoError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0 || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const result = await createOrder.mutateAsync({
        tenantId: tenant.id,
        type: orderType,
        customerName,
        customerPhone,
        deliveryAddress:
          orderType === "DELIVERY"
            ? {
                street: address.street,
                number: address.number,
                complement: address.complement || undefined,
                neighborhood: address.neighborhood,
                city: address.city,
                state: address.state,
                zipCode: address.zipCode,
              }
            : null,
        paymentMethod: paymentMethod as "PIX" | "CASH" | "CREDIT_CARD" | "DEBIT_CARD",
        changeFor: paymentMethod === "CASH" && changeFor ? changeFor : null,
        notes: notes || undefined,
        promoCode: appliedPromo?.code || undefined,
        loyaltyRewardDiscount: loyaltyDiscount > 0 ? loyaltyDiscount : undefined,
        items: items.map((item) => ({
          productId: item.productId,
          productVariantId: item.variantId,
          quantity: item.quantity,
          notes: item.notes || undefined,
          customizations: item.customizations.map((c) => ({
            customizationGroupName: c.groupName,
            customizationOptionName: c.optionName,
            optionId: c.optionId,
          })),
        })),
      });

      clearCart();
      router.push(
        `/restaurantes/${tenant.slug}/pedido/${result.id}`
      );
    } catch {
      alert("Erro ao criar pedido. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isValid =
    customerName.trim() !== "" &&
    customerPhone.trim() !== "" &&
    paymentMethod !== "" &&
    acceptedTerms &&
    (orderType === "PICKUP" ||
      (address.street && address.number && address.neighborhood && address.city && address.state && address.zipCode));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white shadow-sm">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="p-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold">Finalizar pedido</h1>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-lg space-y-5 px-4 py-5"
      >
        {/* Tipo do pedido */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">Tipo do pedido</h2>
          <div className="flex gap-2">
            {(["DELIVERY", "PICKUP"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setOrderType(type)}
                className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                  orderType === type
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {type === "DELIVERY" ? "Entrega" : "Retirada"}
              </button>
            ))}
          </div>
        </section>

        {/* Dados do cliente */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">Seus dados</h2>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Seu nome"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              type="tel"
              placeholder="Telefone / WhatsApp"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </section>

        {/* Endereço */}
        {orderType === "DELIVERY" && (
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">Endereço de entrega</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Rua"
                value={address.street}
                onChange={(e) =>
                  setAddress((a) => ({ ...a, street: e.target.value }))
                }
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Número"
                  value={address.number}
                  onChange={(e) =>
                    setAddress((a) => ({ ...a, number: e.target.value }))
                  }
                  required
                  className="w-28 rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="text"
                  placeholder="Complemento"
                  value={address.complement}
                  onChange={(e) =>
                    setAddress((a) => ({ ...a, complement: e.target.value }))
                  }
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <input
                type="text"
                placeholder="Bairro"
                value={address.neighborhood}
                onChange={(e) =>
                  setAddress((a) => ({ ...a, neighborhood: e.target.value }))
                }
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Cidade"
                  value={address.city}
                  onChange={(e) =>
                    setAddress((a) => ({ ...a, city: e.target.value }))
                  }
                  required
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="text"
                  placeholder="UF"
                  maxLength={2}
                  value={address.state}
                  onChange={(e) =>
                    setAddress((a) => ({
                      ...a,
                      state: e.target.value.toUpperCase(),
                    }))
                  }
                  required
                  className="w-16 rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <input
                type="text"
                placeholder="CEP"
                value={address.zipCode}
                onChange={(e) =>
                  setAddress((a) => ({ ...a, zipCode: e.target.value }))
                }
                required
                className="w-36 rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </section>
        )}

        {/* Pagamento */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">Forma de pagamento</h2>
          <div className="space-y-2">
            {paymentMethods.map((method) => (
              <label
                key={method}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors ${
                  paymentMethod === method
                    ? "border-primary bg-primary/5"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  value={method}
                  checked={paymentMethod === method}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="accent-primary"
                />
                <span className="text-sm font-medium">
                  {PAYMENT_LABELS[method] ?? method}
                </span>
              </label>
            ))}
          </div>
          {paymentMethod === "CASH" && (
            <div className="mt-3">
              <input
                type="text"
                placeholder="Troco para quanto? (ex: 50)"
                value={changeFor}
                onChange={(e) => setChangeFor(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
        </section>

        {/* Cupom de Desconto */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">Cupom de desconto</h2>
          {appliedPromo ? (
            <div className="flex items-center justify-between rounded-lg border-2 border-green-200 bg-green-50 p-3">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-700">
                    Cupom {appliedPromo.code} aplicado!
                  </p>
                  <p className="text-xs text-green-600">
                    -{formatCurrency(appliedPromo.discountAmount)} de desconto
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemovePromo}
                className="text-green-600 hover:text-green-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value.toUpperCase());
                      setPromoError("");
                    }}
                    placeholder="Código do cupom"
                    className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-sm font-mono uppercase focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  disabled={!promoCode.trim() || validatePromo.isFetching}
                  className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {validatePromo.isFetching ? "..." : "Aplicar"}
                </button>
              </div>
              {promoError && (
                <p className="mt-2 text-xs text-red-500">{promoError}</p>
              )}
            </div>
          )}
        </section>

        {/* Fidelidade */}
        <LoyaltySection
          tenantId={tenant.id}
          customerPhone={customerPhone}
          appliedReward={appliedReward}
          onRewardApplied={(discount, rewardName) =>
            setAppliedReward({ name: rewardName, discount })
          }
          onRewardRemoved={() => setAppliedReward(null)}
        />

        {/* Observações */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">Observações</h2>
          <textarea
            placeholder="Alguma observação para o restaurante?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </section>

        {/* Resumo */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">Resumo</h2>
          <div className="space-y-2 text-sm">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span className="text-gray-600">
                  {item.quantity}x {item.productName}
                  {item.variantName && ` (${item.variantName})`}
                </span>
                <span>{formatCurrency(item.itemTotal)}</span>
              </div>
            ))}
            <div className="border-t pt-2">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {orderType === "DELIVERY" && (
                <div className="flex justify-between text-gray-500">
                  <span>Taxa de entrega</span>
                  <span>
                    {deliveryFee === 0
                      ? "Grátis"
                      : formatCurrency(deliveryFee)}
                  </span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Desconto ({appliedPromo?.code})</span>
                  <span>-{formatCurrency(discount)}</span>
                </div>
              )}
              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-yellow-600">
                  <span>Fidelidade ({appliedReward?.name})</span>
                  <span>-{formatCurrency(loyaltyDiscount)}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Termos e Privacidade */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            <span className="text-xs text-gray-600">
              Li e aceito os{" "}
              <a
                href="/termos"
                target="_blank"
                className="text-primary underline"
              >
                Termos de Uso
              </a>{" "}
              e a{" "}
              <a
                href="/privacidade"
                target="_blank"
                className="text-primary underline"
              >
                Política de Privacidade
              </a>
            </span>
          </label>
        </section>

        {/* Botão */}
        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="w-full rounded-full bg-primary py-4 text-center font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isSubmitting ? "Enviando pedido..." : `Confirmar pedido - ${formatCurrency(total)}`}
        </button>
      </form>
    </div>
  );
}
