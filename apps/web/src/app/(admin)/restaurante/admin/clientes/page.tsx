"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";
import {
  Users,
  Search,
  Plus,
  Phone,
  CreditCard,
  Calendar,
  Loader2,
  Mail,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function ClientesPage() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");

  const limit = 10;

  const { data, isLoading } = trpc.customer.listTopCustomers.useQuery({
    query: searchQuery,
    page,
    limit,
  });

  const createMutation = trpc.customer.create.useMutation({
    onSuccess: () => {
      utils.customer.listTopCustomers.invalidate();
      setShowForm(false);
      resetForm();
    },
  });

  function resetForm() {
    setName("");
    setPhone("");
    setCpf("");
    setEmail("");
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchQuery(search);
    setPage(1);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      name,
      phone,
      cpf: cpf ? cpf.replace(/\D/g, "") : undefined,
      email: email || undefined,
    });
  }

  function formatCpf(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9)
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  function handleCpfChange(value: string) {
    setCpf(formatCpf(value));
  }

  const customers = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="mt-1 text-muted-foreground">
            Gerencie seus clientes e visualize o historico de compras
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            resetForm();
          }}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo Cliente
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="relative flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone ou CPF..."
            className="w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          type="submit"
          className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/80"
        >
          <Search className="h-4 w-4" />
          Buscar
        </button>
      </form>

      {/* Create Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-border bg-card p-4"
        >
          <h3 className="mb-3 font-semibold text-foreground">Novo Cliente</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Nome */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Nome *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome completo"
                  required
                  className="w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Telefone */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Telefone *
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  required
                  className="w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* CPF */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                CPF
              </label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => handleCpfChange(e.target.value)}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Error */}
          {createMutation.error && (
            <div className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {createMutation.error.message}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending || !name.trim() || !phone.trim()}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Criar
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Customer List */}
      <div className="space-y-2">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {!isLoading && customers.length === 0 && (
          <div className="rounded-lg border border-dashed border-border py-12 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">
              {searchQuery
                ? "Nenhum cliente encontrado com essa busca."
                : "Nenhum cliente cadastrado ainda."}
            </p>
          </div>
        )}

        {customers.map((customer: (typeof customers)[number]) => (
          <div
            key={customer.id}
            onClick={() =>
              router.push(`/restaurante/admin/clientes/${customer.id}`)
            }
            className="cursor-pointer rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                {/* Name and contact */}
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-bold text-foreground truncate">
                    {customer.name}
                  </h3>
                  {customer.phone && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {customer.phone}
                    </span>
                  )}
                  {customer.cpf && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CreditCard className="h-3 w-3" />
                      {customer.cpf}
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                  <span>
                    {customer.totalOrders} pedidos |{" "}
                    {formatCurrency(parseFloat(String(customer.totalSpent)))} gasto
                  </span>
                </div>

                {/* Last order */}
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {customer.lastOrderAt ? (
                    <span>
                      Ultimo pedido:{" "}
                      {new Date(customer.lastOrderAt).toLocaleDateString(
                        "pt-BR"
                      )}
                    </span>
                  ) : (
                    <span>Nenhum pedido</span>
                  )}
                </div>
              </div>

              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </button>
          <span className="text-sm text-muted-foreground">
            Pagina {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
          >
            Proximo
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
