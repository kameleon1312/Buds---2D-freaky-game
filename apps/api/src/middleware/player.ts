import { createHash, randomBytes } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { BudRecord } from '@buds/shared';
import type { BudStore } from '../store/types.js';

export type PlayerVariables = { bud: BudRecord };

export function newPlayerToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Resolves `Authorization: Bearer <player token>` to the player's bud. */
export function requirePlayer(store: BudStore): MiddlewareHandler<{ Variables: PlayerVariables }> {
  return async (c, next) => {
    const [scheme, token] = (c.req.header('authorization') ?? '').split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token || token.length > 100) {
      throw new HTTPException(401, { message: 'Missing player token' });
    }
    const bud = await store.getByTokenHash(hashToken(token));
    if (!bud) throw new HTTPException(401, { message: 'Unknown player token' });
    c.set('bud', bud);
    await next();
  };
}
