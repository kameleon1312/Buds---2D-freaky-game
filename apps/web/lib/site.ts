/** Accepts `buds.vercel.app`, `https://buds.vercel.app/` and the like: always `https://host` with no trailing slash. */
export function normalizeUrl(url: string) {
  const trimmed = url.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  ? normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL)
  : process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL)
    : 'http://localhost:3000';
