import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  getDb,
  tenantUsers,
  userTypes,
  activityLogs,
  eq,
  and,
} from "@matrix-food/database";
import {
  STAFF_COOKIE_NAME,
  STAFF_COOKIE_OPTIONS,
  createStaffSession,
} from "@/lib/staff-session";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function getClientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}

const ATTEMPTS = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function rateLimit(key: string): boolean {
  const now = Date.now();
  const entry = ATTEMPTS.get(key);
  if (!entry || entry.resetAt < now) {
    ATTEMPTS.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

/**
 * Login direto do funcionário (sem Firebase). Resolve o tenant pelo email +
 * passwordHash, valida bcrypt e cria sessão HMAC própria.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const ip = getClientIp(req) ?? "unknown";
    const rateKey = `${ip}:${parsed.data.email.toLowerCase()}`;
    if (!rateLimit(rateKey)) {
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde alguns segundos." },
        { status: 429 }
      );
    }

    const db = getDb();

    // Busca funcionários ativos com aquele email + passwordHash. Se múltiplos
    // tenants tiverem o mesmo email cadastrado, recusa o login para evitar
    // ambiguidade de tenant.
    const candidates = await db
      .select({
        id: tenantUsers.id,
        tenantId: tenantUsers.tenantId,
        name: tenantUsers.name,
        email: tenantUsers.email,
        phone: tenantUsers.phone,
        role: tenantUsers.role,
        photoUrl: tenantUsers.photoUrl,
        userTypeId: tenantUsers.userTypeId,
        passwordHash: tenantUsers.passwordHash,
      })
      .from(tenantUsers)
      .where(
        and(
          eq(tenantUsers.email, parsed.data.email),
          eq(tenantUsers.isActive, true)
        )
      );

    const eligible = candidates.filter((u) => !!u.passwordHash);

    if (eligible.length === 0) {
      return NextResponse.json(
        { error: "Email ou senha inválidos." },
        { status: 401 }
      );
    }

    if (eligible.length > 1) {
      console.warn(
        `staff login: email "${parsed.data.email}" presente em ${eligible.length} tenants — login recusado`
      );
      return NextResponse.json(
        {
          error:
            "Não foi possível identificar o restaurante automaticamente. Contate o suporte.",
        },
        { status: 409 }
      );
    }

    const user = eligible[0]!;
    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash!);
    if (!ok) {
      return NextResponse.json(
        { error: "Email ou senha inválidos." },
        { status: 401 }
      );
    }

    let permissions: Record<string, boolean> = {};
    let userTypeName: string | null = null;
    if (user.userTypeId) {
      const [userType] = await db
        .select({
          permissions: userTypes.permissions,
          name: userTypes.name,
        })
        .from(userTypes)
        .where(eq(userTypes.id, user.userTypeId))
        .limit(1);
      if (userType) {
        permissions = (userType.permissions as Record<string, boolean>) ?? {};
        userTypeName = userType.name;
      }
    }

    await db.insert(activityLogs).values({
      tenantId: user.tenantId,
      userId: user.id,
      userName: user.name,
      action: "STAFF_LOGIN",
      description: `"${user.name}" fez login por email+senha (sessão HMAC).`,
    });

    const session = createStaffSession({
      staffId: user.id,
      tenantId: user.tenantId,
      role: user.role,
    });

    const res = NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      photoUrl: user.photoUrl,
      userTypeId: user.userTypeId,
      userTypeName,
      permissions,
    });
    res.cookies.set(STAFF_COOKIE_NAME, session, STAFF_COOKIE_OPTIONS);
    return res;
  } catch (err) {
    console.error("staff login error:", err);
    return NextResponse.json(
      { error: "Erro ao fazer login." },
      { status: 500 }
    );
  }
}
