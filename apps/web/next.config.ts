import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@groundline/shared"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
