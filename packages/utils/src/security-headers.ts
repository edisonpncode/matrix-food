const FIREBASE_ENDPOINTS = [
  "https://apis.google.com",
  "https://*.googleapis.com",
  "https://*.firebaseio.com",
  "wss://*.firebaseio.com",
  "https://*.firebasestorage.googleapis.com",
  "https://firebasestorage.googleapis.com",
  "https://firestore.googleapis.com",
  "https://identitytoolkit.googleapis.com",
  "https://securetoken.googleapis.com",
];

const CLOUDINARY = "https://res.cloudinary.com";

type BuildCspOptions = {
  allowInlineScripts?: boolean;
  allowInlineStyles?: boolean;
  extraConnectSrc?: string[];
  extraImgSrc?: string[];
  extraFrameSrc?: string[];
};

export function buildContentSecurityPolicy(options: BuildCspOptions = {}): string {
  const {
    allowInlineScripts = true,
    allowInlineStyles = true,
    extraConnectSrc = [],
    extraImgSrc = [],
    extraFrameSrc = [],
  } = options;

  const scriptSrc = [
    "'self'",
    allowInlineScripts ? "'unsafe-inline'" : "",
    allowInlineScripts ? "'unsafe-eval'" : "",
    "https://apis.google.com",
    "https://www.gstatic.com",
  ].filter(Boolean);

  const styleSrc = [
    "'self'",
    allowInlineStyles ? "'unsafe-inline'" : "",
    "https://fonts.googleapis.com",
  ].filter(Boolean);

  const imgSrc = [
    "'self'",
    "data:",
    "blob:",
    CLOUDINARY,
    "https://*.googleusercontent.com",
    ...extraImgSrc,
  ];

  const connectSrc = [
    "'self'",
    ...FIREBASE_ENDPOINTS,
    ...extraConnectSrc,
  ];

  const frameSrc = [
    "'self'",
    "https://*.firebaseapp.com",
    ...extraFrameSrc,
  ];

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": scriptSrc,
    "style-src": styleSrc,
    "img-src": imgSrc,
    "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
    "connect-src": connectSrc,
    "frame-src": frameSrc,
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
  };

  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");
}

export type SecurityHeaderOptions = BuildCspOptions & {
  reportOnly?: boolean;
};

export function getSecurityHeaders(options: SecurityHeaderOptions = {}) {
  const { reportOnly = true, ...cspOptions } = options;
  const csp = buildContentSecurityPolicy(cspOptions);

  return [
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(self)",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-site" },
    {
      key: reportOnly
        ? "Content-Security-Policy-Report-Only"
        : "Content-Security-Policy",
      value: csp,
    },
  ];
}
