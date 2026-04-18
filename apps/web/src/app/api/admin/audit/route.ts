import { NextRequest, NextResponse } from "next/server";
import { getDb, superadminAuditLogs } from "@matrix-food/database";

const VALID_EVENTS = new Set(["login_success", "login_forbidden"]);

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email?: string;
      event?: string;
    };

    const email = (body.email ?? "").trim().toLowerCase();
    const event = (body.event ?? "").trim();

    if (!email || !VALID_EVENTS.has(event)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0]?.trim() : null;
    const userAgent = request.headers.get("user-agent");

    await getDb().insert(superadminAuditLogs).values({
      email,
      event,
      ip: ip ?? null,
      userAgent: userAgent ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
