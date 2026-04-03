"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@matrix-food/utils";
import { trpc } from "@/lib/trpc";
import {
  Store,
  UtensilsCrossed,
  PackageCheck,
  Truck,
  Zap,
  Search,
  X,
  Check,
  AlertTriangle,
  MapPin,
  Loader2,
} from "lucide-react";

export type OrderType = "COUNTER" | "TABLE" | "PICKUP" | "DELIVERY";

export interface CustomerData {
  id?: string;
  name: string;
  phone: string;
  cpf?: string;
  addresses?: AddressData[];
}

export interface AddressData {
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

export interface DeliveryAreaInfo {
  id: string;
  name: string;
  deliveryFee: string;
  estimatedMinutes?: number | null;
}

export interface OrderHeaderData {
  orderType: OrderType;
  customerName: string;
  customerPhone: string;
  customerId?: string;
  cpf?: string;
  tableNumber?: number;
  quickSale: boolean;
  deliveryAddress?: AddressData;
  deliveryAreaId?: string;
  deliveryFee: number;
  manualDeliveryFee?: string;
}

interface OrderTypeHeaderProps {
  onDataChange: (data: OrderHeaderData) => void;
}

const ORDER_TYPES = [
  { value: "COUNTER" as const, label: "Balcão", icon: Store },
  { value: "TABLE" as const, label: "Mesa", icon: UtensilsCrossed },
  { value: "PICKUP" as const, label: "Vem Buscar", icon: PackageCheck },
  { value: "DELIVERY" as const, label: "Tele Entrega", icon: Truck },
];

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCPFInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function OrderTypeHeader({ onDataChange }: OrderTypeHeaderProps) {
  const [orderType, setOrderType] = useState<OrderType>("COUNTER");
  const [quickSale, setQuickSale] = useState(false);

  // Customer fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [customerId, setCustomerId] = useState<string | undefined>();

  // Table
  const [tableNumber, setTableNumber] = useState("");

  // Customer search
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);

  // Delivery address
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [referencePoint, setReferencePoint] = useState("");

  // Delivery area
  const [deliveryAreaInfo, setDeliveryAreaInfo] = useState<DeliveryAreaInfo | null>(null);
  const [outsideArea, setOutsideArea] = useState(false);
  const [addressNotFound, setAddressNotFound] = useState(false);
  const [manualFee, setManualFee] = useState("");
  const [checkingArea, setCheckingArea] = useState(false);

  // Customer search query (PICKUP / DELIVERY)
  const searchEnabled = searchQuery.length >= 3 && showSearchResults;
  const { data: searchResults, isLoading: searchLoading } =
    trpc.customer.searchByPhone.useQuery(
      { phone: searchQuery },
      { enabled: searchEnabled }
    );

  // Wrap search results in array since searchByPhone returns single result or null
  const searchResultsList = searchResults ? [searchResults] : [];

  // Auto-lookup por telefone (BALCÃO / MESA)
  const isPhoneComplete = phone.replace(/\D/g, "").length >= 10;
  const autoLookupEnabled =
    (orderType === "COUNTER" || orderType === "TABLE") && isPhoneComplete && !customerId;
  const { data: autoLookupResult, isLoading: autoLookupLoading } =
    trpc.customer.searchByPhone.useQuery(
      { phone },
      { enabled: autoLookupEnabled }
    );

  // Auto-preencher nome/cpf quando cliente é encontrado pelo telefone
  useEffect(() => {
    if (!autoLookupEnabled || !autoLookupResult) return;
    if (customerId === autoLookupResult.id) return; // já preenchido

    if (!name || name === "Balcão" || name === `Mesa ${tableNumber}`) {
      setName(autoLookupResult.name);
    }
    if (!cpf && autoLookupResult.cpf) {
      setCpf(autoLookupResult.cpf);
    }
    setCustomerId(autoLookupResult.id);
  }, [autoLookupResult, autoLookupEnabled]);

  // Notify parent of changes
  useEffect(() => {
    const deliveryFeeValue = deliveryAreaInfo
      ? parseFloat(deliveryAreaInfo.deliveryFee) || 0
      : manualFee
        ? parseFloat(manualFee) || 0
        : 0;

    onDataChange({
      orderType,
      customerName:
        orderType === "COUNTER"
          ? name || "Balcão"
          : orderType === "TABLE"
            ? name || `Mesa ${tableNumber}`
            : selectedCustomer?.name || name || "",
      customerPhone:
        orderType === "COUNTER" || orderType === "TABLE"
          ? phone
          : selectedCustomer?.phone || phone || "",
      customerId: selectedCustomer?.id || customerId,
      cpf,
      tableNumber: orderType === "TABLE" ? parseInt(tableNumber) || undefined : undefined,
      quickSale: orderType === "COUNTER" && quickSale,
      deliveryAddress:
        orderType === "DELIVERY" && street
          ? { street, number, complement, neighborhood, city, state, zipCode: "", referencePoint }
          : undefined,
      deliveryAreaId: deliveryAreaInfo?.id,
      deliveryFee: orderType === "DELIVERY" ? deliveryFeeValue : 0,
      manualDeliveryFee:
        orderType === "DELIVERY" && !deliveryAreaInfo && manualFee ? manualFee : undefined,
    });
  }, [
    orderType, name, phone, cpf, customerId, tableNumber, quickSale,
    selectedCustomer, street, number, complement, neighborhood, city,
    state, referencePoint, deliveryAreaInfo, manualFee,
  ]);

  function handleSelectCustomer(c: CustomerData) {
    setSelectedCustomer(c);
    setName(c.name);
    setPhone(c.phone);
    setCpf(c.cpf || "");
    setCustomerId(c.id);
    setShowSearchResults(false);
    setSearchQuery("");

    // Auto-fill first address for delivery
    if (orderType === "DELIVERY" && c.addresses && c.addresses.length > 0) {
      const addr = c.addresses[0]!;
      setStreet(addr.street);
      setNumber(addr.number);
      setComplement(addr.complement || "");
      setNeighborhood(addr.neighborhood || "");
      setCity(addr.city || "");
      setState(addr.state || "");
      setReferencePoint(addr.referencePoint || "");
    }
  }

  // Transferir valor da busca para o campo correto (telefone ou CPF)
  function handleTransferSearchToFields() {
    const digits = searchQuery.replace(/\D/g, "");
    if (digits.length === 11 && digits[2] === "9") {
      // Celular: 11 dígitos começando com 9 no terceiro dígito
      setPhone(formatPhone(digits));
    } else if (digits.length === 10) {
      // Telefone fixo: 10 dígitos
      setPhone(formatPhone(digits));
    } else if (digits.length === 11) {
      // CPF: 11 dígitos (não é celular)
      setCpf(formatCPFInput(digits));
    } else if (digits.length >= 8 && digits.length <= 11) {
      // Assume telefone para outros tamanhos
      setPhone(formatPhone(digits));
    } else {
      // Fallback: coloca como telefone
      setPhone(formatPhone(digits));
    }
    setSearchQuery("");
    setShowSearchResults(false);
  }

  function clearCustomer() {
    setSelectedCustomer(null);
    setName("");
    setPhone("");
    setCpf("");
    setCustomerId(undefined);
    setStreet("");
    setNumber("");
    setComplement("");
    setNeighborhood("");
    setCity("");
    setState("");
    setReferencePoint("");
    setDeliveryAreaInfo(null);
    setOutsideArea(false);
    setManualFee("");
  }

  // Geocode: try structured Nominatim queries with fallback variations
  async function geocodeNominatim(): Promise<{ lat: number; lng: number } | null> {
    const streetFull = `${street} ${number}`;
    const cityVal = city || "";
    const stateVal = state || "";
    const neighborhoodVal = neighborhood || "";

    // Variation 1: structured query with neighborhood
    // Variation 2: structured query without neighborhood
    // Variation 3: free-text query with all info
    const queries = [
      // Structured: street + city + state + neighborhood in q
      `https://nominatim.openstreetmap.org/search?format=json&street=${encodeURIComponent(streetFull)}&city=${encodeURIComponent(cityVal)}&state=${encodeURIComponent(stateVal)}&country=Brazil&limit=3`,
      // Free-text with neighborhood
      neighborhoodVal
        ? `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${streetFull}, ${neighborhoodVal}, ${cityVal}, ${stateVal}, Brasil`)}&countrycodes=br&limit=3`
        : null,
      // Free-text without neighborhood
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${streetFull}, ${cityVal}, ${stateVal}, Brasil`)}&countrycodes=br&limit=3`,
      // Only street name + city (no number)
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${street}, ${cityVal}, ${stateVal}, Brasil`)}&countrycodes=br&limit=3`,
    ].filter(Boolean) as string[];

    for (const url of queries) {
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.length > 0) {
          // Prefer results that are "road" or "house" type
          const best = data.find((r: { type?: string }) => r.type === "house" || r.type === "residential") || data[0];
          if (best?.lat && best?.lon) {
            return { lat: parseFloat(best.lat), lng: parseFloat(best.lon) };
          }
        }
      } catch {
        continue;
      }
      // Small delay between requests to respect Nominatim rate limit
      await new Promise((r) => setTimeout(r, 300));
    }
    return null;
  }

  async function handleCheckArea() {
    if (!street || !number) return;
    setCheckingArea(true);
    setDeliveryAreaInfo(null);
    setOutsideArea(false);
    setAddressNotFound(false);

    try {
      const coords = await geocodeNominatim();

      if (coords) {
        // Check which delivery area this point falls in
        const areaRes = await fetch(
          `/api/trpc/deliveryArea.checkAddress?input=${encodeURIComponent(JSON.stringify({ json: { lat: coords.lat, lng: coords.lng } }))}`
        );
        const areaData = await areaRes.json();
        const area = areaData?.result?.data?.json;

        if (area && area.id) {
          setDeliveryAreaInfo({
            id: area.id,
            name: area.name,
            deliveryFee: area.deliveryFee,
            estimatedMinutes: area.estimatedMinutes,
          });
        } else {
          setOutsideArea(true);
        }
      } else {
        // Nominatim couldn't find the address at all
        setAddressNotFound(true);
      }
    } catch {
      setOutsideArea(true);
    } finally {
      setCheckingArea(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
  const smallInputClass =
    "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex">
        {/* Left: Order Type Buttons */}
        <div className="flex flex-col gap-1 border-r border-border p-2" style={{ minWidth: 140 }}>
          {ORDER_TYPES.map((opt) => {
            const Icon = opt.icon;
            const isSelected = orderType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setOrderType(opt.value);
                  // Reset specific state when switching
                  if (opt.value === "COUNTER") {
                    clearCustomer();
                  }
                }}
                className={`flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                  isSelected
                    ? "bg-primary text-white"
                    : "border border-border hover:border-primary/50 hover:bg-accent"
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Right: Type-specific Fields */}
        <div className="flex-1 p-3">
          {/* ── BALCÃO ── */}
          {orderType === "COUNTER" && (
            <div className="space-y-2">
              {/* Quick sale toggle */}
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={quickSale}
                  onChange={(e) => setQuickSale(e.target.checked)}
                  className="h-4 w-4 rounded accent-primary"
                />
                <Zap className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">Venda rápida</span>
              </label>

              <div className="flex gap-3">
                {!quickSale && (
                  <div className="flex-1">
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => {
                        setPhone(formatPhone(e.target.value));
                        // Limpar customerId se telefone mudar
                        if (customerId) { setCustomerId(undefined); }
                      }}
                      placeholder="Telefone"
                      className={inputClass}
                    />
                  </div>
                )}
                <div className={quickSale ? "flex-1" : "flex-1"}>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={quickSale ? "Nome (opcional)" : "Nome do cliente"}
                    className={inputClass}
                  />
                </div>
                <div className="w-48">
                  <input
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(formatCPFInput(e.target.value))}
                    placeholder="CPF ou CNPJ (opcional)"
                    className={inputClass}
                  />
                </div>
                {!quickSale && autoLookupLoading && isPhoneComplete && (
                  <div className="flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!quickSale && customerId && (
                  <div className="flex items-center">
                    <span className="flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs text-green-700">
                      <Check className="h-3 w-3" /> Cliente reconhecido
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── MESA ── */}
          {orderType === "TABLE" && (
            <div className="flex items-center gap-3">
              <div className="w-28">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Nº Mesa *
                </label>
                <input
                  type="number"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="0"
                  min="1"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-center text-xl font-bold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="w-44">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Telefone (opcional)
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => {
                    setPhone(formatPhone(e.target.value));
                    if (customerId) { setCustomerId(undefined); }
                  }}
                  placeholder="(00) 00000-0000"
                  className={inputClass}
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Nome (opcional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do cliente"
                  className={inputClass}
                />
              </div>
              {autoLookupLoading && isPhoneComplete && (
                <div className="flex items-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {customerId && (
                <div className="flex items-center">
                  <span className="flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs text-green-700">
                    <Check className="h-3 w-3" /> Cliente reconhecido
                  </span>
                </div>
              )}
              <div className="flex-shrink-0">
                <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  Pagamento ao fechar a mesa
                </p>
              </div>
            </div>
          )}

          {/* ── VEM BUSCAR ── */}
          {orderType === "PICKUP" && (
            <div className="space-y-2">
              {!selectedCustomer ? (
                <div className="relative">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setShowSearchResults(true);
                        }}
                        onFocus={() => searchQuery.length >= 3 && setShowSearchResults(true)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !searchLoading && searchResultsList.length === 0 && searchQuery.replace(/\D/g, "").length >= 8) {
                            handleTransferSearchToFields();
                          }
                        }}
                        placeholder="Buscar por telefone ou CPF..."
                        className="w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground self-center">ou preencha:</span>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                      placeholder="Telefone *"
                      className="w-40 rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nome *"
                      className="w-40 rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                      type="text"
                      value={cpf}
                      onChange={(e) => setCpf(formatCPFInput(e.target.value))}
                      placeholder="CPF (opcional)"
                      className="w-44 rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Search Results Dropdown */}
                  {showSearchResults && searchQuery.length >= 3 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                      {searchLoading && (
                        <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
                        </div>
                      )}
                      {!searchLoading && searchResultsList.length === 0 && (
                        <div className="p-3">
                          <p className="text-sm text-muted-foreground mb-2">Nenhum cliente encontrado.</p>
                          {searchQuery.replace(/\D/g, "").length >= 8 && (
                            <button
                              type="button"
                              onClick={handleTransferSearchToFields}
                              className="flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
                            >
                              <Check className="h-3.5 w-3.5" />
                              {searchQuery.replace(/\D/g, "").length === 11 && searchQuery.replace(/\D/g, "")[2] !== "9"
                                ? "Usar como CPF"
                                : "Usar como Telefone"}
                              <span className="text-xs text-muted-foreground ml-1">(ou Enter)</span>
                            </button>
                          )}
                        </div>
                      )}
                      {searchResultsList.map((c: { id: string; name: string; phone: string | null; cpf: string | null; addresses: unknown }) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            handleSelectCustomer({
                              id: c.id,
                              name: c.name,
                              phone: c.phone || "",
                              cpf: c.cpf || undefined,
                              addresses: c.addresses as AddressData[] | undefined,
                            })
                          }
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                        >
                          <div>
                            <span className="font-medium">{c.name}</span>
                            <span className="ml-2 text-muted-foreground">{c.phone}</span>
                            {c.cpf && (
                              <span className="ml-2 text-xs text-muted-foreground">CPF: {c.cpf}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 rounded-md border border-green-300 bg-green-50 px-3 py-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">{selectedCustomer.name}</span>
                    <span className="text-xs text-green-600">{selectedCustomer.phone}</span>
                  </div>
                  <button
                    type="button"
                    onClick={clearCustomer}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" /> Trocar
                  </button>
                  <input
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(formatCPFInput(e.target.value))}
                    placeholder="CPF (opcional)"
                    className="w-44 rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}
            </div>
          )}

          {/* ── TELE ENTREGA ── */}
          {orderType === "DELIVERY" && (
            <div className="space-y-2">
              {/* Customer search row */}
              {!selectedCustomer ? (
                <div className="relative">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setShowSearchResults(true);
                        }}
                        onFocus={() => searchQuery.length >= 3 && setShowSearchResults(true)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !searchLoading && searchResultsList.length === 0 && searchQuery.replace(/\D/g, "").length >= 8) {
                            handleTransferSearchToFields();
                          }
                        }}
                        placeholder="Buscar cliente por telefone ou CPF..."
                        className="w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                      placeholder="Telefone *"
                      className="w-36 rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nome *"
                      className="w-36 rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                      type="text"
                      value={cpf}
                      onChange={(e) => setCpf(formatCPFInput(e.target.value))}
                      placeholder="CPF (opcional)"
                      className="w-40 rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Search dropdown */}
                  {showSearchResults && searchQuery.length >= 3 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                      {searchLoading && (
                        <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
                        </div>
                      )}
                      {!searchLoading && searchResultsList.length === 0 && (
                        <div className="p-3">
                          <p className="text-sm text-muted-foreground mb-2">Nenhum cliente encontrado.</p>
                          {searchQuery.replace(/\D/g, "").length >= 8 && (
                            <button
                              type="button"
                              onClick={handleTransferSearchToFields}
                              className="flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
                            >
                              <Check className="h-3.5 w-3.5" />
                              {searchQuery.replace(/\D/g, "").length === 11 && searchQuery.replace(/\D/g, "")[2] !== "9"
                                ? "Usar como CPF"
                                : "Usar como Telefone"}
                              <span className="text-xs text-muted-foreground ml-1">(ou Enter)</span>
                            </button>
                          )}
                        </div>
                      )}
                      {searchResultsList.map((c: { id: string; name: string; phone: string | null; cpf: string | null; addresses: unknown }) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            handleSelectCustomer({
                              id: c.id,
                              name: c.name,
                              phone: c.phone || "",
                              cpf: c.cpf || undefined,
                              addresses: c.addresses as AddressData[] | undefined,
                            })
                          }
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                        >
                          <div>
                            <span className="font-medium">{c.name}</span>
                            <span className="ml-2 text-muted-foreground">{c.phone}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 rounded-md border border-green-300 bg-green-50 px-3 py-1.5">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">{selectedCustomer.name}</span>
                    <span className="text-xs text-green-600">{selectedCustomer.phone}</span>
                  </div>
                  <button
                    type="button"
                    onClick={clearCustomer}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" /> Trocar
                  </button>
                </div>
              )}

              {/* Address row */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    value={street}
                    onChange={(e) => {
                      setStreet(e.target.value);
                      setDeliveryAreaInfo(null);
                      setOutsideArea(false);
                      setAddressNotFound(false);
                    }}
                    placeholder="Rua / Avenida *"
                    className={smallInputClass}
                  />
                </div>
                <div className="w-20">
                  <input
                    type="text"
                    value={number}
                    onChange={(e) => {
                      setNumber(e.target.value);
                      setDeliveryAreaInfo(null);
                      setOutsideArea(false);
                      setAddressNotFound(false);
                    }}
                    placeholder="Nº"
                    className={smallInputClass}
                  />
                </div>
                <div className="w-36">
                  <input
                    type="text"
                    value={complement}
                    onChange={(e) => setComplement(e.target.value)}
                    placeholder="Complemento"
                    className={smallInputClass}
                  />
                </div>
                <div className="w-40">
                  <input
                    type="text"
                    value={referencePoint}
                    onChange={(e) => setReferencePoint(e.target.value)}
                    placeholder="Ponto de Referência"
                    className={smallInputClass}
                  />
                </div>
              </div>

              {/* Neighborhood + City row + Check button */}
              <div className="flex items-center gap-2">
                <div className="w-40">
                  <input
                    type="text"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="Bairro"
                    className={smallInputClass}
                  />
                </div>
                <div className="w-40">
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Cidade"
                    className={smallInputClass}
                  />
                </div>
                <div className="w-16">
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="UF"
                    maxLength={2}
                    className={smallInputClass}
                  />
                </div>

                {/* Check area button */}
                <button
                  type="button"
                  onClick={handleCheckArea}
                  disabled={!street || !number || checkingArea}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {checkingArea ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <MapPin className="h-3 w-3" />
                  )}
                  Verificar área
                </button>

                {/* Area result */}
                {deliveryAreaInfo && (
                  <span className="flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                    <Check className="h-3 w-3" />
                    {deliveryAreaInfo.name} — {formatCurrency(parseFloat(deliveryAreaInfo.deliveryFee))}
                    {deliveryAreaInfo.estimatedMinutes && ` (~${deliveryAreaInfo.estimatedMinutes}min)`}
                  </span>
                )}

                {outsideArea && !deliveryAreaInfo && (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-yellow-700">
                      <AlertTriangle className="h-3 w-3" />
                      Fora da área de entrega
                    </span>
                    <input
                      type="number"
                      value={manualFee}
                      onChange={(e) => setManualFee(e.target.value)}
                      placeholder="Taxa manual R$"
                      step="0.01"
                      min="0"
                      className="w-28 rounded-md border border-yellow-300 bg-yellow-50 px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}

                {addressNotFound && !deliveryAreaInfo && !outsideArea && (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-red-600">
                      <AlertTriangle className="h-3 w-3" />
                      Endereço não encontrado no mapa
                    </span>
                    <input
                      type="number"
                      value={manualFee}
                      onChange={(e) => setManualFee(e.target.value)}
                      placeholder="Taxa manual R$"
                      step="0.01"
                      min="0"
                      className="w-28 rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
