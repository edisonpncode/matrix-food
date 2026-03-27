"use client";

import { useState, useCallback } from "react";
import { Search, UserPlus, Check, MapPin, Phone, CreditCard } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface CustomerAddress {
  label: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  referencePoint?: string;
  lat?: number;
  lng?: number;
}

interface SelectedCustomer {
  id: string;
  name: string;
  phone: string;
  cpf?: string | null;
  addresses?: CustomerAddress[];
}

interface CustomerSearchProps {
  onCustomerSelected: (customer: SelectedCustomer) => void;
  requireAddress?: boolean;
}

type SearchMode = "phone" | "cpf";

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function CustomerSearch({
  onCustomerSelected,
  requireAddress,
}: CustomerSearchProps) {
  const [searchMode, setSearchMode] = useState<SearchMode>("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [cpfInput, setCpfInput] = useState("");
  const [searched, setSearched] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedAddressIdx, setSelectedAddressIdx] = useState<number | null>(null);

  // New customer form
  const [newName, setNewName] = useState("");
  const [newCpf, setNewCpf] = useState("");

  const phoneDigits = phoneInput.replace(/\D/g, "");
  const cpfDigits = cpfInput.replace(/\D/g, "");

  // Search by phone
  const phoneQuery = trpc.customer.searchByPhone.useQuery(
    { phone: phoneDigits },
    { enabled: false }
  );

  // Search by CPF
  const cpfQuery = trpc.customer.searchByCpf.useQuery(
    { cpf: cpfDigits },
    { enabled: false }
  );

  const createCustomer = trpc.customer.create.useMutation();

  const isSearching = phoneQuery.isFetching || cpfQuery.isFetching;
  const foundCustomer = searchMode === "phone" ? phoneQuery.data : cpfQuery.data;

  const handleSearch = useCallback(async () => {
    setSearched(true);
    setShowNewForm(false);
    setSelectedAddressIdx(null);
    if (searchMode === "phone") {
      await phoneQuery.refetch();
    } else {
      await cpfQuery.refetch();
    }
  }, [searchMode, phoneQuery, cpfQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleSelectCustomer = (customer: SelectedCustomer, addressIdx?: number) => {
    if (requireAddress && customer.addresses && customer.addresses.length > 0 && addressIdx !== undefined) {
      // Include only the selected address
      const selectedAddr = customer.addresses[addressIdx];
      if (!selectedAddr) return;
      onCustomerSelected({
        ...customer,
        addresses: [selectedAddr],
      });
    } else {
      onCustomerSelected(customer);
    }
  };

  const handleCreateCustomer = async () => {
    if (!newName.trim()) return;
    try {
      const created = await createCustomer.mutateAsync({
        name: newName.trim(),
        phone: phoneDigits,
        cpf: newCpf.replace(/\D/g, "") || undefined,
      });
      if (!created) return;
      onCustomerSelected({
        id: created.id,
        name: created.name,
        phone: created.phone ?? "",
        cpf: created.cpf ?? undefined,
      });
    } catch {
      // Error handled by tRPC
    }
  };

  return (
    <div className="space-y-3">
      {/* Search mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setSearchMode("phone");
            setSearched(false);
            setShowNewForm(false);
          }}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            searchMode === "phone"
              ? "bg-primary text-white"
              : "border border-border hover:border-primary/50"
          }`}
        >
          <Phone className="h-3 w-3" />
          Telefone
        </button>
        <button
          type="button"
          onClick={() => {
            setSearchMode("cpf");
            setSearched(false);
            setShowNewForm(false);
          }}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            searchMode === "cpf"
              ? "bg-primary text-white"
              : "border border-border hover:border-primary/50"
          }`}
        >
          <CreditCard className="h-3 w-3" />
          CPF
        </button>
      </div>

      {/* Search input */}
      <div className="flex gap-2">
        {searchMode === "phone" ? (
          <input
            type="text"
            value={phoneInput}
            onChange={(e) => {
              setPhoneInput(formatPhone(e.target.value));
              setSearched(false);
            }}
            onKeyDown={handleKeyDown}
            placeholder="(00) 00000-0000"
            className="flex-1 rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          <input
            type="text"
            value={cpfInput}
            onChange={(e) => {
              setCpfInput(formatCPF(e.target.value));
              setSearched(false);
            }}
            onKeyDown={handleKeyDown}
            placeholder="000.000.000-00"
            className="flex-1 rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        )}
        <button
          type="button"
          onClick={handleSearch}
          disabled={
            isSearching ||
            (searchMode === "phone" ? phoneDigits.length < 10 : cpfDigits.length < 11)
          }
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          <Search className="h-4 w-4" />
          Buscar
        </button>
      </div>

      {/* Search results */}
      {searched && !isSearching && (
        <>
          {foundCustomer ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-green-800">
                    {foundCustomer.name}
                  </p>
                  <p className="text-xs text-green-600">
                    {foundCustomer.phone}
                    {foundCustomer.cpf && ` | CPF: ${formatCPF(foundCustomer.cpf)}`}
                  </p>
                </div>
                {!(requireAddress && foundCustomer.addresses && foundCustomer.addresses.length > 0) && (
                  <button
                    type="button"
                    onClick={() => handleSelectCustomer(foundCustomer as SelectedCustomer)}
                    className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Selecionar
                  </button>
                )}
              </div>

              {/* Address selection when required */}
              {requireAddress && foundCustomer.addresses && foundCustomer.addresses.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-green-700">
                    Selecione um endereco:
                  </p>
                  {foundCustomer.addresses.map((addr: CustomerAddress, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedAddressIdx(idx);
                        handleSelectCustomer(foundCustomer as SelectedCustomer, idx);
                      }}
                      className={`flex w-full items-start gap-2 rounded-lg border p-2 text-left text-xs transition-colors ${
                        selectedAddressIdx === idx
                          ? "border-primary bg-primary/5"
                          : "border-green-200 hover:border-green-400"
                      }`}
                    >
                      <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-600" />
                      <span>
                        {addr.label && <strong>{addr.label}: </strong>}
                        {addr.street}, {addr.number}
                        {addr.complement && ` - ${addr.complement}`}
                        {" - "}
                        {addr.neighborhood}, {addr.city}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
              <p className="text-sm text-yellow-800">
                Cliente nao encontrado.
              </p>
              {!showNewForm && (
                <button
                  type="button"
                  onClick={() => {
                    setShowNewForm(true);
                    setNewCpf("");
                    setNewName("");
                  }}
                  className="mt-2 flex items-center gap-1.5 rounded-lg bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-700"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Novo Cliente
                </button>
              )}
            </div>
          )}
        </>
      )}

      {isSearching && (
        <div className="flex items-center justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="ml-2 text-sm text-muted-foreground">Buscando...</span>
        </div>
      )}

      {/* New customer form */}
      {showNewForm && (
        <div className="space-y-3 rounded-lg border p-3">
          <h4 className="text-sm font-semibold">Novo Cliente</h4>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Nome *
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do cliente"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Telefone
            </label>
            <input
              type="text"
              value={phoneInput}
              disabled
              className="w-full rounded-lg border bg-muted px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              CPF (opcional)
            </label>
            <input
              type="text"
              value={newCpf}
              onChange={(e) => setNewCpf(formatCPF(e.target.value))}
              placeholder="000.000.000-00"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <button
            type="button"
            onClick={handleCreateCustomer}
            disabled={!newName.trim() || createCustomer.isPending}
            className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {createCustomer.isPending ? "Salvando..." : "Salvar"}
          </button>

          {createCustomer.isError && (
            <p className="text-xs text-red-500">
              Erro ao salvar cliente. Tente novamente.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
