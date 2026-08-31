# mingldingl_control

Internal admin panel for [MingldIngl](../README.md) — users and moderation,
business partners, live config tuning, content pages, Ships, Town Square, and
analytics.

React 19 + Vite, React Router, TanStack Query, Tailwind 4, Radix UI, oxlint.

## Running it

```bash
npm install
npm run dev        # vite dev server, http://localhost:5173
npm run build      # tsc -b && vite build
npm run lint       # oxlint
npm run preview
```

`VITE_API_URL` (in `.env`, defaults to `http://localhost:5150`) points at the
engine. Copy `.env.example` to `.env` first — nothing is checked in.

## API types are generated

```bash
npm run generate:api   # engine must be running on :5150
```

This regenerates `src/lib/api/api.generated.d.ts` from the engine's live Swagger
doc via `openapi-typescript`. Never hand-edit that file; regenerate it whenever
an engine DTO changes.

## Auth

The panel uses its own `AdminBearer` JWT scheme, entirely separate from the
Supabase JWTs app users get — a single hardcoded admin logs in via
`POST /admin/auth/login` and receives a self-signed 12h token with no refresh
flow. Admin endpoints on the engine opt into that scheme explicitly, so it can
never leak onto app-user endpoints. See `Controllers/AdminAuthController.cs` in
the engine.

There is no test script for this subproject.
