import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin/sidebar";
import { InactivityGuard } from "@/components/shared/user-session/inactivity-guard";
import { RoutePermissionGuard } from "@/components/shared/user-session/route-permission-guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Matrix Food - Painel Administrativo",
  description: "Painel de administração para restaurantes",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InactivityGuard timeoutMinutes={15}>
      <div className="flex h-screen">
        <AdminSidebar />
        <main className="flex-1 overflow-auto p-6">
          <RoutePermissionGuard>{children}</RoutePermissionGuard>
        </main>
      </div>
    </InactivityGuard>
  );
}
