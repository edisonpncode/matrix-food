/**
 * Logger estruturado com reda\u00e7\u00e3o de PII.
 *
 * Uso:
 *   const log = createLogger("orders");
 *   log.info("pedido criado", { orderId, userId });
 *
 * Nunca logue objetos de usu\u00e1rio/cliente inteiros sem revisar.
 * Campos em REDACT_KEYS s\u00e3o mascarados automaticamente.
 */

const REDACT_KEYS = new Set([
  "password",
  "passwd",
  "senha",
  "pin",
  "cpf",
  "cnpj",
  "rg",
  "phone",
  "telefone",
  "whatsapp",
  "email",
  "token",
  "authorization",
  "cookie",
  "secret",
  "apikey",
  "api_key",
  "accessToken",
  "refreshToken",
  "clientSecret",
]);

const REDACTED = "[REDACTED]";

function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 6) return "[MaxDepth]";
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((v) => redact(v, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (REDACT_KEYS.has(key.toLowerCase())) {
      out[key] = REDACTED;
    } else {
      out[key] = redact(val, depth + 1);
    }
  }
  return out;
}

type Level = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: Level;
  time: string;
  scope?: string;
  msg: string;
  [key: string]: unknown;
}

function emit(entry: LogEntry): void {
  const fn =
    entry.level === "error"
      ? console.error
      : entry.level === "warn"
        ? console.warn
        : console.log;
  try {
    fn(JSON.stringify(entry));
  } catch {
    fn(`[${entry.level}] ${entry.msg}`);
  }
}

function make(level: Level, scope: string | undefined) {
  return (msg: string, extra?: Record<string, unknown>) => {
    const entry: LogEntry = {
      level,
      time: new Date().toISOString(),
      msg,
    };
    if (scope) entry.scope = scope;
    if (extra) {
      const safe = redact(extra) as Record<string, unknown>;
      for (const [k, v] of Object.entries(safe)) entry[k] = v;
    }
    emit(entry);
  };
}

export function createLogger(scope?: string) {
  return {
    debug: make("debug", scope),
    info: make("info", scope),
    warn: make("warn", scope),
    error: make("error", scope),
  };
}

export const logger = createLogger();
