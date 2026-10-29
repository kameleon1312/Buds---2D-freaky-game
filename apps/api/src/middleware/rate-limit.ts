import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { clientIp } from './client-ip.js';

type Bucket = { count: number; resetAt: number };

/**
 * Fixed-window in-memory limiter keyed by client IP.
 * Good enough for a single API instance; swap for Redis when scaling out.
 * `ipHeader` is the one header trusted for the client IP (CLIENT_IP_HEADER, see clientIp).
 */
/** How many addresses a limiter remembers right now (tests check that old ones are forgotten). */
export const rateLimitSize = (mw: MiddlewareHandler) =>
  (mw as MiddlewareHandler & { size?: () => number }).size?.() ?? -1;

export function rateLimit(
  limitPerMinute: number,
  windowMs = 60_000,
  ipHeader?: string,
): MiddlewareHandler {
  const buckets = new Map<string, Bucket>();
  let sweptAt = Date.now();

  const handler: MiddlewareHandler = async (c, next) => {
    const ip = clientIp(c, ipHeader);
    const now = Date.now();
    // forget the windows that are over, once a window: every address that ever called would otherwise stay in
    // memory for the life of the process (a slow leak, and an easy one to push with many addresses)
    if (now - sweptAt >= windowMs) {
      sweptAt = now;
      for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
    }

    let bucket = buckets.get(ip);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, bucket);
    }
    bucket.count += 1;

    c.header('X-RateLimit-Limit', String(limitPerMinute));
    c.header('X-RateLimit-Remaining', String(Math.max(0, limitPerMinute - bucket.count)));

    if (bucket.count > limitPerMinute) {
      c.header('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      throw new HTTPException(429, { message: 'Too many requests' });
    }
    await next();
  };
  return Object.assign(handler, { size: () => buckets.size });
}
