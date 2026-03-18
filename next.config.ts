import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // @ts-expect-error: dynamicIO is an experimental flag not yet in stable NextConfig types
    dynamicIO: true,
    cacheComponents: true,
  },
};

export default nextConfig;
