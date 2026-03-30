import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "borikipr.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;