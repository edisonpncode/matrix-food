import { createHmac, timingSafeEqual } from "crypto";

/**
 * Valida a assinatura X-Hub-Signature-256 enviada pelo Meta nos webhooks.
 * Docs: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#event-notifications
 *
 * O header vem como "sha256=<hex>".
 */
export function verifyMetaSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader) return false;
  const [algo, received] = signatureHeader.split("=");
  if (algo !== "sha256" || !received) return false;

  const hmac = createHmac("sha256", appSecret);
  hmac.update(rawBody);
  const expected = hmac.digest("hex");

  if (expected.length !== received.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(received, "hex")
    );
  } catch {
    return false;
  }
}
