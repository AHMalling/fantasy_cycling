import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.procyclingstats.com" },
    ],
  },
};

export default nextConfig;
