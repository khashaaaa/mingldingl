# MingldIngl

A gamified dating app for the Mongolian market — a score-based economy, gemstone tier identity, and progressive profile reveal, built to replace disposable swipe-loop dating apps. Solo-developer project.

| Dir | Purpose | Stack |
|---|---|---|
| [`mingldingl_engine/`](mingldingl_engine) | Backend API — owns all business logic and data | ASP.NET Core on .NET 10, EF Core, PostgreSQL, SignalR, xUnit (own throwaway Postgres) |
| [`mingldingl_app/`](mingldingl_app) | Mobile app for daters (Android/iOS) | Expo SDK 57 / React Native 0.86, expo-router, TanStack Query, Reanimated, Skia, Jest, Maestro |
| [`mingldingl_control/`](mingldingl_control) | Internal admin panel | React 19 + Vite, TanStack Query, Playwright |

This is the initial version, built design-first; the design lives in the Figma file "MinglDingl — Visual System".

## Where to look

- **How to run, test and build anything** — [`CLAUDE.md`](CLAUDE.md). It is the single source of commands, ports, config files and architecture rules, kept current because it is what the coding agent reads too.
- **Domain model, product background and the live backlog** — [`docs/superpowers/project-plan.md`](docs/superpowers/project-plan.md).
- **Everything that has shipped** — [`docs/superpowers/shipped-log.md`](docs/superpowers/shipped-log.md).

## Quick start

```bash
./scripts/dev.sh          # engine :5150 (fake verify.mn), Metro :8081, admin :5173
                          # needs local Postgres + mingldingl_engine/.../appsettings.Development.json
./scripts/check-all.sh    # every test, typecheck, lint and build — the same set CI runs (engine tests need the Postgres server binaries)
```

The app runs only as a development build (`npx expo run:android`), not in Expo Go. The engine
reads `appsettings.Development.json` (copy its `.example`); the app reads `.env` (copy
`.env.example`); no real values are checked in. The API hooks in both frontends are generated from
the committed `mingldingl_engine/swagger.json`, never hand-written.

## License

See [`LICENSE`](LICENSE).
