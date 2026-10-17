import { describe, expect, it } from 'vitest';
import { sign } from 'hono/jwt';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/env.js';
import { createMemoryStore } from '../src/store/memory.js';

const SECRET = 'test-secret-test-secret-test-secret-123';
const ORIGIN = 'https://buds.example';

function makeApp() {
  return createApp(
    loadEnv({ SUPABASE_JWT_SECRET: SECRET, WEB_ORIGIN: ORIGIN, RATE_LIMIT_PER_MINUTE: '5' }),
    { store: createMemoryStore() },
  );
}

async function token(claims: Record<string, unknown> = {}, secret = SECRET) {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    { sub: 'user-1', email: 'a@b.co', role: 'authenticated', exp: now + 60, ...claims },
    secret,
    'HS256',
  );
}

describe('env', () => {
  it('rejects a short JWT secret', () => {
    expect(() => loadEnv({ SUPABASE_JWT_SECRET: 'short' })).toThrow(/SUPABASE_JWT_SECRET/);
  });
});

describe('public endpoints', () => {
  it('GET /health returns ok', async () => {
    const res = await makeApp().request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ok' });
  });

  it('sets security headers', async () => {
    const res = await makeApp().request('/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(res.headers.get('strict-transport-security')).toBeTruthy();
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });

  it('returns JSON 404 for unknown routes', async () => {
    const res = await makeApp().request('/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: 'not_found' } });
  });
});

describe('CORS', () => {
  it('allows the configured web origin', async () => {
    const res = await makeApp().request('/health', { headers: { Origin: ORIGIN } });
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN);
  });

  it('does not allow foreign origins', async () => {
    const res = await makeApp().request('/health', {
      headers: { Origin: 'https://evil.example' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('auth on /v1/me', () => {
  const me = (authorization?: string) =>
    makeApp().request('/v1/me', authorization ? { headers: { Authorization: authorization } } : {});

  it('401 without token', async () => {
    expect((await me()).status).toBe(401);
  });

  it('401 with token signed by another secret', async () => {
    const t = await token({}, 'another-secret-another-secret-another');
    expect((await me(`Bearer ${t}`)).status).toBe(401);
  });

  it('401 with expired token', async () => {
    const t = await token({ exp: Math.floor(Date.now() / 1000) - 10 });
    expect((await me(`Bearer ${t}`)).status).toBe(401);
  });

  it('401 for anon role token', async () => {
    const t = await token({ role: 'anon' });
    expect((await me(`Bearer ${t}`)).status).toBe(401);
  });

  it('200 with valid token', async () => {
    const res = await me(`Bearer ${await token()}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'user-1', email: 'a@b.co', role: 'authenticated' });
  });
});

describe('abuse protection', () => {
  it('429 after exceeding the rate limit', async () => {
    const app = makeApp();
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await app.request('/v1/me', { headers: { 'X-Forwarded-For': '1.2.3.4' } });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it('413 for oversized bodies', async () => {
    const size = 200 * 1024;
    const res = await makeApp().request('/v1/me', {
      method: 'POST',
      body: 'x'.repeat(size),
      headers: { 'Content-Type': 'text/plain', 'Content-Length': String(size) },
    });
    expect(res.status).toBe(413);
  });
});

describe('signing a device out', () => {
  const look = {
    gender: 'on',
    mood: 'radosny',
    skin: 1,
    hair: 'krotkie',
    hairColor: 0,
    outfit: 'bluza',
    outfitColor: 1,
    pantsColor: 0,
  };

  it('forgets only that device token; the bud and its other devices stay signed in', async () => {
    const app = createApp(
      loadEnv({ SUPABASE_JWT_SECRET: SECRET, WEB_ORIGIN: ORIGIN, RATE_LIMIT_PER_MINUTE: '100' }),
      { store: createMemoryStore() },
    );
    const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
    const created = await app.request('/v1/buds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Wylogowany', look }),
    });
    const { token: phone, bud } = (await created.json()) as {
      token: string;
      bud: { slug: string };
    };
    // a second device paired with a code
    const code = (await (
      await app.request('/v1/buds/me/pair-code', { method: 'POST', headers: auth(phone) })
    ).json()) as { code: string };
    const paired = (await (
      await app.request('/v1/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.code }),
      })
    ).json()) as { token: string };

    expect((await app.request('/v1/buds/me/logout', { method: 'POST' })).status).toBe(401);
    expect(
      (await app.request('/v1/buds/me/logout', { method: 'POST', headers: auth(phone) })).status,
    ).toBe(204);
    expect((await app.request('/v1/buds/me', { headers: auth(phone) })).status).toBe(401);
    expect(
      (await app.request('/v1/buds/me/logout', { method: 'POST', headers: auth(phone) })).status,
    ).toBe(401);
    const other = await app.request('/v1/buds/me', { headers: auth(paired.token) });
    expect(other.status).toBe(200);
    expect(((await other.json()) as { bud: { slug: string } }).bud.slug).toBe(bud.slug);
  });
});
