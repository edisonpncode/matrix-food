import { NextRequest, NextResponse } from "next/server";
import { getDb, customers, eq } from "@matrix-food/database";
import {
  CUSTOMER_COOKIE_NAME,
  CUSTOMER_COOKIE_OPTIONS,
  parseCustomerSessionCookie,
} from "@/lib/customer-session";

export const runtime = "nodejs";

/**
 * Retorna o cliente logado a partir do cookie HMAC.
 * Se não houver cookie válido, retorna null.
 */
export async function GET(req: NextRequest) {
  const payload = parseCustomerSessionCookie(req.headers.get("cookie"));
  if (!payload) {
    return NextResponse.json({ customer: null });
  }

  const db = getDb();
  const [customer] = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      cpf: customers.cpf,
      addresses: customers.addresses,
    })
    .from(customers)
    .where(eq(customers.id, payload.customerId))
    .limit(1);

  if (!customer) {
    return NextResponse.json({ customer: null });
  }

  return NextResponse.json({ customer });
}

/**
 * Encerra a sessão do cliente (logout).
 */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CUSTOMER_COOKIE_NAME, "", {
    ...CUSTOMER_COOKIE_OPTIONS,
    maxAge: 0,
  });
  return res;
}
