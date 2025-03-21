import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  experimental: {
    serverActions: {
      bodySizeLimit: "1mb",
    },
  },

  env: {
    NEXT_PUBLIC_SIGNALING_SERVER: "ws://localhost:8081/ws",
  },

  images: {
    domains: ["localhost"],
  },
};

export default nextConfig;
