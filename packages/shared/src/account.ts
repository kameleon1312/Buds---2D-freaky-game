import { z } from 'zod';
import { exploredMapSchema } from './explored';
import { ownedItemSchema } from './catalog';
import { characterStatsSchema, equipmentSchema } from './gear';
import { budNameSchema, budRecordSchema } from './schemas';

/**
 * Accounts (Supabase Auth, e-mail + password): a signed-in user owns buds, sees their private data (wallet, items,
 * gear, progress) and can link a device to them from anywhere. Guest buds created before signing in are claimed with
 * the guest token this browser keeps. Only the API reads and writes this; the public profile stays minimal.
 */

/** A user can hold this many buds. */
export const MAX_BUDS_PER_ACCOUNT = 5;

export const accountBudSchema = z.object({
  bud: budRecordSchema,
  level: z.number().int().min(1),
  coins: z.number().int().nonnegative(),
  gems: z.number().int().nonnegative(),
  items: z.array(ownedItemSchema),
  equipment: equipmentSchema,
  stats: characterStatsSchema,
  questsDone: z.number().int().nonnegative(),
  cachesFound: z.number().int().nonnegative(),
});
export type AccountBud = z.infer<typeof accountBudSchema>;

export const accountBudsResponseSchema = z.object({ buds: z.array(accountBudSchema) });
export type AccountBudsResponse = z.infer<typeof accountBudsResponseSchema>;

/**
 * Links a bud made in the game: the game shows a pairing code (POST /v1/buds/me/pair-code) and the signed-in
 * website account redeems it (POST /v1/account/buds/link). The code proves the player has the bud.
 */
export { redeemPairSchema as linkBudRequestSchema } from './schemas';

/**
 * Creating an account (website and game): the API creates the sign-in with the Supabase admin API, ready to use at
 * once, so a new player never waits for a confirmation e-mail that the project's mailer may not deliver. The client
 * signs in with the same e-mail and password right after. The password goes over TLS to the API and on to Supabase,
 * never stored or logged here.
 */
export const PASSWORD_MIN = 8;
/** bcrypt, which Supabase Auth uses, reads at most 72 bytes. */
export const PASSWORD_MAX = 72;

export const signUpRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email({ message: 'Sprawdź adres e-mail.' })),
  password: z
    .string()
    .min(PASSWORD_MIN, { message: `Hasło musi mieć co najmniej ${PASSWORD_MIN} znaków.` })
    .refine((p) => new TextEncoder().encode(p).length <= PASSWORD_MAX, {
      message: 'Hasło jest za długie.',
    }),
  /** The privacy policy accepted (the form's checkbox). */
  consent: z.literal(true, { message: 'Zaakceptuj zasady prywatności.' }),
});
export type SignUpRequest = z.infer<typeof signUpRequestSchema>;

export const signUpResponseSchema = z.object({ email: z.string() });
export type SignUpResponse = z.infer<typeof signUpResponseSchema>;

/**
 * Signing in from the game: the public Supabase values (the game talks to Supabase Auth itself, so the password
 * never reaches the API). `enabled: false` when the server has no accounts configured.
 */
export const authConfigResponseSchema = z.object({
  enabled: z.boolean(),
  url: z.string().nullable(),
  publishableKey: z.string().nullable(),
  /** The website (privacy, terms, deleting the account), so the game links to the real pages. */
  site: z.string().nullable().default(null),
});
export type AuthConfigResponse = z.infer<typeof authConfigResponseSchema>;

// ---------- managing the account and the buds (docs/konto.md) ----------

/** A bud can be renamed once in this many days (its name is public: no hiding behind a new one every hour). */
export const RENAME_DAYS = 7;

export const renameBudRequestSchema = z.object({ name: budNameSchema });
export type RenameBudRequest = z.infer<typeof renameBudRequestSchema>;

/**
 * Deleting a bud for good: the player types its name, so a stray tap never does it. Everything it has goes with it
 * (gear, coins, gems, progress, its district); purchases already made are not refunded by deleting.
 */
export const deleteBudRequestSchema = z.object({ confirm: z.string().min(1).max(40) });
export type DeleteBudRequest = z.infer<typeof deleteBudRequestSchema>;

/** Deleting the account: every bud on it and the sign-in itself. The words have to be typed. */
export const DELETE_ACCOUNT_WORDS = 'USUŃ KONTO';
export const deleteAccountRequestSchema = z.object({ confirm: z.literal(DELETE_ACCOUNT_WORDS) });
export type DeleteAccountRequest = z.infer<typeof deleteAccountRequestSchema>;

/** A typed name matches the bud's (case and spaces at the ends don't count). */
export const confirmsName = (typed: string, name: string) =>
  typed.trim().toLocaleLowerCase('pl') === name.trim().toLocaleLowerCase('pl');

/** How many devices were signed out. */
export const logoutAllResponseSchema = z.object({ signedOut: z.number().int().nonnegative() });
export type LogoutAllResponse = z.infer<typeof logoutAllResponseSchema>;

/**
 * Everything the game keeps about a bud, for the player to download (the GDPR's right of access and portability):
 * plain JSON, the same shapes the API answers with.
 */
export const budExportSchema = z.object({
  exportedAt: z.string(),
  bud: budRecordSchema,
  account: z.object({ email: z.string().nullable() }).nullable(),
  wallet: z.object({ coins: z.number().int(), gems: z.number().int() }),
  items: z.array(ownedItemSchema),
  equipment: equipmentSchema,
  skills: z.array(z.object({ id: z.string(), rank: z.number().int() })),
  training: z.array(z.object({ skill: z.string(), xp: z.number().int() })),
  quests: z.array(z.string()),
  caches: z.array(z.string()),
  consumables: z.array(z.object({ itemId: z.string(), qty: z.number().int() })),
  loadouts: z.record(z.string(), z.array(z.string().nullable())),
  moveRanks: z.record(z.string(), z.number().int()),
  crew: z.object({ tag: z.string(), name: z.string() }).nullable(),
  land: z.unknown().nullable(),
  explored: z.array(exploredMapSchema),
  devices: z.number().int(),
});
export type BudExport = z.infer<typeof budExportSchema>;

export const accountExportSchema = z.object({
  exportedAt: z.string(),
  email: z.string().nullable(),
  buds: z.array(budExportSchema),
});
export type AccountExport = z.infer<typeof accountExportSchema>;

/** Links a guest bud: the guest token proves the browser created it. */
export const claimBudRequestSchema = z.object({ token: z.string().min(16).max(200) });
export type ClaimBudRequest = z.infer<typeof claimBudRequestSchema>;
