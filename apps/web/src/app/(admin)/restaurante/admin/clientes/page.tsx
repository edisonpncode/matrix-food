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
  Loader2,
  Mail,
  User,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";

export default function ClientesPage() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);

  // Sort
  type SortKey = "name" | "phone" | "cpf" | "neighborhood" | "firstOrderAt" | "lastOrderAt" | "totalOrders" | "loyaltyPointsBalance" | "totalSpent" | "ticketMedio" | "source";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // Form fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");

  const limit = 20;

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

  const deleteMutation = trpc.customer.delete.useMutation({
    onSuccess: () => {
      utils.customer.listTopCustomers.invalidate();
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
      source: "MANUAL",
    });
  }

  function handleDelete(id: string, customerName: string) {
    if (confirm(`Tem certeza que deseja excluir o cliente "${customerName}"?`)) {
      deleteMutation.mutate({ id });
    }
  }

  function formatCpf(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9)
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  function formatPhoneInput(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  function formatDateTime(date: Date | string | null): string {
    if (!date) return "-";
    const d = new Date(date);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getNeighborhood(addresses: unknown): string {
    if (!Array.isArray(addresses) || addresses.length === 0) return "-";
    const first = addresses[0] as { neighborhood?: string };
    return first?.neighborhood || "-";
  }

  const SOURCE_LABELS: Record<string, string> = {
    POS: "POS",
    ONLINE: "App/Site",
    MANUAL: "Manual",
  };

  function getSourceLabel(source: string | null | undefined): string {
    if (!source) return "-";
    return SOURCE_LABELS[source] ?? source;
  }

  const rawCustomers = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalCustomers = data?.total ?? 0;

  // Ordenação client-side
  const customers = [...rawCustomers].sort((a, b) => {
    if (!sortKey) return 0;
    const dir = sortDir === "asc" ? 1 : -1;

    switch (sortKey) {
      case "name":
        return dir * (a.name || "").localeCompare(b.name || "");
      case "phone":
        return dir * (a.phone || "").localeCompare(b.phone || "");
      case "cpf":
        return dir * (a.cpf || "").localeCompare(b.cpf || "");
      case "neighborhood": {
        const na = getNeighborhood(a.addresses);
        const nb = getNeighborhood(b.addresses);
        return dir * na.localeCompare(nb);
      }
      case "firstOrderAt": {
        const da = a.firstOrderAt ? new Date(a.firstOrderAt).getTime() : 0;
        const db = b.firstOrderAt ? new Date(b.firstOrderAt).getTime() : 0;
        return dir * (da - db);
      }
      case "lastOrderAt": {
        const da = a.lastOrderAt ? new Date(a.lastOrderAt).getTime() : 0;
        const db = b.lastOrderAt ? new Date(b.lastOrderAt).getTime() : 0;
        return dir * (da - db);
      }
      case "totalOrders":
        return dir * (a.totalOrders - b.totalOrders);
      case "loyaltyPointsBalance":
        return dir * (a.loyaltyPointsBalance - b.loyaltyPointsBalance);
      case "totalSpent":
        return dir * (parseFloat(String(a.totalSpent)) - parseFloat(String(b.totalSpent)));
      case "ticketMedio": {
        const ta = a.totalOrders > 0 ? parseFloat(String(a.totalSpent)) / a.totalOrders : 0;
        const tb = b.totalOrders > 0 ? parseFloat(String(b.totalSpent)) / b.totalOrders : 0;
        return dir * (ta - tb);
      }
      case "source":
        return dir * (a.source || "").localeCompare(b.source || "");
      default:
        return 0;
    }
  });

  // Componente do cabeçalho ordenável
  function SortHeader({ label, column, align }: { label: string; column: SortKey; align?: "center" | "right" }) {
    const isActive = sortKey === column;
    const alignClass = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
    return (
      <th
        className={`px-3 py-2.5 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors ${align === "right" ? "text-right" : align === "center" ? "text-center" : ""}`}
        onClick={() => toggleSort(column)}
      >
        <span className={`inline-flex items-center gap-1 ${alignClass}`}>
          {label}
          {isActive ? (
            sortDir === "asc" ? (
              <ArrowUp className="h-3 w-3 text-primary" />
            ) : (
              <ArrowDown className="h-3 w-3 text-primary" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-30" />
          )}
        </span>
      </th>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCustomers} clientes cadastrados
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

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Telefone *
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                  placeholder="(00) 00000-0000"
                  required
                  className="w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                CPF
              </label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
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

      {/* Customer Table */}
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

      {!isLoading && customers.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <SortHeader label="Cliente" column="name" />
                <SortHeader label="Telefone" column="phone" />
                <SortHeader label="CPF" column="cpf" />
                <SortHeader label="Bairro" column="neighborhood" />
                <SortHeader label="Cliente desde" column="firstOrderAt" />
                <SortHeader label="Ultimo pedido" column="lastOrderAt" />
                <SortHeader label="Compras" column="totalOrders" align="center" />
                <SortHeader label="Pontos" column="loyaltyPointsBalance" align="center" />
                <SortHeader label="Faturado" column="totalSpent" align="right" />
                <SortHeader label="Ticket medio" column="ticketMedio" align="right" />
                <SortHeader label="Origem" column="source" />
                <th className="px-3 py-2.5 font-medium text-muted-foreground text-center">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map((customer) => {
                const totalSpent = parseFloat(String(customer.totalSpent));
                const ticketMedio =
                  customer.totalOrders > 0 ? totalSpent / customer.totalOrders : 0;
                return (
                  <tr
                    key={customer.id}
                    className="text-foreground hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                      {customer.name}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      {customer.phone || "-"}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      {customer.cpf || "-"}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      {getNeighborhood(customer.addresses)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      {formatDateTime(customer.firstOrderAt)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      {formatDateTime(customer.lastOrderAt)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {customer.totalOrders}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {customer.loyaltyPointsBalance}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium">
                      {formatCurrency(totalSpent)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">
                      {formatCurrency(ticketMedio)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {customer.source ? (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                          {getSourceLabel(customer.source)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() =>
                            router.push(`/restaurante/admin/clientes/${customer.id}`)
                          }
                          className="rounded-md p-1.5 text-primary hover:bg-primary/10 transition-colors"
                          title="Visualizar cliente"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(customer.id, customer.name);
                          }}
                          disabled={deleteMutation.isPending}
                          className="rounded-md p-1.5 text-destructive hover:bg-destructive/10 transition-colors"
                          title="Excluir cliente"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Pagina {page} de {totalPages} ({totalCustomers} clientes)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
            >
              Proximo
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
