import type { Context } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';

/**
 * Railway's edge sets X-Real-IP / X-Forwarded-For; locally we fall back to the socket address.
 */
export function clientIp(c: Context): string {
  const forwarded =
    c.req.header('x-real-ip')?.trim() || c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown'; // not running on a node socket (tests)
  }
}
