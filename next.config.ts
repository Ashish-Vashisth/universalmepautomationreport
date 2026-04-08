import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empty turbopack config silences the turbopack/webpack mismatch error
  turbopack: {},
};

export default nextConfig;
