import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getDb, customers, eq } from "@matrix-food/database";
import {
  CUSTOMER_COOKIE_NAME,
  CUSTOMER_COOKIE_OPTIONS,
  createCustomerSession,
} from "@/lib/customer-session";

export const runtime = "nodejs";

const bodySchema = z.object({
  phone: z.string().min(10),
  password: z.string().min(1),
});

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length > 11 && digits.startsWith("55")) {
    return digits.slice(2);
  }
  return digits;
}

/**
 * Valida senha e cria sessão.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos." },
        { status: 400 }
      );
    }

    const phone = normalizePhone(parsed.data.phone);
    const db = getDb();

    const [existing] = await db
      .select({
        id: customers.id,
        passwordHash: customers.passwordHash,
      })
      .from(customers)
      .where(eq(customers.phone, phone))
      .limit(1);

    if (!existing || !existing.passwordHash) {
      return NextResponse.json(
        { error: "Telefone ou senha incorretos." },
        { status: 401 }
      );
    }

    const ok = await bcrypt.compare(parsed.data.password, existing.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "Telefone ou senha incorretos." },
        { status: 401 }
      );
    }

    const session = createCustomerSession(existing.id, phone);
    const res = NextResponse.json({ ok: true, customerId: existing.id });
    res.cookies.set(CUSTOMER_COOKIE_NAME, session, CUSTOMER_COOKIE_OPTIONS);
    return res;
  } catch (err) {
    console.error("login error:", err);
    return NextResponse.json(
      { error: "Erro ao fazer login." },
      { status: 500 }
    );
  }
}
