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
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres."),
});

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length > 11 && digits.startsWith("55")) {
    return digits.slice(2);
  }
  return digits;
}

/**
 * Cria a senha para um cliente já existente (criado por atendente).
 * Retorna 409 se o cliente já tem senha — nesse caso deve usar /login.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ?? "Dados inválidos.",
        },
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

    if (!existing) {
      return NextResponse.json(
        { error: "Cliente não encontrado." },
        { status: 404 }
      );
    }

    if (existing.passwordHash) {
      return NextResponse.json(
        { error: "Este cliente já tem senha. Faça login." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    await db
      .update(customers)
      .set({ passwordHash })
      .where(eq(customers.id, existing.id));

    const session = createCustomerSession(existing.id, phone);
    const res = NextResponse.json({ ok: true, customerId: existing.id });
    res.cookies.set(CUSTOMER_COOKIE_NAME, session, CUSTOMER_COOKIE_OPTIONS);
    return res;
  } catch (err) {
    console.error("set-password error:", err);
    return NextResponse.json(
      { error: "Erro ao criar senha." },
      { status: 500 }
    );
  }
}
