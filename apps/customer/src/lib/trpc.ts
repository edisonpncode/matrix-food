import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@matrix-food/api";

export const trpc: ReturnType<typeof createTRPCReact<AppRouter>> =
  createTRPCReact<AppRouter>();
