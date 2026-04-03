import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** macOS-only optional dep of chokidar; exclude from server bundles so Linux CI builds succeed. */
  serverExternalPackages: ["fsevents"],
};

export default nextConfig;
