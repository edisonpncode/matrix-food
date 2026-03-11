import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@matrix-food/api";
import type { TRPCContext } from "@matrix-food/api";

/**
 * Handler tRPC para o Admin.
 * TODO: Na Fase 3, extrair user do cookie Firebase e tenantId da sessão.
 * Por agora, usa um tenant de desenvolvimento para testar o CRUD.
 */
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: (): TRPCContext => ({
      user: {
        uid: "dev-admin",
        email: "admin@dev.local",
        name: "Dev Admin",
        tenantId: process.env.DEV_TENANT_ID ?? null,
        role: "OWNER",
      },
      tenantId: process.env.DEV_TENANT_ID ?? null,
    }),
    onError: ({ path, error }) => {
      console.error(`tRPC error on '${path}':`, error);
    },
  });

export { handler as GET, handler as POST };
