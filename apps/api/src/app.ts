import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import {
  PAIR_CODE_TTL_MINUTES,
  budSlugSchema,
  createBudSchema,
  redeemPairSchema,
  type ApiError,
  type BudResponse,
  type CreateBudResponse,
  type HealthResponse,
  type LeaderboardResponse,
  type MeResponse,
  type PairCodeResponse,
} from '@buds/shared';
import type { Env } from './env.js';
import { requireAuth, type AuthVariables } from './middleware/auth.js';
import {
  hashToken,
  newPlayerToken,
  requirePlayer,
  type PlayerVariables,
} from './middleware/player.js';
import { rateLimit } from './middleware/rate-limit.js';
import { budSheetPng } from './png.js';
import { makePairCode } from './store/slug.js';
import type { BudStore } from './store/types.js';

const VERSION = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev';
const startedAt = Date.now();

export type AppDeps = { store: BudStore };

export function createApp(env: Env, { store }: AppDeps) {
  const app = new Hono<{ Variables: AuthVariables & PlayerVariables }>();

  app.use('*', requestId());
  app.use('*', secureHeaders());
  app.use(
    '*',
    cors({
      origin: (origin) => (origin === env.WEB_ORIGIN ? origin : null),
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Authorization', 'Content-Type'],
      maxAge: 600,
    }),
  );
  app.use(
    '*',
    bodyLimit({
      maxSize: 100 * 1024,
      onError: (c) =>
        c.json<ApiError>({ error: { code: 'payload_too_large', message: 'Body too large' } }, 413),
    }),
  );
  app.use('/v1/*', rateLimit(env.RATE_LIMIT_PER_MINUTE));

  app.get('/health', (c) =>
    c.json<HealthResponse>({
      status: 'ok',
      version: VERSION,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    }),
  );

  app.get('/v1/me', requireAuth(env.SUPABASE_JWT_SECRET), (c) => {
    const user = c.get('user');
    return c.json<MeResponse>({ id: user.id, email: user.email, role: user.role });
  });

  // ---------- buds ----------

  app.post('/v1/buds', rateLimit(env.CREATE_LIMIT_PER_MINUTE), async (c) => {
    const body = await c.req.json().catch(() => null);
    const input = createBudSchema.safeParse(body);
    if (!input.success) {
      const message = input.error.issues[0]?.message ?? 'Invalid input';
      return c.json<ApiError>({ error: { code: 'invalid_input', message } }, 400);
    }
    const token = newPlayerToken();
    const bud = await store.create(input.data, hashToken(token));
    return c.json<CreateBudResponse>({ bud, token }, 201);
  });

  app.get('/v1/buds/me', requirePlayer(store), (c) => c.json<BudResponse>({ bud: c.get('bud') }));

  // web shows this code; the game redeems it for its own token
  app.post('/v1/buds/me/pair-code', requirePlayer(store), async (c) => {
    const code = makePairCode();
    const expiresAt = new Date(Date.now() + PAIR_CODE_TTL_MINUTES * 60_000);
    await store.savePairCode(c.get('bud').slug, code, expiresAt);
    return c.json<PairCodeResponse>({ code, expiresAt: expiresAt.toISOString() }, 201);
  });

  // tight limit: this is the one endpoint where guessing would pay off
  app.post('/v1/pair', rateLimit(env.CREATE_LIMIT_PER_MINUTE), async (c) => {
    const input = redeemPairSchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success) {
      return c.json<ApiError>(
        { error: { code: 'invalid_input', message: 'Kod ma 6 znaków' } },
        400,
      );
    }
    const slug = await store.redeemPairCode(input.data.code, new Date());
    const bud = slug ? await store.getBySlug(slug) : null;
    if (!bud) throw new HTTPException(404, { message: 'Kod nieważny lub wygasł' });
    const token = newPlayerToken();
    await store.addToken(bud.slug, hashToken(token));
    return c.json<CreateBudResponse>({ bud, token }, 201);
  });

  app.get('/v1/buds/top', async (c) => {
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 50, 1), 100);
    return c.json<LeaderboardResponse>({ buds: await store.top(limit) });
  });

  app.get('/v1/buds/:slug/sheet.png', async (c) => {
    const slug = budSlugSchema.safeParse(c.req.param('slug'));
    const bud = slug.success ? await store.getBySlug(slug.data) : null;
    if (!bud) throw new HTTPException(404, { message: 'Bud not found' });
    // default 8 → 128×192 px per frame; 2..16 accepted
    const scale = Math.min(Math.max(Math.round(Number(c.req.query('scale'))) || 8, 2), 16);
    return c.body(new Uint8Array(budSheetPng(bud.look, scale)), 200, {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=300',
    });
  });

  app.get('/v1/buds/:slug', async (c) => {
    const slug = budSlugSchema.safeParse(c.req.param('slug'));
    const bud = slug.success ? await store.getBySlug(slug.data) : null;
    if (!bud) throw new HTTPException(404, { message: 'Bud not found' });
    return c.json<BudResponse>({ bud });
  });

  app.notFound((c) =>
    c.json<ApiError>({ error: { code: 'not_found', message: 'Not found' } }, 404),
  );

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      // keep headers set by earlier middleware (CORS, rate-limit, security headers)
      return c.json<ApiError>(
        { error: { code: `http_${err.status}`, message: err.message } },
        err.status,
      );
    }
    console.error(`[${c.get('requestId')}]`, err);
    return c.json<ApiError>({ error: { code: 'internal', message: 'Internal server error' } }, 500);
  });

  return app;
}
