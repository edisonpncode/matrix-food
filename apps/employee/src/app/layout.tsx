import type { Metadata } from "next";
import "@matrix-food/ui/globals.css";

export const metadata: Metadata = {
  title: "Matrix Food - Painel do Funcionário",
  description: "POS e gestão de pedidos para funcionários",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
