import type { Metadata } from "next";
import "@matrix-food/ui/globals.css";
import { TRPCProvider } from "@/lib/trpc-provider";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "Matrix Food - Super Admin",
  description: "Painel de administração da Matrix Food",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-background font-sans antialiased">
        <TRPCProvider>
          <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
          </div>
        </TRPCProvider>
      </body>
    </html>
  );
}
