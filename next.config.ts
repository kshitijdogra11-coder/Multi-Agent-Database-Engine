import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the engine to persist data files inside the project directory.
  env: {
    DATA_DIR: process.env.DATA_DIR || ".dbdata",
  },
};

export default nextConfig;
