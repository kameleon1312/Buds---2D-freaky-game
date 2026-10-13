import type { Context, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { decodeProtectedHeader, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';

export type AuthUser = {
  id: string;
  email: string | null;
  role: string;
};

export type AuthVariables = { user: AuthUser };

export type AuthKeys = {
  /** Legacy shared secret (HS256). */
  secret: string;
  /** The project's public signing keys (ES256/RS256), from `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`. */
  jwks?: JWTVerifyGetKey;
};

/**
 * Verifies a Supabase access token. New projects sign with asymmetric keys (checked against the project's JWKS);
 * older ones with the shared JWT secret (HS256). Only signed-in users (`role: authenticated`) pass.
 */
export async function verifyUser(token: string, keys: AuthKeys): Promise<AuthUser | null> {
  let payload: JWTPayload;
  try {
    const { alg } = decodeProtectedHeader(token);
    if (alg === 'HS256') {
      ({ payload } = await jwtVerify(token, new TextEncoder().encode(keys.secret), {
        algorithms: ['HS256'],
      }));
    } else if (keys.jwks && (alg === 'ES256' || alg === 'RS256')) {
      ({ payload } = await jwtVerify(token, keys.jwks, { algorithms: ['ES256', 'RS256'] }));
    } else {
      return null;
    }
  } catch {
    return null;
  }
  if (typeof payload.sub !== 'string' || payload.role !== 'authenticated') return null;
  return {
    id: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    role: payload.role,
  };
}

const bearerOf = (c: Context) => {
  const [scheme, token] = (c.req.header('authorization') ?? '').split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
};

export function requireAuth(keys: AuthKeys): MiddlewareHandler<{ Variables: AuthVariables }> {
  return async (c, next) => {
    const token = bearerOf(c);
    if (!token) throw new HTTPException(401, { message: 'Missing bearer token' });
    const user = await verifyUser(token, keys);
    if (!user) throw new HTTPException(401, { message: 'Invalid or expired token' });
    c.set('user', user);
    await next();
  };
}

/**
 * The signed-in user, if the request carries an account token (creating a bud while signed in). A token that
 * doesn't verify is an error, not a silent guest.
 */
export async function optionalUser(c: Context, keys: AuthKeys): Promise<AuthUser | null> {
  const token = bearerOf(c);
  if (!token) return null;
  const user = await verifyUser(token, keys);
  if (!user) throw new HTTPException(401, { message: 'Invalid or expired token' });
  return user;
}
