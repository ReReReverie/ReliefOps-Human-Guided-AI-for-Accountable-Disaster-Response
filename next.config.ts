import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the production image small by copying only Next's traced runtime.
  output: "standalone",
  // Prevent webpack from bundling native Node.js modules used by @stellar/stellar-sdk.
  serverExternalPackages: ["sodium-native", "@stellar/stellar-sdk"],
};

export default nextConfig;
