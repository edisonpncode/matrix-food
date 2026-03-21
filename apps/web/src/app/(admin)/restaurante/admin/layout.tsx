import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin/sidebar";

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
    <div className="flex h-screen">
      <AdminSidebar />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
