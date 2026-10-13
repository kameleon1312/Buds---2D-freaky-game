import type { MiddlewareHandler } from 'hono';
import { verify } from 'hono/jwt';
import { HTTPException } from 'hono/http-exception';

export type AuthUser = {
  id: string;
  email: string | null;
  role: string;
};

export type AuthVariables = { user: AuthUser };

/** Verifies a Supabase access token (HS256, signed with the project's JWT secret). */
export function requireAuth(jwtSecret: string): MiddlewareHandler<{ Variables: AuthVariables }> {
  return async (c, next) => {
    const header = c.req.header('authorization') ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new HTTPException(401, { message: 'Missing bearer token' });
    }

    let payload: Record<string, unknown>;
    try {
      payload = await verify(token, jwtSecret, 'HS256');
    } catch {
      throw new HTTPException(401, { message: 'Invalid or expired token' });
    }

    if (typeof payload.sub !== 'string' || payload.role !== 'authenticated') {
      throw new HTTPException(401, { message: 'Invalid token claims' });
    }

    c.set('user', {
      id: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : null,
      role: payload.role,
    });
    await next();
  };
}
