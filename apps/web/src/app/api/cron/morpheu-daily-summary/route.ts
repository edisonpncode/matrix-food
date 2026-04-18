/**
 * Cron: resumo diário do Morpheu.
 *
 * Roda idealmente 1x/dia pela manhã (ex: 08:00 America/Sao_Paulo).
 * Pra cada tenant com `morpheuTenantSettings.notifyDailySummary = true`,
 * monta o resumo do dia anterior + comparação com mesmo dia da semana passada
 * e dispara o template `morpheu_daily_summary`.
 *
 * Autenticação: header `Authorization: Bearer <MORPHEU_CRON_SECRET>`.
 */
import { NextResponse } from "next/server";
import {
  getDb,
  morpheuTenantSettings,
  orders,
  orderItems,
  eq,
  and,
  gte,
  lte,
  sql,
  desc,
} from "@matrix-food/database";
import {
  emitMorpheuEvent,
  getTenantName,
} from "@matrix-food/api/services/morpheu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function brl(v: unknown): string {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Nome do dia da semana em PT-BR (domingo..sábado). */
const WEEKDAYS_PT = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

/**
 * Retorna [início, fim] de um dia no timezone dado, como Date UTC.
 * Implementação simples: formata "YYYY-MM-DD" naquele TZ e usa as bordas em UTC.
 * Nota: isso é aproximado porque um dia local pode ter 23 ou 25 horas em DST —
 * mas o agregado diário tolera isso.
 */
function dayBounds(now: Date, offsetDays: number, timezone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const shifted = new Date(now.getTime() + offsetDays * 86400000);
  const ymd = fmt.format(shifted); // "2026-04-17"
  const start = new Date(`${ymd}T00:00:00`);
  const end = new Date(`${ymd}T23:59:59.999`);
  return { start, end, ymd };
}

interface SumResult {
  total: number;
  count: number;
}

async function sumRange(
  tenantId: string,
  from: Date,
  to: Date
): Promise<SumResult> {
  const db = getDb();
  const [row] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${orders.total}::numeric),0)::numeric`,
      count: sql<number>`count(*)::int`,
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
  return {
    total: Number(row?.total ?? 0),
    count: row?.count ?? 0,
  };
}

async function topProduct(
  tenantId: string,
  from: Date,
  to: Date
): Promise<string> {
  const db = getDb();
  const rows = await db
    .select({
      name: orderItems.productName,
      qty: sql<number>`SUM(${orderItems.quantity})::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(
      and(
        eq(orders.tenantId, tenantId),
        gte(orders.createdAt, from),
        lte(orders.createdAt, to),
        sql`${orders.status} <> 'CANCELLED'`
      )
    )
    .groupBy(orderItems.productName)
    .orderBy(desc(sql`SUM(${orderItems.quantity})`))
    .limit(1);
  return rows[0]?.name ?? "—";
}

function dayLabel(ymd: string): string {
  // "YYYY-MM-DD" → "DD/MM"
  const [, m, d] = ymd.split("-");
  return `${d}/${m}`;
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
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
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
        eq(morpheuTenantSettings.notifyDailySummary, true)
      )
    );

  const results: Array<{ tenantId: string; status: string; sent?: number }> = [];

  for (const s of settingsRows) {
    try {
      const timezone = s.timezone ?? "America/Sao_Paulo";
      const yesterday = dayBounds(now, -1, timezone);
      const lastWeekSameDay = dayBounds(now, -8, timezone);

      const a = await sumRange(s.tenantId, yesterday.start, yesterday.end);
      const b = await sumRange(
        s.tenantId,
        lastWeekSameDay.start,
        lastWeekSameDay.end
      );

      const absDelta = a.total - b.total;
      const pct = b.total > 0 ? (absDelta / b.total) * 100 : null;
      const variationLabel =
        pct === null
          ? "sem comparativo"
          : `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;

      const top = await topProduct(s.tenantId, yesterday.start, yesterday.end);

      const weekdayIndex = new Date(
        `${yesterday.ymd}T12:00:00Z`
      ).getUTCDay();
      const weekdayLabel = WEEKDAYS_PT[weekdayIndex] ?? "";

      // Busca nome do destinatário — usa o nome do tenant como fallback
      const tenantName = await getTenantName(s.tenantId);

      const out = await emitMorpheuEvent(s.tenantId, "DAILY_SUMMARY", {
        userName: tenantName,
        dateLabel: dayLabel(yesterday.ymd),
        totalRevenue: brl(a.total),
        ordersCount: String(a.count),
        weekdayLabel,
        variationLabel,
        topCategoryOrProduct: top,
      });
      results.push({
        tenantId: s.tenantId,
        status: "ok",
        sent: out.sent,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(
        `[cron.morpheu-daily-summary] tenant ${s.tenantId} falhou:`,
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
