import { NextRequest, NextResponse } from "next/server";
import {
  authMiddleware,
  redirectToLogin,
} from "next-firebase-auth-edge";
import { authConfig } from "./config";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/api/health"];

export async function createAuthMiddleware() {
  return authMiddleware(
    async (request: NextRequest) => {
      return NextResponse.next();
    },
    {
      loginPath: "/api/login",
      logoutPath: "/api/logout",
      apiKey: authConfig.apiKey,
      cookieName: authConfig.cookieName,
      cookieSignatureKeys: authConfig.cookieSignatureKeys,
      cookieSerializeOptions: {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 12 * 60 * 60 * 24, // 12 days
      },
      serviceAccount: authConfig.serviceAccount,
      handleValidToken: async ({ token, decodedToken }, headers) => {
        if (PUBLIC_PATHS.includes(new URL(token).pathname)) {
          return NextResponse.next({ request: { headers } });
        }
        return NextResponse.next({ request: { headers } });
      },
      handleInvalidToken: async (reason) => {
        console.info("Token inválido:", { reason });
        return redirectToLogin(new NextRequest(new URL("/login", "http://localhost")), {
          path: "/login",
          publicPaths: PUBLIC_PATHS,
        });
      },
      handleError: async (error) => {
        console.error("Erro no middleware de auth:", { error });
        return redirectToLogin(new NextRequest(new URL("/login", "http://localhost")), {
          path: "/login",
          publicPaths: PUBLIC_PATHS,
        });
      },
    }
  );
}
