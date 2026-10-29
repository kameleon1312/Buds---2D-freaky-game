import { describe, expect, it } from 'vitest';
import { sign } from 'hono/jwt';
import {
  DELETE_ACCOUNT_WORDS,
  RENAME_DAYS,
  type AccountExport,
  type ApiError,
  type BudExport,
  type BudResponse,
  type CreateBudResponse,
  type LogoutAllResponse,
  type PairCodeResponse,
} from '@buds/shared';
import type { MiddlewareHandler } from 'hono';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/env.js';
import { rateLimit, rateLimitSize } from '../src/middleware/rate-limit.js';
import { createMemoryStore } from '../src/store/memory.js';

const SECRET = 'x'.repeat(32);
const look = {
  gender: 'on',
  mood: 'radosny',
  skin: 1,
  hair: 'krotkie',
  hairColor: 0,
  outfit: 'bluza',
  outfitColor: 1,
  pantsColor: 0,
} as const;

function setup() {
  let clock = Date.parse('2026-10-29T12:00:00Z');
  const store = createMemoryStore(() => new Date(clock));
  const app = createApp(
    loadEnv({
      SUPABASE_JWT_SECRET: SECRET,
      CREATE_LIMIT_PER_MINUTE: '1000',
      RATE_LIMIT_PER_MINUTE: '10000',
    }),
    { store, now: () => new Date(clock) },
  );
  const gone: string[] = [];
  const renamed: string[] = [];
  app.hooks.budGone = (slug) => void gone.push(slug);
  app.hooks.budChanged = (slug) => void renamed.push(slug);
  const call = (method: string, path: string, token?: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const user = (sub: string) =>
    sign(
      {
        sub,
        email: `${sub}@buds.example`,
        role: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 600,
      },
      SECRET,
      'HS256',
    );
  const bud = async (name: string, account?: string) => {
    const res = await call('POST', '/v1/buds', account, { name, look });
    return (await res.json()) as CreateBudResponse;
  };
  return {
    app,
    store,
    call,
    user,
    bud,
    gone,
    renamed,
    later: (days: number) => (clock += days * 86_400_000),
  };
}

const err = async (res: Response) => ((await res.json()) as ApiError).error.code;

describe('a bud’s name', () => {
  it('keeps swears and contacts out of a public name', async () => {
    const { call } = setup();
    for (const name of ['kurwa', 'Ku rwa', 'www.x.pl', '5551234567'])
      expect((await call('POST', '/v1/buds', undefined, { name, look })).status, name).toBe(400);
    expect(
      (await call('POST', '/v1/buds', undefined, { name: '  Szymon   K ', look })).status,
    ).toBe(201);
  });

  it('can be changed once a week, and the room hears it', async () => {
    const { call, bud, renamed, later } = setup();
    const b = await bud('Ala');
    expect((await call('PUT', '/v1/buds/me/name', undefined, { name: 'Nowa' })).status).toBe(401);
    expect((await call('PUT', '/v1/buds/me/name', b.token, { name: 'kurwa' })).status).toBe(400);
    const res = await call('PUT', '/v1/buds/me/name', b.token, { name: 'Alicja' });
    expect(res.status).toBe(200);
    expect(((await res.json()) as BudResponse).bud.name).toBe('Alicja');
    expect(renamed).toEqual([b.bud.slug]);
    expect(await err(await call('PUT', '/v1/buds/me/name', b.token, { name: 'Ola' }))).toBe(
      'rename_too_soon',
    );
    later(RENAME_DAYS + 0.01);
    expect((await call('PUT', '/v1/buds/me/name', b.token, { name: 'Ola' })).status).toBe(200);
  });
});

describe('devices', () => {
  it('signs every other device out, this one stays', async () => {
    const { call, bud } = setup();
    const b = await bud('Ala');
    const code = (await (
      await call('POST', '/v1/buds/me/pair-code', b.token)
    ).json()) as PairCodeResponse;
    const phone = (await (
      await call('POST', '/v1/pair', undefined, { code: code.code })
    ).json()) as CreateBudResponse;
    expect((await call('GET', '/v1/buds/me', phone.token)).status).toBe(200);
    const out = (await (
      await call('POST', '/v1/buds/me/logout-all', b.token)
    ).json()) as LogoutAllResponse;
    expect(out.signedOut).toBe(1);
    expect((await call('GET', '/v1/buds/me', phone.token)).status).toBe(401);
    expect((await call('GET', '/v1/buds/me', b.token)).status).toBe(200);
  });
});

describe('the player’s data', () => {
  it('a bud downloads everything the game keeps about it', async () => {
    const { call, bud } = setup();
    const b = await bud('Ala');
    const res = await call('GET', '/v1/buds/me/export', b.token);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toMatch(/attachment/);
    const data = (await res.json()) as BudExport;
    expect(data.bud.slug).toBe(b.bud.slug);
    expect(data.wallet).toEqual({ coins: 0, gems: 0 });
    expect(data.devices).toBe(1);
    expect(data.account).toBeNull();
    // no token hash or account id ever leaves
    expect(JSON.stringify(data)).not.toMatch(/token_hash|user_id|"token"/);
  });
});

describe('deleting a bud', () => {
  it('needs its name typed, then everything about it is gone and the room lets it go', async () => {
    const { call, store, bud, gone } = setup();
    const b = await bud('Ala');
    expect(await err(await call('DELETE', '/v1/buds/me', b.token, { confirm: 'Ola' }))).toBe(
      'confirm_name',
    );
    expect(await err(await call('DELETE', '/v1/buds/me', b.token, {}))).toBe('confirm_name');
    expect((await call('DELETE', '/v1/buds/me', b.token, { confirm: ' ala ' })).status).toBe(204);
    expect(gone).toEqual([b.bud.slug]);
    expect(await store.getBySlug(b.bud.slug)).toBeNull();
    expect((await call('GET', '/v1/buds/me', b.token)).status).toBe(401);
    expect((await call('GET', `/v1/buds/${b.bud.slug}`)).status).toBe(404);
  });
});

describe('the account', () => {
  it('manages only its own buds', async () => {
    const { call, user, bud, renamed } = setup();
    const mine = await user('u1');
    const theirs = await user('u2');
    const b = await bud('Ala', mine);
    expect(
      (await call('PUT', `/v1/account/buds/${b.bud.slug}/name`, theirs, { name: 'Obca' })).status,
    ).toBe(404);
    expect(
      (await call('DELETE', `/v1/account/buds/${b.bud.slug}`, theirs, { confirm: 'Ala' })).status,
    ).toBe(404);
    expect((await call('POST', `/v1/account/buds/${b.bud.slug}/logout-all`, theirs)).status).toBe(
      404,
    );
    expect((await call('PUT', `/v1/account/buds/../name`, mine, { name: 'X' })).status).toBe(404);
    expect(
      (await call('PUT', `/v1/account/buds/${b.bud.slug}/name`, mine, { name: 'Alicja' })).status,
    ).toBe(200);
    expect(renamed).toEqual([b.bud.slug]);
    // signing every device out from the website: the game's token goes too
    const out = (await (
      await call('POST', `/v1/account/buds/${b.bud.slug}/logout-all`, mine)
    ).json()) as LogoutAllResponse;
    expect(out.signedOut).toBe(1);
    expect((await call('GET', '/v1/buds/me', b.token)).status).toBe(401);
  });

  it('downloads all its data and deletes itself with every bud, only with the words typed', async () => {
    const { call, store, user, bud, gone } = setup();
    const me = await user('u1');
    const a = await bud('Ala', me);
    const c = await bud('Celina', me);
    const other = await bud('Obcy', await user('u2'));
    const data = (await (await call('GET', '/v1/account/export', me)).json()) as AccountExport;
    expect(data.email).toBe('u1@buds.example');
    expect(data.buds.map((x) => x.bud.slug).sort()).toEqual([a.bud.slug, c.bud.slug].sort());
    expect((await call('GET', '/v1/account/export')).status).toBe(401);

    expect(await err(await call('DELETE', '/v1/account', me, { confirm: 'usun' }))).toBe(
      'confirm_words',
    );
    expect(
      (await call('DELETE', '/v1/account', me, { confirm: DELETE_ACCOUNT_WORDS })).status,
    ).toBe(204);
    expect(gone.sort()).toEqual([a.bud.slug, c.bud.slug].sort());
    expect(await store.getBySlug(a.bud.slug)).toBeNull();
    expect(await store.budsOfUser('u1')).toEqual([]);
    // another account's bud stays
    expect(await store.getBySlug(other.bud.slug)).not.toBeNull();
  });
});

describe('a bud on an account', () => {
  it('leaves only through the account: the claiming guest key stops working, no device hands out codes', async () => {
    const { call, user, bud } = setup();
    const me = await user('u1');
    const guest = await bud('Szymon');
    // a guest bud can still be brought to the game with its own key
    expect((await call('POST', '/v1/buds/me/pair-code', guest.token)).status).toBe(201);
    // a phone paired before the claim keeps playing
    const code = (await (
      await call('POST', '/v1/buds/me/pair-code', guest.token)
    ).json()) as PairCodeResponse;
    const phone = (await (
      await call('POST', '/v1/pair', undefined, { code: code.code })
    ).json()) as CreateBudResponse;

    expect((await call('POST', '/v1/account/buds/claim', me, { token: guest.token })).status).toBe(
      200,
    );
    // the browser's guest key is spent
    expect((await call('GET', '/v1/buds/me', guest.token)).status).toBe(401);
    expect((await call('POST', '/v1/buds/me/pair-code', guest.token)).status).toBe(401);
    // the phone plays on, but can't hand the bud to anyone else
    expect((await call('GET', '/v1/buds/me', phone.token)).status).toBe(200);
    const denied = await call('POST', '/v1/buds/me/pair-code', phone.token);
    expect(denied.status).toBe(403);
    expect(await err(denied)).toBe('bud_on_account');
    // the signed-in owner still gets one
    expect((await call('POST', `/v1/account/buds/${guest.bud.slug}/pair-code`, me)).status).toBe(
      201,
    );
    // and another account never does
    expect(
      (await call('POST', `/v1/account/buds/${guest.bud.slug}/pair-code`, await user('u2'))).status,
    ).toBe(404);
  });
});

describe('creating an account', () => {
  const form = { email: ' Nowy@Buds.Example ', password: 'dobre-haslo-1', consent: true };

  it('makes a sign-in ready at once and never makes the same e-mail twice', async () => {
    const { call } = setup();
    const res = await call('POST', '/v1/auth/signup', undefined, form);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ email: 'nowy@buds.example' });
    const again = await call('POST', '/v1/auth/signup', undefined, {
      ...form,
      email: 'nowy@buds.example',
    });
    expect(again.status).toBe(409);
    expect(await err(again)).toBe('email_taken');
  });

  it('turns away a bad e-mail, a short or too long password and a missing consent', async () => {
    const { call } = setup();
    for (const body of [
      { ...form, email: 'nie-email' },
      { ...form, password: 'krotkie' },
      { ...form, password: 'ą'.repeat(37) }, // 74 bytes: past what bcrypt reads
      { ...form, consent: false },
      { email: form.email, password: form.password },
      null,
    ]) {
      const res = await call('POST', '/v1/auth/signup', undefined, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(await err(res)).toBe('invalid_signup');
    }
  });

  it('is limited per address', async () => {
    const store = createMemoryStore();
    const app = createApp(loadEnv({ SUPABASE_JWT_SECRET: SECRET, SIGNUP_LIMIT_PER_HOUR: '2' }), {
      store,
    });
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await app.request('/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.9.9.9' },
        body: JSON.stringify({ ...form, email: `gracz${i}@buds.example` }),
      });
      statuses.push(res.status);
    }
    expect(statuses).toEqual([201, 201, 429]);
  });
});

describe('rate limits', () => {
  it('forget addresses whose window is over', async () => {
    const mw = rateLimit(5, 30);
    const run = (ip: string) =>
      (mw as MiddlewareHandler)(
        {
          req: {
            header: (h: string) => (h.toLowerCase() === 'x-forwarded-for' ? ip : undefined),
            raw: { headers: new Headers() },
          },
          header: () => {},
          env: { incoming: { socket: { remoteAddress: ip } } },
        } as never,
        async () => {},
      );
    for (let i = 0; i < 50; i++) await run(`10.0.0.${i}`);
    expect(rateLimitSize(mw)).toBe(50);
    await new Promise((r) => setTimeout(r, 40));
    await run('10.0.1.1');
    expect(rateLimitSize(mw)).toBe(1);
  });
});
