# CLAUDE.md

MingldIngl is a gamified dating app for the Mongolian market (score economy, gemstone tiers,
progressive profile reveal). Solo-developer project. The whole game is built and runs on the home
server; what is left is the Play launch, which waits on the user (plan's "Launch checklist").

| Dir | Purpose | Stack |
|---|---|---|
| `mingldingl_engine/` | Backend API — owns all business logic and data | ASP.NET Core .NET 10, EF Core + Npgsql, SignalR, xUnit |
| `mingldingl_app/` | Mobile app for daters | Expo SDK 57 / RN 0.86, expo-router, TanStack Query, Reanimated, Skia, Jest, Maestro |
| `mingldingl_control/` | Admin panel + Guild House web page + legal pages | React 19 + Vite, TanStack Query, Playwright |

Design source of truth: Figma "MinglDingl — Visual System" (`nLwcONhTplnnOmXu3wroIx`; S1–S8 app
and admin, S9 web page). **Two docs, never more:** `docs/project-plan.md` (status, launch checklist,
backlog, game rules as built, principles, visual system, hard-won rules, and **"How the code fits
together" — the full architecture notes; read the matching part before changing an area**) and
`docs/shipped-log.md` (one short entry per finished piece, newest first). A finished item leaves
the backlog and becomes a log entry.

## Workflow

- Verify: `scripts/check.sh [--fast]` (wraps `scripts/check-all.sh`, the same steps as CI).
- See it: `scripts/dev.sh`, then the `verify` skill (`.claude/skills/verify/`) drives app, admin and
  devices end to end; Android device setup is in Claude's project memory.
- Ship: Commands below ("Production", OTA vs store build) and project-plan.md "Production deploy".

## Claude and Codex share this tree

Both work here with full permission (Codex: `.codex/config.toml`). `AGENTS.md` is a symlink to
this file, for Codex. Build on the
other's uncommitted work; never revert or reformat it unasked. Read `.remember/now.md` first.
Neither commits until the user says "push", then commits and pushes at once.

## Rules that span files (full detail: project-plan.md, "How the code fits together")

**Engine**
- Feature folders (`Features/<X>/`: endpoints, service, DTOs, validation) over `Kernel/`. A feature
  talks to another only through its service. **Every service is registered in `Registration.cs`
  (`AddEngine`)**, nowhere else.
- **One initial migration, and it keeps its id**: after a model change run
  `scripts/new-migration.sh`; a new column also goes into `DatabaseBootstrap` as `ADD COLUMN IF NOT
  EXISTS`. Every boot-time step (migrate, seeds, config, backfills) lives in
  `Kernel/Persistence/DatabaseBootstrap.cs`. Ids UUIDv7; times UTC; "today" from `IClock` in Asia/Ulaanbaatar.
- **Sign-in is only a WeSend texted code**; the engine never sees the code and issues its own
  sessions (15-min access token + rotated, hashed per-device refresh token). Each text costs 80₮.
- **Three auth schemes never mix** (app `Auth:SigningKey`, admin `Admin:JwtSigningKey`, Guild
  House `GuildAuth`), hubs included.
- **Everything is live; nothing polls.** Services write `{ kind, ids }` to `ILiveOutbox`, sent only
  **after commit**. Every kind is listed in the app's `lib/live/events.ts`.
- **Business rules are `DomainException(status, code, message)`**; a new code needs an `en.json`
  (and `mn.json`) `error.<code>` line.
- Photos: private Supabase bucket (`Supabase:PhotoBucket`), signed URLs, re-encoded, ThumbHash.
  **The bucket `photos` is not this app's — leave it alone.** Deleting a person deletes their files.
- Membership: every feature asks `MembershipService`, none reads payments. QPay is believed only
  from `payment/check`, which **must not be polled**.
- Config is DB-backed (`ConfigKeys.All`, bounds, `ConfigWrites.SetAsync`); every tunable number is
  config. Rate limits on every write. `/dev/*`, `WeSend:Fake` (code **000000**) and the `seed` CLI
  exist only in Development. `Cors:AllowedOrigins` required outside Development.

**App**
- `src/app/` thin route files only; screens in `src/features/<feature>/`; design system in
  `src/design/`; session, live, i18n, feedback, query, API in `src/lib/`.
- **One gate, no redirects**: `lib/gate.ts` `whereBelongs` picks the group; no screen navigates
  between groups.
- Query cache: `staleTime` infinite (only a live event stales data); `refetchOnMount` stays **on**.
- **API hooks are generated** (Orval from `mingldingl_engine/swagger.json`). After any endpoint/DTO
  change: `./mingldingl_engine/scripts/export-swagger.sh`, then `npm run generate:api` in both
  frontends. check-all and CI fail if stale.
- **Design comes from Figma, never typed in**: `scripts/gen-tokens.js`, `scripts/export-art.py`;
  a colour literal outside the tokens fails `scripts/check-literals.js`. Sounds come from
  `scripts/gen-sounds.js` — don't edit `assets/sounds`.
- Overlays render into `OverlayHost`, never RN `Modal`.
- **Mongolian**: every string is a key in `lib/i18n/en.json` with its line in `mn.json` in the same
  change; Claude writes the Mongolian in the game's voice. **Before writing any, read the glossary
  in project-plan.md ("How the code fits together" → App → Mongolian)** — fixed terms, never-use
  words, чи not та. Never glue a case suffix onto `{{var}}`; rephrase.
- Dev tools only behind `__DEV__`. **Expo Go cannot run this app**: use the development build.
- **Expo SDK 57 / RN 0.86.3 — don't trust remembered Expo APIs**: check
  https://docs.expo.dev/versions/v57.0.0/ (index: https://docs.expo.dev/llms.txt) before touching an
  Expo/EAS/RN API; bump this line with `package.json`. Add packages with `npx expo install`.
  `android/`/`ios/` are generated (CNG, git-ignored): native behaviour goes in `app.json` and `plugins/`.
- `patches/` (react-native-screens fix, native: needs a rebuild; drop at ≥ 4.28.0) and
  `plugins/withLeanAndroid.js` (strips Agora extensions; a new Agora feature must come off its list).
- `EXPO_PUBLIC_API_URL` is pinned only for the `development` EAS profile.

**Admin**: same shape as the app (`src/features/`, Orval hooks, tokens from the app's generator,
live via `/admin/live`); `src/guild/` is the Guild House page with its own client and words.

## Commands

```bash
./scripts/dev.sh                 # Postgres check, engine (:5150, fake WeSend: code 000000), Metro (:8081), admin (:5173)
./scripts/dev.sh --real-sms      # real WeSend key (live: 80₮ a text)
./scripts/check.sh [--fast]      # everything CI runs (.github/workflows/ci.yml); --fast = typecheck + Biome
CHECK_SKIP_ENGINE=1 / CHECK_SKIP_E2E=1
```

Engine (`mingldingl_engine/`, SDK in `~/.dotnet`):
```bash
export DOTNET_ROOT=$HOME/.dotnet PATH=$HOME/.dotnet:$PATH
dotnet test [--filter FullyQualifiedName~ProfileTests]   # own throwaway Postgres; never the dev DB
./scripts/export-swagger.sh [--check] ; ./scripts/new-migration.sh
dotnet run --project src/MinglDingl.Engine -- seed <Step1..Step6|Finished|Suspended|Deleted> --phone 99xxxxxx
dotnet run --project src/MinglDingl.Engine -- seed crowd [--phone 99xxxxxx]   # 48-person crowd
dotnet run --project src/MinglDingl.Engine -- hash-password <pw>
```
Local config: `src/MinglDingl.Engine/appsettings.Development.json` (copy the `.example`). If
`dotnet watch` misses a change, restart the engine. **Production** = home server (`ssh server`), no
Docker: `./scripts/deploy.sh` (`--setup`, `--tunnel`); secrets only in the server's
`/etc/mingldingl/engine.env`; `./scripts/restore-check.sh` proves the newest backup restores.
Details: project-plan.md "Production deploy".

App (`mingldingl_app/`):
```bash
npm run typecheck | lint | generate:api | generate:tokens
npm test            # jest --forceExit (plain `npx jest` hangs)
npx expo run:android                                # dev build (device or AVD mingl_pixel)
SENTRY_DISABLE_AUTO_UPLOAD=true npx eas-cli build --profile production --platform android --local --output ~/builds/mingldingl/x.aab
~/.venvs/play/bin/python scripts/play-upload.py ~/builds/mingldingl/x.aab   # to Play internal testing
npx eas-cli update --branch production --environment production --message "…" --non-interactive
```
OTA update = JS/words/art only. Anything native needs a store build **and a `version` bump in
app.json first** (runtimeVersion is the app version; a JS bundle on mismatched native code crashes).

Maestro (`.maestro/`, needs `scripts/dev.sh`): `signup.yaml`, `resume.yaml`,
`resume-every-step.yaml`, `keyboard-clear.yaml`, `two-devices.sh <A> <B>`, `device-pass.sh
<device>`; once per device `push-seed-photos.sh <device>`. **Never use Maestro's `hideKeyboard`**
(Android presses Back); use `_keys-away.yaml`.

Admin (`mingldingl_control/`): `npm run dev | build | lint | typecheck | generate:api | e2e`.
