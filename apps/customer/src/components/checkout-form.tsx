"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Tag, X, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useCartStore } from "@/stores/cart-store";
import { formatCurrency } from "@matrix-food/utils";
import { AddressForm, type AddressValue } from "@matrix-food/ui/address-form";
import { AddressList } from "@matrix-food/ui/address-list";
import { LoyaltySection } from "./loyalty-section";
import { useCustomerAuth } from "@/lib/customer-auth-context";

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
  const pointsToSpend = useCartStore((s) => s.getPointsToSpend());
  const clearCart = useCartStore((s) => s.clearCart);

  const [orderType, setOrderType] = useState<"DELIVERY" | "PICKUP">(
    "DELIVERY"
  );
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedAddressIndex, setSelectedAddressIndex] = useState<number | null>(null);
  const [draftAddress, setDraftAddress] = useState<AddressValue | null>(null);
  const [addressMode, setAddressMode] = useState<"list" | "new" | "edit">("list");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);
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

  const createOrder = trpc.order.create.useMutation();
  const utils = trpc.useUtils();
  const updateMe = trpc.customerPortal.updateMe.useMutation();

  // Pre-preencher quando cliente esta logado
  const { customer } = useCustomerAuth();
  const meQuery = trpc.customerPortal.getMe.useQuery(undefined, {
    enabled: !!customer,
    retry: false,
  });
  useEffect(() => {
    if (!customer) return;
    if (!customerName && customer.name) setCustomerName(customer.name);
    if (!customerPhone && customer.phone) setCustomerPhone(customer.phone);
  }, [customer]);

  const savedAddresses: AddressValue[] = useMemo(() => {
    return (meQuery.data?.addresses ?? []) as AddressValue[];
  }, [meQuery.data]);

  // Quando lista de endereços salvos chega, seleciona o primeiro automaticamente
  useEffect(() => {
    if (orderType !== "DELIVERY") return;
    if (selectedAddressIndex !== null) return;
    if (savedAddresses.length === 0) return;
    setSelectedAddressIndex(0);
  }, [savedAddresses, orderType, selectedAddressIndex]);

  // Cliente anônimo (sem login): garante que sempre exista um draftAddress quando entrega
  useEffect(() => {
    if (orderType !== "DELIVERY") return;
    if (customer) return;
    if (!draftAddress) {
      setDraftAddress({
        label: "",
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
        zipCode: "",
      });
    }
  }, [orderType, customer, draftAddress]);

  const selectedAddress: AddressValue | null = useMemo(() => {
    if (orderType !== "DELIVERY") return null;
    if (customer) {
      if (selectedAddressIndex !== null && savedAddresses[selectedAddressIndex]) {
        return savedAddresses[selectedAddressIndex];
      }
      return null;
    }
    return draftAddress;
  }, [orderType, customer, selectedAddressIndex, savedAddresses, draftAddress]);

  async function handleSaveAddress(value: AddressValue) {
    if (!customer) {
      // Anônimo: só salva no estado local
      setDraftAddress(value);
      setAddressMode("list");
      return;
    }
    setSavingAddress(true);
    try {
      let nextAddresses: AddressValue[];
      if (addressMode === "edit" && editingIndex !== null) {
        nextAddresses = savedAddresses.map((addr, i) =>
          i === editingIndex ? value : addr
        );
      } else {
        nextAddresses = [...savedAddresses, value];
      }
      const normalized = nextAddresses.map((a) => ({
        ...a,
        label: a.label?.trim() || "Endereço",
      }));
      await updateMe.mutateAsync({ addresses: normalized });
      await utils.customerPortal.getMe.invalidate();
      const newIndex =
        addressMode === "edit" && editingIndex !== null
          ? editingIndex
          : nextAddresses.length - 1;
      setSelectedAddressIndex(newIndex);
      setAddressMode("list");
      setEditingIndex(null);
    } finally {
      setSavingAddress(false);
    }
  }

  async function handleRemoveAddress(index: number) {
    if (!customer) return;
    if (!confirm("Remover este endereço?")) return;
    const nextAddresses = savedAddresses.filter((_, i) => i !== index);
    const normalized = nextAddresses.map((a) => ({
      ...a,
      label: a.label?.trim() || "Endereço",
    }));
    await updateMe.mutateAsync({ addresses: normalized });
    await utils.customerPortal.getMe.invalidate();
    if (selectedAddressIndex === index) {
      setSelectedAddressIndex(nextAddresses.length > 0 ? 0 : null);
    } else if (selectedAddressIndex !== null && selectedAddressIndex > index) {
      setSelectedAddressIndex(selectedAddressIndex - 1);
    }
  }

  const deliveryFee =
    orderType === "DELIVERY"
      ? tenant.deliverySettings?.deliveryFee ?? 0
      : 0;
  const discount = appliedPromo?.discountAmount ?? 0;
  const total = subtotal + deliveryFee - discount;

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
          orderType === "DELIVERY" && selectedAddress
            ? {
                street: selectedAddress.street,
                number: selectedAddress.number,
                complement: selectedAddress.complement || undefined,
                neighborhood: selectedAddress.neighborhood,
                city: selectedAddress.city,
                state: selectedAddress.state,
                zipCode: selectedAddress.zipCode,
              }
            : null,
        paymentMethod: paymentMethod as "PIX" | "CASH" | "CREDIT_CARD" | "DEBIT_CARD",
        changeFor: paymentMethod === "CASH" && changeFor ? changeFor : null,
        notes: notes || undefined,
        promoCode: appliedPromo?.code || undefined,
        items: items.map((item) => ({
          productId: item.productId,
          productVariantId: item.variantId,
          quantity: item.quantity,
          notes: item.notes || undefined,
          paidWithPoints: item.paidWithPoints,
          customizations: item.customizations.map((c) => ({
            customizationGroupName: c.groupName,
            customizationOptionName: c.optionName,
            optionId: c.optionId,
          })),
        })),
      });

      clearCart();
      router.push(
        `/restaurante/${tenant.slug}/pedido/${result.id}?t=${encodeURIComponent(
          result.accessToken
        )}`
      );
    } catch {
      alert("Erro ao criar pedido. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasValidAddress =
    !!selectedAddress &&
    !!selectedAddress.street &&
    !!selectedAddress.number &&
    !!selectedAddress.neighborhood &&
    !!selectedAddress.city &&
    !!selectedAddress.state;

  const isValid =
    customerName.trim() !== "" &&
    customerPhone.trim() !== "" &&
    paymentMethod !== "" &&
    acceptedTerms &&
    (orderType === "PICKUP" || hasValidAddress);

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

            {customer ? (
              addressMode === "new" || addressMode === "edit" ? (
                <div>
                  <AddressForm
                    value={
                      addressMode === "edit" && editingIndex !== null
                        ? savedAddresses[editingIndex]
                        : null
                    }
                    onSave={handleSaveAddress}
                    onCancel={() => {
                      setAddressMode("list");
                      setEditingIndex(null);
                    }}
                    saveLabel={
                      savingAddress
                        ? "Salvando..."
                        : addressMode === "edit"
                          ? "Salvar alterações"
                          : "Salvar endereço"
                    }
                  />
                </div>
              ) : (
                <AddressList
                  addresses={savedAddresses}
                  selectedIndex={selectedAddressIndex}
                  onSelect={(i) => setSelectedAddressIndex(i)}
                  onAddNew={() => {
                    setAddressMode("new");
                    setEditingIndex(null);
                  }}
                  onEdit={(i) => {
                    setAddressMode("edit");
                    setEditingIndex(i);
                  }}
                  onRemove={handleRemoveAddress}
                  emptyMessage="Você ainda não tem endereços salvos. Adicione um abaixo."
                />
              )
            ) : (
              <AddressForm
                value={draftAddress}
                onChange={setDraftAddress}
                hideLabel
              />
            )}
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
        <LoyaltySection tenantId={tenant.id} customerPhone={customerPhone} />

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
                  {item.paidWithPoints && (
                    <span className="ml-1 text-xs font-medium text-amber-600">
                      (resgate)
                    </span>
                  )}
                </span>
                <span>
                  {item.paidWithPoints
                    ? `${item.pointsUnitCost * item.quantity} pts${item.itemTotal > 0 ? ` + ${formatCurrency(item.itemTotal)}` : ""}`
                    : formatCurrency(item.itemTotal)}
                </span>
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
              <div className="mt-1 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(total)}</span>
              </div>
              {pointsToSpend > 0 && (
                <div className="mt-1 flex justify-between text-sm font-semibold text-amber-700">
                  <span>Pontos a gastar</span>
                  <span>{pointsToSpend} pts</span>
                </div>
              )}
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
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Termos de Uso
              </a>{" "}
              e a{" "}
              <a
                href="/privacidade"
                target="_blank"
                rel="noopener noreferrer"
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
          {isSubmitting
            ? "Enviando pedido..."
            : pointsToSpend > 0
              ? `Confirmar pedido - ${formatCurrency(total)} + ${pointsToSpend} pts`
              : `Confirmar pedido - ${formatCurrency(total)}`}
        </button>
      </form>
    </div>
  );
}
