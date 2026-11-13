import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/receipts/[paymentId]": ["./public/assets/receipts/ipsm-official-stamp.png", "./public/assets/branding/ipsm-logo-original.jpg"],
  },
};

export default nextConfig;
