import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000', 
        '127.0.0.1:3000',
        'ctm-inventory-system.rubtumseo.com'
      ]
    }
  },
  // Production optimization
  output: 'standalone',
  env: {
    PORT: '3000'
  },
  // Trust proxy for production
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Forwarded-Proto',
            value: 'https',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
