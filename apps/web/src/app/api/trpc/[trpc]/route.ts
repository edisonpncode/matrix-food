import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@matrix-food/api";
import type { TRPCContext } from "@matrix-food/api";
import type { UserRole } from "@matrix-food/auth";
import { getTokens } from "next-firebase-auth-edge";
import { cookies } from "next/headers";
import { authConfig } from "@matrix-food/auth";
import { parseCustomerSessionCookie } from "@/lib/customer-session";
import { parseStaffSessionCookie } from "@/lib/staff-session";
import { getDb, tenantUsers, eq, and } from "@matrix-food/database";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** Extrai o IP do cliente de headers de proxy (best-effort). */
function extractIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}

/**
 * Resolve o vínculo tenant/role do usuário Firebase via `tenant_users`.
 * Filtra por uid e por isActive=true para impedir acesso de funcionário desligado.
 */
async function resolveTenantUser(
  uid: string
): Promise<{ tenantId: string; role: UserRole } | null> {
  const rows = await getDb()
    .select({
      tenantId: tenantUsers.tenantId,
      role: tenantUsers.role,
    })
    .from(tenantUsers)
    .where(
      and(eq(tenantUsers.firebaseUid, uid), eq(tenantUsers.isActive, true))
    )
    .limit(1);
  return rows[0] ?? null;
}

async function createContext(req: Request): Promise<TRPCContext> {
  const referer = req.headers.get("referer") || "";
  const url = new URL(referer, "http://localhost");
  const pathname = url.pathname;
  const ip = extractIp(req);

  // Sessão do cliente (consumidor — link de pedidos)
  const customerPayload = parseCustomerSessionCookie(
    req.headers.get("cookie")
  );
  const customer = customerPayload
    ? { customerId: customerPayload.customerId, phone: customerPayload.phone }
    : null;

  // Superadmin routes - valida cookie Firebase real e delega o email ao procedure
  if (pathname.startsWith("/admin")) {
    try {
      const tokens = await getTokens(await cookies(), {
        apiKey: authConfig.apiKey,
        cookieName: authConfig.cookieName,
        cookieSignatureKeys: authConfig.cookieSignatureKeys,
        serviceAccount: authConfig.serviceAccount,
      });
      if (tokens?.decodedToken?.email) {
        return {
          user: {
            uid: tokens.decodedToken.uid,
            email: tokens.decodedToken.email,
            name: tokens.decodedToken.name ?? null,
            tenantId: null,
            role: "OWNER",
          },
          tenantId: null,
          customer,
          ip,
        };
      }
    } catch (err) {
      console.error("Falha ao validar sessão superadmin:", err);
    }
    return { user: null, tenantId: null, customer, ip };
  }

  // Painel restaurante / POS — em produção exigem identidade real:
  //   1) cookie Firebase válido + vínculo ativo em tenant_users (dono/admin), OU
  //   2) cookie HMAC de sessão staff (login direto por email+senha).
  // Em dev, mantemos o atalho hardcoded para não quebrar fluxo local sem
  // Firebase real.
  const isRestauranteAdmin = pathname.startsWith("/restaurante/admin");
  const isRestaurantePos = pathname.startsWith("/restaurante/pos");
  if (isRestauranteAdmin || isRestaurantePos) {
    if (IS_PRODUCTION) {
      // 1) Firebase tem precedência (dono autenticado).
      try {
        const tokens = await getTokens(await cookies(), {
          apiKey: authConfig.apiKey,
          cookieName: authConfig.cookieName,
          cookieSignatureKeys: authConfig.cookieSignatureKeys,
          serviceAccount: authConfig.serviceAccount,
        });
        const decoded = tokens?.decodedToken;
        if (decoded?.uid) {
          const link = await resolveTenantUser(decoded.uid);
          if (link) {
            return {
              user: {
                uid: decoded.uid,
                email: decoded.email ?? null,
                name: decoded.name ?? null,
                tenantId: link.tenantId,
                role: link.role,
              },
              tenantId: link.tenantId,
              customer,
              ip,
            };
          }
        }
      } catch (err) {
        console.error("Falha ao validar sessão Firebase de restaurante:", err);
      }

      // 2) Fallback: sessão HMAC de funcionário.
      const staff = parseStaffSessionCookie(req.headers.get("cookie"));
      if (staff) {
        return {
          user: {
            uid: `staff:${staff.staffId}`,
            email: null,
            name: null,
            tenantId: staff.tenantId,
            role: staff.role,
          },
          tenantId: staff.tenantId,
          customer,
          ip,
        };
      }

      return { user: null, tenantId: null, customer, ip };
    }

    // Dev only — atalho para desenvolvimento local sem Firebase.
    if (isRestauranteAdmin) {
      return {
        user: {
          uid: "dev-admin",
          email: "admin@dev.local",
          name: "Dev Admin",
          tenantId: process.env.DEV_TENANT_ID ?? null,
          role: "OWNER",
        },
        tenantId: process.env.DEV_TENANT_ID ?? null,
        customer,
        ip,
      };
    }
    return {
      user: {
        uid: "dev-employee",
        email: "employee@dev.local",
        name: "Dev Funcionário",
        tenantId: process.env.DEV_TENANT_ID ?? null,
        role: "CASHIER",
      },
      tenantId: process.env.DEV_TENANT_ID ?? null,
      customer,
      ip,
    };
  }

  // Customer/public routes - anonymous user, but talvez cliente logado
  return {
    user: null,
    tenantId: null,
    customer,
    ip,
  };
}

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(req),
    onError: ({ path, error }) => {
      console.error(`tRPC error on '${path}':`, error);
    },
  });

export { handler as GET, handler as POST };
