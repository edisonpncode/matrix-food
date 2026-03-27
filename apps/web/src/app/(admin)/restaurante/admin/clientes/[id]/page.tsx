"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";
import {
  ArrowLeft,
  Pencil,
  Phone,
  CreditCard,
  Mail,
  Calendar,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Loader2,
  Plus,
  Trash2,
  MapPin,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
  User,
} from "lucide-react";

type OrderType = "COUNTER" | "TABLE" | "PICKUP" | "DELIVERY";
type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "PICKED_UP"
  | "CANCELLED";

const TYPE_CONFIG: Record<OrderType, { label: string; color: string }> = {
  COUNTER: { label: "Balcao", color: "bg-gray-100 text-gray-700" },
  TABLE: { label: "Mesa", color: "bg-blue-100 text-blue-700" },
  PICKUP: { label: "Retirada", color: "bg-orange-100 text-orange-700" },
  DELIVERY: { label: "Entrega", color: "bg-green-100 text-green-700" },
};

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string }> = {
  PENDING: { label: "Pendente", color: "bg-yellow-100 text-yellow-700" },
  CONFIRMED: { label: "Confirmado", color: "bg-blue-100 text-blue-700" },
  PREPARING: { label: "Preparando", color: "bg-orange-100 text-orange-700" },
  READY: { label: "Pronto", color: "bg-green-100 text-green-700" },
  OUT_FOR_DELIVERY: {
    label: "Saiu entrega",
    color: "bg-purple-100 text-purple-700",
  },
  DELIVERED: { label: "Entregue", color: "bg-gray-100 text-gray-700" },
  PICKED_UP: { label: "Retirado", color: "bg-gray-100 text-gray-700" },
  CANCELLED: { label: "Cancelado", color: "bg-red-100 text-red-700" },
};

const PAYMENT_LABELS: Record<string, string> = {
  PIX: "PIX",
  CASH: "Dinheiro",
  CREDIT_CARD: "Cartao Credito",
  DEBIT_CARD: "Cartao Debito",
};

export default function ClienteDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const utils = trpc.useUtils();

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCpf, setEditCpf] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addrLabel, setAddrLabel] = useState("");
  const [addrStreet, setAddrStreet] = useState("");
  const [addrNumber, setAddrNumber] = useState("");
  const [addrComplement, setAddrComplement] = useState("");
  const [addrNeighborhood, setAddrNeighborhood] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrZipCode, setAddrZipCode] = useState("");
  const [addrReferencePoint, setAddrReferencePoint] = useState("");

  const [orderPage, setOrderPage] = useState(1);
  const orderLimit = 10;

  const { data: customer, isLoading } = trpc.customer.getById.useQuery({ id });

  const { data: orderData, isLoading: ordersLoading } =
    trpc.customer.getOrderHistory.useQuery({
      customerId: id,
      page: orderPage,
      limit: orderLimit,
    });

  const updateMutation = trpc.customer.update.useMutation({
    onSuccess: () => {
      utils.customer.getById.invalidate({ id });
      setEditing(false);
    },
  });

  const addAddressMutation = trpc.customer.addAddress.useMutation({
    onSuccess: () => {
      utils.customer.getById.invalidate({ id });
      setShowAddressForm(false);
      resetAddressForm();
    },
  });

  const removeAddressMutation = trpc.customer.removeAddress.useMutation({
    onSuccess: () => {
      utils.customer.getById.invalidate({ id });
    },
  });

  function resetAddressForm() {
    setAddrLabel("");
    setAddrStreet("");
    setAddrNumber("");
    setAddrComplement("");
    setAddrNeighborhood("");
    setAddrCity("");
    setAddrState("");
    setAddrZipCode("");
    setAddrReferencePoint("");
  }

  function startEdit() {
    if (!customer) return;
    setEditName(customer.name);
    setEditPhone(customer.phone ?? "");
    setEditCpf(customer.cpf ?? "");
    setEditEmail(customer.email ?? "");
    setEditing(true);
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    updateMutation.mutate({
      id,
      name: editName,
      phone: editPhone || undefined,
      cpf: editCpf ? editCpf.replace(/\D/g, "") : undefined,
      email: editEmail || undefined,
    });
  }

  function handleAddAddress(e: React.FormEvent) {
    e.preventDefault();
    addAddressMutation.mutate({
      customerId: id,
      address: {
        label: addrLabel,
        street: addrStreet,
        number: addrNumber,
        complement: addrComplement || undefined,
        neighborhood: addrNeighborhood,
        city: addrCity,
        state: addrState,
        zipCode: addrZipCode,
        referencePoint: addrReferencePoint || undefined,
      },
    });
  }

  function handleRemoveAddress(index: number) {
    if (confirm("Tem certeza que deseja remover este endereco?")) {
      removeAddressMutation.mutate({ customerId: id, index });
    }
  }

  function formatCpfDisplay(value: string): string {
    const digits = value.replace(/\D/g, "");
    if (digits.length !== 11) return value;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  function formatCpfInput(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9)
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="space-y-4">
        <Link
          href="/restaurante/admin/clientes"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <div className="rounded-lg border border-dashed border-border py-12 text-center">
          <User className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Cliente nao encontrado.</p>
        </div>
      </div>
    );
  }

  const stats = customer.tenantStats ?? {
    totalOrders: 0,
    totalSpent: "0",
    firstOrderAt: null,
    lastOrderAt: null,
    loyaltyPointsBalance: 0,
    isBlocked: false,
  };
  const ticketMedio =
    stats.totalOrders > 0 ? parseFloat(String(stats.totalSpent)) / stats.totalOrders : 0;
  const orders = orderData?.items ?? [];
  const orderTotalPages = orderData?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href="/restaurante/admin/clientes"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      {/* Customer Header Card */}
      <div className="rounded-lg border border-border bg-card p-4">
        {editing ? (
          <form onSubmit={handleSaveEdit}>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              Editar Cliente
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Nome
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Telefone
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  CPF
                </label>
                <input
                  type="text"
                  value={editCpf}
                  onChange={(e) => setEditCpf(formatCpfInput(e.target.value))}
                  maxLength={14}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Email
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {updateMutation.error && (
              <div className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {updateMutation.error.message}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={updateMutation.isPending || !editName.trim()}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {updateMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                <Save className="h-4 w-4" />
                Salvar
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">
                {customer.name}
              </h2>
              <button
                onClick={startEdit}
                className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-2 flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
              {customer.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {customer.phone}
                </span>
              )}
              {customer.cpf && (
                <span className="flex items-center gap-1">
                  <CreditCard className="h-4 w-4" />
                  {formatCpfDisplay(customer.cpf)}
                </span>
              )}
              {customer.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {customer.email}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShoppingCart className="h-4 w-4" />
            Total Pedidos
          </div>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {stats.totalOrders}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            Total Gasto
          </div>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {formatCurrency(parseFloat(String(stats.totalSpent)))}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            Ticket Medio
          </div>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {formatCurrency(ticketMedio)}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Ultimo Pedido
          </div>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {stats.lastOrderAt
              ? new Date(stats.lastOrderAt).toLocaleDateString("pt-BR")
              : "Nunca"}
          </p>
        </div>
      </div>

      {/* Addresses Section */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Enderecos</h3>
          <button
            onClick={() => {
              setShowAddressForm(!showAddressForm);
              resetAddressForm();
            }}
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Adicionar Endereco
          </button>
        </div>

        {/* Add Address Form */}
        {showAddressForm && (
          <form onSubmit={handleAddAddress} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Rotulo *
                </label>
                <input
                  type="text"
                  value={addrLabel}
                  onChange={(e) => setAddrLabel(e.target.value)}
                  placeholder="Ex: Casa, Trabalho"
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-2">
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Rua *
                </label>
                <input
                  type="text"
                  value={addrStreet}
                  onChange={(e) => setAddrStreet(e.target.value)}
                  placeholder="Nome da rua"
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Numero *
                </label>
                <input
                  type="text"
                  value={addrNumber}
                  onChange={(e) => setAddrNumber(e.target.value)}
                  placeholder="123"
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Complemento
                </label>
                <input
                  type="text"
                  value={addrComplement}
                  onChange={(e) => setAddrComplement(e.target.value)}
                  placeholder="Apto, Bloco..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Bairro *
                </label>
                <input
                  type="text"
                  value={addrNeighborhood}
                  onChange={(e) => setAddrNeighborhood(e.target.value)}
                  placeholder="Bairro"
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Cidade *
                </label>
                <input
                  type="text"
                  value={addrCity}
                  onChange={(e) => setAddrCity(e.target.value)}
                  placeholder="Cidade"
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Estado *
                </label>
                <input
                  type="text"
                  value={addrState}
                  onChange={(e) => setAddrState(e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="SP"
                  maxLength={2}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  CEP *
                </label>
                <input
                  type="text"
                  value={addrZipCode}
                  onChange={(e) => setAddrZipCode(e.target.value)}
                  placeholder="00000-000"
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Ponto de Referencia
                </label>
                <input
                  type="text"
                  value={addrReferencePoint}
                  onChange={(e) => setAddrReferencePoint(e.target.value)}
                  placeholder="Proximo ao mercado..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {addAddressMutation.error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {addAddressMutation.error.message}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={
                  addAddressMutation.isPending ||
                  !addrLabel.trim() ||
                  !addrStreet.trim() ||
                  !addrNumber.trim() ||
                  !addrNeighborhood.trim() ||
                  !addrCity.trim() ||
                  !addrState.trim() ||
                  !addrZipCode.trim()
                }
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {addAddressMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Salvar Endereco
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddressForm(false);
                  resetAddressForm();
                }}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Address List */}
        <div className="mt-4 space-y-2">
          {(!customer.addresses || (Array.isArray(customer.addresses) && customer.addresses.length === 0)) && (
            <p className="text-sm text-muted-foreground">
              Nenhum endereco cadastrado.
            </p>
          )}
          {Array.isArray(customer.addresses) &&
            customer.addresses.map(
              (
                addr: {
                  label: string;
                  street: string;
                  number: string;
                  complement?: string;
                  neighborhood: string;
                  city: string;
                  state: string;
                  zipCode: string;
                  referencePoint?: string;
                },
                index: number
              ) => (
                <div
                  key={index}
                  className="flex items-start justify-between rounded-md border border-border bg-background p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-primary" />
                      <span className="font-medium text-foreground">
                        {addr.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {addr.street}, {addr.number}
                      {addr.complement && ` - ${addr.complement}`} -{" "}
                      {addr.neighborhood}, {addr.city}/{addr.state} -{" "}
                      {addr.zipCode}
                    </p>
                    {addr.referencePoint && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Ref: {addr.referencePoint}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveAddress(index)}
                    disabled={removeAddressMutation.isPending}
                    className="ml-2 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Remover endereco"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            )}
        </div>
      </div>

      {/* Order History Section */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-lg font-semibold text-foreground">
          Historico de Pedidos
        </h3>

        {ordersLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {!ordersLoading && orders.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhum pedido encontrado.
          </p>
        )}

        {orders.length > 0 && (
          <>
            {/* Desktop Table */}
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Data</th>
                    <th className="pb-2 font-medium">Numero</th>
                    <th className="pb-2 font-medium">Tipo</th>
                    <th className="pb-2 font-medium">Total</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Pagamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((order: (typeof orders)[number]) => {
                    const typeConfig =
                      TYPE_CONFIG[order.type as OrderType] ?? {
                        label: order.type,
                        color: "bg-gray-100 text-gray-700",
                      };
                    const statusConfig =
                      STATUS_CONFIG[order.status as OrderStatus] ?? {
                        label: order.status,
                        color: "bg-gray-100 text-gray-700",
                      };
                    return (
                      <tr key={order.id} className="text-foreground">
                        <td className="py-2.5">
                          {new Date(order.createdAt).toLocaleDateString(
                            "pt-BR"
                          )}
                        </td>
                        <td className="py-2.5 font-medium">
                          #{order.displayNumber}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeConfig.color}`}
                          >
                            {typeConfig.label}
                          </span>
                        </td>
                        <td className="py-2.5 font-medium">
                          {formatCurrency(
                            typeof order.total === "string"
                              ? parseFloat(order.total)
                              : order.total
                          )}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig.color}`}
                          >
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="py-2.5 text-muted-foreground">
                          {PAYMENT_LABELS[order.paymentMethod] ??
                            order.paymentMethod}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="mt-4 space-y-2 md:hidden">
              {orders.map((order: (typeof orders)[number]) => {
                const typeConfig =
                  TYPE_CONFIG[order.type as OrderType] ?? {
                    label: order.type,
                    color: "bg-gray-100 text-gray-700",
                  };
                const statusConfig =
                  STATUS_CONFIG[order.status as OrderStatus] ?? {
                    label: order.status,
                    color: "bg-gray-100 text-gray-700",
                  };
                return (
                  <div
                    key={order.id}
                    className="rounded-md border border-border bg-background p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">
                        #{order.displayNumber}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeConfig.color}`}
                      >
                        {typeConfig.label}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig.color}`}
                      >
                        {statusConfig.label}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {PAYMENT_LABELS[order.paymentMethod] ??
                          order.paymentMethod}
                      </span>
                      <span className="font-bold text-foreground">
                        {formatCurrency(
                          typeof order.total === "string"
                            ? parseFloat(order.total)
                            : order.total
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Order Pagination */}
            {orderTotalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
                  disabled={orderPage <= 1}
                  className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </button>
                <span className="text-sm text-muted-foreground">
                  Pagina {orderPage} de {orderTotalPages}
                </span>
                <button
                  onClick={() =>
                    setOrderPage((p) => Math.min(orderTotalPages, p + 1))
                  }
                  disabled={orderPage >= orderTotalPages}
                  className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
                >
                  Proximo
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
