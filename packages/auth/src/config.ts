const cookieCurrent =
  process.env.AUTH_COOKIE_SECRET_CURRENT ??
  process.env.COOKIE_SECRET_CURRENT ??
  "";
const cookiePrevious =
  process.env.AUTH_COOKIE_SECRET_PREVIOUS ??
  process.env.COOKIE_SECRET_PREVIOUS ??
  "";

export const authConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  cookieName: "matrix-food-auth",
  cookieSignatureKeys: [cookieCurrent, cookiePrevious],
  cookieSerializeOptions: {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 12 * 60 * 60 * 24, // 12 dias
  },
  serviceAccount: {
    projectId: process.env.FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  },
};
