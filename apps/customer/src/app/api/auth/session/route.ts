import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAuth } from "next-firebase-auth-edge/lib/auth";
import {
  CUSTOMER_COOKIE_NAME,
  CUSTOMER_COOKIE_OPTIONS,
  createCustomerSession,
} from "@/lib/customer-session";

export const runtime = "nodejs";

function getAuth() {
  return getFirebaseAuth(
    {
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    },
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY!
  );
}

/**
 * Cria a sessão do cliente a partir de um ID token do Firebase Phone Auth.
 */
export async function POST(req: NextRequest) {
  try {
    const { idToken } = (await req.json()) as { idToken?: string };
    if (!idToken) {
      return NextResponse.json(
        { error: "idToken obrigatório" },
        { status: 400 }
      );
    }

    const decoded = await getAuth().verifyIdToken(idToken);
    if (!decoded?.uid) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const phone =
      (decoded as { phone_number?: string }).phone_number ?? null;

    const session = createCustomerSession(decoded.uid, phone);
    const res = NextResponse.json({ ok: true, uid: decoded.uid, phone });
    res.cookies.set(CUSTOMER_COOKIE_NAME, session, CUSTOMER_COOKIE_OPTIONS);
    return res;
  } catch (err) {
    console.error("session POST error:", err);
    return NextResponse.json(
      { error: "Falha ao criar sessão" },
      { status: 401 }
    );
  }
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
