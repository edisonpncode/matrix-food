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

// Painel /admin nunca pode ser pre-renderizado: a verificação de sessão
// depende de cookies e da env SUPERADMIN_EMAILS, que só existem em runtime.
export const dynamic = "force-dynamic";

async function assertSuperadminOrRedirect() {
  const allowlist = getSuperadminAllowlist();
  if (allowlist.length === 0) {
    // Fail-closed: sem allowlist configurada, ninguém entra.
    console.error(
      "superadmin layout: SUPERADMIN_EMAILS não configurada — recusando acesso"
    );
    redirect("/admin/login?error=forbidden");
  }
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
