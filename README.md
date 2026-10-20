# MingldIngl

A gamified dating app for the Mongolian market — a score-based economy, gemstone tier identity and
progressive profile reveal, built to replace disposable swipe-loop dating apps. Solo-developer
project. The whole game is built; the Android launch is next.

| Dir | Purpose | Stack |
|---|---|---|
| [`mingldingl_engine/`](mingldingl_engine) | Backend API — owns all business logic and data | ASP.NET Core on .NET 10, EF Core, PostgreSQL, SignalR, xUnit |
| [`mingldingl_app/`](mingldingl_app) | Mobile app for daters (Android first) | Expo SDK 57 / React Native 0.86, expo-router, TanStack Query, Reanimated, Skia, Jest, Maestro |
| [`mingldingl_control/`](mingldingl_control) | Admin panel and the Guild House web page | React 19 + Vite, TanStack Query, Playwright |

The design lives in the Figma file "MinglDingl — Visual System"; code never invents a colour, size
or component.

## Where to look

- [`CLAUDE.md`](CLAUDE.md) — architecture, commands, ports and config files (the coding agent reads it too).
- [`docs/project-plan.md`](docs/project-plan.md) — status, launch checklist, backlog, and how the game works.
- [`docs/shipped-log.md`](docs/shipped-log.md) — what was built, newest first.

## Quick start

```bash
./scripts/dev.sh          # engine :5150 (fake verify.mn), Metro :8081, admin :5173 — needs local Postgres
./scripts/check-all.sh    # every test, typecheck, lint and build — the same set CI runs
```

Copy the examples before the first run: `mingldingl_engine/src/MinglDingl.Engine/appsettings.Development.example.json`
→ `appsettings.Development.json`, and `.env.example` → `.env` in the app and the admin. No real
values are checked in. The app runs only as a development build (`npx expo run:android`), not in
Expo Go. The API hooks in both frontends are generated from the committed
`mingldingl_engine/swagger.json`, never hand-written.

## License

See [`LICENSE`](LICENSE).
