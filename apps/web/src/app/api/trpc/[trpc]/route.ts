import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@matrix-food/api";
import type { TRPCContext } from "@matrix-food/api";
import type { UserRole } from "@matrix-food/auth";
import { getTokens } from "next-firebase-auth-edge";
import { cookies } from "next/headers";
import { authConfig } from "@matrix-food/auth";
import { parseCustomerSessionCookie } from "@/lib/customer-session";
import { parseStaffSessionCookie } from "@/lib/staff-session";
import {
  getDb,
  tenantUsers,
  eq,
  and,
  or,
  isNull,
  inArray,
} from "@matrix-food/database";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Sentinels que historicamente foram gravados em `firebase_uid` por
 * rotinas internas. São tratados como "não vinculado" e podem ser
 * sobrescritos por um uid Firebase real durante o backfill.
 */
const STALE_FIREBASE_UIDS = ["dev-admin", "dev-superadmin", "dev-employee"];

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
 * Resolve o vínculo tenant/role de um usuário Firebase via `tenant_users`.
 *
 * Estratégia:
 *  1) Match exato por `firebase_uid`.
 *  2) Fallback de backfill: se nada bate, mas há **exatamente um**
 *     `tenant_user` ativo com o mesmo email Firebase, role OWNER/MANAGER
 *     e `firebase_uid` "stale" (NULL ou um dos sentinels antigos), grava
 *     o uid real ali e devolve o vínculo.
 *
 *  O backfill só corre quando `emailVerified=true` para evitar que um
 *  atacante crie uma conta Firebase com o mesmo email do dono e ganhe
 *  acesso. Esse caminho é uma migração one-shot: depois que o uid real
 *  é gravado, o passo (1) passa a bastar e (2) fica inerte.
 */
async function resolveTenantUser(args: {
  uid: string;
  email: string | null;
  emailVerified: boolean;
}): Promise<{ tenantId: string; role: UserRole } | null> {
  const db = getDb();

  const byUid = await db
    .select({ tenantId: tenantUsers.tenantId, role: tenantUsers.role })
    .from(tenantUsers)
    .where(
      and(eq(tenantUsers.firebaseUid, args.uid), eq(tenantUsers.isActive, true))
    )
    .limit(1);
  if (byUid[0]) return byUid[0];

  if (!args.email || !args.emailVerified) return null;

  const candidates = await db
    .select({
      id: tenantUsers.id,
      tenantId: tenantUsers.tenantId,
      role: tenantUsers.role,
      firebaseUid: tenantUsers.firebaseUid,
    })
    .from(tenantUsers)
    .where(
      and(
        eq(tenantUsers.email, args.email),
        eq(tenantUsers.isActive, true),
        inArray(tenantUsers.role, ["OWNER", "MANAGER"]),
        or(
          isNull(tenantUsers.firebaseUid),
          eq(tenantUsers.firebaseUid, ""),
          inArray(tenantUsers.firebaseUid, STALE_FIREBASE_UIDS)
        )
      )
    );
  if (candidates.length !== 1) return null;

  const match = candidates[0]!;
  await db
    .update(tenantUsers)
    .set({ firebaseUid: args.uid })
    .where(eq(tenantUsers.id, match.id));
  console.info(
    `tenant_user backfill: linked firebase_uid=${args.uid} to tenant_user=${match.id} (email=${args.email})`
  );
  return { tenantId: match.tenantId, role: match.role };
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
          const link = await resolveTenantUser({
            uid: decoded.uid,
            email: decoded.email ?? null,
            emailVerified: decoded.email_verified === true,
          });
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
