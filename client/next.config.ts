import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  experimental: {
    serverActions: {
      bodySizeLimit: "1mb",
    },
  },

  env: {
    NEXT_PUBLIC_SIGNALING_SERVER:
      process.env.NEXT_PUBLIC_SIGNALING_SERVER || "ws://localhost:8081/ws",
  },

  images: {
    domains: [
      process.env.NODE_ENV === "production"
        ? process.env.NEXT_PUBLIC_API_URL ?? "localhost"
        : "localhost",
    ],
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
