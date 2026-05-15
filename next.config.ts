import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {},
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "gateway.pinata.cloud" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/watch/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
