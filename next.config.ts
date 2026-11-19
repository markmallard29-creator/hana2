import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // libsql ships native bindings for local file databases
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
