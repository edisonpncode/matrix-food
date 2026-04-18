import type { Metadata } from "next";
import { SuperAdminSidebar } from "@/components/superadmin/sidebar";
import { SuperAdminTopbar } from "@/components/superadmin/topbar";

export const metadata: Metadata = {
  title: "Matrix Food — Painel Administrativo",
  robots: { index: false, follow: false },
};

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <SuperAdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <SuperAdminTopbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
