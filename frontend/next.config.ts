import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    // In development, proxy root and frontend static assets to the backend
    if (process.env.NODE_ENV === 'development') {
      return [
        { source: '/', destination: 'http://localhost:8000/' },
        { source: '/frontend/:path*', destination: 'http://localhost:8000/frontend/:path*' },
      ];
    }
    return [];
  },
};

export default nextConfig;
