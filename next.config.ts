import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server (.next/standalone) for the Docker image.
  output: "standalone",
  // Hide the dev-mode Next.js indicator ("N" bubble in the corner);
  // compile and runtime errors still surface as usual.
  devIndicators: false,
};

export default nextConfig;
