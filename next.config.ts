import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', '127.0.0.1:3000']
    }
  },
  // Ensure development server uses port 3000
  env: {
    PORT: '3000'
  }
};

export default nextConfig;
