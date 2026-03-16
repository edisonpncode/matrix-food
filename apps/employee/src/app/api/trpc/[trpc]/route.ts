import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@matrix-food/api";
import type { TRPCContext } from "@matrix-food/api";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: (): TRPCContext => ({
      user: {
        uid: "dev-employee",
        email: "employee@dev.local",
        name: "Dev Funcionário",
        tenantId: process.env.DEV_TENANT_ID ?? null,
        role: "CASHIER",
      },
      tenantId: process.env.DEV_TENANT_ID ?? null,
    }),
    onError: ({ path, error }) => {
      console.error(`tRPC error on '${path}':`, error);
    },
  });

export { handler as GET, handler as POST };
