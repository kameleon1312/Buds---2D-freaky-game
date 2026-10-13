import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { clientIp } from './client-ip.js';

type Bucket = { count: number; resetAt: number };

/**
 * Fixed-window in-memory limiter keyed by client IP.
 * Good enough for a single Railway instance; swap for Redis when scaling out.
 */
export function rateLimit(limitPerMinute: number, windowMs = 60_000): MiddlewareHandler {
  const buckets = new Map<string, Bucket>();

  return async (c, next) => {
    const ip = clientIp(c);
    const now = Date.now();

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
}
