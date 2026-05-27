import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // [demo-mock] Inline demo-mode flags at build time so we don't depend on
  // Vercel project env vars. Demo branch is the only branch deployed.
  env: {
    NEXT_PUBLIC_DEMO: process.env.NEXT_PUBLIC_DEMO ?? "true",
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "https://demo-disabled.local",
  },
  // [demo-mock] Keep msw out of the edge runtime / instrumentation bundle.
  // Turbopack tries to follow dynamic imports statically and pulls in
  // @mswjs/interceptors, which doesn't resolve cleanly under edge.
  serverExternalPackages: ["msw", "@mswjs/interceptors"],
  reactCompiler: true,
  images: {
    remotePatterns: [
      // Kakao
      { protocol: "http", hostname: "img1.kakaocdn.net" },
      { protocol: "http", hostname: "k.kakaocdn.net" },

      // Naver
      { protocol: "http", hostname: "phinf.pstatic.net" },
      { protocol: "https", hostname: "phinf.pstatic.net" },
      { protocol: "http", hostname: "ssl.pstatic.net" },
      { protocol: "https", hostname: "ssl.pstatic.net" },

      // Google
      { protocol: "http", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },

      // Placeholder / Stock
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },

      // Toss
      { protocol: "https", hostname: "static.toss.im" },

      // Windfall
      { protocol: "https", hostname: "wind-fall.store" },
      { protocol: "https", hostname: "windfall-bucket.s3.ap-northeast-2.amazonaws.com" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
