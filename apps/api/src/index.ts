import type { Server } from 'node:http';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadEnv } from './env.js';
import { attachLive } from './live.js';
import { clientIpOfRequest } from './middleware/client-ip.js';
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

const server = serve({ fetch: app.fetch, port: env.PORT, hostname: '0.0.0.0' }, (info) => {
  console.info(`@buds/api listening on http://localhost:${info.port}`);
});

// live play on the same port: buds on the same map see each other (live.ts)
const live = attachLive(server as Server, store, {
  addressOf: (req) => clientIpOfRequest(req, env.CLIENT_IP_HEADER),
});

// Render stops the old instance with SIGTERM on every deploy: say goodbye to everyone, so the game reconnects
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.once(signal, () => {
    void live.close().finally(() => server.close(() => process.exit(0)));
    setTimeout(() => process.exit(0), 5000).unref();
  });
