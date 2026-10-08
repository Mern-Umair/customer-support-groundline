import type { NextConfig } from "next";

const baseHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@groundline/shared"],
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      // The embed page must be frameable by any customer site; everything else only by us.
      { source: "/embed/:path*", headers: [...baseHeaders, { key: "Content-Security-Policy", value: "frame-ancestors *" }] },
      { source: "/widget.js", headers: [{ key: "Cache-Control", value: "public, max-age=300, stale-while-revalidate=86400" }, { key: "Access-Control-Allow-Origin", value: "*" }] },
      { source: "/((?!embed|widget.js).*)", headers: [...baseHeaders, { key: "Content-Security-Policy", value: "frame-ancestors 'self'" }] },
    ];
  },
};

export default nextConfig;
