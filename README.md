# MingldIngl

A gamified dating app for the Mongolian market — a score-based economy, gemstone tier identity, and progressive profile reveal, built to replace disposable swipe-loop dating apps. Solo-developer project.

## Repo layout

| Dir | Purpose | Stack |
|---|---|---|
| [`mingldingl_engine/`](mingldingl_engine) | Backend API — monolithic, owns all business logic and data | ASP.NET Core 8, EF Core, PostgreSQL (Npgsql), xUnit |
| [`mingldingl_app/`](mingldingl_app) | Mobile app (iOS/Android/web) for end users (daters) | React Native 0.81 + Expo ~54, expo-router, Tamagui, Zustand, TanStack Query, Jest |
| [`mingldingl_control/`](mingldingl_control) | Internal admin panel (users, moderation, business partners, config, analytics) | React 19 + Vite, React Router, TanStack Query, Tailwind 4, Radix UI, oxlint |

Both frontends talk to `mingldingl_engine` over REST and generate their TypeScript API types from the engine's live Swagger doc — there is no hand-maintained shared types package.

Full domain model, design background, and every feature's design docs + implementation plans live in [`docs/superpowers/project-plan.md`](docs/superpowers/project-plan.md).

## Getting started

The app and admin panel each have an `.env.example` — copy it to `.env` and fill in your own Supabase project / API URL. The engine reads `src/MinglDingl.Engine/appsettings.Development.json` for local dev (copy it from the `.example` next to it: Supabase project, Agora credentials, local Postgres connection string). `mingldingl_engine/.env.example` is the env file for `mingldingl_engine/docker-compose.yml`, not something the engine reads directly — `docker-compose.yml` + `Dockerfile` are the Production deploy path. None of the real values are checked in.

### Engine (`mingldingl_engine/`, port 5150)

```bash
./mingldingl_engine/scripts/start-engine.sh
# or manually:
cd mingldingl_engine && DOTNET_ROOT=$HOME/.dotnet ASPNETCORE_ENVIRONMENT=Development \
  $HOME/.dotnet/dotnet run --project src/MinglDingl.Engine --urls http://0.0.0.0:5150
```

Must bind `0.0.0.0`, not `localhost` — the mobile app expects to reach it over LAN for on-device testing.

```bash
dotnet build
dotnet test
```

Swagger UI (Development only): `/swagger`. Health check: `/health`.

### App (`mingldingl_app/`, Expo, port 8081 on web)

```bash
cd mingldingl_app
npx expo start --web --port 8081   # or --android / --ios
npm test
npm run typecheck                  # tsc --noEmit (plain `npx tsc` resolves to the wrong package here)
```

### Admin panel (`mingldingl_control/`, Vite, default port 5173)

```bash
cd mingldingl_control
npm run dev
npm run build
npm run lint
```

## Checks

```bash
./scripts/check-all.sh
```

Runs `dotnet test`, `tsc --noEmit`, `jest`, `oxlint`, and `vite build` across all three subprojects — the same checks CI runs. Enable it as a local pre-commit hook with:

```bash
git config core.hooksPath .githooks
```

CI (`.github/workflows/ci.yml`) mirrors this script as three parallel jobs, one per subproject; the engine job additionally runs `dotnet ef database update` against a service Postgres before testing, so migrations are exercised on every push.

## License

See [LICENSE](LICENSE). Source is visible for portfolio/reference purposes; it is not open source.
