import type { Metadata, Viewport } from "next";
import "@matrix-food/ui/globals.css";
import { TRPCProvider } from "@/lib/trpc-provider";
import { CustomerAuthProvider } from "@/lib/customer-auth-context";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#7c3aed",
};

export const metadata: Metadata = {
  title: "Matrix Food - Sistema de Pedidos para Restaurantes",
  description:
    "Plataforma completa para restaurantes: cardápio digital, pedidos online, gestão de cozinha e muito mais.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Matrix Food",
  },
  openGraph: {
    type: "website",
    siteName: "Matrix Food",
    title: "Matrix Food - Sistema de Pedidos para Restaurantes",
    description:
      "Plataforma completa para restaurantes: cardápio digital, pedidos online, gestão de cozinha e muito mais.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <TRPCProvider>
          <CustomerAuthProvider>{children}</CustomerAuthProvider>
        </TRPCProvider>
      </body>
    </html>
  );
}
