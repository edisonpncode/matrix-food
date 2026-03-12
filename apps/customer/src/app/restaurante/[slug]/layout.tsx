import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cardápio | Matrix Food",
};

export default function RestaurantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
