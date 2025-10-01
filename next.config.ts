import type { NextConfig } from 'next';
import 'dotenv/config';

const nextConfig: NextConfig = {
  // --- ADD THIS LINE ---
  distDir: 'build',
  // --------------------

  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'management-app-bakery.vercel.app',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;