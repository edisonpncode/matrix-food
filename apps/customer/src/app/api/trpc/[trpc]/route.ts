import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@matrix-food/api";
import type { TRPCContext } from "@matrix-food/api";
import {
  CUSTOMER_COOKIE_NAME,
  verifyCustomerSession,
} from "@/lib/customer-session";

export const runtime = "nodejs";

function parseCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  const match = header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

function extractIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: (): TRPCContext => {
      const cookieHeader = req.headers.get("cookie");
      const sessionToken = parseCookie(cookieHeader, CUSTOMER_COOKIE_NAME);
      const session = verifyCustomerSession(sessionToken);
      return {
        user: null,
        tenantId: null,
        customer: session
          ? { uid: session.uid, phone: session.phone }
          : null,
        ip: extractIp(req),
      };
    },
    onError: ({ path, error }) => {
      console.error(`tRPC error on '${path}':`, error);
    },
  });

export { handler as GET, handler as POST };
