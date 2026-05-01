"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Tag,
  X,
  Check,
  MapPin,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Ban,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useCartStore } from "@/stores/cart-store";
import {
  cleanCpf,
  formatCpf,
  formatCurrency,
  isValidCpf,
  getEnabledPaymentMethods,
  DEFAULT_PAYMENT_METHODS,
  type PaymentMethodConfig,
} from "@matrix-food/utils";
import { LoyaltySection } from "./loyalty-section";
import { formatBrazilianPhone, stripPhone } from "@/lib/format-phone";
import { fetchAddressByCep, formatCep } from "@/lib/viacep";
import { useCustomerAuth } from "@/lib/customer-auth-context";
import { AddressList } from "@matrix-food/ui/address-list";
import { AddressForm, type AddressValue } from "@matrix-food/ui/address-form";

interface Tenant {
  id: string;
  slug: string;
  name: string;
  paymentMethodsAccepted: PaymentMethodConfig[] | null;
  deliverySettings: {
    deliveryFee: number;
    estimatedMinutes: { min: number; max: number };
    minOrder?: number;
  } | null;
}

interface CheckoutFormProps {
  tenant: Tenant;
  isOpen: boolean;
  onBack: () => void;
}


export function CheckoutForm({ tenant, isOpen, onBack }: CheckoutFormProps) {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.getSubtotal());
  const pointsToSpend = useCartStore((s) => s.getPointsToSpend());
  const clearCart = useCartStore((s) => s.clearCart);
  const { customer, refetch: refetchCustomer } = useCustomerAuth();

  // Lista de enderecos salvos do cliente logado
  const savedAddresses = useMemo<AddressValue[]>(
    () => (customer?.addresses ?? []) as AddressValue[],
    [customer]
  );

  const firstSaved = savedAddresses[0];
  const [orderType, setOrderType] = useState<"DELIVERY" | "PICKUP">(
    "DELIVERY"
  );
  const [customerName, setCustomerName] = useState(customer?.name ?? "");
  const [customerPhone, setCustomerPhone] = useState(
    customer?.phone ? formatBrazilianPhone(customer.phone) : ""
  );
  const [customerCpf, setCustomerCpf] = useState(
    customer?.cpf ? formatCpf(customer.cpf) : ""
  );
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [address, setAddress] = useState({
    zipCode: firstSaved?.zipCode ? formatCep(firstSaved.zipCode) : "",
    street: firstSaved?.street ?? "",
    number: firstSaved?.number ?? "",
    complement: firstSaved?.complement ?? "",
    neighborhood: firstSaved?.neighborhood ?? "",
    city: firstSaved?.city ?? "",
    state: firstSaved?.state ?? "",
  });
  const [selectedAddressIndex, setSelectedAddressIndex] = useState<number | null>(
    customer && savedAddresses.length > 0 ? 0 : null
  );
  const [addressMode, setAddressMode] = useState<"list" | "new" | "edit">("list");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [paymentMethodId, setPaymentMethodId] = useState<string>("");
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

  // --- CEP auto-fill states ---
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");

  // --- Delivery area states ---
  const [areaChecked, setAreaChecked] = useState(false);
  const [deliveryArea, setDeliveryArea] = useState<{
    id: string;
    name: string;
    deliveryFee: string;
    estimatedMinutes?: number | null;
    freeDeliveryAbove?: string | null;
  } | null>(null);
  const [outsideArea, setOutsideArea] = useState(false);

  // --- Delivery area: chamadas imperativas via utils.fetch ---
  // (useQuery + refetch ligado a state nao funciona aqui porque o input
  // do refetch fica preso ao closure do render anterior — passamos as
  // coords direto pro fetch.)
  const utils = trpc.useUtils();
  const [isCheckingArea, setIsCheckingArea] = useState(false);

  const canCheckArea =
    address.street.trim() &&
    address.number.trim() &&
    address.city.trim() &&
    address.state.trim();

  // Ao abrir a tela de confirmacao, rola para o topo (evita herdar scroll do menu)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  // --- CEP auto-fill ---
  useEffect(() => {
    const digits = address.zipCode.replace(/\D/g, "");
    if (digits.length !== 8) return;

    setCepLoading(true);
    setCepError("");

    fetchAddressByCep(digits).then((result) => {
      setCepLoading(false);
      if (result) {
        setAddress((a) => ({
          ...a,
          street: result.street || a.street,
          neighborhood: result.neighborhood || a.neighborhood,
          city: result.city || a.city,
          state: result.state || a.state,
        }));
        setAreaChecked(false);
        setCepError("");
      } else {
        setCepError("CEP nao encontrado");
      }
    });
  }, [address.zipCode]);

  // Mutation para salvar enderecos no perfil do cliente
  const updateMeMutation = trpc.customerPortal.updateMe.useMutation();

  // Quando o usuario seleciona outro endereco salvo, copia os campos pro
  // estado `address` (que alimenta a verificacao de area e o submit do pedido).
  useEffect(() => {
    if (!customer) return;
    if (selectedAddressIndex === null) return;
    const sel = savedAddresses[selectedAddressIndex];
    if (!sel) return;
    setAddress({
      zipCode: sel.zipCode ? formatCep(sel.zipCode) : "",
      street: sel.street ?? "",
      number: sel.number ?? "",
      complement: sel.complement ?? "",
      neighborhood: sel.neighborhood ?? "",
      city: sel.city ?? "",
      state: sel.state ?? "",
    });
    setAreaChecked(false);
    setDeliveryArea(null);
    setOutsideArea(false);
  }, [customer, selectedAddressIndex, savedAddresses]);

  async function handleSaveAddress(value: AddressValue) {
    if (!customer) return;
    setSavingAddress(true);
    try {
      let nextAddresses: AddressValue[];
      if (addressMode === "edit" && editingIndex !== null) {
        nextAddresses = savedAddresses.map((a, i) =>
          i === editingIndex ? value : a
        );
      } else {
        nextAddresses = [...savedAddresses, value];
      }
      const normalized = nextAddresses.map((a) => ({
        ...a,
        label: (a.label ?? "").trim() || "Endereço",
      }));
      await updateMeMutation.mutateAsync({ addresses: normalized });
      await refetchCustomer();
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
      label: (a.label ?? "").trim() || "Endereço",
    }));
    await updateMeMutation.mutateAsync({ addresses: normalized });
    await refetchCustomer();
    if (selectedAddressIndex === index) {
      setSelectedAddressIndex(nextAddresses.length > 0 ? 0 : null);
    } else if (selectedAddressIndex !== null && selectedAddressIndex > index) {
      setSelectedAddressIndex(selectedAddressIndex - 1);
    }
    setAreaChecked(false);
    setDeliveryArea(null);
    setOutsideArea(false);
  }

  async function handleCheckArea() {
    setAreaChecked(false);
    setDeliveryArea(null);
    setOutsideArea(false);
    setIsCheckingArea(true);

    try {
      const geoResult = await utils.deliveryArea.geocodeAddress.fetch({
        street: address.street,
        number: address.number,
        neighborhood: address.neighborhood,
        city: address.city,
        state: address.state,
      });

      if (geoResult) {
        const areaResult = await utils.deliveryArea.checkAddressPublic.fetch({
          tenantId: tenant.id,
          lat: geoResult.lat,
          lng: geoResult.lng,
        });

        setAreaChecked(true);

        if (areaResult) {
          setDeliveryArea(areaResult);
          setOutsideArea(false);
        } else {
          setDeliveryArea(null);
          setOutsideArea(true);
        }
      } else {
        setAreaChecked(true);
        setOutsideArea(true);
      }
    } catch {
      setAreaChecked(true);
      setOutsideArea(true);
    } finally {
      setIsCheckingArea(false);
    }
  }

  const createOrder = trpc.order.create.useMutation();

  // Dynamic delivery fee from area check, fallback to tenant settings
  const areaFeeRaw = deliveryArea
    ? parseFloat(deliveryArea.deliveryFee)
    : null;
  const isFreeDelivery =
    deliveryArea?.freeDeliveryAbove &&
    subtotal >= parseFloat(deliveryArea.freeDeliveryAbove);
  const deliveryFee =
    orderType === "DELIVERY"
      ? areaFeeRaw !== null
        ? isFreeDelivery
          ? 0
          : areaFeeRaw
        : (tenant.deliverySettings?.deliveryFee ?? 0)
      : 0;
  const discount = appliedPromo?.discountAmount ?? 0;
  const total = subtotal + deliveryFee - discount;

  const minOrder = tenant.deliverySettings?.minOrder ?? 0;
  const isBelowMinimum = minOrder > 0 && subtotal < minOrder;

  const paymentMethods = getEnabledPaymentMethods(
    tenant.paymentMethodsAccepted ?? DEFAULT_PAYMENT_METHODS
  );
  const selectedMethod = paymentMethods.find((m) => m.id === paymentMethodId);

  const validatePromo = trpc.promotion.validate.useQuery(
    {
      tenantId: tenant.id,
      code: promoCode.trim(),
      subtotal,
      deliveryFee,
      customerPhone: stripPhone(customerPhone) || undefined,
    },
    { enabled: false }
  );

  async function handleApplyPromo() {
    if (!promoCode.trim()) return;
    setPromoError("");

    const result = await validatePromo.refetch();
    const data = result.data;

    if (!data || !data.valid) {
      setPromoError(data?.error ?? "Codigo invalido");
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
    if (items.length === 0 || isSubmitting || !isOpen || isBelowMinimum) return;

    if (!isValidCpf(customerCpf)) {
      setCpfError(
        customerCpf.trim() === ""
          ? "CPF é obrigatório para finalizar o pedido."
          : "CPF inválido. Confira os dígitos."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createOrder.mutateAsync({
        tenantId: tenant.id,
        type: orderType,
        customerId: customer?.id,
        customerName,
        customerPhone: stripPhone(customerPhone),
        customerCpf: cleanCpf(customerCpf),
        deliveryAddress:
          orderType === "DELIVERY"
            ? {
                street: address.street,
                number: address.number,
                complement: address.complement || undefined,
                neighborhood: address.neighborhood,
                city: address.city,
                state: address.state,
                zipCode: address.zipCode.replace(/\D/g, ""),
              }
            : null,
        deliveryAreaId: deliveryArea?.id ?? undefined,
        paymentMethod: (selectedMethod?.code ?? "CASH") as
          | "PIX"
          | "CASH"
          | "CREDIT_CARD"
          | "DEBIT_CARD"
          | "OTHER",
        customPaymentLabel:
          selectedMethod?.code === "OTHER" ? selectedMethod.label : null,
        changeFor: selectedMethod?.code === "CASH" && changeFor ? changeFor : null,
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
          ingredients: (item.ingredientModifications ?? []).map((m) => ({
            ingredientId: m.ingredientId,
            quantity: m.quantity,
            state: m.state as "SEM" | "COM" | "MENOS" | "MAIS" | undefined,
          })),
        })),
      });

      clearCart();
      router.push(
        `/restaurantes/${tenant.slug}/pedido/${result.id}?t=${encodeURIComponent(
          result.accessToken
        )}`
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao criar pedido. Tente novamente.";
      if (/cpf/i.test(message)) {
        setCpfError(message);
      } else {
        alert(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const isValid =
    customerName.trim() !== "" &&
    stripPhone(customerPhone).length >= 10 &&
    isValidCpf(customerCpf) &&
    selectedMethod !== undefined &&
    acceptedTerms &&
    !isBelowMinimum &&
    isOpen &&
    (orderType === "PICKUP" ||
      (address.street &&
        address.number &&
        address.neighborhood &&
        address.city &&
        address.state &&
        (address.zipCode || (areaChecked && deliveryArea))));

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

      {/* Aviso restaurante fechado */}
      {!isOpen && (
        <div className="mx-auto max-w-lg px-4 pt-4">
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <Ban className="h-5 w-5 flex-shrink-0 text-red-500" />
            <p className="text-sm font-medium text-red-700">
              Restaurante fechado. Nao e possivel finalizar o pedido agora.
            </p>
          </div>
        </div>
      )}

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
              placeholder="(11) 99999-9999"
              value={customerPhone}
              onChange={(e) =>
                setCustomerPhone(formatBrazilianPhone(e.target.value))
              }
              required
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div>
              <input
                type="text"
                placeholder="CPF (000.000.000-00)"
                value={customerCpf}
                onChange={(e) => {
                  setCustomerCpf(formatCpf(e.target.value));
                  if (cpfError) setCpfError(null);
                }}
                disabled={Boolean(customer?.cpf)}
                inputMode="numeric"
                maxLength={14}
                required
                className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 ${
                  cpfError
                    ? "border-red-400 focus:border-red-500 focus:ring-red-200"
                    : "border-gray-200 focus:border-primary focus:ring-primary"
                } ${customer?.cpf ? "bg-gray-50 text-gray-500" : ""}`}
              />
              {cpfError && (
                <p className="mt-1 text-xs text-red-500">{cpfError}</p>
              )}
              {!cpfError && (
                <p className="mt-1 text-xs text-gray-500">
                  {customer?.cpf
                    ? "Para alterar o CPF, edite no seu cadastro."
                    : "CPF é obrigatório para finalizar o pedido."}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Endereco */}
        {orderType === "DELIVERY" && (
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">Endereço de entrega</h2>

            {customer ? (
              addressMode === "new" || addressMode === "edit" ? (
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
              ) : (
                <div className="space-y-3">
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

                  {/* Verificar endereco — so aparece com endereco selecionado */}
                  {selectedAddressIndex !== null && !areaChecked && (
                    <button
                      type="button"
                      onClick={handleCheckArea}
                      disabled={!canCheckArea || isCheckingArea}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/30 py-2.5 text-sm font-medium text-primary hover:border-primary/60 hover:bg-primary/5 disabled:opacity-50"
                    >
                      {isCheckingArea ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Verificando...
                        </>
                      ) : (
                        <>
                          <MapPin className="h-4 w-4" />
                          Verificar endereço
                        </>
                      )}
                    </button>
                  )}

                  {/* Area result: found */}
                  {areaChecked && deliveryArea && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-green-800">
                            Área: {deliveryArea.name}
                          </p>
                          <p className="text-sm text-green-700">
                            {isFreeDelivery ? (
                              <span className="font-semibold">Frete grátis!</span>
                            ) : (
                              <>
                                Taxa:{" "}
                                {formatCurrency(parseFloat(deliveryArea.deliveryFee))}
                              </>
                            )}
                          </p>
                          {deliveryArea.estimatedMinutes && (
                            <p className="flex items-center gap-1 text-xs text-green-600">
                              <Clock className="h-3 w-3" />
                              Tempo estimado: {deliveryArea.estimatedMinutes} min
                            </p>
                          )}
                          {deliveryArea.freeDeliveryAbove && !isFreeDelivery && (
                            <p className="mt-1 text-xs text-green-600">
                              Frete grátis acima de{" "}
                              {formatCurrency(
                                parseFloat(deliveryArea.freeDeliveryAbove)
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Area result: not found */}
                  {areaChecked && outsideArea && (
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600" />
                        <div>
                          <p className="text-sm font-semibold text-yellow-800">
                            Endereço fora da área de entrega
                          </p>
                          <p className="text-xs text-yellow-600">
                            Seu pedido pode ser feito, mas a taxa de entrega
                            será combinada com o restaurante.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : (
              // Cliente nao logado: form inline simples
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="CEP"
                      value={address.zipCode}
                      onChange={(e) => {
                        const formatted = formatCep(e.target.value);
                        setAddress((a) => ({ ...a, zipCode: formatted }));
                        setCepError("");
                      }}
                      required={!(areaChecked && deliveryArea)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    {cepLoading && (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
                    )}
                  </div>
                </div>
                {cepError && <p className="text-xs text-red-500">{cepError}</p>}

                <input
                  type="text"
                  placeholder="Rua"
                  value={address.street}
                  onChange={(e) => {
                    setAddress((a) => ({ ...a, street: e.target.value }));
                    setAreaChecked(false);
                  }}
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Numero"
                    value={address.number}
                    onChange={(e) => {
                      setAddress((a) => ({ ...a, number: e.target.value }));
                      setAreaChecked(false);
                    }}
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
                    onChange={(e) => {
                      setAddress((a) => ({ ...a, city: e.target.value }));
                      setAreaChecked(false);
                    }}
                    required
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    type="text"
                    placeholder="UF"
                    maxLength={2}
                    value={address.state}
                    onChange={(e) => {
                      setAddress((a) => ({
                        ...a,
                        state: e.target.value.toUpperCase(),
                      }));
                      setAreaChecked(false);
                    }}
                    required
                    className="w-16 rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {!areaChecked && (
                  <button
                    type="button"
                    onClick={handleCheckArea}
                    disabled={!canCheckArea || isCheckingArea}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/30 py-2.5 text-sm font-medium text-primary hover:border-primary/60 hover:bg-primary/5 disabled:opacity-50"
                  >
                    {isCheckingArea ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        <MapPin className="h-4 w-4" />
                        Verificar endereço
                      </>
                    )}
                  </button>
                )}

                {areaChecked && deliveryArea && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-green-800">
                          Área: {deliveryArea.name}
                        </p>
                        <p className="text-sm text-green-700">
                          {isFreeDelivery ? (
                            <span className="font-semibold">Frete grátis!</span>
                          ) : (
                            <>
                              Taxa:{" "}
                              {formatCurrency(parseFloat(deliveryArea.deliveryFee))}
                            </>
                          )}
                        </p>
                        {deliveryArea.estimatedMinutes && (
                          <p className="flex items-center gap-1 text-xs text-green-600">
                            <Clock className="h-3 w-3" />
                            Tempo estimado: {deliveryArea.estimatedMinutes} min
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {areaChecked && outsideArea && (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600" />
                      <div>
                        <p className="text-sm font-semibold text-yellow-800">
                          Endereço fora da área de entrega
                        </p>
                        <p className="text-xs text-yellow-600">
                          Seu pedido pode ser feito, mas a taxa de entrega
                          será combinada com o restaurante.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Pagamento */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">Forma de pagamento</h2>
          <div className="space-y-2">
            {paymentMethods.map((method) => (
              <label
                key={method.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors ${
                  paymentMethodId === method.id
                    ? "border-primary bg-primary/5"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  value={method.id}
                  checked={paymentMethodId === method.id}
                  onChange={(e) => setPaymentMethodId(e.target.value)}
                  className="accent-primary"
                />
                <span className="text-sm font-medium">{method.label}</span>
              </label>
            ))}
          </div>
          {selectedMethod?.code === "CASH" && (
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
                    placeholder="Codigo do cupom"
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
          customerPhone={stripPhone(customerPhone)}
        />

        {/* Observacoes */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">Observacoes</h2>
          <textarea
            placeholder="Alguma observacao para o restaurante?"
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
                <div
                  className={`flex justify-between ${isFreeDelivery ? "text-green-600" : "text-gray-500"}`}
                >
                  <span>Taxa de entrega</span>
                  <span>
                    {deliveryFee === 0
                      ? isFreeDelivery
                        ? "Frete gratis!"
                        : "Gratis"
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

        {/* Aviso pedido minimo */}
        {isBelowMinimum && (
          <div className="flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-yellow-600" />
            <p className="text-sm text-yellow-800">
              Pedido minimo de{" "}
              <strong>{formatCurrency(minOrder)}</strong>. Faltam{" "}
              <strong>{formatCurrency(minOrder - subtotal)}</strong>.
            </p>
          </div>
        )}

        {/* Termos e Privacidade */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <label className="flex cursor-pointer items-start gap-3">
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
                Politica de Privacidade
              </a>
            </span>
          </label>
        </section>

        {/* Botao */}
        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="w-full rounded-full bg-primary py-4 text-center font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {!isOpen
            ? "Restaurante fechado"
            : isSubmitting
              ? "Enviando pedido..."
              : `Confirmar pedido - ${formatCurrency(total)}`}
        </button>
      </form>
    </div>
  );
}
