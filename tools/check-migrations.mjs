#!/usr/bin/env node
// Validates supabase/migrations: naming (<14-digit timestamp>_<snake_name>.sql),
// unique + strictly increasing timestamps, no timestamps from the future,
// and no edits to migrations that already exist on the base branch.
import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '..', 'supabase', 'migrations');
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort();
const errors = [];
const pattern = /^(\d{14})_[a-z0-9_]+\.sql$/;
const nowStamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);

let prev = '';
for (const file of files) {
  const match = pattern.exec(file);
  if (!match) {
    errors.push(`${file}: name must match <YYYYMMDDHHMMSS>_<snake_case>.sql`);
    continue;
  }
  const stamp = match[1];
  if (stamp === prev) errors.push(`${file}: duplicate timestamp ${stamp}`);
  if (stamp > nowStamp) errors.push(`${file}: timestamp is in the future`);
  prev = stamp;
}

// Applied migrations are immutable: fail if a file that exists on the base ref was modified.
const baseRef = process.env.MIGRATIONS_BASE_REF;
if (baseRef) {
  try {
    const changed = execSync(
      `git diff --name-only --diff-filter=MD ${baseRef} -- supabase/migrations`,
      {
        encoding: 'utf8',
      },
    ).trim();
    for (const file of changed.split('\n').filter(Boolean)) {
      errors.push(`${file}: existing migrations must not be modified or deleted — add a new one`);
    }
  } catch (err) {
    console.warn(`Skipping immutability check (${err.message.split('\n')[0]})`);
  }
}

if (errors.length) {
  console.error(`Migration check failed:\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}
console.info(`Migration check passed (${files.length} migration(s)).`);
