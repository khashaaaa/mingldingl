# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this is

MingldIngl is a gamified dating app for the Mongolian market — a score-based economy, gemstone tier identity, and progressive profile reveal, built to replace disposable swipe-loop dating apps. Solo-developer project.

The whole game is built (sign-in, Seek, bonds and letters, score and tiers, encounters, the
world, membership and payments, the Guild House web page, statistics). What is left is the launch
on the home server, which waits on the user's accounts and keys (the plan's "Launch checklist").

| Dir | Purpose | Stack |
|---|---|---|
| `mingldingl_engine/` | Backend API — owns all business logic and data | ASP.NET Core on .NET 10, EF Core + Npgsql, SignalR, xUnit (own throwaway Postgres) |
| `mingldingl_app/` | Mobile app for daters | Expo SDK 57 / React Native 0.86, expo-router, TanStack Query, Reanimated, Skia, Jest, Maestro |
| `mingldingl_control/` | Internal admin panel | React 19 + Vite, TanStack Query, Playwright |

Design source of truth is the Figma file "MinglDingl — Visual System"
(`nLwcONhTplnnOmXu3wroIx`; pages S1–S8 hold the app and admin screens, S9 the web page).
Two docs, never more: `docs/project-plan.md` (status, launch checklist, backlog, the game's rules
as built, principles, visual system, hard-won rules) and `docs/shipped-log.md` (one short entry
per finished piece of work, newest first). New work updates those two; a finished item leaves the
backlog and becomes a log entry.

---

## Architecture / cross-file facts

### Engine
- **Feature folders over a small kernel.** `Features/<Auth|Profile|Seek|Bonds|…>/` each
  hold endpoints (an `IEndpointModule`), service, DTOs and validation; `Kernel/` holds errors,
  clock, config, storage, rate limits, persistence, live outbox. A feature talks to another only
  through its service. **Every service is registered in `Registration.cs` (`AddEngine`)** — nowhere else.
- **One initial migration.** After a model change run `scripts/new-migration.sh`, which
  regenerates the single `Initial` migration (the spec allows no migration history yet).
  The engine applies migrations itself at boot, and every boot-time step (migrate, reference
  seeds, config load, backfills) lives in `Kernel/Persistence/DatabaseBootstrap.cs` — boot and the
  `seed` CLI both call it, so a new seed or backfill goes there. Ids are UUIDv7; times are UTC; "today" comes from
  `IClock` in Asia/Ulaanbaatar.
- **verify.mn is the only sign-in, and the engine issues its own sessions** (no Supabase Auth).
  verify.mn is Mobile-Originated: `POST /auth/phone/start` mints a code, the *person* texts it to
  144773 from the number they claim, the app polls `GET /auth/phone/status/{id}` (the one poll the
  app allows, only while Verify is on screen), then `POST /auth/phone/complete` returns a session
  pair. Hardening: a pending session is never handed to a caller who cannot name it
  (`ResumeVerificationId`), at most 5 live sessions per number with a sixth superseding the oldest
  (serialised by `pg_advisory_xact_lock`), and a superseded code already texted still verifies.
  Each text costs the user 150₮.
- **Sessions:** 15-minute signed access token + one refresh token per device, stored hashed and
  rotated on every use under a row lock. A duplicate refresh within 30 s gets the same new pair
  (a race never signs anyone out); a replay after that revokes the device. `sign-out` revokes the
  device, `sign-out-all` every device.
- **Three auth schemes, never interchangeable.** The Guild House web page (`/guild/*`) has its own
  half-hour token (`GuildAuth`, key derived from the app's, no refresh, reaches only `/guild`); it
  signs in an existing finished character by the same verify.mn proof and never creates accounts.
  App users: the engine's own tokens (`Auth:SigningKey`).
  Admin: a separate scheme and key (`Admin:JwtSigningKey`, 12 h, one admin from
  `Admin:Username`/`Admin:PasswordHash`, a PBKDF2 hash made with `dotnet run -- hash-password <pw>`).
  Neither is accepted where the other is expected, hubs included. Admin login is throttled
  (5 failures / 15 min → `429 admin.login_throttled`).
- **Everything is live; nothing polls.** SignalR hubs `/live` (one group per account, one per
  session) and `/admin/live`. Services write events to `ILiveOutbox` (`{ kind, ids }`, never the
  data), and they go out only **after the transaction commits** — a rolled-back write sends
  nothing. The app's `lib/live/events.ts` lists every kind; `session.revoked` goes to that
  device's own group only.
- **Business rules travel as `DomainException(status, code, message)`.** `ErrorMiddleware` turns
  it into `{ code, message }`; anything else is a logged 500. The app shows the localised
  `error.<code>` line (`tError`), so a new rule code needs an `en.json` entry.
- **Photos live in a private Supabase Storage bucket** (`Supabase:PhotoBucket`, made by
  `scripts/create-bucket.sh`); the engine hands out short-lived signed URLs. Upload re-encodes with
  SkiaSharp (metadata stripped) and computes a ThumbHash, which is what a viewer gets for a photo
  they may not see yet. 3–6 portraits (`photos.min`/`photos.max`); removing below the minimum is
  `409 photos.min`. Deleting a photo or a person deletes the files. The bucket `photos` is public
  and not this app's — leave it alone. Supabase's only other job is the desktop's 02:00 `mingldingl-devdb-backup.timer`
  (`scripts/backup-to-supabase.sh`, units in `scripts/systemd/`), which pushes the dev DB dump to its `backups` bucket;
  production backs up on the server.
- **Membership & payments (stage 6):** `Membership/` holds the floor (Yard / Hall / High Table) as
  grants; every feature asks `MembershipService` (`FloorAsync`, `Perks`), none reads payments.
  Store floors mirror RevenueCat — the webhook and the app's `/me/membership/sync` only prompt the
  engine to ask RevenueCat. QPay (web page only) is believed only from `payment/check`; the
  one-minute `PaymentSweep` checks open invoices, cancels cold ones and finds late money; anything
  paid that cannot be credited waits on the admin's Payments page to be refunded. In Development
  `QPay:Fake`/`RevenueCat:Fake` and `/dev/me/store`, `/dev/qpay/pay/{invoice}` walk it locally.
- **Statistics (stage 6c):** `Stats/` rolls each finished day into `stats_daily` (hourly
  `StatsSweep`); reads add today live. A new metric is one SQL source in `StatsService.Sources`.
- **Config is DB-backed and cached** (`Kernel/Config`): `ConfigKeys.All` defines each key with type
  and bounds; boot seeds missing keys and warms the cache; `ConfigWrites.SetAsync` validates,
  saves and fires `config.updated`. Reads go through the singleton `IConfig`. App-visible keys
  reach the app via `GET /app/status` (`app.minVersion`, `app.maintenance`, photo limits).
- **Rate limits on every write** (`writes` policy, per account per minute, a config key) and on
  auth (per IP) — both answer `429 rate_limited` ("wait a minute").
- **Validation** via `AddValidation` with limits from one place (field limits per DTO);
  attributes on record DTOs go on the constructor parameter.
- **Development-only surface**, 404 elsewhere: `/dev/*` (`me/state`, `me/live`, `config/{key}`,
  `run-sweep`), `VerifyMn:Fake` (every number verifies at once except **99000000**, which stays
  pending, and **99000001**, which expires — refused outside Development), and the `seed` CLI.
- **CORS:** `Cors:AllowedOrigins` is required outside Development (startup throws without it).
- **Sentry** runs only when `Sentry:Dsn` is set, with personal data scrubbed (`SentryScrub`).

### App
- **Layout:** `src/app/` holds thin route files only; screens live in `src/features/<feature>/`;
  `src/design/` holds generated tokens, art, glyphs, motion and the component library
  (`design/components`, one file per component); `src/lib/` holds session, live, i18n, feedback,
  the query client and the generated API.
- **One gate, no redirects.** `lib/gate.ts` `whereBelongs(session, me, app status)` → loading /
  out / closed (suspended, deleted, update, maintenance) / onboarding step N / world. The root
  layout renders exactly that group with `Stack.Protected`; no screen ever navigates between
  groups. Onboarding's step comes from the server profile, so a relaunch resumes in place.
  Links out of the app (store page, support mail) are in `lib/links.ts`; "Write to the keepers"
  is hidden until `EXPO_PUBLIC_SUPPORT_EMAIL` is set.
- **Session (`lib/session`):** access token in memory, refresh token in SecureStore. One
  single-flight refresh is shared by every request; a 401 waits for it and retries once. Only a
  revoked or reused token signs out, and `session.revoked` signs that device out at once.
- **Live (`lib/live`):** one SignalR connection while signed in, reconnecting forever. `events.ts`
  is the one table from event kind to the query keys it invalidates. After a reconnect or ≥30 s in
  the background the active queries refetch once; the connection stops after 5 min in background.
- **Query cache (`lib/query.ts`):** `staleTime` infinite (only a live event makes data stale), no
  refetch on focus/reconnect, 5-minute `gcTime`, nothing persisted. `refetchOnMount` stays **on**
  — an event that lands while no screen watches its query is otherwise lost.
- **API hooks are generated** by Orval from the checked-in `mingldingl_engine/swagger.json` in both
  frontends. After any endpoint/DTO change: `./mingldingl_engine/scripts/export-swagger.sh`, then
  `npm run generate:api` in both. check-all and CI fail if either is stale.
- **Design comes from Figma, never typed in.** `scripts/gen-tokens.js` writes `design/tokens.ts`
  (and the admin's `tokens.css`) from the Figma JSON in `design/figma/`; `scripts/export-art.py`
  exports art and glyph PNGs (token in `~/.figma-token`). A colour literal outside the tokens
  fails `scripts/check-literals.js`. Glyphs are tinted images, never live SVG.
- **The World Floor** is one Skia canvas behind every screen (gradient, stars, breathing glow,
  sparks on `useFrameCallback`), paused in background and under Reduce Motion. Screens are
  transparent over it.
- **Motion and feedback are tables:** `design/motion.ts` (the 17 Figma motions) and
  `lib/feedback` (each world event → haptic + sound; haptics always, sound opt-in and
  device-local). The WAVs come from `scripts/gen-sounds.js` — rerun it, don't edit `assets/sounds`.
- **Overlays:** Sheet and Dialog render into the in-window `OverlayHost`, not RN `Modal` (Modal's
  window stops above the Android nav bar); Back closes the top overlay.
- **Forms (`features/common/Scene.tsx`):** a focused field is scrolled whole into the space above
  the footer, and while the keyboard is up the footer drops its bottom inset. Onboarding fields
  that must survive stepping back use `useDraft`.
- **Mongolian:** every string is a key in `lib/i18n/en.json`, and every key has its line in
  `mn.json` — Codex writes the Mongolian (the user's call, 2026-10-16), in the same primal, epic
  game voice as the English, reusing the established words (Гал голомт, цайз, манаачид, хөрөг,
  домог, лац, Наймааны өргөө…). A new English key gets its Mongolian in the same change (a jest
  test fails on a missing or orphaned key). Never glue a case suffix onto `{{var}}` (Mongolian
  suffixes change with the word) — rephrase ("Хүлээж буй нь: {{name}}", "{{time}} цагт").
  Interpolation is `{{var}}`. The engine's Mongolian (question banks, pushes, Codex) is in
  `QuestionsMn`, `PushCopy` and `CodexSeed`. Pirata One has no Cyrillic, so in Mongolian room
  titles use Yeseva One. The language switch remounts leaf
  screens (`LocaleScreens.tsx`). verify.mn's own Mongolian instruction is shown verbatim.
- **Developer tools** exist only behind `__DEV__` (`lib/devTools.ts`): the Tools screen (`/dev`,
  from the Expo dev menu) puts your account into any state, fires live/world events, switches
  language and Reduce Motion; `/dev/gallery` shows every component. A release bundle has none of it.
- **Expo Go cannot run this app** (Skia, Sentry, dev-client). Use the development build
  (`npx expo run:android`, or `eas build --profile development`). `mingldingl_app/AGENTS.md` →
  `AGENTS.md` names the SDK and its docs; bump it with `package.json`.
- **`patches/` (patch-package, `postinstall`)** backports react-native-screens 4.28's
  screen-removal-listener fix onto the 4.26.2 Expo SDK 57 pins: without it a launch could SIGSEGV
  in `MountingCoordinator::pullTransaction` (≈1 in 5 relaunches on the emulator). It is native
  code, so it needs a rebuild of the development build. Drop it when Expo pins ≥ 4.28.0.
- **`EXPO_PUBLIC_API_URL`** is pinned to the LAN IP only for the `development` EAS profile;
  preview/production must set it on EAS before their first build (it falls back to localhost).

### Admin
- The build has two pages: the panel (`index.html`) and the Guild House web page (`guild/index.html`,
  `src/guild/`, its own Orval client from the Guild + Auth tags) — the page bundles none of the panel.
- Same shape: `src/features/<users|payments|stats|…>/`, generated Orval hooks, tokens from the
  app's generator (`src/design/tokens.css`), live via `/admin/live` (a sign-up appears in Users
  without a reload). Art is synced from the app with `npm run sync:art`.

---

## Commands

### Everything
```bash
./scripts/dev.sh                 # Postgres check, engine (dotnet watch, :5150, fake verify.mn), Metro (:8081), admin (:5173)
./scripts/dev.sh --real-sms      # the real verify.mn (each text costs the user 150₮)
./scripts/check-all.sh           # engine tests + swagger freshness, app typecheck/Biome/jest/literals/Orval, admin Biome/build/Orval/Playwright
./scripts/check-all.sh --fast    # app typecheck + both Biome checks
CHECK_SKIP_ENGINE=1 / CHECK_SKIP_E2E=1   # without Postgres server binaries / without local Postgres
```
CI (`.github/workflows/ci.yml`) runs the same steps as three jobs.

### Engine (`mingldingl_engine/`, .NET 10 SDK in `~/.dotnet`)
```bash
export DOTNET_ROOT=$HOME/.dotnet PATH=$HOME/.dotnet:$PATH
dotnet test                                        # initdb's its own throwaway Postgres (temp dir, own port); never the dev DB
dotnet test --filter FullyQualifiedName~ProfileTests
./scripts/export-swagger.sh [--check]              # rewrite swagger.json (no server, no DB)
./scripts/new-migration.sh                         # regenerate the single Initial migration
dotnet run --project src/MinglDingl.Engine -- seed <Step1..Step6|Finished|Suspended|Deleted> --phone 99xxxxxx
dotnet run --project src/MinglDingl.Engine -- seed crowd       # the 48-person seed crowd (99100000–99100047)
dotnet run --project src/MinglDingl.Engine -- hash-password <pw>
```
Local config: `src/MinglDingl.Engine/appsettings.Development.json` (copy the `.example`).
Production deploy (the home server, `ssh server`) uses **no Docker**: `./scripts/deploy.sh` publishes
the engine self-contained (linux-x64, ReadyToRun) and builds the web pages here, rsyncs them to
`/opt/mingldingl/{engine,web}` and restarts the `mingldingl-engine` systemd unit (127.0.0.1:8080).
nginx serves the web pages on 127.0.0.1:8081; the database is the server's own Postgres 18
(`mingldingl` role over the socket, peer auth); backups are `mingldingl-backup.timer` (03:00, 14 kept,
`/var/lib/mingldingl/backups`). Everything server-side is in `scripts/server/` and installed by
`./scripts/deploy.sh --setup` (`--tunnel` adds cloudflared); secrets live only in the server's
`/etc/mingldingl/engine.env`. `./scripts/restore-check.sh` proves the newest backup restores.
`dotnet watch` does not always pick up a changed class or a new endpoint — if a change seems
missing, restart the engine.

### App (`mingldingl_app/`)
```bash
npm run typecheck   # tsc --noEmit
npm run lint        # Biome
npm test            # jest --forceExit (plain `npx jest` hangs on exit; pass --forceExit)
npm run generate:api / generate:tokens
npx expo run:android                                # local dev build onto a device or the emulator (AVD mingl_pixel)
```
Maestro flows (`.maestro/`, need `scripts/dev.sh`): `signup.yaml`, `resume.yaml`,
`resume-every-step.yaml`, `keyboard-clear.yaml`; `two-devices.sh <A> <B>` runs live-edit and
revoke; `device-pass.sh <device>` screenshots the foundation screens (sign-in, onboarding, Character, Edit) in EN and MN beside its Figma
frame. Once per device: `push-seed-photos.sh <device>` (portrait pickers use that album, never a
personal gallery). Never use Maestro's `hideKeyboard` — on Android it presses Back and can leave
the app; use `_keys-away.yaml`.

### Admin (`mingldingl_control/`)
```bash
npm run dev | build | lint | typecheck | generate:api | e2e    # e2e = Playwright with its own engine, admin and database (mingldingl_e2e, fresh each run)
```

---

## Verification

`.Codex/skills/verify/SKILL.md` describes driving the stack end to end. Android device setup
(A51 + emulator over adb, screenshot scale) is in Codex's project memory
(`~/.Codex/projects/-home-khashaa-Desktop-mingldingl/memory/`), not here.
