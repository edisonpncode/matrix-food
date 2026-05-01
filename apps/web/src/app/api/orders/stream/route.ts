import { cookies } from "next/headers";
import { getTokens } from "next-firebase-auth-edge";
import { authConfig } from "@matrix-food/auth";
import { orderEvents, type NewOnlineOrderPayload } from "@matrix-food/api";
import {
  getDb,
  tenantUsers,
  eq,
  and,
} from "@matrix-food/database";
import { parseStaffSessionCookie } from "@/lib/staff-session";

/**
 * SSE (Server-Sent Events) endpoint que entrega notificações em tempo
 * real para atendentes/gerentes logados no POS.
 *
 * Eventos enviados:
 *  - `new-online-order`: pedido recém-criado pelo link público
 *  - `ping` (a cada 25s): keepalive p/ proxies que derrubam conexão ociosa
 *
 * Autenticação: aceita cookie Firebase (dono autenticado) ou cookie HMAC
 * de sessão de staff. Conexões anônimas são rejeitadas com 401.
 *
 * Filtra mensagens por `tenantId` da sessão — atendente só recebe
 * eventos do restaurante ao qual ele está vinculado.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEEPALIVE_INTERVAL_MS = 25_000;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

async function resolveTenantId(req: Request): Promise<string | null> {
  // 1) Tenta cookie HMAC de staff
  const staff = parseStaffSessionCookie(req.headers.get("cookie"));
  if (staff?.tenantId) return staff.tenantId;

  // 2) Tenta cookie Firebase
  try {
    const tokens = await getTokens(await cookies(), {
      apiKey: authConfig.apiKey,
      cookieName: authConfig.cookieName,
      cookieSignatureKeys: authConfig.cookieSignatureKeys,
      serviceAccount: authConfig.serviceAccount,
    });
    const uid = tokens?.decodedToken?.uid;
    if (uid) {
      const db = getDb();
      const [link] = await db
        .select({ tenantId: tenantUsers.tenantId })
        .from(tenantUsers)
        .where(
          and(eq(tenantUsers.firebaseUid, uid), eq(tenantUsers.isActive, true))
        )
        .limit(1);
      if (link?.tenantId) return link.tenantId;
    }
  } catch {
    // Falha de Firebase em dev é esperada — segue para o atalho dev abaixo
  }

  // 3) Atalho dev: mesmo padrão do tRPC route handler.
  if (!IS_PRODUCTION && process.env.DEV_TENANT_ID) {
    return process.env.DEV_TENANT_ID;
  }

  return null;
}

function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: Request) {
  const tenantId = await resolveTenantId(req);
  if (!tenantId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let listener: ((p: NewOnlineOrderPayload) => void) | null = null;
  let keepalive: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Stream já foi fechado pelo cliente
          closed = true;
        }
      };

      // Hello inicial — confirma ao cliente que a conexão abriu
      safeEnqueue(sseFrame("connected", { tenantId, ts: Date.now() }));

      listener = (payload: NewOnlineOrderPayload) => {
        if (payload.tenantId !== tenantId) return;
        safeEnqueue(sseFrame("new-online-order", payload));
      };
      orderEvents.on("new-online-order", listener);

      keepalive = setInterval(() => {
        safeEnqueue(sseFrame("ping", { ts: Date.now() }));
      }, KEEPALIVE_INTERVAL_MS);

      const onAbort = () => {
        closed = true;
        if (listener) orderEvents.off("new-online-order", listener);
        if (keepalive) clearInterval(keepalive);
        try {
          controller.close();
        } catch {
          // já fechado
        }
      };
      req.signal.addEventListener("abort", onAbort, { once: true });
    },
    cancel() {
      closed = true;
      if (listener) orderEvents.off("new-online-order", listener);
      if (keepalive) clearInterval(keepalive);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
