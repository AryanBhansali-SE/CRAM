import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // There's an unrelated package-lock.json in the home directory above this
    // project. Without pinning the root, Turbopack warns that it may have
    // picked the wrong workspace.
    root: import.meta.dirname,
  },
};

export default nextConfig;
