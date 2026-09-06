# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

MingldIngl is a gamified dating app for the Mongolian market — a score-based economy, gemstone tier identity, and progressive profile reveal, built to replace disposable swipe-loop dating apps. Solo-developer project.

| Dir | Purpose | Stack |
|---|---|---|
| `mingldingl_engine/` | Backend API — monolithic, owns all business logic and data | ASP.NET Core 8, EF Core, PostgreSQL (Npgsql), xUnit |
| `mingldingl_app/` | Mobile app (iOS/Android/web) for end users (daters) | React Native 0.81 + Expo ~54, expo-router, Zustand, TanStack Query, Jest |
| `mingldingl_control/` | Internal admin panel (users, moderation, business partners, config, analytics) | React 19 + Vite, React Router, TanStack Query, Tailwind 4, Radix UI, oxlint |

Both frontends talk to `mingldingl_engine` over REST (axios, default `http://localhost:5150`) and generate their TypeScript API types from the engine's live Swagger doc — there is no hand-maintained shared types package.

Design/product background, the full domain model, and live implementation plans are in `docs/superpowers/project-plan.md` (see its "Domain Model & Product Background" section for the domain model); its "Outstanding Follow-ups" section is the live backlog — deferred product decisions, known gaps, and the manual verification passes still owed. Shipped features are archived beside it in `docs/superpowers/shipped-log.md`, pruned to outcome summaries — check there before assuming a feature (e.g. membership billing cycles, admin config foundation, Recruit an Ally, Fated Threads, Town Square, The Oath, The Flame Rite, no-show tracking) doesn't exist yet. New feature work gets appended to these two files, not spun into new ones; when something ships, its record moves from the plan to the log.

---

## Architecture / cross-file facts

- **Phone ownership is proven by the engine via verify.mn, never by the client.** verify.mn is a Mongolia-only **Mobile-Originated** SMS API: the engine mints a 6-digit code and opens a session (`POST https://api.verify.mn/sessions`), the *user* texts that code to shortcode **144773** from the number being claimed, and the engine polls `GET /sessions/{id}` for `VERIFIED`. There is no outbound SMS and no code to type in — the app shows verify.mn's Mongolian `displayInstruction` verbatim plus a one-tap `sms:` URI. Flow: `POST /auth/phone/start` → poll `GET /auth/phone/status/{id}` → Supabase anonymous sign-up → `POST /auth/phone/claim` binds the proven number to that identity (single use). `POST /users` **refuses to create a new account** without a claimed verification, and takes `PhoneNumber` from it — the JWT's phone claim is client-set and is never trusted. `PUT /users/me/phone` requires the same proof. Key lives in `VerifyMn:ApiKey` (gitignored `appsettings.Development.json`; `VERIFY_MN_API_KEY` for docker) — if it is unset, `IsConfigured` is false and enforcement is inert, which is how the pre-existing tests still pass. `VerifyMn:CallbackBaseUrl` is optional and must only be set to a public origin this engine actually serves: verify.mn retries failed callbacks, and the callback is a wake-up ping with no body or signature, so status is always re-read from the provider. Each SMS costs the *user* 150₮, so the app passes back the `verificationId` a number was last given (`ResumeVerificationId`) and `StartAsync` resumes that session — but a pending session is **never handed to a caller who cannot name it**: `start` is anonymous, and returning "the session for this number" to anyone leaked the owner's id and code to an attacker who then raced the single-use claim. One number holds at most 5 pending sessions (`429 phone.too_many_attempts`). **Returning users alias, not re-register:** every sign-in mints a fresh anonymous Supabase `sub`, so `CurrentUserMiddleware` maps a `sub` with no `Users` row onto the account whose `PhoneNumber` that `sub` has *claimed a verification for* (`PhoneVerificationService.ResolveAliasAsync`), and `ClaimAsync` allows an account-less identity to prove a number that already has an account (that is sign-in) while an existing account still cannot take another's number. The JWT's `user_metadata.phone` is consulted only when verify.mn is unconfigured (dev/test) — it is client-writable and once let anyone become any user. See `Services/VerifyMnClient.cs`, `Services/PhoneVerificationService.cs`, `Controllers/AuthController.cs`, `Middleware/CurrentUserMiddleware.cs`.
- **Two separate JWT schemes on the engine, never interchangeable.** Regular app users authenticate with Supabase-issued asymmetric JWTs (`Bearer` scheme, validated via JWKS against `Supabase:ProjectUrl`, `ValidateIssuer/Audience = false`). `mingldingl_control` uses a completely separate `AdminBearer` scheme: a single hardcoded admin (`Admin:Username` / `Admin:PasswordHash` in appsettings) logs in via `POST /admin/auth/login` and gets a self-signed, symmetric-key JWT (`Admin:JwtSigningKey`, 12h expiry, no refresh flow). Admin controllers opt in explicitly with `[Authorize(AuthenticationSchemes = "AdminBearer")]`; this scheme is never the default so it can't leak onto app-user endpoints. See `mingldingl_engine/src/MinglDingl.Engine/Controllers/AdminAuthController.cs` and `Program.cs`.
- **Primary datastore is local Postgres, not Supabase**, despite Supabase being visible everywhere in config. Outbound port 5432 to Supabase is blocked on the dev network, so the engine runs against `127.0.0.1:5432/mingldingl`. Supabase is only used for (a) Auth — phone/OTP → JWT — and (b) a nightly `pg_dump` backup to Supabase Storage (`mingldingl_engine/scripts/backup-to-supabase.sh`). Photo uploads are also local disk (`LocalFileStorageService`), served by the engine at `/uploads`, not Supabase Storage.
- **Realtime chat/nudges use Supabase's Broadcast API, not `postgres_changes`.** `postgres_changes` only observes Supabase's own hosted Postgres, so it silently stopped working once data moved to local Postgres. The engine (`SupabaseBroadcastService`) explicitly pushes an event after each relevant write (new message, icebreaker/quiz response, date confirmed); the app is already subscribed via `.on('broadcast', ...)`. If a live-update feature seems to "just not fire," check the engine log for the broadcast POST before suspecting the client.
- **Business rules travel as `DomainException`, never framework types.** `ExceptionHandlingMiddleware` maps it to its `StatusCode` with the message verbatim (and logs at Information — a broken rule is not a fault); everything else becomes a logged 500 with a generic body. Services must not signal rules with `InvalidOperationException`/`ArgumentException`, because EF and the BCL produce those too and a controller cannot tell them apart. Controllers therefore need no try/catch for rules; the only ones left are narrow `when`-filtered `DbUpdateException` guards for unique-constraint races.
- **`Cors:AllowedOrigins` is required outside Development** — `Program.cs` throws at startup rather than falling back to reflecting any origin. In Development an empty list stays permissive but does *not* send `Allow-Credentials`. `CorsOrigins.Parse` accepts the indexed-array form or one comma-separated string (`Cors__AllowedOrigins=a,b` is what docker-compose passes).
- **Push notifications are localised per recipient, never free text.** `PushNotificationService.NotifyUserAsync` takes a `PushKind`; `Services/PushCopy.cs` holds every kind's EN + MN title/body and its wire `type` (which `hooks/usePushNotifications.ts` routes on). The language is `User.PreferredLocale`, set at `POST /users` and kept in step by the app's `useSyncPreferredLocale`. Adding a push means adding a kind and both translations, not a string at the call site. `NotifyUserAsync` only resolves the recipient (opt-in, tokens, locale) and hands a `PushEnvelope` to `IPushDispatcher`; the Expo POST runs in `PushDispatchBackgroundService` (singleton + hosted, `Channel`-backed) off the request path, and a `DeviceNotRegistered` ticket deletes that token. Tests get the same code path inline via `IntegrationTestBase.BuildTestPush`/`BuildCapturingPush`, so `NotifyUserAsync` is still awaitable end to end there.
- **Screens no longer paint their own background — the world layer does.** `components/world/`
  mounts once in `app/_layout.tsx`: `WorldFloor` behind the navigator, `WorldCanopy` above it.
  Which "room" a screen is in, and therefore its light, floor texture, vfx, travel direction and
  atlas position, all come from one table (`lib/world/rooms.ts`, resolved off `useSegments()`);
  `lib/world/light.ts` holds the six light signatures and the pure `(WorldState) => number | null`
  ramps. Consequences: a screen container must be `backgroundColor: 'transparent'` (an opaque one
  hides the floor), the navigation theme's `background`/`card` are transparent for the same reason
  (`HOLD_THEME` — React Navigation's default #F2F2F2 otherwise renders the whole app white), a new
  route must appear in a room's `match` list or in `UNLIT` (the route-coverage test in
  `lib/world/__tests__/world.test.ts` fails otherwise), and `useWorldState` reads the query cache
  without ever fetching. `WORLD_ENABLED` in `lib/world/index.ts` is a build-time kill switch.
- **World feedback is a table, never a call-site literal**, exactly like `PushCopy`:
  `lib/world/feedback.ts` maps six `WorldEvent`s to a haptic and a sound. Haptics always fire;
  sound is opt-in (Settings → Sound, device-local), loads nothing until enabled, and never plays
  over the silent switch. The WAVs are generated by `scripts/gen-sounds.js`, not committed by hand
  — rerun it rather than editing `assets/sounds/`.
- **Request field lengths are capped centrally** in `DTOs/FieldLimits.cs`. Validation attributes on record DTOs go on the **constructor parameter**, never `[property: ...]` — ASP.NET throws at model-binding time for the latter.
- **Deleting a user deletes their files.** `/uploads` is public and unauthenticated, so `DailyMaintenanceBackgroundService` calls `LocalFileStorageService.DeleteByPublicUrl` during anonymisation and purges their `PhoneVerifications` rows; `PUT /users/me` deletes photos dropped from the list. Clearing the DB column alone is not deletion.
- **Config is DB-backed and cached, not appsettings-only.** `ConfigKeys.All` defines default admin-tunable config; on startup `Program.cs` calls `AdminConfigSeeder.SeedAsync` (`Services/AdminConfigSeeder.cs`), which inserts any missing keys into `AdminConfigs` and re-syncs each key's Category/Description/ValueType every boot, then `ConfigService.LoadCacheAsync` warms an in-memory cache. `mingldingl_control`'s Config page and the engine's `AdminConfigController`/`ConfigService` are the live-tuning path — don't assume a behavior threshold is hardcoded without checking here first. As of 2026-09-04 this covers every score delta, all tier thresholds, daily match budgets, membership prices/discounts, quest XP/targets, ghosting/no-show/deletion timings, Town Square sizing, and kill switches (`ships.enabled`, `townsquare.enabled`, `video.enabled`, `campaign.enabled`). Each `ConfigKeyDefinition` carries optional `Min`/`Max` bounds enforced on write, tier thresholds must stay strictly increasing (`ScoreService.ValidateTierThreshold`), and `video.enabled=false` also lifts the Flame Rite pledge gate (`ConfigService.FlameRiteRequired`) so matches cannot deadlock. Progressive profile reveal is tunable too (`reveal.levelN.messages`, `RevealService`), and its four thresholds must stay strictly increasing the same way tier thresholds do; the app reads the effective ladder from `GET /engagement/reveal-thresholds` (`lib/reveal.ts`) rather than pinning its own, and the activity-suggestion gate is `activity.suggestions.messages`. Left hardcoded on purpose: login throttle, password hashing, phone-verification windows, upload/compression limits, page sizes, sweep intervals.
- **Engine services are all explicitly registered** in `mingldingl_engine/src/MinglDingl.Engine/ServiceCollectionExtensions.cs` (`AddApplicationServices`) — new services need to be added there, not just `AddScoped`'d ad hoc in `Program.cs`.
- **`DailyMaintenanceBackgroundService`** (ghosting, daily reset, deletion-anonymization, membership expiry, Ship expiry) is registered as both a singleton and a hosted service so `DevController` can trigger it on demand — `POST /dev/run-maintenance-sweep` (Development-only, 404 elsewhere) runs the sweep immediately instead of waiting up to an hour. `TownSquareSchedulerBackgroundService` (10s sweep that locks rosters, starts sessions, advances rounds) uses the same singleton + hosted registration.
- **Video calls** go through Agora (`react-native-agora` in the app; `Agora:AppId`/`Agora:AppCertificate` + `VideoTokenService` in the engine, which mints Agora tokens — see `VideoController`).
- **API types are generated, not hand-written**, in both frontends via `openapi-typescript` hitting the engine's live Swagger JSON (`generate:api` script in both `mingldingl_app/package.json` and `mingldingl_control/package.json` → `lib/api/api.generated.d.ts` / `src/lib/api/api.generated.d.ts`). The engine must be running on :5150 for this to work.
- **`mingldingl_app/CLAUDE.md` just points to `mingldingl_app/AGENTS.md`** (read it before writing Expo code). `package.json` pins `expo: ~54.0.0` while AGENTS.md points at the v56 docs — treat the AGENTS.md version note as the operative instruction, not the lockfile.
- **`expo-secure-store` has no web implementation** (empty module) — sessions never persist across page loads when running the app in a browser; this is expected, not a bug to fix.

---

## Commands

### Everything at once
```bash
./scripts/check-all.sh            # engine tests + app typecheck/jest + control lint/build; first failure exits
./scripts/check-all.sh --fast     # sub-minute subset (app typecheck, control lint + typecheck)
CHECK_SKIP_ENGINE=1 ./scripts/check-all.sh   # when local Postgres isn't up (integration tests need it)
git config core.hooksPath .githooks           # once, to run --fast as a pre-commit gate
```
`.github/workflows/ci.yml` mirrors the full script as three parallel jobs, one per subproject, so
"passes locally" and "passes in CI" mean the same thing. The per-project commands below are what it
runs.

### Engine (`mingldingl_engine/`, port 5150)
```bash
./mingldingl_engine/scripts/start-engine.sh          # frees port 5150 if stale, runs in foreground (binds 0.0.0.0)
# manual equivalent:
cd mingldingl_engine && DOTNET_ROOT=$HOME/.dotnet ASPNETCORE_ENVIRONMENT=Development \
  $HOME/.dotnet/dotnet run --project src/MinglDingl.Engine --urls http://0.0.0.0:5150

dotnet build                                          # build
dotnet test                                           # run all tests (xUnit)
dotnet test --filter FullyQualifiedName~LootServiceTests   # single test class
dotnet test --filter ComputeStreak                    # by test name substring

dotnet ef migrations add <Name> --project src/MinglDingl.Engine   # needs DOTNET_ROOT + $HOME/.dotnet/tools on PATH,
dotnet ef database update --project src/MinglDingl.Engine         # and dotnet-ef pinned to 8.0.x (a default install grabs 10.x, which fails: "Failed to resolve libhostfxr.so" against this net8.0 project)
```
Health check: `GET /health`. Swagger UI only in Development: `/swagger`.
Local dev config is `src/MinglDingl.Engine/appsettings.Development.json` (copy from its `.example`). `mingldingl_engine/.env.example` is **not** read by the engine — it is the env file for `mingldingl_engine/docker-compose.yml`, which (with the `Dockerfile`) is the Production deploy path (`ASPNETCORE_ENVIRONMENT=Production`).
**Must bind `0.0.0.0`, not `localhost`** — `mingldingl_app/.env` bakes a LAN IP into `EXPO_PUBLIC_API_URL` for on-device testing, and inline env overrides don't take (the `.env` file wins).

### App (`mingldingl_app/`, Expo, port 8081 on web)
```bash
cd mingldingl_app
npx expo start [--web --port 8081 | --android | --ios]
npm test                       # jest --forceExit
npm run typecheck              # tsc --noEmit — use this, not plain `npx tsc`, which resolves to the wrong npm package in this repo
npm run generate:api           # regenerate lib/api/api.generated.d.ts from the running engine's swagger.json
```
No lint script defined in `package.json`.

### Admin panel (`mingldingl_control/`, Vite, default port 5173)
```bash
cd mingldingl_control
npm run dev                    # vite dev server
npm run build                  # tsc -b && vite build
npm run lint                   # oxlint
npm run preview
npm run generate:api           # regenerate src/lib/api/api.generated.d.ts from the running engine's swagger.json
```
No test script defined. `VITE_API_URL` (`.env`, defaults to `http://localhost:5150`) points at the engine.

---

## Verification

A project skill, `verify` (`.claude/skills/verify/SKILL.md`), documents how to drive the whole stack end-to-end (creating real Supabase test users/JWTs without SMS, Playwright against the Expo web build with a stubbed anonymous-signin login trick, direct local-Postgres inspection, and a long list of confirmed UI-copy/selector gotchas). Load it before attempting manual or automated end-to-end verification.
