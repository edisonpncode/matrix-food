import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "next-firebase-auth-edge";
import { authConfig } from "@matrix-food/auth";
import { getSuperadminAllowlist } from "@/lib/superadmin-allowlist";

const SUPERADMIN_LOGIN = "/admin/login";

function needsSuperadmin(pathname: string): boolean {
  return pathname.startsWith("/admin") && pathname !== SUPERADMIN_LOGIN;
}

function redirectToLoginPage(
  request: NextRequest,
  { forbidden }: { forbidden?: boolean } = {}
) {
  const url = request.nextUrl.clone();
  url.pathname = SUPERADMIN_LOGIN;
  url.search = forbidden ? "?error=forbidden" : "";
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  return authMiddleware(request, {
    loginPath: "/api/login",
    logoutPath: "/api/logout",
    apiKey: authConfig.apiKey,
    cookieName: authConfig.cookieName,
    cookieSignatureKeys: authConfig.cookieSignatureKeys,
    cookieSerializeOptions: authConfig.cookieSerializeOptions,
    serviceAccount: authConfig.serviceAccount,
    handleValidToken: async ({ decodedToken }, headers) => {
      const pathname = request.nextUrl.pathname;

      if (needsSuperadmin(pathname)) {
        const email = (decodedToken.email ?? "").toLowerCase();
        try {
          const allowed = getSuperadminAllowlist();
          if (!email || !allowed.includes(email)) {
            return redirectToLoginPage(request, { forbidden: true });
          }
        } catch (err) {
          // SUPERADMIN_EMAILS não configurada em produção → fail-closed.
          console.error("middleware superadmin allowlist:", err);
          return redirectToLoginPage(request, { forbidden: true });
        }
      }

      return NextResponse.next({ request: { headers } });
    },
    handleInvalidToken: async () => {
      if (needsSuperadmin(request.nextUrl.pathname)) {
        return redirectToLoginPage(request);
      }
      return NextResponse.next();
    },
    handleError: async (error) => {
      const msg = error instanceof Error ? error.message : "unknown";
      console.error("middleware auth error:", msg);
      if (needsSuperadmin(request.nextUrl.pathname)) {
        return redirectToLoginPage(request);
      }
      return NextResponse.next();
    },
  });
}

export const config = {
  matcher: ["/admin/:path*", "/api/login", "/api/logout"],
};
