# MingldIngl — Shipped log

## 2026-10-16 — Mongolian, by Claude

The user's call: no translator is coming, so Claude writes the Mongolian in the game's voice.
Every app line (`mn.json`, 1,100+ keys), place names (`place.*`, the city picker searches both
spellings via `tPlace`), the icebreaker and Trial banks (`QuestionsMn`), pushes (`PushCopy`) and
the Codex pages (`CodexSeed`). The language switch refreshes loaded content. Tolgee, the
translation memory and the awaiting list are gone; a jest test now fails on any key missing its
Mongolian. A native read-through is still welcome.

## 2026-10-16 — Figma pass, glow and motion

Every S1–S7 frame has a screen; ~45 checked on the A51 beside their frames (font scale there is
0.9, so text reads ~10% small — not a bug). Fixed: the tier-up's light was 14 hard ray wedges
(striped) — now one dithered bloom that swells and breathes; Seek's stele now spans the gutter
(26:3); the Guild House hangs its name on the chained brass sign (Figma "Hanging Sign", art
`sign_plank`/`sign_chain`); the Rite's ember bowl fills its slot as Figma does; a 204 reply
now resolves to null (undefined crashed the Bond via the weekly-trial query). Motion added:
lists ink-bleed in row by row on first show (`Cascade`; Quest Log, Hall, Honours, Chronicle,
Missions, logs, Codex), the XP bar draws and glides, the tab bar's ember tick draws out and the
glyph lifts, the honour detail sets its emblem down. Not done: auth screens, Square live and
festivals were not re-shot (they need a signed-out phone or a live round).

## 2026-10-15 — App icon

The placeholder Expo chevron is replaced by the guild's wax seal: a round crimson seal pressed
with the knot, on the night sky. One render (FLUX, no drips) cut out and composed in code into
`icon.png`, the Android adaptive set (foreground in the safe circle, starfield background, an
engraved monochrome for themed icons), the splash mark and the favicon. Seen on the A51's app
drawer and splash.

## 2026-10-15 — Phone pass and fixes

A screen-by-screen pass on the A51. Fixed: a claimed quest paid points but lost its deed (now
`AwardAsync` saves its own row); wide art kept its source width and sat off-centre (Hearth, Hold,
Campaign, header rules — `FillArt`); the Naadam pennants stand whole above the button; filter
labels, the closed screens' body and the composer's typed text line up with Figma; venue "1
rating"; the phone field is focused on arrival. Decided with the user: a Sign out row in the War
Room (asks first, names the 150₮ to come back); finishing pays +50 so Opal takes doing (the
welcome step shows it, from `/app/status`); candles are counted only when five or fewer are left,
otherwise "to spare". Figma follows: War Room row, S6 sign-out dialog, every candle and summons
line, onboarding 6 "+50".

## 2026-10-11 — Stage 6: Business (6a–6c built, 6d prepared)

**6a built 2026-10-11.** Figma: S6 216:4728 / 4814 / 4900 / 4654 (your floor ×2, did not land,
Abandon with a floor), page S9 (the web page, 8 frames), S8 218:984 / 1138 / 1271 (Payments,
invoice, user floor) and a Payments item in every admin frame's menu. Engine: `Membership/`,
`Payments/` (QPay client + fake, RevenueCat client + fake, the Guild scheme, the one-minute payment
sweep, `/dev/me/store` and `/dev/qpay/pay/{id}` for walking it locally); 205 tests. App: Guild
House (all six faces), Chip component, `lib/store.ts`, War Room floor row, Abandon's note, live
`membership.updated`; jest green. Web: `/guild/` as a second Vite page in the admin build. Admin:
Payments, invoice (refund / by hand / handled), the user's floor and payments; 5 Playwright tests.
Checked: the web flow against the dev engine (Maestro bought the Hall), and on the A51 "your
floor" then a climb to the High Table live. The web page's code and QR screens ask the engine
every 3 s while shown — the same exception as Verify.
Owed: the real keys (RevenueCat Android key `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` and
secret, QPay merchant account, the Play products `hall` / `high_table` with base plans
`m1`/`m3`/`m6`) — 6d.

**6b built 2026-10-11.** Figma: S2 223:1613 / 223:1655 (the tavern's ⋮ menu, Hall and Yard),
223:1697 (who the tavern shows), 223:1892 (Missions with a ger rest kept); the deep profile follows
35:285–35:475. Engine: candles and seats by floor (`FloorPerks`; the other side's seats count their
floor in Seek's one query), `seek_filters` (narrow, never reorder), `seek_second_looks`, the deep
profile on `profiles` (`/me/deep`, revealed in the bond at the fourth seal to a member),
`ger_rests` (spent on return — a missed dawn kept, Hall 1 / High Table 2 a moon), the High Table's
first seat (`square.highTableLeadMinutes`, 10: only it may sit for that long after a bell is rung);
210 tests. App: the tavern's ⋮ menu, Who the tavern shows, the second look, the deep profile and its
pickers (Edit → Deep profile), the Companion's deep rows, the ger-rest banner on Missions, the
Square's "the High Table sits first" line; 323 jest tests. Checked on the A51 as High Table
Maestro: 38 candles, the menu, a Bond filter, a pass then a second look, a deep answer saved.
Decisions (the user may overrule): Figma, not this spec, holds — the Yard neither fills nor reads
the deep profile; ger rests are spent when the person returns, not by a sweep; "first seat at the
bells" is a ten-minute lead after a bell is rung. Dev data: Maestro (99883599) now holds the High
Table through the dev store and the Hall through a dev QPay payment.

---

**6c built 2026-10-11.** Figma: S8 226:1236–226:2247 (Statistics: Growth, Engagement, Matching,
Encounters, Square, Money, Cohorts — group tabs, range, five filters, CSV), 226:13358 (the dashboard
with money and needs attention), 226:13443 (Health). Engine: `Stats/` — `stats_daily` keyed by day,
metric and the five dimensions (city, gender and age band at the event; tier and floor at rollup),
34 metric sources, the hourly `StatsSweep` (each finished day once, yesterday again), today counted
live by the same SQL; group tables, dashboard, deletions, health (`/admin/health` reaches QPay,
RevenueCat, Agora, verify.mn); 212 tests. Admin: Dashboard (now the landing), Analytics (SVG line
charts from tokens), Deletions, Ops; the sidebar in Figma's order; CSV built in the browser from
the same numbers; 6 Playwright tests. A config-write live test failed once under the full run and
passed alone twice (timing; watch it).

**6d prepared 2026-10-11** (the home server was unreachable, so nothing is deployed yet):
`docker-compose.yml` for the server (db, engine, web, nightly backup, tunnel profile; everything
bound to 127.0.0.1), `mingldingl_control/Dockerfile` + `nginx.conf` (panel and `/guild/`, image
built and smoke-tested locally), `scripts/deploy.sh`, `scripts/restore-check.sh`; the engine boots
in production without QPay keys (the page says payment is not open — nothing can be paid).

## 2026-10-11 — Stage 5: The world

The full game. Three daily quests and one weekly fill from what you already do and pay when
claimed; the third claim of the day leaves a bounty chest, and the seventh dawn has its ceremony.
21 honours and feats are earned with a ceremony and fill the case. The Encounter Log shows word,
scars and waypoints. The Hearth (reached by the ← on every tab room), the Hold and the Hall of
Names open. A bond's Campaign clears seven chambers, the week's trial (the Three Games in Naadam)
is answered by both, and a pair that met can retire together. A thread woven between two numbers
sparks into a bond, and an ally's code brings a new person in. A bell rung in the admin fills the
Town Square: seats live, paired video rounds (voices only when masked), the bell, two yeses make
a bond. Festivals dress the square and Seek. The admin edits Codex pages and reads an audit log.
Checked on the A51 and the emulator, in EN and pseudo-Mongolian.

- **Engine:** Quests, Honours (with a backfill at boot), Hall, Campaign, Threads, Square,
  Festivals; progress and honours through one `IWorldEvents.Raise` inside the caller's
  transaction; admin Codex editing, threads, gatherings, festival calendar and an audit row per
  keeper write. 197 tests.
- **App:** Missions, chest and seven-dawns ceremonies, Honours case/detail/ceremony, Satchel and
  keepsake share, Encounter Log, Hearth, Hold, Hall of Names, Campaign, weekly trial, retire,
  Weave a thread and Thread Log, Invite an Ally, the Square tab and the night (Agora), festival
  skies and ornaments. 314 jest tests.
- **Admin:** Fated Threads, Town Square ("Ring a new bell", edit, cancel, festival calendar),
  Codex pages, audit log. 4 Playwright tests, now on their own database.
- **Decisions (the user may overrule):** wax is not built (letters are never gated); the Campaign,
  weekly trial and retire have no Figma entry and sit under the Bond's options and the Campaign
  map; a thread's invitee answers on a page made from existing parts; pre-stage-5 honours carry
  the backfill date; thread and square bonds may pass a full fire; the festival calendar sits
  under the admin's Town Square page.
- **Fixed in the device pass:** festival ornaments at Figma's opacity and place; a festival bell
  dresses the Square tab's sky; the masked moon and Naadam's dusk horizon; the garland covered the
  words; "join failed" to 34:425; a dropped call now shows "connection lost" after 8 s (Agora never
  reports "failed" for a lost network) and a rejoin binds the faces again; the Hold's edge rooms
  and long honour names were cut off; the admin e2e had been writing into the dev database.
- **Still owed:** Mongolian for every stage-5 key (the translator); the Hearth's night / dawn /
  day skies (Figma paints dusk only); Naadam's pennant art is a hard-edged rectangle in Figma too;
  Firebase push (the user) before the square's one-minute call reaches a locked phone.

## 2026-10-10 — Stage 4½: Account & system

Character's "⋮" opens the War Room (Figma 35:3): edit, pause (hidden from Seek, bonds go on),
your sigil (moved to a new verify.mn-proven number, other devices signed out), sound / haptics /
notifications per device, language, the Yard, the Codex and Terms (pages in the engine, seeded in
English), the Frozen Gate, and Abandon (deletion in `account.deleteDays`, "fades in N days" on
Character, Keep or any sign-in cancels; the hourly sweep burns the account and its portraits and
frees the number). "The road is cut" shows when the live connection is down 5 s, and letters
written then wait as unsent and go out in order when it opens. A throwing world screen shows "The
path falters"; after `app.restMinutes` (40) the floor dims and "The fire burns low". Checked on
the A51 in EN and pseudo-Mongolian, offline included.

- **Engine:** `AccountService` (abandon, keep, sigil start/complete, burn), `Profile.PausedAt`,
  Codex feature, two config keys; 180 tests.
- **App:** Toggle and Setting Row components, War Room, sigil (the Verify screen reused with a
  sigil purpose), departing, Codex, error boundary, rest watch, the road and the letter outbox;
  266 jest tests.
- **Fixed in the device pass:** Hermes has no `Intl.PluralRules` (the departing date crashed);
  "Return to the Hearth" re-drew the broken screen; a refused number offered a useless "Try
  again"; a bond opened offline was blank; a held letter blinked out before the sent one showed.

## 2026-10-10 — Stage 4: Encounters

A bond can become a real date. At the first seal the Icebreaker opens (both answers revealed
together), at the second the five-question Trial (the same score on both sides), then the Flame
Rite — a real Agora video call the engine counts — then a verified venue, a day and an hour both
pledge to, and after it "Did they come?". Kept, no-show and "I could not go" all resolve live; a
second kept encounter turns the Oath Proven. Checked on the A51 and the emulator, in EN and
pseudo-Mongolian.

- **Engine:** Encounters (icebreaker and trial banks seeded at boot, the next-step rule opened by
  seal breaks inside the bond's transaction), Video (AccessToken2 builder, attempts with the five
  minutes from the second join, Agora's signed NCS webhook, a Development-only presence path),
  Meetings and Attendance (pledge / counter / call-off, the outcome table, the third no-show
  docking reputation, ratings, the Oath), Venues (photos in the private bucket, rating from kept
  meetings). Production refuses to start with video on and Agora unset. 175 tests.
- **App:** the Bond's next-action card and nudges, Icebreaker, Trial, Flame Rite and the call
  (`react-native-agora`, camera and microphone), where-to-meet / venue / pledge / sworn with
  "Share safety info", attendance and rating, the Oath row on Character. The tier-up ceremony was
  rebuilt as a Skia light layer on one UI-thread clock (crack, shatter, beam, forge, name). 250
  jest tests.
- **Admin:** Venues (list, add, edit with photos, verify, remove, live), and the user record's
  kept encounters, no-shows and Oath. Playwright covers a venue appearing live, edited and removed.
- **Fixed in the device pass:** the World Floor crashed on gradients with alpha colour stops; a
  leave reported as the five minutes ran out, and an attempt that ended with no one reporting it,
  lost the time already shared; the ceremony restarted itself when Continue appeared (a re-render
  reset Reanimated's frame clock); Character's oath row ignored `oathProvenAt`.
- **Still owed (not blocking stage 5):** Agora's NCS webhook URL set in the Agora console once
  the engine has a public address (`AGORA_*` in `.env`); Mongolian for 125 stage-4 keys (the
  translator); venue photos for the seeded venues. The Rite was completed on devices with a
  135-second call (the threshold is 60 s); a full five-minute run to 0:00 is covered by tests.

## 2026-10-10 — Stage 3: Core loop

Two people find each other in Seek, a summons makes the bond live on both phones, letters break
four seals that reveal portraits, age and district, points and tiers move with the tier-up
ceremony, silence turns to embers and then cold with its penalty, and either side can sever, cast
out (the Frozen Gate) or report. Checked on the A51 and the emulator against every Figma frame.

- **Engine:** Score (ledger, tiers, dawn streak), Bonds (seats under a row lock, seals by
  `min(letters each)`, the 5-minute `SKIP LOCKED` sweep for embers / cold / fade), Seek (one
  indexed candidate query, candles), Safety (block, report, admin resolve), Push (Expo, per device
  session). 141 tests.
- **App:** Seek and its three empty states, Quest Log, the Bond, Companion, Report, the Frozen
  Gate, the Ascent, the Chronicle of Deeds, bond-made / seal / tier-up ceremonies, the reward toast
  and the nudges, the ring screen. 219 jest tests.
- **Admin:** Reports (list, detail with the last letters, resolve) and the user record's score,
  bonds and reputation; Playwright covers a live report being penalised.
- **Fixed in the device pass:** a ceremony opening over a focused composer left the keyboard up
  (every overlay now puts it away); the embers warning scrolled away and short conversations sat
  at the bottom (both now follow 31:97 / 31:262); the bond options were cream text on parchment
  (a dark `menu` Sheet per 31:492); the severed page shows the broken seal; the Ascent dims the
  tiers above yours; long (Mongolian) room titles, tab labels and the XP line shrink to fit
  instead of clipping. The brass Nameplate and drum counter became NameTitle and the lit points
  number, in code and in Figma.
- **Still owed (not blocking stage 4):** Firebase for Android push (the user: `google-services.json`
  and the FCM V1 key on EAS); Mongolian lines for 134 stage-3 keys (the translator); a Figma frame
  for Companion if wanted. "The tavern is empty" is covered by jest only (the seed crowd never runs
  out on a device).

## 2026-10-07 — Stage 2: Foundation

Fresh engine, app and admin. You can sign up with your phone on a real device and see and edit your
own Character, and the admin panel shows sign-ups live. How it fits together is in `CLAUDE.md`.

- **Engine (.NET 10):** verify.mn sign-in, hardened. The engine issues its own
  sessions (rotating refresh tokens, a 30 s duplicate grace, a replay revokes the device). SignalR
  live events go out only after the transaction commits. Config is DB-backed with bounds. Portraits
  live in a private Supabase bucket (SkiaSharp re-encode, ThumbHash, signed URLs, retry on a 5xx).
  Admin has a separate auth scheme, a login throttle, users and config. Rate limits on every write.
  Dev tooling, seed CLI and the 48-person seed crowd, Docker deploy, Sentry with personal data
  scrubbed. 116 tests on Testcontainers.
- **App (Expo SDK 57):** tokens, art and glyphs generated from Figma (no literal colours). The
  World Floor is one Skia canvas with live sparks and a breathing glow. Motion and feedback tables,
  sound opt-in. 30+ components with a gallery. One gate with no redirects. The S1 entry, the six
  onboarding steps (resumable from the server), the closed screens, Character and Edit. Live edits
  arrive in about 1.1 s on the A51, and sign-out-all reaches every device. A dev Tools screen. 200
  jest tests.
- **Admin:** login, users (live list, search, paging, detail) and config, with a Playwright e2e.
- **Tooling:** `scripts/dev.sh`, `check-all.sh` and CI (three jobs). Maestro flows: signup, resume,
  resume-every-step, keyboard-clear, and two-device live-edit/revoke. A device pass that diffs every
  screen against its Figma frame. Tolgee for strings.
- **Decisions worth keeping:**
  - Bio limit 300 (Figma).
  - SkiaSharp over ImageSharp (licence).
  - Sheet and Dialog render in an in-window OverlayHost, not RN Modal.
  - The language switch remounts leaf screens.
  - The engine sends JSON numbers strictly, so the OpenAPI types are clean.
  - Admin password: PBKDF2-SHA256 `{iterations}.{salt}.{hash}`.
- **Fixed on device:**
  - A launch SIGSEGV, about 1 in 5 relaunches: react-native-screens 4.28's fix backported in `patches/`.
  - The city search dropped typed keys: the field is now uncontrolled.
  - Removing a portrait in Edit could drop you back into onboarding: now `409 photos.min`.
  - A live event for an unmounted screen was lost: `refetchOnMount` is on.
  - Engine errors showed in English in every language.
  - "The road is broken" now retries on its own.
  - The keyboard covered Born.
  - A tale was lost on stepping back.
  - The portraits counter read "4 of 3".
  - TalkBack labels for the points and the portraits.
  - The closed screens sat centred instead of in the upper third.
- **Left over:** see the plan's "Stage 2 — Outstanding follow-ups".
