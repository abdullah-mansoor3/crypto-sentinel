import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // We serve the Next.js app directly; backend requests should use NEXT_PUBLIC_API_URL
  // so we no longer proxy the root to the FastAPI server.
};

export default nextConfig;
