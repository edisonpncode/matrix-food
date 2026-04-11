"use client";

import { use, useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useCartStore } from "@/stores/cart-store";
import { isRestaurantOpen, getNextOpenTime } from "@matrix-food/utils";
import { RestaurantHeader } from "@/components/customer/restaurant-header";
import { CategoryBar } from "@/components/customer/category-tabs";
import { CategorySection } from "@/components/customer/category-section";
import { ProductDetailModal } from "@/components/customer/product-detail-modal";
import { ProductSearch } from "@/components/customer/product-search";
import { CartFab } from "@/components/customer/cart-fab";
import { CartDrawer } from "@/components/customer/cart-drawer";
import { CheckoutForm } from "@/components/customer/checkout-form";
import { PromoBanner } from "@/components/customer/promo-banner";
import { LoyaltyBanner } from "@/components/customer/loyalty-banner";
import { ClosedOverlay } from "@/components/customer/closed-overlay";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function RestaurantPage({ params }: PageProps) {
  const { slug } = use(params);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null
  );
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [closedDismissed, setClosedDismissed] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const setTenant = useCartStore((s) => s.setTenant);

  // Buscar dados do restaurante
  const { data: tenant, isLoading: loadingTenant } =
    trpc.tenant.getBySlug.useQuery({ slug });

  // Buscar todos os produtos agrupados por categoria (scrollspy)
  const { data: categoriesWithProducts } =
    trpc.product.listAllPublic.useQuery(
      { tenantId: tenant?.id ?? "" },
      { enabled: !!tenant?.id }
    );

  // Verificar se restaurante esta aberto
  const isOpen = tenant?.operatingHours
    ? isRestaurantOpen(
        tenant.operatingHours as Record<
          string,
          { open: string; close: string; isOpen: boolean }
        >
      )
    : true;

  const nextOpenTime = tenant?.operatingHours
    ? getNextOpenTime(
        tenant.operatingHours as Record<
          string,
          { open: string; close: string; isOpen: boolean }
        >
      )
    : null;

  // Filtrar categorias/produtos pela busca
  const filteredCategories = useMemo(() => {
    if (!categoriesWithProducts) return [];
    if (!searchQuery.trim()) return categoriesWithProducts;

    const query = searchQuery.toLowerCase().trim();
    return categoriesWithProducts
      .map((cat) => ({
        ...cat,
        products: cat.products.filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            (p.description && p.description.toLowerCase().includes(query))
        ),
      }))
      .filter((cat) => cat.products.length > 0);
  }, [categoriesWithProducts, searchQuery]);

  // Auto-set primeiro category ativo
  const firstCategoryId = filteredCategories[0]?.id ?? null;
  const currentActiveCategoryId = activeCategoryId ?? firstCategoryId;

  // Configurar tenant no cart store
  if (tenant?.id) {
    setTenant(tenant.id, slug);
  }

  if (loadingTenant) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2">
        <h1 className="text-2xl font-bold">Restaurante nao encontrado</h1>
        <p className="text-muted-foreground">
          Verifique o link e tente novamente.
        </p>
      </div>
    );
  }

  if (showCheckout) {
    return (
      <CheckoutForm
        tenant={tenant}
        isOpen={isOpen}
        onBack={() => setShowCheckout(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Overlay de restaurante fechado */}
      {!isOpen && !closedDismissed && (
        <ClosedOverlay
          nextOpenTime={nextOpenTime}
          onDismiss={() => setClosedDismissed(true)}
        />
      )}

      <RestaurantHeader
        tenant={tenant}
        isOpen={isOpen}
        nextOpenTime={nextOpenTime}
      />

      {/* Banner de Promocoes */}
      <PromoBanner tenantId={tenant.id} />

      {/* Banner de Fidelidade */}
      <LoyaltyBanner tenantId={tenant.id} />

      {/* Busca */}
      <div className="mx-auto max-w-2xl px-4 pt-3">
        <ProductSearch value={searchQuery} onChange={setSearchQuery} />
      </div>

      {/* Barra de categorias (scrollspy) */}
      {filteredCategories.length > 0 && (
        <CategoryBar
          categories={filteredCategories.map((c) => ({
            id: c.id,
            name: c.name,
          }))}
          activeCategoryId={currentActiveCategoryId}
          onScrollspy={(id) => setActiveCategoryId(id)}
          onSelect={(id) => {
            setActiveCategoryId(id);
            const el = document.getElementById(`category-${id}`);
            if (el) {
              const yOffset = -100; // offset para o sticky header
              const y =
                el.getBoundingClientRect().top + window.scrollY + yOffset;
              window.scrollTo({ top: y, behavior: "smooth" });
            }
          }}
        />
      )}

      {/* Sections de categorias com produtos (scroll continuo) */}
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-4">
        {filteredCategories.length > 0 ? (
          filteredCategories.map((category) => (
            <CategorySection
              key={category.id}
              id={category.id}
              name={category.name}
              products={category.products}
              onProductClick={setSelectedProductId}
            />
          ))
        ) : searchQuery ? (
          <p className="py-8 text-center text-muted-foreground">
            Nenhum produto encontrado para &quot;{searchQuery}&quot;.
          </p>
        ) : (
          <p className="py-8 text-center text-muted-foreground">
            Nenhum produto disponivel.
          </p>
        )}
      </div>

      {/* Modal de detalhe do produto */}
      {selectedProductId && tenant && (
        <ProductDetailModal
          productId={selectedProductId}
          tenantId={tenant.id}
          onClose={() => setSelectedProductId(null)}
        />
      )}

      {/* FAB do carrinho */}
      <CartFab onClick={() => setShowCart(true)} disabled={!isOpen} />

      {/* Drawer do carrinho */}
      <CartDrawer
        open={showCart}
        onClose={() => setShowCart(false)}
        onCheckout={() => {
          setShowCart(false);
          setShowCheckout(true);
        }}
        minOrder={
          tenant.deliverySettings
            ? (
                tenant.deliverySettings as {
                  minOrder?: number;
                }
              ).minOrder ?? 0
            : 0
        }
      />
    </div>
  );
}
