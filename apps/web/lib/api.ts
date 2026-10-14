import {
  accountBudSchema,
  accountBudsResponseSchema,
  apiErrorSchema,
  type AccountBud,
  type AccountBudsResponse,
  budResponseSchema,
  createBudResponseSchema,
  leaderboardResponseSchema,
  pairCodeResponseSchema,
  type BudRecord,
  type CreateBudInput,
  type CreateBudResponse,
  type PairCodeResponse,
} from '@buds/shared';
import type { z } from 'zod';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

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
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
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

export function accountPairCode(accessToken: string, slug: string): Promise<PairCodeResponse> {
  return request(`/v1/account/buds/${encodeURIComponent(slug)}/pair-code`, pairCodeResponseSchema, {
    method: 'POST',
    headers: bearer(accessToken),
  });
}
