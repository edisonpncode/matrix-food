import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@matrix-food/ui",
    "@matrix-food/database",
    "@matrix-food/auth",
    "@matrix-food/utils",
  ],
};

export default nextConfig;
