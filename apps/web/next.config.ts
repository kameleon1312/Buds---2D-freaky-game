import path from 'node:path';
import type { NextConfig } from 'next';

// local dev: read the repo-root .env like the API does (Vercel sets real env vars; those win)
try {
  process.loadEnvFile(path.join(process.cwd(), '../../.env'));
} catch {
  // no .env file
}

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // a separate output dir lets a production build run next to `pnpm dev` (BUDS_DIST_DIR=.next-build)
  distDir: process.env.BUDS_DIST_DIR || '.next',
  poweredByHeader: false,
  transpilePackages: ['@buds/shared'],
  // monorepo root (next build runs from apps/web)
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  // lint runs as a separate CI job from the repo root
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
