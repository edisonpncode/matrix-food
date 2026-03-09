import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@matrix-food/api";
import type { TRPCContext } from "@matrix-food/api";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: (): TRPCContext => ({
      user: null, // TODO: extrair do cookie Firebase na Fase 2
      tenantId: null, // TODO: extrair do subdomínio na Fase 3
    }),
    onError: ({ path, error }) => {
      console.error(`tRPC error on '${path}':`, error);
    },
  });

export { handler as GET, handler as POST };
