import { NextRequest, NextResponse } from "next/server";
import { authMiddleware, redirectToPath } from "next-firebase-auth-edge";
import { authConfig } from "@matrix-food/auth";

const SUPERADMIN_LOGIN = "/admin/login";

function getAllowedEmails(): string[] {
  return (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

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
        const allowed = getAllowedEmails();
        if (!email || !allowed.includes(email)) {
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
      console.error("middleware /admin auth error:", error);
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
