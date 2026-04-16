import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@matrix-food/ui",
    "@matrix-food/database",
    "@matrix-food/auth",
    "@matrix-food/utils",
    "@matrix-food/api",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
