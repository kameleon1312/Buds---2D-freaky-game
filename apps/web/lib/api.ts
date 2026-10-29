import {
  DELETE_ACCOUNT_WORDS,
  logoutAllResponseSchema,
  accountBudSchema,
  accountBudsResponseSchema,
  apiErrorSchema,
  type AccountBud,
  type AccountBudsResponse,
  budResponseSchema,
  createBudResponseSchema,
  leaderboardResponseSchema,
  pairCodeResponseSchema,
  rankingResponseSchema,
  type BudRecord,
  type CreateBudInput,
  type CreateBudResponse,
  type PairCodeResponse,
} from '@buds/shared';
import type { z } from 'zod';
import { normalizeUrl } from '@/lib/site';

export const API_URL = process.env.NEXT_PUBLIC_API_URL?.trim()
  ? normalizeUrl(process.env.NEXT_PUBLIC_API_URL)
  : 'http://localhost:4000';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const FRIENDLY: Record<number, string> = {
  401: 'Sesja wygasła. Zaloguj się ponownie.',
  429: 'Za szybko! Odczekaj chwilę i spróbuj ponownie.',
  500: 'Coś poszło nie tak po naszej stronie. Spróbuj za moment.',
};

async function request<T>(
  path: string,
  schema: z.ZodType<T, unknown>,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiRequestError('Brak połączenia z serwerem.', 0);
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const apiMessage = apiErrorSchema.safeParse(body).data?.error.message;
    const message =
      FRIENDLY[res.status] ??
      ([400, 403, 404, 409].includes(res.status) && apiMessage ? apiMessage : 'Nieznany błąd.');
    throw new ApiRequestError(message, res.status);
  }
  return schema.parse(body);
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

// ---------- server ----------

export async function getBud(slug: string): Promise<BudRecord | null> {
  try {
    const { bud } = await request(`/v1/buds/${encodeURIComponent(slug)}`, budResponseSchema, {
      cache: 'no-store',
    });
    return bud;
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) return null;
    throw err;
  }
}

export async function getLeaderboard(limit = 50): Promise<BudRecord[]> {
  const { buds } = await request(`/v1/buds/top?limit=${limit}`, leaderboardResponseSchema, {
    next: { revalidate: 30 },
  });
  return buds;
}

/** The week's rivalry rankings; null while the API doesn't have them (an older deploy) or is waking up. */
export async function getRanking(): Promise<z.infer<typeof rankingResponseSchema> | null> {
  try {
    return await request('/v1/rivalry/ranking', rankingResponseSchema, {
      next: { revalidate: 30 },
    });
  } catch {
    return null;
  }
}

// ---------- browser ----------

/** Signed in (`accessToken`): the bud belongs to the account right away. */
export function createBud(
  input: CreateBudInput,
  accessToken?: string | null,
): Promise<CreateBudResponse> {
  return request('/v1/buds', createBudResponseSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(accessToken ? bearer(accessToken) : {}) },
    body: JSON.stringify(input),
  });
}

export async function getMyBud(token: string): Promise<BudRecord | null> {
  try {
    const { bud } = await request('/v1/buds/me', budResponseSchema, { headers: bearer(token) });
    return bud;
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 401) return null;
    throw err;
  }
}

export function createPairCode(token: string): Promise<PairCodeResponse> {
  return request('/v1/buds/me/pair-code', pairCodeResponseSchema, {
    method: 'POST',
    headers: bearer(token),
  });
}

// ---------- account (signed in on the website) ----------

export function getAccountBuds(accessToken: string): Promise<AccountBudsResponse> {
  return request('/v1/account/buds', accountBudsResponseSchema, { headers: bearer(accessToken) });
}

/** Links a bud from the game: the code it shows under Twój Bud → Połącz z kontem. */
export function linkBud(accessToken: string, code: string): Promise<AccountBud> {
  return request('/v1/account/buds/link', accountBudSchema, {
    method: 'POST',
    headers: { ...bearer(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}

/** Links the guest bud this browser created to the account. */
export function claimBud(accessToken: string, guestToken: string): Promise<AccountBud> {
  return request('/v1/account/buds/claim', accountBudSchema, {
    method: 'POST',
    headers: { ...bearer(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: guestToken }),
  });
}

// ---------- managing the account and its buds ----------

/** A new name for an account's bud (once a week; the server filters it like every public name). */
export function renameAccountBud(
  accessToken: string,
  slug: string,
  name: string,
): Promise<BudRecord> {
  return request(`/v1/account/buds/${encodeURIComponent(slug)}/name`, budResponseSchema, {
    method: 'PUT',
    headers: { ...bearer(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  }).then((r) => r.bud);
}

/** Signs out every device playing the bud (a lost phone). Returns how many. */
export async function logoutBudDevices(accessToken: string, slug: string): Promise<number> {
  const r = await request(
    `/v1/account/buds/${encodeURIComponent(slug)}/logout-all`,
    logoutAllResponseSchema,
    { method: 'POST', headers: bearer(accessToken) },
  );
  return r.signedOut;
}

/** A request that answers 204 (nothing to read): throws the API's message otherwise. */
async function noContent(path: string, init: RequestInit): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiRequestError('Brak połączenia z serwerem.', 0);
  }
  if (res.ok) return;
  const body: unknown = await res.json().catch(() => null);
  const message = apiErrorSchema.safeParse(body).data?.error.message;
  throw new ApiRequestError(FRIENDLY[res.status] ?? message ?? 'Nieznany błąd.', res.status);
}

/** Deletes an account's bud for good; `confirm` is its name as the player typed it. */
export function deleteAccountBud(
  accessToken: string,
  slug: string,
  confirm: string,
): Promise<void> {
  return noContent(`/v1/account/buds/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
    headers: { ...bearer(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm }),
  });
}

/** Deletes the account with every bud on it (the words must be typed exactly). */
export function deleteAccount(accessToken: string): Promise<void> {
  return noContent('/v1/account', {
    method: 'DELETE',
    headers: { ...bearer(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: DELETE_ACCOUNT_WORDS }),
  });
}

/** Everything the game keeps about the account, as a JSON file. */
export async function exportAccount(accessToken: string): Promise<Blob> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/v1/account/export`, { headers: bearer(accessToken) });
  } catch {
    throw new ApiRequestError('Brak połączenia z serwerem.', 0);
  }
  if (!res.ok)
    throw new ApiRequestError(FRIENDLY[res.status] ?? 'Nie udało się pobrać danych.', res.status);
  return res.blob();
}

export function accountPairCode(accessToken: string, slug: string): Promise<PairCodeResponse> {
  return request(`/v1/account/buds/${encodeURIComponent(slug)}/pair-code`, pairCodeResponseSchema, {
    method: 'POST',
    headers: bearer(accessToken),
  });
}
