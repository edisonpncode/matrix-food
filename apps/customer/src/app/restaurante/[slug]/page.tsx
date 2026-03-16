"use client";

import { use, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCartStore } from "@/stores/cart-store";
import { RestaurantHeader } from "@/components/restaurant-header";
import { CategoryTabs } from "@/components/category-tabs";
import { ProductCard } from "@/components/product-card";
import { ProductDetailModal } from "@/components/product-detail-modal";
import { CartFab } from "@/components/cart-fab";
import { CartDrawer } from "@/components/cart-drawer";
import { CheckoutForm } from "@/components/checkout-form";
import { PromoBanner } from "@/components/promo-banner";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function RestaurantPage({ params }: PageProps) {
  const { slug } = use(params);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null
  );
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  const setTenant = useCartStore((s) => s.setTenant);

  // Buscar dados do restaurante
  const { data: tenant, isLoading: loadingTenant } =
    trpc.tenant.getBySlug.useQuery({ slug });

  // Buscar categorias
  const { data: categoriesData } = trpc.category.list.useQuery(
    { tenantId: tenant?.id ?? "" },
    { enabled: !!tenant?.id }
  );

  // Selecionar primeira categoria automaticamente
  const categories = categoriesData ?? [];
  const activeCategoryId = selectedCategoryId ?? categories[0]?.id ?? null;

  // Buscar produtos da categoria ativa
  const { data: productsData } = trpc.product.listByCategory.useQuery(
    { tenantId: tenant?.id ?? "", categoryId: activeCategoryId ?? "" },
    { enabled: !!tenant?.id && !!activeCategoryId }
  );

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
        <h1 className="text-2xl font-bold">Restaurante não encontrado</h1>
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
        onBack={() => setShowCheckout(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <RestaurantHeader tenant={tenant} />

      {/* Banner de Promoções */}
      <PromoBanner tenantId={tenant.id} />

      {categories.length > 0 && (
        <CategoryTabs
          categories={categories}
          activeCategoryId={activeCategoryId}
          onSelect={setSelectedCategoryId}
        />
      )}

      {/* Grid de produtos */}
      <div className="mx-auto max-w-2xl px-4 py-4">
        {productsData && productsData.length > 0 ? (
          <div className="space-y-3">
            {productsData.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={() => setSelectedProductId(product.id)}
              />
            ))}
          </div>
        ) : (
          activeCategoryId && (
            <p className="py-8 text-center text-muted-foreground">
              Nenhum produto nesta categoria.
            </p>
          )
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
      <CartFab onClick={() => setShowCart(true)} />

      {/* Drawer do carrinho */}
      <CartDrawer
        open={showCart}
        onClose={() => setShowCart(false)}
        onCheckout={() => {
          setShowCart(false);
          setShowCheckout(true);
        }}
      />
    </div>
  );
}
