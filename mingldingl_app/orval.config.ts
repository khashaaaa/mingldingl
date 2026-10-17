import { defineConfig } from 'orval';

export default defineConfig({
  engine: {
    input: { target: '../mingldingl_engine/swagger.json' },
    output: {
      target: 'src/lib/api/generated/engine.ts',
      schemas: 'src/lib/api/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      mode: 'split',
      clean: true,
      override: {
        mutator: { path: 'src/lib/api/client.ts', name: 'apiFetch' },
        fetch: { includeHttpResponseReturnType: false },
        query: { signal: true },
      },
    },
  },
});
