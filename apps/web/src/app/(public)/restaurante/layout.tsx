import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Matrix Food - Plataforma para Restaurantes",
  description:
    "Gerencie seu restaurante com cardápio digital, pedidos online, promoções e muito mais.",
};

export default function RestaurantPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
