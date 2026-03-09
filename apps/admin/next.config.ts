import type { NextConfig } from "next";

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
};

export default nextConfig;
