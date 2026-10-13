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
  /** Look previews in the in-game creator (rendered on the server). */
  PREVIEW_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(40),
  /** Without both of these the API keeps buds in memory (local dev only). */
  SUPABASE_URL: optional.pipe(z.string().url().optional()),
  SUPABASE_SERVICE_ROLE_KEY: optional,
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
