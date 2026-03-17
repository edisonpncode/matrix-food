import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@matrix-food/api";
import type { TRPCContext } from "@matrix-food/api";

/**
 * Handler tRPC para o Super Admin.
 * Role SUPER_ADMIN com acesso a todos os tenants.
 */
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: (): TRPCContext => ({
      user: {
        uid: "dev-superadmin",
        email: "superadmin@matrixfood.com.br",
        name: "Super Admin",
        tenantId: null,
        role: "OWNER",
      },
      tenantId: null,
    }),
    onError: ({ path, error }) => {
      console.error(`tRPC error on '${path}':`, error);
    },
  });

export { handler as GET, handler as POST };
