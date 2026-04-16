import type { Metadata } from "next";
import { POSSidebar } from "@/components/pos/sidebar";
import { RoutePermissionGuard } from "@/components/shared/user-session/route-permission-guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Matrix Food - Painel do Funcionário",
  description: "POS e gestão de pedidos para funcionários",
};

export default function POSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <POSSidebar />
      <main className="flex-1 overflow-auto p-6">
        <RoutePermissionGuard>{children}</RoutePermissionGuard>
      </main>
    </div>
  );
}
