import path from 'node:path';
import type { NextConfig } from 'next';

// local dev: read the repo-root .env like the API does (Vercel sets real env vars; those win)
try {
  process.loadEnvFile(path.join(process.cwd(), '../../.env'));
} catch {
  // no .env file
}

/** The origin of a configured URL (or nothing): what the page may talk to. */
const originOf = (url: string | undefined) => {
  try {
    return url?.trim() ? new URL(url.trim()).origin : '';
  } catch {
    return '';
  }
};

const dev = process.env.NODE_ENV !== 'production';
const api = originOf(process.env.NEXT_PUBLIC_API_URL) || (dev ? 'http://localhost:4000' : '');
const auth = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL);

/**
 * Content Security Policy: the page loads only its own scripts, styles and fonts, talks only to the game's API and
 * the sign-in service, can't be framed, and no plugin or foreign form target ever runs. Inline scripts stay
 * allowed for Next.js's own bootstrapping (no third-party script is ever added to the page).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${api}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${api} ${auth} ${auth.replace(/^http/, 'ws')}`.replace(/\s+/g, ' ').trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(dev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

// the public values the browser needs, passed explicitly: Next.js inlines them at compile time and rebuilds when
// they change (values from the repo-root .env would otherwise stay cached in .next after editing .env)
const publicEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => entry[0].startsWith('NEXT_PUBLIC_') && !!entry[1],
  ),
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: publicEnv,
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
