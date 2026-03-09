import { createTRPCRouter, publicProcedure } from "../trpc";

export const healthRouter = createTRPCRouter({
  check: publicProcedure.query(() => {
    return {
      status: "ok" as const,
      timestamp: new Date(),
      version: "0.1.0",
    };
  }),
});
