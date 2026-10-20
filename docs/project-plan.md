# MingldIngl — Plan

The one living document: where the project stands, what is left, how the game works as built, and
the rules every change is checked against. Finished work is recorded in
[`shipped-log.md`](shipped-log.md); how the code fits together and every command are in
[`CLAUDE.md`](../CLAUDE.md). Every number below is a default the admin can tune (DB-backed
config, key in brackets where it helps).

---

# Where it stands (2026-10-17)

The whole game is built and checked on devices in English and Mongolian. What is left is the
launch, and that waits on the user's accounts and keys.

| Stage | What | State |
|---|---|---|
| 0. Visual system | Figma library: art study, motion, tokens, art, glyphs, components | approved 2026-10-05 |
| 1. Screen designs | Every screen in Figma (129 frames, pages S1–S8; S9 the web page) | approved 2026-10-05 |
| 2. Foundation | Engine + app + admin, design system in code, phone sign-in, profile | built 2026-10-07 |
| 3. Core loop | Seek, bonds, letters, seals, score & tiers, going cold, safety | shipped 2026-10-10 |
| 4. Encounters | Icebreaker, Trial, Flame Rite video, meetings & venues, attendance, the Oath | shipped 2026-10-10 |
| 4½. Account & system | War Room, sigil change, Abandon, Codex, offline, error, rest | shipped 2026-10-10 |
| 5. The world | Quests, honours, Hearth/Hold/Hall, Campaign, threads, allies, Town Square, festivals | shipped 2026-10-11 |
| 6. Business | 6a membership & payments, 6b paid floors, 6c statistics & ops | built 2026-10-11 |
| 6d. Launch | Home server, accounts, Play closed test | **scripted; waits on the user** |

## Launch checklist (6d)

The server side is scripted; the accounts are the user's.

1. **Server** — myserver (192.168.1.102) on, with its LAN address reserved. No Docker:
   `./scripts/deploy.sh --setup` installs `scripts/server/` (systemd units, nginx, the `mingldingl`
   Postgres role, the backup timer) and `/etc/mingldingl/engine.env` from
   `scripts/server/engine.env.example`. `./scripts/deploy.sh` builds here and ships the engine and
   the web pages (panel + `/guild/`); `./scripts/restore-check.sh` restores the newest backup into a
   throwaway database — do it once for real.
2. **Domain + tunnel** (user) — a domain on Cloudflare; a tunnel with two public hostnames: the API
   → `http://localhost:8080`, the panel → `http://localhost:8081` (the web page is its `/guild/`).
   Its token goes in `engine.env` as `TUNNEL_TOKEN`, then `./scripts/deploy.sh --tunnel`. Set
   `PUBLIC_API_URL`, `QPay__CallbackBase` and `Cors__AllowedOrigins` to match.
3. **Accounts** (user) — QPay merchant (client id/secret, invoice code); Google Play Console app
   `com.mingldingl.app` with subscriptions `hall` and `high_table` (base plans `m1`, `m3`, `m6`,
   priced as config); RevenueCat project (Play service account, entitlements `hall` /
   `high_table`, webhook `POST {API}/payments/revenuecat` with the `engine.env` Authorization
   value); Firebase `google-services.json` + FCM V1 key on EAS; Sentry DSNs; the Agora NCS webhook
   URL `{API}/video/ncs`.
4. **EAS production env** — `EXPO_PUBLIC_API_URL` (the API hostname),
   `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_SUPPORT_EMAIL`;
   then `eas build --profile production --platform android` and a closed-testing track.
5. **Listing** — the EN draft below, MN by Claude, screenshots from the device pass, the content
   rating questionnaire (dating, 18+), data safety as below.
6. **Last checks** — the Principles; a load test of Seek and the Square with the seed crowd on the
   server; the admin's Ops page all "Reachable".

**Play listing, EN draft** (the user may reword)
- *Title:* MingldIngl — meet, keep your word
- *Short:* A dating game where letters break seals, encounters are real and ghosting costs.
- *Full:* MingldIngl is dating as a slow, forged game. Each night the tavern brings you one
  traveller at a time. Summon someone and a bond is made — then letters break four seals, one
  portrait at a time. Break the ice, take the Trial, light the Flame Rite, and meet at a verified
  place. Keep your word and your gem climbs from Garnet to Emerald; let a fire go cold and it
  shows. Quests, honours, Fated Threads from friends and the Town Square's live rounds make the
  world. Every floor plays the same game: the Hall and the High Table add reach, never score.

**Data safety (Play form)** — collected: phone number (account, verified by SMS), name, birth
date, gender, city, photos, messages (letters), in-app interactions; deep-profile answers
(members); purchase history. Shared: none sold; processors only (Supabase storage, Agora video —
never recorded, RevenueCat, QPay, Expo push, Sentry crash reports with personal data scrubbed).
Encrypted in transit; deletion on request in the app (Abandon, 30 days) and by the keepers.

## Backlog

**Needs the user**
- Everything in the launch checklist's accounts (QPay, Play, RevenueCat, Firebase, Sentry, domain).
- `EXPO_PUBLIC_SUPPORT_EMAIL` — until it is set, "Write to the keepers" is hidden and the Cast Out
  screen has no way to write.
- The Codex guide texts other than "The fire and the cold" were written from the rules, not Figma
  — the user may want to reword them (the admin's Codex pages edit them).

**Owed checks**
- The Mongolian half of the device pass (`LOCALES=mn .maestro/device-pass.sh <device>`) and a
  native read-through of the Mongolian.
- Sign-in screens, Town Square live rounds and festivals were not re-shot against Figma in the
  2026-10-16 pass (they need a signed-out phone or a live round).
- The A51 frame-rate measurement (screen travel, the ember, the counter roll) on a production
  bundle.
- Push on a locked phone (needs Firebase) — the square's one-minute call depends on it.

**Art**
- The Hearth's night / dawn / day skies (Figma paints dusk only).
- Naadam's pennant art (a hard-edged rectangle in Figma too).
- Photos for the seeded venues.
- A Figma frame for Companion, if wanted.

**Known, watch**
- A fast burst into the tale logs React's dev-only "Maximum update depth" warning (RN 0.86
  multiline TextInput) — harmless.
- A config-write live test failed once in a full engine run and passed alone (timing).
- The capped reply score is still farmable by two colluding accounts (~500 a day) — add a minimum
  length or decay.
- A third gender's matching semantics are not decided (Seek and the square pair opposite genders).

**Not built, by decision** — Travel mode, Fun tags, cosmetics (they need new art); wax (letters
are never gated); venue featured placement and partner dashboards; e-barimt receipts on the web
page (QPay's `ebarimt_v3`, once the merchant account exists — Web 6's link is hidden until then);
time-in-app statistics (the engine does not track session minutes).

## Technology for later

| Tool | When | Why |
|---|---|---|
| Photo moderation (Rekognition / Vision / Sightengine) | before a wide launch | Nudity check on every upload; a face in the first photo. |
| Selfie liveness + face match | before a wide launch | A "verified" mark against scam profiles. |
| Redis | more than one engine instance | SignalR backplane; shared rate limits and throttles (in-memory ones are per instance). |
| PostGIS | if a distance band is wanted | No coordinates are stored today (district → aimag → elsewhere). |
| LiveKit | before the Town Square scales | Open-source video; compare cost and quality with Agora. |
| Rive | if ceremonies grow | State-driven ceremony animation; Skia stays for particles. |
| Quartz.NET / Hangfire | if the sweeps outgrow `SKIP LOCKED` loops | Scheduled jobs. |

---

# Principles (the user's, 2026-10-05 — every change is checked against these)

1. **Nothing that bothers or is redundant gets built** (see "Never built").
2. **Everything is live.** No pull-to-refresh, no refresh-on-focus, no polling, no "tap to
   reload". The engine pushes a change to every screen that shows it.
3. **No navigation loops or router hell.** One place decides where a person belongs; screens
   never redirect on their own.
4. **Scalable, well-structured architecture** — feature folders with clear boundaries in all
   three projects; no file that grows into a god-object.
5. **No session issues.** Nobody is signed out by a race, a stale token or a relaunch.
6. **No unnecessary cache build-up** — memory and disk caches are bounded and keyed.
7. **No heavy loads, build-ups or jank** — 60 fps on the A51 is the bar.
8. **Motion, sound and haptics are part of the build**, not a later pass.
9. **Mongolian is handled during the build**, not after it.
10. **Git is the user's.** Nothing is committed, pushed or branched unless the user says so.

**Workflow**
- **Figma is the source of truth for everything visible.** If a screen needs something the library
  lacks, it is added to Figma first, approved, then built. Code never invents a colour, size,
  texture, motion or component.
- **Study before making.** Each art category is researched from real references and ends in
  written rules; assets are made from the rules.
- **English first, Mongolian in the same change.** Text slots are sized for Mongolian (≈1.4×
  longer); Claude writes the Mongolian (the user's call, 2026-10-16).
- **The style is fixed:** RPG / Warcraft / dungeon-crawler, forged and gamified — stone age →
  bronze age → forged medieval, with a scent of Mongolian heritage. Ink and brush, dark and
  mysterious, iron / gold / ember: ink-stroke glyphs, ink splatter, brush strokes, gems that
  visibly upgrade by tier, animated effects.

**Never built** — Supabase Auth, anonymous identities or aliasing; trusting a JWT phone claim;
Supabase Realtime; public uploads or local-disk photos; hand-written theme files and colour
literals; live SVG glyphs; pull-to-refresh and refresh-on-focus; tests sharing the dev database;
petroglyph carvings; a migration history (one initial migration). **Not social media:** no feeds,
followers, public posts or like counts — ever.

---

# The game

A gamified dating app for the Mongolian market, built against ghosting, swipe fatigue and shallow
engagement. It replaces the swipe loop with a score economy, gemstone tiers and a progressive
reveal that rewards real conversation. **Accountability is the thesis** — the ghosting penalty,
streaks and quests are deliberate, not burnout risks to soften.

## Identity

- **Sign-in** is verify.mn only: the person texts a code to 144773 from the number they claim
  (150₮ a text). Onboarding: name & born → gender → 3–6 portraits → tale (bio ≤ 300) and city →
  the Oath → welcome. Finishing pays +50 [`score.finished`] — below Opal, so the first gem takes
  doing. Onboarding resumes from the server at the step it left.
- **City** — Ulaanbaatar beside the 21 aimags, its districts nested under it; searched in both
  languages; GPS "use my location" inside a Mongolia bounding box.
- **The Oath** — Bond / Fate / Kinship; Sworn at onboarding, **Proven** after 2 kept encounters
  [`oath.provenEncounters`] (+40, once).
- **Tiers** from points, never bought: Garnet 0 → Opal 100 → Amethyst 300 → Sapphire 600 → Ruby
  1000 → Emerald 2000 (strictly increasing). A tier change raises the three-part tier-up ceremony
  once, on whichever device is open.
- **Reputation** 0–100, starts at 100, never shown; it only orders Seek. Docked by going cold (5),
  a third no-show in 90 days (10) and an admin penalty (10).
- **Character** — own profile: card, gem, XP bar, oath, honours, Satchel, Encounter Log rows,
  deletion-pending banner. **Deep profile** (children, smoking, drinking, faith, lifestyle) is a
  members' thing: they fill it and read another's after the 4th seal; the Yard sees it sealed.

## Seek and bonds

- **Seek** shows one companion at a time: their sealed first portrait (ThumbHash only), name, age,
  tier, province (or Ulaanbaatar — the district is a seal's reward), oath and tale. *Summon* makes
  the bond at once, live on both sides with the "A bond is made" ceremony. *Pass for tonight* hides
  them until the next day.
- **Who can be seen:** finished, Active, not paused or departing, opposite gender, no cast-out
  either way, never bonded before, not passed today. Order: same district → same aimag (or
  Ulaanbaatar) → elsewhere; inside each the same oath first, then nearest tier, then most recently
  seen, then reputation. One indexed SQL query paged by a cursor; the same eligibility rule guards
  every path that makes a bond (summons, threads, the square).
- **Candles** (summons a day): 5, +1 per 50 points and +1 per tier index, capped at 12 + tier
  index; the Hall 12 (cap 25), the High Table 20 (cap 40). Counted only when five or fewer are
  left, otherwise "to spare". The day is the Ulaanbaatar day.
- **The fire** (party seats): 4 + 1 per tier index live bonds; the Hall +2, the High Table +4. A
  full fire refuses a summons; the seat is taken under a row lock. Threads and the square may pass
  a full fire. Losing a floor never breaks a bond, it only blocks new ones until under the cap.
- **Letters:** text only, 1–1000 characters. No typing dots, no "seen". Whose turn = the other side
  of the last letter. Written offline, a letter waits as unsent and goes out in order.
- **The four seals** count `min(letters each)`, so a monologue never climbs: 5 → the first portrait
  and age; 10 → the second portrait; 15 → the third portrait and district; 30 → every portrait and
  the rest (deep fields to members). Until then the engine sends only a ThumbHash.
- **Embers and gone cold:** 36 h on your turn shows embers and a push; 48 h and the bond goes cold
  — the silent side loses 15 points and 5 reputation, both are told, the letters freeze, the seat
  frees, and a scar is left. A bond nobody wrote in fades after 7 days with no one at fault. A sweep
  every 5 minutes finds them (`FOR UPDATE SKIP LOCKED`).
- **Safety:** *Sever* closes the letters for both, no penalty. *Cast out* (block) severs and hides
  both everywhere; the Frozen Gate lists them and can let them in (they never re-bond). *Report*
  (Rude / Asked for money / Not who they claim / Under 18 / Something else, note ≤ 1000) goes to
  the admin, who dismisses, penalises (−30 points, −10 reputation) or casts out the account.

## Score

Every change is one row in the ledger (the Chronicle of Deeds), never below 0.

| Earn | | Earn | |
|---|---|---|---|
| Finished character | +50 | Meeting sworn | +50 |
| First letter of a bond | +10 | Oath proven | +40 |
| Reply (max 10 per bond a day) | +10 | Quest | per quest |
| Return each day | +5 × streak (cap 7), +50 on the seventh dawn | Bounty chest | +30 |
| Icebreaker | +20 | Campaign chamber / boss | +5 / +25 |
| Trial | +15 | Weekly trial | +25 |
| Flame Rite | +30 | Thread sparked (weaver) | +40 |
| Town Square attended | +10 | Ally finished (both) | +50 |

Lose: gone cold −15; an admin penalty −30 (never automatic).

## Encounters

Letters are never gated. Each step opens on the bond and shows as the Bond's one next-action card
(icebreaker → trial → rite → meeting), each opening a live event and a nudge. Only Live bonds run
encounters; a bond that ends cancels its open steps.

- **Icebreaker** (1st seal): one question from a bank neither has seen; each answers once (1–300),
  hidden until both answered, then revealed together.
- **The Trial** (2nd seal): five four-choice questions; both done → the same match % ("Kindred in
  N of five") and a summary line on both sides. A half-finished trial resumes.
- **Flame Rite** (after both answered the icebreaker): either proposes, the other accepts or says
  not now (re-propose after `video.reproposeHours`). A 5-minute Agora call from the second join,
  ending itself at 0:00. **Completion is never the app's word:** Agora's signed webhook reports
  joins and leaves; both together ≥ 60 s completes it (in Development the apps report, accepted
  only inside the token's window). Douse ends it for both, no penalty; a lost connection offers a
  new attempt. Never recorded. `video.enabled` off hides the Rite and lifts its gate.
- **Meetings** (3rd seal, and after the Rite while `video.required`): a verified venue (ordered by
  the bond's districts then rating), a day and an hour (+2 h to 30 days); the other pledges or
  suggests another time. One open or sworn meeting per bond. Sworn: a push both ways and "Share
  safety info" (venue, district, address, time to a friend). Either may call it off before it
  starts, without penalty.
- **Attendance:** 3 h after the meeting both are asked "Did <name> come?" for 48 h — *We met* /
  *They did not come* / *I could not go*, each private. Both *We met* → kept, and each may rate the
  venue 1–5. *They did not come* stands as a no-show only against silence; a disagreement is
  recorded as disputed, *I could not go* closes it honestly — no one penalised.
- **Venues:** Cafe / Restaurant / Bar / Entertainment / Outdoor / Culture; name EN + MN, district,
  address, hours, description, up to 4 photos, verified flag; rating from kept encounters. A
  removed venue shows "This place is gone — choose another" on meetings still pointing at it.

## The world

- **Quests:** three daily (Ulaanbaatar day) and one weekly (Mon–Sun), drawn per person from a pool
  and never offering what cannot be done; progress comes from what already happens, never from the
  app; claiming pays. The day's third claim leaves a **bounty chest** in the Satchel — contents
  shown before opening, never a gamble, never expiring.
- **Seven dawns:** the return streak; the seventh dawn has its ceremony. Extra opens earn nothing.
- **Honours** — 14 honours and 7 feats, each with its emblem, earned once (festival honours once a
  year), never lost, no points: Seal-Breaker, Bond-Keeper, Flamekeeper, True to Word, Oath-Keeper,
  Seven Dawns, Ally-Caller, Thread-Weaver, Fate-Seer, Mended, Cartographer, Hearthbound, Of the
  Naadam, Of Tsagaan Sar; feats First Bond Forged, Ice Broken, First Trial Taken, Ten Words
  Exchanged, First Encounter Pledged, Face to Flame, Oath Fulfilled. Earning one is a ceremony; the
  case shows "???" for the rest and the date in the world's calendar.
- **Encounter Log:** *Word* = kept of (kept + no-shows against you); *Scars* from going cold, closed
  by two kept encounters (Mended); *Waypoints* = districts where kept encounters' venues stand
  (three → Cartographer); *Season* = the current or next festival.
- **The Satchel:** the Oath, unopened chests, the keepsake — your card shared as an image.
- **The Hearth** — the home hub, reached by the ← on every tab room (Seek stays the landing): sky by
  the Ulaanbaatar hour, candles left, six doors. Its ⋮ opens **the Hold** — the seven rooms (the
  Gate, the Long Road, the Tavern, the Hearth, the Forge, the Hall, the Deep) on the mountain, with
  "you are here".
- **Hall of Names:** your cohort (Ulaanbaatar or your aimag), the top five by points with names
  hidden, then your own rank. Paused, departing and retired characters are not listed.
- **The Campaign** (per Live bond): seven chambers opened by deeds done together — letters, the
  first seal, the icebreaker, the Trial, the Rite, the third seal, and the boss: a kept encounter.
  Clearing all earns Oath-Keeper; the bond goes on.
- **Weekly trial:** each Live bond past the first seal gets one prompt a week, answered like the
  icebreaker. During Naadam it is the **Three Games**: strength, aim and speed (answer within an
  hour of opening).
- **Retire together:** after a kept encounter, either asks and the other agrees. The bond closes as
  complete, both are paused, their other Live bonds close quietly ("retired from the road", no
  penalty), both earn Hearthbound. Pause can bring a character back to Seek later.
- **Fated Threads:** a weaver pairs two Mongolian numbers (2 a day); each gets an invitation code.
  An existing account sees the thread in its Quest Log; a newcomer finds it on signing up with that
  number. Each answers privately, never learning the other's name first. Two yeses and an eligible
  pair → a bond for both, and the weaver earns +40 and Thread-Weaver. A no, an ineligible pair or
  14 days cuts it; the weaver sees only Sparked / Waiting / Cut.
- **Invite an Ally:** one code each (`MNKH-4821`); the link carries it into the sign-up; when the
  newcomer finishes, both earn +50 and the caller Ally-Caller.
- **Town Square:** a gathering is rung in the admin — name ("the Fourth Bell"), time, 6 rounds of
  5 minutes, 16 seats (half for each gender), optional festival and masked flag. Seats are taken
  live; for 10 minutes after a bell is rung only the High Table may sit. A minute before, a push
  calls the seated. At each bell the engine pairs the present (never bonded, cast out or already
  met that night; same oath preferred); a pair gets a video round with the round's question, then
  Yes / No within 30 s. Two yeses → a bond at once and Fate-Seer; otherwise "Not this time"
  (neither learns the other's answer). Sitting through a round earns +10. In a **masked** gathering
  only voices until the bell. A dropped connection rejoins the round if it still runs.
- **Festivals** change the world, not the pressure: sky, light, ornaments, the square's bell card,
  Seek's banner, the Three Games, and a kept encounter in the season earns its honour. No sales, no
  countdowns, no "last chance". Seeded calendar (the admin keeps it):

  | Season | The vibe |
  |---|---|
  | **Tsagaan Sar** (Lunar New Year — never "White Moon"; dates set yearly) | white and blue world, khadag blue, a quieter family bell; Of Tsagaan Sar |
  | **Naadam** (July 11–15) | the Three Games, a festival bell; Of the Naadam |
  | **Last bell of the year** (Dec 30) | fireworks, snow, the year's last gathering |
  | **Day of the Bond** (Feb 14) | a gathering, warm rose-gold light |
  | **March 8** | a warm world tint, a gathering |
  | Masked round | faces hidden until the bell |

## Account & system

- **The War Room** (Character's ⋮): edit, pause (hidden from Seek, bonds go on), sound (opt-in) /
  haptics / notifications per device, language, your floor, the Codex and Terms, the Frozen Gate,
  sign out (asks first, names the 150₮ to come back), Abandon.
- **Your sigil** — a phone change by the same verify.mn proof; a number another account holds is
  refused; other devices are signed out.
- **Abandon** schedules deletion in 30 days: hidden from Seek, "fades in N days", undone by "Keep my
  character" or any sign-in. On the day the sweep deletes the photo files and then the account; the
  number is free again. A store subscription must be cancelled in Google Play, and QPay time left is
  not refunded — both said plainly before confirming.
- **Codex** — guide and legal pages in the DB, edited in the admin.
- **The road is cut** when the live connection is down 5 s. A crash shows **"The path falters"**.
- **The fire burns low** — after 40 minutes of continuous use the floor dims; a gentle stop,
  never a lockout.
- **Push** (Expo) is asked for only after the first bond, on the "May we ring for you?" screen;
  never while the app shows that bond. Copy is one EN + MN table.

## Membership & payments

Only membership earns money. Every floor plays the whole game; paying buys reach and depth, never
score, tier, reputation or forgiveness, and filters narrow Seek but never rank it.

| Floor | A moon (web) | Summons a day | Seats | Perks |
|---|---|---|---|---|
| The Yard | free | 5 (cap 12) | 4 + tier | the whole game |
| The Hall | 10,900₮ | 12 (cap 25) | +2 | deep profile, Seek filters, a second look, 1 ger rest a moon |
| The High Table | 21,900₮ | 20 (cap 40) | +4 | the Hall's, 2 ger rests, first seat at the Town Square |

1 / 3 / 6 moons at 0 / 10 / 20 % off. *Seek filters:* age, district, oath, deep answers. *A second
look:* bring back today's last pass, once a day. *Ger rest:* a missed dawn keeps the streak, spent
when the person returns.

- **One membership record** decides the floor (grants from store and QPay; the highest wins; QPay
  time bought during a store period starts after it). Features ask `MembershipService`, never
  payments. Three days before a floor ends a push says so.
- **In the app:** Google Play through RevenueCat. The webhook and the app only prompt the engine to
  ask RevenueCat and store exactly what is there — a missed webhook loses nothing.
- **On the web:** the Guild House page `/guild/` (served with the admin build) signs an existing
  character in by verify.mn and sells floors by QPay QR (or a bank link on a phone). QPay time never
  renews. The app never links to or names the page (store rule).
- **No one's money is ever locked:** the invoice is written before the QR shows; QPay's callback
  only hints — the one-minute sweep asks `payment/check` for every open invoice and credits late
  money; anything paid that cannot be credited waits on the admin's Payments page for a refund.
  `membership.enabled` off hides the Guild House and the page.

Rejected: Reputation Repair (sells forgiveness), score boosters (pay-to-win), "see who liked you"
(no likes exist), Profile Boost (tilts fairness).

## Admin (the keepers)

Login (one admin, throttled), Dashboard (today live: sign-ups, active, bonds, letters, kept
encounters, money, needs attention), Statistics (Growth, Engagement, Matching, Encounters, Square,
Money, Cohorts — range, five filters, CSV; rolled up hourly into `stats_daily`, today live), Users
(live list, detail with score, bonds, encounters, floor, payments), Reports, Venues, Fated Threads,
Town Square (ring, edit, cancel, festival calendar), Codex pages, Config, Payments, Deletions, Ops
(health of the engine, sweeps, Agora, QPay, RevenueCat, verify.mn, last backup) and the audit log
(every keeper write, in the same transaction).

---

# Visual system (approved 2026-10-05)

The Figma file "MinglDingl — Visual System" (`nLwcONhTplnnOmXu3wroIx`): pages 01–07 hold the
library, S1–S8 the app and admin screens, S9 the web page. Code reads it through
`scripts/gen-tokens.js` and `scripts/export-art.py`. Check new art and screens against:

- **Gem ladder** — each tier a later age: Garnet raw crystal in rock → Opal polished cabochon in
  rawhide → Amethyst first step cut in riveted iron prongs → Sapphire brilliant cut in verdigris
  bronze with a deer-stone band → Ruby cushion cut in Xiongnu animal-style gold, fire inside →
  Emerald royal cut in gold with Ulzii filigree and a halo. Motion grows with the tier (ember pulse
  → colour flashes → glint → breathing light → inner fire → aura). Rules: 70–80 % shadow, three
  light layers, no outlines, the setting is the forge, one camera and one light. Gems are the only
  things that shine.
- **Type** — Pirata One blackletter, rarely (English room titles only; it has no Cyrillic); Yeseva
  One display (names, numbers, headings, Mongolian room titles); EB Garamond body and italic.
  Italic is only the app's voice: my letters on parchment, theirs on dark stone.
- **Night sky base** — near-black `#060912` with a navy glow and sparse faint stars; panels
  `#0f1424`. Warmth comes only from fire, gold, wax and gems. Screens are transparent over one
  World Floor.
- **The ember** — a hidden fire's light rises from below every in-world screen (Lit / Roaring for
  the Hearth and the Rite / Out when gone cold). Animated in the app: each spark a live Skia
  particle with its own speed and delay, the glow breathing ±10 % on a 4–6 s loop.
- **Rich gold** — 500 `#D9A21B`, 300 `#F5C542`, 700 `#8F6410`, 100 `#FBE6A6`: a struck coin.
- **Brass hardware** only where two things join or something opens, two to four pieces a plate:
  Fastener (rivets), Corner Cap (Dialog, a selected Choice Card), Drawer Pull (Sheet grip), Clasp
  (locked Notice), Maker's Mark (one per plate, never on buttons). Button brass is worn where the
  thumb presses. **NameTitle** sets names in Yeseva with a gold glow, rule and lozenge. The
  **Points Counter** is a lit gold number whose digits roll on a gain (360 ms a digit, anvil
  settle, a metallic tick). **Gate Chain** across the Frozen Gate; **Hanging Sign** for the Guild
  House.
- **Motion** — 5 durations (tap 120, shift 240, travel 360, ceremony 1.2–3 s, loop 2.4–6 s), 4
  easings (forge-out, ember-in, anvil, breathe), 17 named motions (Figma page 02).
- **The seven rooms** each have their own light and floor; four sky phases (night / dawn / day /
  dusk) and festival variants tint them.
- **Art** is painted, never photographic: generated locally (FLUX on the RTX 5060) and
  code-painted materials. Declined: petroglyphs, leather/felt, wax drips/soot, brown backgrounds.

---

# Hard-won rules

- **Phone ownership is proven by the engine** via verify.mn, never by the client; account creation
  and phone change need a claimed verification. A pending session is never handed to a caller who
  cannot name it; one number holds at most 5 live sessions, a sixth supersedes the oldest.
- **Auth schemes never mix** — app, admin and the Guild page each have their own, valid nowhere
  else, hubs included.
- **Realtime goes per user**, never a shared topic; events go out only after the commit.
- **Business rules travel as a domain exception** with a code, and **every code has app copy** in
  both languages.
- **Every tunable number is admin config** with bounds, readable by the app through one path
  (hardcoded numbers go stale); thresholds stay strictly increasing.
- **"Today" is Asia/Ulaanbaatar**, not UTC (else days roll over at 08:00 local).
- **Discovery never loads every eligible person**, and its eligibility is one rule shared by every
  path that makes a bond; blocks are checked on all of them.
- **Seats are taken under a lock** — a fast-path check lets concurrent summons overflow by one.
- **Video completion is corroborated** by Agora's webhook, never a client assertion.
- **Rate-limit every write** from day one. In-memory throttles are per instance (Redis before
  scaling out).
- **Push tokens** are per device session and dropped when it is revoked (the same device on a new
  account must not inherit them).
- **A kill switch hides its entry point** — never copy on a 404.
- **Deleting a person deletes their files.**
- **Sounds on Android follow media volume** and must not take audio focus; expo-haptics impact
  styles are weak on the A51, so heavy moments use the long-press preset.
- **Place names are stored in English**; cohorts group GPS districts and the seeded "Ulaanbaatar"
  together; coordinates need a Mongolia bounding box (`(0,0)` must not land in Ölgii).
- **Mongolian grammar:** suffixes follow the word's vowels, so never glue one onto `{{name}}`;
  compose a line in one locale.
- **Copy traps:** one word meaning three things; account deletion as the loudest button; a buy
  button that doesn't name what it buys; "3/3 minimum"; an empty state with no way forward; a map
  with no "you are here".
