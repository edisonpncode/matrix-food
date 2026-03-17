import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@matrix-food/api";

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
export const trpc: ReturnType<typeof createTRPCReact<AppRouter>> =
  createTRPCReact<AppRouter>();
