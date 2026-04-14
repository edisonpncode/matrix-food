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
  name: z.string().min(2, "Informe seu nome."),
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
 * Cria um novo cliente com senha e inicia a sessão.
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
    if (phone.length < 10) {
      return NextResponse.json(
        { error: "Telefone deve ter DDD + número." },
        { status: 400 }
      );
    }

    const db = getDb();

    // Telefone já existe?
    const [existing] = await db
      .select({ id: customers.id, passwordHash: customers.passwordHash })
      .from(customers)
      .where(eq(customers.phone, phone))
      .limit(1);

    if (existing?.passwordHash) {
      return NextResponse.json(
        { error: "Telefone já cadastrado. Faça login." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    let customerId: string;
    if (existing) {
      // Cliente já existe (criado por atendente) — apenas atualiza nome e senha.
      const [updated] = await db
        .update(customers)
        .set({
          name: parsed.data.name.trim(),
          passwordHash,
        })
        .where(eq(customers.id, existing.id))
        .returning({ id: customers.id });
      customerId = updated!.id;
    } else {
      const [created] = await db
        .insert(customers)
        .values({
          name: parsed.data.name.trim(),
          phone,
          passwordHash,
          source: "PORTAL",
          addresses: [],
        })
        .returning({ id: customers.id });
      if (!created) {
        return NextResponse.json(
          { error: "Falha ao criar cliente." },
          { status: 500 }
        );
      }
      customerId = created.id;
    }

    const session = createCustomerSession(customerId, phone);
    const res = NextResponse.json({ ok: true, customerId });
    res.cookies.set(CUSTOMER_COOKIE_NAME, session, CUSTOMER_COOKIE_OPTIONS);
    return res;
  } catch (err) {
    console.error("register error:", err);
    return NextResponse.json(
      { error: "Erro ao criar conta." },
      { status: 500 }
    );
  }
}
