import type { NextConfig } from "next";
import { getSecurityHeaders } from "@matrix-food/utils";

const securityHeaders = getSecurityHeaders({ reportOnly: true });

const nextConfig: NextConfig = {
  transpilePackages: [
    "@matrix-food/ui",
    "@matrix-food/database",
    "@matrix-food/auth",
    "@matrix-food/utils",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
