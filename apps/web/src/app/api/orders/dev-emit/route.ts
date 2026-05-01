/**
 * Endpoint dev-only para simular emissão de `new-online-order` sem precisar
 * criar pedido real no banco. Usado para validar o fluxo SSE → som → badge.
 *
 * Bloqueado em produção. Não documentar publicamente.
 */
import { orderEvents } from "@matrix-food/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

export async function POST(req: Request) {
  if (IS_PRODUCTION) {
    return new Response("Not Found", { status: 404 });
  }
  const url = new URL(req.url);
  const tenantId =
    url.searchParams.get("tenantId") ?? process.env.DEV_TENANT_ID ?? "";
  const status = (url.searchParams.get("status") ?? "PENDING") as
    | "PENDING"
    | "PREPARING";
  if (!tenantId) {
    return new Response("missing tenantId", { status: 400 });
  }
  orderEvents.emit("new-online-order", {
    tenantId,
    orderId: "dev-" + Date.now(),
    displayNumber: "DEV" + Math.floor(Math.random() * 999),
    status,
    createdAt: new Date().toISOString(),
  });
  return Response.json({ ok: true, tenantId, status });
}
