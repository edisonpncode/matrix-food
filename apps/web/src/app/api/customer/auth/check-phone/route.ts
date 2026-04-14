import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb, customers, eq } from "@matrix-food/database";

export const runtime = "nodejs";

const bodySchema = z.object({
  phone: z.string().min(8),
});

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length > 11 && digits.startsWith("55")) {
    return digits.slice(2);
  }
  return digits;
}

/**
 * Verifica o status do telefone no sistema:
 * - NEW → telefone não cadastrado
 * - NEEDS_PASSWORD → cliente existe (criado por atendente) mas sem senha
 * - HAS_PASSWORD → cliente já cadastrado, pode fazer login
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Telefone inválido." },
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
    const [existing] = await db
      .select({
        id: customers.id,
        name: customers.name,
        passwordHash: customers.passwordHash,
      })
      .from(customers)
      .where(eq(customers.phone, phone))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ status: "NEW" });
    }

    if (!existing.passwordHash) {
      return NextResponse.json({
        status: "NEEDS_PASSWORD",
        name: existing.name,
      });
    }

    return NextResponse.json({
      status: "HAS_PASSWORD",
      name: existing.name,
    });
  } catch (err) {
    console.error("check-phone error:", err);
    return NextResponse.json(
      { error: "Erro ao verificar telefone." },
      { status: 500 }
    );
  }
}
