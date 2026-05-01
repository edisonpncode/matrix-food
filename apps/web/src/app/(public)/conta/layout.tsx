import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Minha conta | Matrix Food",
};

export default function ContaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
