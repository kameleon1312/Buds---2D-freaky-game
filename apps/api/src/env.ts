import { z } from 'zod';

const optional = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  SUPABASE_JWT_SECRET: z.string().min(32, 'SUPABASE_JWT_SECRET must be at least 32 chars'),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
  CREATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(5),
  /** New accounts per client address per hour (POST /v1/auth/signup). */
  SIGNUP_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(10),
  /** Look previews in the in-game creator (rendered on the server). */
  PREVIEW_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(40),
  /** How long a newly bought district is safe from raids (hours); lower it only on a test server. */
  LAND_SHIELD_HOURS: z.coerce
    .number()
    .min(0)
    .max(24 * 14)
    .default(48),
  /** Without both of these the API keeps buds in memory (local dev only). */
  SUPABASE_URL: optional.pipe(z.string().url().optional()),
  SUPABASE_SERVICE_ROLE_KEY: optional,
  /**
   * The project's publishable (anon) key: public by design. The game reads it with the URL from
   * GET /v1/auth/config to sign players in with Supabase Auth directly (passwords never pass through this API).
   * Locally it falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY from the shared .env.
   */
  SUPABASE_PUBLISHABLE_KEY: optional,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optional,
  /**
   * The only request header trusted for the client IP in rate limits, lower-case (e.g. cf-connecting-ip on Render).
   * Unset: X-Real-IP / X-Forwarded-For as Railway's edge sets them.
   */
  CLIENT_IP_HEADER: optional.pipe(
    z
      .string()
      .regex(/^[a-z0-9-]+$/, 'CLIENT_IP_HEADER must be a lower-case header name')
      .optional(),
  ),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data;
}
