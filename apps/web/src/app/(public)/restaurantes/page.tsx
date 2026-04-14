"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Search, MapPin, Store, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { isRestaurantOpen } from "@matrix-food/utils";
import { CustomerLoginButton } from "@/components/customer/auth/customer-login-button";

const FOOD_TYPE_LABELS: Record<string, string> = {
  hamburger: "Hamburgueria",
  pizza: "Pizzaria",
  japanese: "Japonesa",
  brazilian: "Brasileira",
  chinese: "Chinesa",
  italian: "Italiana",
  mexican: "Mexicana",
  bakery: "Padaria",
  acai: "Acai",
  ice_cream: "Sorveteria",
  healthy: "Saudavel",
  snack: "Lanchonete",
  barbecue: "Churrascaria",
  seafood: "Frutos do Mar",
  arabic: "Arabe",
  vegetarian: "Vegetariana",
  dessert: "Sobremesas",
  coffee: "Cafeteria",
  pastel: "Pastelaria",
  chicken: "Frango",
};

export default function RestaurantesPage() {
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const { data: restaurants, isLoading } = trpc.tenant.listPublic.useQuery({
    search: search.trim() || undefined,
  });

  // Coletar todos os tipos de comida unicos
  const foodTypes = useMemo(() => {
    if (!restaurants) return [];
    const types = new Set<string>();
    for (const r of restaurants) {
      const ft = r.foodTypes as string[] | null;
      if (ft) ft.forEach((t) => types.add(t));
    }
    return Array.from(types).sort();
  }, [restaurants]);

  // Filtrar por tipo selecionado
  const filtered = useMemo(() => {
    if (!restaurants) return [];
    if (!selectedType) return restaurants;
    return restaurants.filter((r) => {
      const ft = r.foodTypes as string[] | null;
      return ft?.includes(selectedType);
    });
  }, [restaurants, selectedType]);

  return (
    <main className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-5">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm font-medium text-[#64748b] hover:text-[#7c3aed]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
              <input
                type="text"
                placeholder="Buscar restaurante..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8f9fa] py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/10"
              />
            </div>
          </div>
          <CustomerLoginButton />
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-5 py-6">
        <h1 className="mb-4 text-2xl font-bold text-[#1a1a2e]">
          Restaurantes
        </h1>

        {/* Filtros por tipo */}
        {foodTypes.length > 0 && (
          <div className="mb-5 flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            <button
              onClick={() => setSelectedType(null)}
              className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                !selectedType
                  ? "bg-[#7c3aed] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Todos
            </button>
            {foodTypes.map((type) => (
              <button
                key={type}
                onClick={() =>
                  setSelectedType(selectedType === type ? null : type)
                }
                className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  selectedType === type
                    ? "bg-[#7c3aed] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {FOOD_TYPE_LABELS[type] ?? type}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {/* Lista de restaurantes */}
        {!isLoading && filtered.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((restaurant) => {
              const open = restaurant.operatingHours
                ? isRestaurantOpen(
                    restaurant.operatingHours as Record<
                      string,
                      { open: string; close: string; isOpen: boolean }
                    >
                  )
                : true;

              const ft = restaurant.foodTypes as string[] | null;
              const deliverySettings = restaurant.deliverySettings as {
                estimatedMinutes?: { min: number; max: number };
              } | null;

              return (
                <Link
                  key={restaurant.id}
                  href={`/restaurantes/${restaurant.slug}`}
                  className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* Banner */}
                  <div className="h-32 overflow-hidden bg-gradient-to-r from-primary/60 to-primary">
                    {restaurant.bannerUrl && (
                      <img
                        src={restaurant.bannerUrl}
                        alt=""
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    )}
                  </div>

                  <div className="relative px-4 pb-4">
                    {/* Logo */}
                    <div className="-mt-8 mb-2 h-14 w-14 overflow-hidden rounded-xl border-3 border-white bg-white shadow-md">
                      {restaurant.logoUrl ? (
                        <img
                          src={restaurant.logoUrl}
                          alt={restaurant.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-primary/10 text-lg font-bold text-primary">
                          {restaurant.name.charAt(0)}
                        </div>
                      )}
                    </div>

                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h2 className="font-bold text-gray-900 group-hover:text-primary">
                          {restaurant.name}
                        </h2>
                        {restaurant.description && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">
                            {restaurant.description}
                          </p>
                        )}
                      </div>
                      <span
                        className={`ml-2 flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          open
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {open ? "Aberto" : "Fechado"}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                      {restaurant.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {restaurant.city}
                          {restaurant.state && `/${restaurant.state}`}
                        </span>
                      )}
                      {deliverySettings?.estimatedMinutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {deliverySettings.estimatedMinutes.min}-
                          {deliverySettings.estimatedMinutes.max} min
                        </span>
                      )}
                    </div>

                    {/* Tags */}
                    {ft && ft.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {ft.slice(0, 3).map((type) => (
                          <span
                            key={type}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600"
                          >
                            {FOOD_TYPE_LABELS[type] ?? type}
                          </span>
                        ))}
                        {ft.length > 3 && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                            +{ft.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#e2e8f0] bg-white py-20">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#7c3aed]/10">
              <Store className="h-8 w-8 text-[#7c3aed]" />
            </div>
            <h2 className="mb-2 text-lg font-bold text-[#1a1a2e]">
              {search || selectedType
                ? "Nenhum restaurante encontrado"
                : "Nenhum restaurante cadastrado"}
            </h2>
            <p className="max-w-sm text-center text-sm text-[#64748b]">
              {search || selectedType
                ? "Tente buscar com outros termos ou remova os filtros."
                : "Em breve teremos restaurantes disponiveis."}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
