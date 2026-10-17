import { defineConfig } from 'orval';

export default defineConfig({
  engine: {
    input: {
      target: '../mingldingl_engine/swagger.json',
      filters: { tags: ['Admin'] },
    },
    output: {
      target: 'src/lib/api/generated/engine.ts',
      schemas: 'src/lib/api/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      mode: 'split',
      clean: true,
      override: {
        mutator: { path: 'src/lib/api/client.ts', name: 'adminFetch' },
        fetch: { includeHttpResponseReturnType: false },
        query: { signal: true },
      },
    },
  },
  // The Guild House web page (/guild): sign-in by verify.mn and QPay invoices, with its own token.
  guild: {
    input: {
      target: '../mingldingl_engine/swagger.json',
      filters: { tags: ['Guild', 'Auth'] },
    },
    output: {
      target: 'src/guild/api/generated/guild.ts',
      schemas: 'src/guild/api/generated/model',
      client: 'fetch',
      httpClient: 'fetch',
      mode: 'split',
      clean: true,
      override: {
        mutator: { path: 'src/guild/api/client.ts', name: 'guildFetch' },
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
});
