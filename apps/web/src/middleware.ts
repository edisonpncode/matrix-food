import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "next-firebase-auth-edge";
import { authConfig } from "@matrix-food/auth";
import { getSuperadminAllowlist } from "@/lib/superadmin-allowlist";

const SUPERADMIN_LOGIN = "/admin/login";
const RESTAURANTE_LOGIN = "/restaurante/login";
// Mantido em sincronia com STAFF_COOKIE_NAME em apps/web/src/lib/staff-session.ts.
// Não importamos o módulo aqui porque ele usa node:crypto e o middleware roda em edge.
const STAFF_COOKIE_NAME = "mf-staff-session";

function needsSuperadmin(pathname: string): boolean {
  return pathname.startsWith("/admin") && pathname !== SUPERADMIN_LOGIN;
}

function needsRestauranteAuth(pathname: string): boolean {
  return (
    pathname.startsWith("/restaurante/admin") ||
    pathname.startsWith("/restaurante/pos")
  );
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

function redirectToRestauranteLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = RESTAURANTE_LOGIN;
  url.search = "";
  return NextResponse.redirect(url);
}

/**
 * Há um caminho alternativo de autenticação para staff via cookie HMAC
 * (`mf-staff-session`, criado em /api/staff/login). Se ele estiver presente,
 * deixamos a request seguir — a validação real acontece no createContext
 * do tRPC. Não verificamos a assinatura aqui porque o middleware roda em
 * edge runtime e o verify usa node:crypto.
 */
function hasStaffSessionCookie(request: NextRequest): boolean {
  return Boolean(request.cookies.get(STAFF_COOKIE_NAME)?.value);
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
      const pathname = request.nextUrl.pathname;
      if (needsSuperadmin(pathname)) {
        return redirectToLoginPage(request);
      }
      // Em produção, painel/POS exigem identidade real. Em dev mantemos o
      // atalho hardcoded do tRPC createContext, então não redirecionamos.
      if (
        process.env.NODE_ENV === "production" &&
        needsRestauranteAuth(pathname) &&
        !hasStaffSessionCookie(request)
      ) {
        return redirectToRestauranteLogin(request);
      }
      return NextResponse.next();
    },
    handleError: async (error) => {
      const msg = error instanceof Error ? error.message : "unknown";
      console.error("middleware auth error:", msg);
      const pathname = request.nextUrl.pathname;
      if (needsSuperadmin(pathname)) {
        return redirectToLoginPage(request);
      }
      if (
        process.env.NODE_ENV === "production" &&
        needsRestauranteAuth(pathname) &&
        !hasStaffSessionCookie(request)
      ) {
        return redirectToRestauranteLogin(request);
      }
      return NextResponse.next();
    },
  });
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/restaurante/admin/:path*",
    "/restaurante/pos/:path*",
    "/api/login",
    "/api/logout",
  ],
};
