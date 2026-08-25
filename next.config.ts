import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: false },
  agentRules: false,
  // Dev-only: hosts other than `localhost` that may request /_next/* assets.
  // Without this Next.js blocks the cross-origin dev request (127.0.0.1 and the
  // LAN address are different origins from localhost, even on the same machine).
  allowedDevOrigins: ['127.0.0.1', 'localhost', '0.0.0.0', '192.168.1.248'],
};

export default nextConfig;
