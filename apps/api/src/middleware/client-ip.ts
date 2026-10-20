import type { IncomingMessage } from 'node:http';
import type { Context } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';

/**
 * The client's IP for rate limiting. With `trustedHeader` (CLIENT_IP_HEADER) only that header counts, because
 * on hosts whose proxy passes client-sent X-Real-IP / X-Forwarded-For through (Render) those can be faked to dodge
 * the limits; on Render use cf-connecting-ip, which its Cloudflare edge always overwrites. Without it, Railway's
 * edge sets X-Real-IP / X-Forwarded-For; locally we fall back to the socket address.
 */
export function clientIp(c: Context, trustedHeader?: string): string {
  if (trustedHeader) {
    const value = c.req.header(trustedHeader)?.split(',')[0]?.trim();
    // missing (not behind that proxy): fall through rather than putting every client in one bucket
    if (value) return value;
  }
  const forwarded =
    c.req.header('x-real-ip')?.trim() || c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  return socketIp(c);
}

function socketIp(c: Context): string {
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown'; // not running on a node socket (tests)
  }
}

/** The same rule for a raw request (the live server's WebSocket upgrade, which never reaches Hono). */
export function clientIpOfRequest(req: IncomingMessage, trustedHeader?: string): string {
  const header = (name: string) => {
    const v = req.headers[name];
    return (Array.isArray(v) ? v[0] : v)?.split(',')[0]?.trim();
  };
  if (trustedHeader) {
    const value = header(trustedHeader);
    if (value) return value;
  }
  return header('x-real-ip') || header('x-forwarded-for') || req.socket.remoteAddress || 'unknown';
}
