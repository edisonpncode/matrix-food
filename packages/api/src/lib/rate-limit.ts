import { LRUCache } from "lru-cache";
import { TRPCError } from "@trpc/server";

/**
 * Rate limit em memória (janela fixa) usando LRU.
 * Stopgap até migrar pra Upstash/Redis — só funciona em 1 instância.
 *
 * Cada "bucket" nomeado mantém seu próprio cache e limite.
 * Chave típica: `${ip}:${procedure}` ou `${ip}:${resource}`.
 */

interface Bucket {
  cache: LRUCache<string, number>;
  limit: number;
  windowMs: number;
}

const buckets = new Map<string, Bucket>();

function getBucket(
  name: string,
  limit: number,
  windowMs: number
): Bucket {
  let bucket = buckets.get(name);
  if (!bucket) {
    bucket = {
      cache: new LRUCache<string, number>({
        max: 10_000,
        ttl: windowMs,
      }),
      limit,
      windowMs,
    };
    buckets.set(name, bucket);
  }
  return bucket;
}

/**
 * Consome 1 unidade para a chave dada. Lança TRPCError TOO_MANY_REQUESTS
 * quando estoura. Retorna silenciosamente em ambiente de teste pra não
 * poluir suites.
 */
export function rateLimit(
  bucketName: string,
  key: string,
  options: { limit: number; windowMs: number }
): void {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return;
  if (!key) return; // sem chave (ex: IP não detectado) — não aplica

  const bucket = getBucket(bucketName, options.limit, options.windowMs);
  const current = bucket.cache.get(key) ?? 0;
  if (current >= bucket.limit) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message:
        "Muitas requisições. Aguarde alguns segundos antes de tentar novamente.",
    });
  }
  bucket.cache.set(key, current + 1);
}
