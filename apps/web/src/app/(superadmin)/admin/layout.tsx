import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getTokens } from "next-firebase-auth-edge";
import { authConfig } from "@matrix-food/auth";
import { SuperAdminSidebar } from "@/components/superadmin/sidebar";
import { SuperAdminTopbar } from "@/components/superadmin/topbar";
import { getSuperadminAllowlist } from "@/lib/superadmin-allowlist";

export const metadata: Metadata = {
  title: "Matrix Food — Painel Administrativo",
  robots: { index: false, follow: false },
};

async function assertSuperadminOrRedirect() {
  const allowlist = getSuperadminAllowlist();
  let email: string | null = null;
  try {
    const tokens = await getTokens(await cookies(), {
      apiKey: authConfig.apiKey,
      cookieName: authConfig.cookieName,
      cookieSignatureKeys: authConfig.cookieSignatureKeys,
      serviceAccount: authConfig.serviceAccount,
    });
    email = tokens?.decodedToken?.email?.toLowerCase() ?? null;
  } catch (err) {
    console.error("superadmin layout: falha ao validar sessão:", err);
    redirect("/admin/login");
  }
  if (!email || !allowlist.includes(email)) {
    redirect("/admin/login?error=forbidden");
  }
}

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertSuperadminOrRedirect();
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
