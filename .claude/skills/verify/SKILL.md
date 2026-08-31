---
name: verify
description: How to run + drive MingldIngl end-to-end (engine API with real Supabase JWTs, web app via Playwright with stubbed anonymous-signin)
---

# MingldIngl end-to-end verification recipe

## Engine (ASP.NET Core, port 5150)
- One command: `./mingldingl_engine/scripts/start-engine.sh` — frees port 5150 if a stale instance is still bound (safe to re-run any time), then runs in the foreground with the `http` launch profile (binds `0.0.0.0`, not just localhost). Ctrl+C stops it.
- Manual equivalent: `cd mingldingl_engine && DOTNET_ROOT=$HOME/.dotnet ASPNETCORE_ENVIRONMENT=Development $HOME/.dotnet/dotnet run --project src/MinglDingl.Engine --urls http://0.0.0.0:5150`
- **Bind 0.0.0.0, not localhost** — the app bundle bakes `EXPO_PUBLIC_API_URL=http://192.168.1.32:5150` from `mingldingl_app/.env` (inline env overrides do NOT take; .env wins). 192.168.1.32 is this machine.
- Health: `GET /health`. Unauthed API call → 401 proves the guard.
- `dotnet ef` (migrations) needs `DOTNET_ROOT=$HOME/.dotnet` and `$HOME/.dotnet/tools` on `PATH` — and must be **version-pinned to 8.0.x** (`dotnet tool install --global dotnet-ef --version 8.0.11`); the default `dotnet tool install` grabs a 10.x build that fails with "Failed to resolve libhostfxr.so" against this net8.0 project.
- **`POST /dev/run-maintenance-sweep`** (Development-only, 404 elsewhere) triggers the hourly `DailyMaintenanceBackgroundService` sweep (ghosting, daily-reset, deletion-anonymization, membership-expiry, Ship expiry) on demand — use this instead of waiting up to an hour to verify sweep-driven behavior.

## Real test users / JWTs (no SMS needed)
- Supabase project URL + `sb_secret_…` admin key: `mingldingl_engine/src/MinglDingl.Engine/appsettings.Development.json`; publishable key in `mingldingl_app/.env`.
- Create user: `POST {url}/auth/v1/admin/users` with admin key, body `{email, password, email_confirm: true}` (use `e2e-*@mingldingl.test`).
- Sign in: `POST {url}/auth/v1/token?grant_type=password` with the publishable key → full session JSON. JWT `sub` = engine UserId.
- Engine user row: `POST /users` (upsert) with the bearer token.
- JWTs are JWKS-validated (asymmetric) — cannot be minted locally.

## Web app (expo, port 8081)
- `cd mingldingl_app && npx expo start --web --port 8081`
- Playwright: `chromium.launch({ executablePath: '/usr/bin/google-chrome' })`; playwright module lives in the npx cache — symlink it: `ln -s /home/khashaa/.npm/_npx/<hash>/node_modules node_modules` in your script dir (find via `find ~/.npm/_npx -maxdepth 3 -name playwright -type d`).
- **Login trick:** the app's `useAuth.verifyOtp` is a dev stub that calls `supabase.auth.signInAnonymously()` → `POST /auth/v1/signup`. Route-intercept `**/auth/v1/signup**` and fulfill with a saved real session JSON → the app runs as that user. Phone: any 8 digits, OTP: any 6 digits.
- expo-secure-store has NO web implementation (empty module) → sessions never persist on web; every page load starts at the phone screen. Re-login each run.
- Selectors: RN inputs are `input` tags; old screens stay hidden in the DOM after navigation — target by placeholder (OTP input: `input[placeholder="------"]`). Tabs (5, left to right): Seek / Quest Log / Town Sq. / Missions / Character (getByText; `tab_town_square: 'Town Sq.'`). ChestModal close button: "TAKE BOUNTY" — it blocks all other clicks until closed. Mouse wheel does not scroll RN ScrollViews reliably; use `scrollIntoViewIfNeeded` on a text locator.
- **Getting multiple hidden matches from stale screens is common** — don't just `.first()` a `getByText()` match, filter for the actually-visible one (loop `locator.nth(i)` + `isVisible()`, or scroll into view first). One `.first()` picking a hidden duplicate is the single most common cause of a Playwright click silently no-oping in this app.
- **Button/label copy routinely doesn't match the i18n key name or what you'd guess from the feature name** — always screenshot before assuming text. Confirmed mismatches: OTP screen's submit button is **"VERIFY"**, not "Continue"; Settings is titled **"The War Room"**, not "Settings"; the photo-library picker button reads **"Choose from Library"** even though its i18n key is `pick_from_library`.
- **Generic `img` locators can match decorative background art** (e.g. `TiledBackdrop`'s texture), not just content photos — `page.locator('img').first()` on a screen with a backdrop will often grab the wrong element. Scope to a specific container or use accessible role/text queries instead.
- Chat input: `page.keyboard.press('Enter')` after filling the message box does NOT reliably trigger send in this RN-Web + Playwright setup (silently does nothing — no request ever reaches the engine). Click the SEND button (`getByText(/send/i)`) instead.
- Web renders REDUCED VFX by design (no Skia embers/burst) — absence of particles on web is correct, not a bug.
- Adding a new route file under `app/` doesn't make it typed-navigable until Expo Router regenerates `.expo/types/router.d.ts` — `tsc` will report the new path as invalid until you boot the dev server once (`npx expo start --web`, wait for "Web Bundled", Ctrl+C) to force regeneration.

## Gotchas
- The engine's primary datastore is now **local Postgres** (`127.0.0.1:5432/mingldingl`), not remote Supabase Postgres — outbound port 5432 to Supabase is blocked from this network. Supabase is only used for Auth (JWT) and Realtime, plus a nightly backup pg_dump. Migrations/seed data hit local Postgres; test users/matches/score events created during verification persist there — use the `e2e-` or `seed-`/`load-` prefix so they're identifiable, and check `psql -U postgres -h 127.0.0.1 -p 5432 -d mingldingl` for direct inspection.
- Photo uploads go to local disk (`LocalFileStorageService`), served at `/uploads` — not Supabase Storage.
- Quest rotation is date-deterministic: `QuestService.QuestsForDate` — day index from 2026-01-01, 3 of 6 quests/day. Two-user actions (match/icebreaker/messages/confirm) can complete most boards; suggestions need MessageCount ≥ 15.
- Realtime chat/nudges use Supabase's **Broadcast** API (not `postgres_changes`, which only observes Supabase's own hosted Postgres and stopped firing once messages/matches moved to local Postgres). The engine explicitly pushes via `SupabaseBroadcastService` after each relevant write. If verifying live chat/nudge delivery and nothing arrives, check the engine log for the broadcast POST and confirm the JWT sessions used aren't stale (Supabase JWTs expire ~1h — refetch via `grant_type=password` if you get 400/401s on `/auth/v1/token?grant_type=refresh_token` or on any engine call right after "logging in").
- **Raw-SQL seeding gotchas** (writing INSERT statements directly against local Postgres, e.g. for bulk test data):
  - `User.PhotoUrls` and `BusinessPartner.PhotoUrls` are `jsonb`, not a Postgres array — use `'["url1","url2"]'::jsonb`, not `ARRAY[...]::text[]`.
  - `ScoreEvents` has a **partial** unique index, `ix_score_events_once_per_day`, on `("UserId","EventType",(("CreatedAt" AT TIME ZONE 'UTC')::date))` `WHERE "EventType" IN ('DailyLogin','QuestChest')`. It's an index, not a named constraint — `ON CONFLICT ON CONSTRAINT ix_score_events_once_per_day` fails ("constraint ... does not exist"); you need `ON CONFLICT ("UserId","EventType",((("CreatedAt" AT TIME ZONE 'UTC')::date))) WHERE "EventType" = ANY (ARRAY['DailyLogin','QuestChest']) DO NOTHING` — the expression and the WHERE clause both have to match the index exactly.
  - Reassigning a seeded row's PK to a real Supabase auth UID (so you can log in as a user with pre-built match/message history) is **not** a plain `UPDATE "Users" SET "Id"=...` — `Match`'s FKs use `DeleteBehavior.Restrict` and nothing here is a deferrable constraint, so a direct ID swap violates FK checks mid-transaction. Do it as: INSERT a copy of the row under the new ID (set `PhoneNumber` to NULL on the copy first — it's unique-indexed and the old row still holds the real value) → UPDATE every child table's FK column from old ID to new ID → DELETE the old row.
