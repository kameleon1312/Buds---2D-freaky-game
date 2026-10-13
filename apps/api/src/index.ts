import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadEnv } from './env.js';
import { createMemoryStore } from './store/memory.js';
import { createSupabaseStore } from './store/supabase.js';

// local dev: load the repo-root .env (src/ and dist/ are both two levels below it); absent in prod
try {
  process.loadEnvFile(new URL('../../../.env', import.meta.url));
} catch {
  // no .env file — rely on the real environment
}

const env = loadEnv();

const store =
  env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    : createMemoryStore();

if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY not set — buds are kept in memory and lost on restart.');
}

const app = createApp(env, { store });

serve({ fetch: app.fetch, port: env.PORT, hostname: '0.0.0.0' }, (info) => {
  console.info(`@buds/api listening on http://localhost:${info.port}`);
});
