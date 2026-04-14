import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@matrix-food/api";
import type { TRPCContext } from "@matrix-food/api";
import { parseCustomerSessionCookie } from "@/lib/customer-session";

function createContext(req: Request): TRPCContext {
  const referer = req.headers.get("referer") || "";
  const url = new URL(referer, "http://localhost");
  const pathname = url.pathname;

  // Sessão do cliente (consumidor — link de pedidos)
  const customerPayload = parseCustomerSessionCookie(
    req.headers.get("cookie")
  );
  const customer = customerPayload
    ? { customerId: customerPayload.customerId, phone: customerPayload.phone }
    : null;

  // Admin routes - role OWNER
  if (pathname.startsWith("/restaurante/admin")) {
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
    };
  }

  // POS/Employee routes - role CASHIER
  if (pathname.startsWith("/restaurante/pos")) {
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
    };
  }

  // Customer/public routes - anonymous user, but talvez cliente logado
  return {
    user: null,
    tenantId: null,
    customer,
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
