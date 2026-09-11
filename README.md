# MingldIngl

A gamified dating app for the Mongolian market — a score-based economy, gemstone tier identity, and progressive profile reveal, built to replace disposable swipe-loop dating apps. Solo-developer project.

| Dir | Purpose | Stack |
|---|---|---|
| [`mingldingl_engine/`](mingldingl_engine) | Backend API — owns all business logic and data | ASP.NET Core 8, EF Core, PostgreSQL, xUnit |
| [`mingldingl_app/`](mingldingl_app) | Mobile app for daters (iOS/Android/web) | React Native 0.81 + Expo 54, expo-router, Zustand, TanStack Query, Jest |
| [`mingldingl_control/`](mingldingl_control) | Internal admin panel | React 19 + Vite, Tailwind 4, Radix UI |

## Where to look

- **How to run, test and build anything** — [`CLAUDE.md`](CLAUDE.md). It is the single source of commands, ports, config files and architecture rules, kept current because it is what the coding agent reads too.
- **Domain model, product background and the live backlog** — [`docs/superpowers/project-plan.md`](docs/superpowers/project-plan.md).
- **Everything that has shipped** — [`docs/superpowers/shipped-log.md`](docs/superpowers/shipped-log.md).

## Quick start

```bash
./mingldingl_engine/scripts/start-engine.sh     # engine on :5150 (needs local Postgres + appsettings.Development.json)
cd mingldingl_app && npx expo start             # app (device testing needs the EAS development build, not Expo Go)
cd mingldingl_control && npm run dev            # admin panel on :5173
./scripts/check-all.sh                          # every test, typecheck, lint and build — the same set CI runs
```

Each subproject has an `.env.example` or `appsettings.Development.json.example` to copy; no real values are checked in. API types in both frontends are generated from the committed `mingldingl_engine/swagger.json`, never hand-written.

## License

See [`LICENSE`](LICENSE).
