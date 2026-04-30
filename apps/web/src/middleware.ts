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
 * Caminho alternativo de autenticação para staff via cookie HMAC
 * (`mf-staff-session`, criado em /api/staff/login). Não verificamos a
 * assinatura aqui porque o middleware roda em edge runtime e o verify
 * usa node:crypto. Validação real acontece no createContext do tRPC.
 */
function hasStaffSessionCookie(request: NextRequest): boolean {
  return Boolean(request.cookies.get(STAFF_COOKIE_NAME)?.value);
}

/**
 * `next-firebase-auth-edge` 1.12 usa múltiplos cookies com prefixo
 * `cookieName` (`.id`, `.refresh`, `.sig`, etc). Quem está logado sempre
 * tem o `.id`. Verificamos só presença — a assinatura é validada pelo
 * próprio auth-edge dentro do authMiddleware.
 */
function hasFirebaseAuthCookie(request: NextRequest): boolean {
  return Boolean(request.cookies.get(`${authConfig.cookieName}.id`)?.value);
}

/**
 * Em dev local, o tRPC createContext tem atalhos hardcoded que dão
 * usuário fake quando `DEV_TENANT_ID` está setado. Nesse caso não
 * redirecionamos — preserva o fluxo de desenvolvimento sem precisar
 * de Firebase real.
 */
function shouldEnforceRestauranteAuth(): boolean {
  return !process.env.DEV_TENANT_ID;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Fast-path: usuário sem nenhum cookie de auth tentando acessar
  // /restaurante/admin ou /restaurante/pos é redirecionado para login.
  // Roda ANTES do authMiddleware do auth-edge para garantir que sempre
  // dispara, independente de quirks do flow interno (timing de
  // handleInvalidToken, validação de service account, etc).
  if (
    needsRestauranteAuth(pathname) &&
    shouldEnforceRestauranteAuth() &&
    !hasFirebaseAuthCookie(request) &&
    !hasStaffSessionCookie(request)
  ) {
    return redirectToRestauranteLogin(request);
  }

  return authMiddleware(request, {
    loginPath: "/api/login",
    logoutPath: "/api/logout",
    apiKey: authConfig.apiKey,
    cookieName: authConfig.cookieName,
    cookieSignatureKeys: authConfig.cookieSignatureKeys,
    cookieSerializeOptions: authConfig.cookieSerializeOptions,
    serviceAccount: authConfig.serviceAccount,
    handleValidToken: async ({ decodedToken }, headers) => {
      const path = request.nextUrl.pathname;

      if (needsSuperadmin(path)) {
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
      const path = request.nextUrl.pathname;
      if (needsSuperadmin(path)) {
        return redirectToLoginPage(request);
      }
      // Restaurante já tratado pelo fast-path acima — aqui só passamos.
      return NextResponse.next();
    },
    handleError: async (error) => {
      const msg = error instanceof Error ? error.message : "unknown";
      console.error("middleware auth error:", msg);
      const path = request.nextUrl.pathname;
      if (needsSuperadmin(path)) {
        return redirectToLoginPage(request);
      }
      return NextResponse.next();
    },
  });
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/restaurante/admin",
    "/restaurante/admin/:path*",
    "/restaurante/pos",
    "/restaurante/pos/:path*",
    "/api/login",
    "/api/logout",
  ],
};
