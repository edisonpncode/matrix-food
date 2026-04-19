/**
 * Cron: verificação de anomalia de vendas do Morpheu.
 *
 * Roda de hora em hora durante horário comercial (ex: 10h, 12h, 14h, 16h, 18h).
 * Pra cada tenant com `notifyAnomalyAlerts=true`, compara:
 *   - Vendas "do dia até agora" (hoje, TZ local) vs
 *   - Média das 4 últimas ocorrências do mesmo dia da semana (mesma janela
 *     horária: 00:00 → hora atual no TZ)
 * Se a queda for >= 30% (e a média de referência tiver sido > 0), dispara o
 * template `morpheu_anomaly_alert`. Ignora quiet hours propositalmente (o
 * próprio `emitMorpheuEvent` já faz isso pra ANOMALY_ALERT).
 *
 * Autenticação: header `Authorization: Bearer <MORPHEU_CRON_SECRET>`.
 */
import { NextResponse } from "next/server";
import {
  getDb,
  morpheuTenantSettings,
  orders,
  eq,
  and,
  gte,
  lte,
  sql,
} from "@matrix-food/database";
import {
  emitMorpheuEvent,
  getTenantName,
} from "@matrix-food/api/services/morpheu";
import { isAuthorizedBearer } from "@/lib/bearer-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DROP_THRESHOLD_PCT = 30;
const LOOKBACK_WEEKS = 4;

function brl(v: unknown): string {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Data no timezone em YYYY-MM-DD + HH:mm */
function nowInTz(now: Date, timezone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const ymd =
    (parts.find((p) => p.type === "year")?.value ?? "1970") +
    "-" +
    (parts.find((p) => p.type === "month")?.value ?? "01") +
    "-" +
    (parts.find((p) => p.type === "day")?.value ?? "01");
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  return { ymd, hhmm: `${hh}:${mm}` };
}

/**
 * Calcula [from, to] UTC representando o intervalo
 * "00:00 do dia `ymd` até hhmm do mesmo dia", aproximado.
 */
function dayWindowUntil(ymd: string, hhmm: string) {
  const start = new Date(`${ymd}T00:00:00`);
  const end = new Date(`${ymd}T${hhmm}:59.999`);
  return { start, end };
}

/** Subtrai N dias de uma data YYYY-MM-DD. */
function minusDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function sumRange(tenantId: string, from: Date, to: Date): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${orders.total}::numeric),0)::numeric`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, tenantId),
        gte(orders.createdAt, from),
        lte(orders.createdAt, to),
        sql`${orders.status} <> 'CANCELLED'`
      )
    );
  return Number(row?.total ?? 0);
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  const secret = process.env.MORPHEU_CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "MORPHEU_CRON_SECRET não configurada" },
      { status: 500 }
    );
  }
  if (!isAuthorizedBearer(req.headers.get("authorization"), secret)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const db = getDb();
  const now = new Date();

  const settingsRows = await db
    .select()
    .from(morpheuTenantSettings)
    .where(
      and(
        eq(morpheuTenantSettings.enabled, true),
        eq(morpheuTenantSettings.notifyAnomalyAlerts, true)
      )
    );

  const results: Array<{
    tenantId: string;
    status: string;
    pct?: number;
    revenueToday?: number;
  }> = [];

  for (const s of settingsRows) {
    try {
      const timezone = s.timezone ?? "America/Sao_Paulo";
      const { ymd: todayYmd, hhmm } = nowInTz(now, timezone);
      const today = dayWindowUntil(todayYmd, hhmm);
      const revenueToday = await sumRange(s.tenantId, today.start, today.end);

      // Média das últimas 4 mesmas dia da semana
      const baselineValues: number[] = [];
      for (let w = 1; w <= LOOKBACK_WEEKS; w++) {
        const ymdRef = minusDays(todayYmd, 7 * w);
        const ref = dayWindowUntil(ymdRef, hhmm);
        const sum = await sumRange(s.tenantId, ref.start, ref.end);
        baselineValues.push(sum);
      }
      const baseline =
        baselineValues.reduce((acc, n) => acc + n, 0) / baselineValues.length;

      if (baseline <= 0) {
        results.push({ tenantId: s.tenantId, status: "no_baseline" });
        continue;
      }

      const diffPct = ((revenueToday - baseline) / baseline) * 100;
      // só alerta queda expressiva
      if (diffPct > -DROP_THRESHOLD_PCT) {
        results.push({
          tenantId: s.tenantId,
          status: "ok",
          pct: diffPct,
          revenueToday,
        });
        continue;
      }

      const tenantName = await getTenantName(s.tenantId);
      await emitMorpheuEvent(s.tenantId, "ANOMALY_ALERT", {
        userName: tenantName,
        variationPercent: `${Math.abs(diffPct).toFixed(0)}`,
        revenueToday: brl(revenueToday),
      });

      results.push({
        tenantId: s.tenantId,
        status: "alerted",
        pct: diffPct,
        revenueToday,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(
        `[cron.morpheu-anomaly-check] tenant ${s.tenantId} falhou:`,
        e
      );
      results.push({ tenantId: s.tenantId, status: "error" });
    }
  }

  return NextResponse.json({
    ranAt: now.toISOString(),
    processed: results.length,
    results,
  });
}
