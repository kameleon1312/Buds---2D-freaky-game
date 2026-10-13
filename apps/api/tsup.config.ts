import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  clean: true,
  // shared is consumed as TS source, so bundle it into the API output
  noExternal: ['@buds/shared'],
});
