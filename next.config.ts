import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent webpack from bundling native Node.js modules used by @stellar/stellar-sdk.
  serverExternalPackages: ["sodium-native", "@stellar/stellar-sdk"],
};

export default nextConfig;
