# MingldIngl — Shipped log

Newest first. One short entry per finished piece of work: what a person can now do, what was
decided, what was fixed on a device. Open items live in the plan's Backlog, not here.

## 2026-10-20 — A lighter download

The painted art is lossy WebP now (quality 90): 42 MB of PNGs became 9.5 MB, and the six images
whose source is too small for 3x no longer ship an identical @3x copy (`export-art.py` writes it
this way; the admin syncs the WebPs). Agora's optional extensions (lip sync, face capture,
spatial audio, segmentation, screen capture and the rest; ≈30 MB a CPU type) are left out of the
APK by `plugins/withLeanAndroid.js`, which also builds preview and production for ARM only. Calls
keep echo cancellation, noise suppression and the hardware video encoder.

## 2026-10-20 — Fated Threads are Заяаны холбоос

"Заяаны утаснууд" read wrong (утас is first a phone), so in Mongolian a Fated Thread is now a
холбоос that a friend ties (зангидах) between two people: it is cut (тасарлаа), it sparks, and the
honour is Заяа холбогч. The app's lines and the two pushes changed; English is unchanged.

## 2026-10-20 — Snow from the solstice to January 20

From the winter solstice (the first of the Nine Nines) to January 20, snow falls through the night
sky over every screen and melts into the ember's glow. The engine works out the solstice's
Ulaanbaatar day itself (it moves between Dec 21 and 22) and says `snow` on `/season`; the admin can
switch it off (`world.snow`). About thirty flakes in three depth layers, the near ones soft so they
never read as stars; off under Reduce Motion. Figma: World Floor Season=Winter. Tools → Snow
previews it any day. Seen on the A51.

## 2026-10-20 — Sign-in by a texted code (WeSend replaces verify.mn)

The person no longer texts 144773 and pays 150₮: WeSend texts a six-digit code to the number, in the
app's language, and they type it (the sixth digit opens the gate; Android offers it from the SMS).
The engine never sees the code: `/auth/phone/check` asks WeSend, five tries a code, ten minutes; a
new code at most once a minute per number, and it cancels the last. The app, the sigil change and the
Guild House web page use the same check; the poll is gone. Each code costs us 80₮ of credit. The fake
(Development, Maestro `_code.yaml`, Playwright) takes 000000. An existing database keeps verify.mn's
old columns, loosened at boot so nothing is dropped.

## 2026-10-20 — A stranger in Seek is nameless

The onboarding hint promised a first name is seen only after a match, but every Seek card showed it.
Seek now sends no name (the card reads "A traveller, 28" / "Аянчин, 28"; a second look says "the one
you passed tonight"), so the name comes with the bond; the hint now says so, and names the Square,
where partners do see it. Also: the gate says what this is not ("Зураг гүйлгэх биш"), the SMS cost
says it is one message's price, the Mongolian "you" is always чи and "the keepers" always манаач,
and Seek is "Хайх хэсэг" everywhere (Codex, Terms).

## 2026-10-20 — Drift sweep: the web page speaks Mongolian

The Guild House web page was English only; it now opens in Mongolian (`?lang=en`, a switch, the
reader's choice remembered), with the engine's rules in the reader's language and the app's own words
(`src/guild/words.ts`; the sign in Yeseva One). Its abandon screen named only Google Play; it now
names both stores. Eight rules a dater can meet had no app line and showed the engine's English; they
have lines now, and `ErrorLinesTests` fails when a new code has none (admin/internal codes are listed
there). Mongolian drift: Campaign chambers are "тасалгаа" (they shared "танхим" with the Hall floor),
"Climb" is "Өгсөх" everywhere, the Fate oath is "Хувь заяа", and the MN store listing uses the app's
words. The crowd's bios: Mongolian for the Mongolian-speaking, no bio names another city, no
copies, and Сарангэрэл is a herder's daughter.

## 2026-10-20 — A living dev world, and Mongolian corrections

`seed crowd` now seeds what the crowd does together (`WorldSeeder`): 15 fictional partner venues
with two FLUX photos each (`Seed/crowd/venues.json`, `venue-<id>_<n>.jpg`,
`~/ComfyUI-models/venues.sh`), about 30 bonds at every stage with letters that read as one
conversation (EN/MN), icebreakers, Trials, Flame Rites, meetings proposed/sworn/waiting for "Did
they come?"/kept/missed, cold, severed, faded and one retired pair, Fated Threads, an ally, reports
for the admin queue, blocks, and the points, honours, oaths proven and Campaign chambers that
history earns. `seed crowd --phone 99xxxxxx` makes that finished account the hero: 13 bonds, one at
each stage, seven of them live. The unread `crowd-world.json` is gone. The app now shows a venue's
Mongolian name to a Mongolian reader (`tVenue`, including the Encounter Log, which gained
`venueMn`). Mongolian fixes: "хором" is a moment, not a minute (Rite, codes, rounds); "until both
say yes" is "гэх хүртэл"; one person is "тэр/түүн", not "тэд"; list joiners had lost their spaces;
"Эрэгтэй/Эмэгтэй"; "гулсуулах" dropped from the invite. Renamed in Mongolian (user's call): the
Tavern is "Учралын тойрог", the Opal tier "Гэрэлт чимэд", the Amethyst tier "Ягаан болор".

## 2026-10-20 — App icon: the bond medallion

The icon is now the First Bond honour medallion with its twin flames relit as glowing gold, on the
World Floor night (user's pick over the ruby crest, forged/molten/ruby M monograms and a coat of
arms; raw FLUX icon renders were rejected). One source feeds `icon.png`, the Android adaptive
foreground/background/monochrome, the splash and favicon, plus `assets/store/` (Play 512 icon,
1024×500 feature graphic with the gold Pirata One title). Sources and scripts:
`assets/atelier/icon/` (`medal.py` relights the Figma art, `feature.py` paints the graphic). A
new build is needed for devices to show it.

## 2026-10-20 — Store readiness

The public pages both stores require, in Mongolian and English, served by nginx from the panel host
with no script: `/privacy/`, `/terms/` (zero tolerance for abusive content, reports acted on within
a day, auto-renewal, no cash value) and `/delete/`. The Guild House web page deletes an account:
`/guild/?leave` signs a character in and abandons it exactly as the War Room does
(`POST /guild/abandon`, same 30-day grace). The app's Terms · Privacy page and the Guild House
link to the full pages (`EXPO_PUBLIC_WEB_URL`); the Guild House states the renewal and where to
cancel. iOS is ready for its first build: RevenueCat's iOS key, Apple product ids
(`hall_m1` …), "App Store" in place of "Google Play" on iPhone, Apple's subscriptions page, and
the export-compliance flag. Checked: the app never points to the QPay web page (both stores forbid
steering away from in-app purchase). `deploy.sh` now needs `SUPPORT_EMAIL` in `engine.env`.

## 2026-10-17 — Test and code cleanup

A Square test failed about one run in three: the engine's real 2-second square clock ticked during
tests and held the gathering's lock while the test ticked it. Tests now tick the square
themselves. New tests cover what the parity pass added: the safety share appears only while
a meeting is sworn, "Manage in Google Play" shows only for a store floor, the admin finds a
person by id with their tier, score and reputation, and a sideways phone photo is stored upright.
Cleared out: 9 orphaned English/Mongolian lines, two unused app packages (`expo-status-bar`,
`thumbhash`), `export` on values used only in their own file, three copies of the admin's ₮
formatter (now one in `lib/format`), and every engine build warning (SkiaSharp's deprecated draw
call; the stats SQL is now built in named locals). Tab deep links now honour the Character tab
as home.

## 2026-10-17 — Figma parity pass

Checked against the live Figma file: every variable, text style and effect (one 1/255 drift fixed),
all 66 glyphs (pixel-identical re-renders), all 89 art images (every hash present; screens use no
art the code lacks), every text line on S1–S9 against the code's copy, and the admin panel page by
page beside its frames. Code now follows Figma: the Bond options' "Share safety info" row (while a
meeting is sworn), Seek's "Widen who you seek", the War Room's "Climb", "Manage in Google Play"
on a store floor, the square's push copy, the Three Games line, and the admin Travellers list
(tier, score, reputation; search by id). Figma now follows code where code holds a decision: the
deep-profile filter chips, the oath and Satchel lines, the Edit hint, the Guild welcome, no wax,
no e-barimt link, and the admin's live header, stats tiles (what the engine counts), config keys,
venues' Listed column and the Ops room. The Ops tile shows a short engine version. The device
pass flow follows the current navigation (finishing lands in Seek).

## 2026-10-17 — On GitHub; native deploy

The project went up as one "Initial version" commit to `github.com/khashaaaa/mingldingl`. The
home-server deploy dropped Docker: `scripts/deploy.sh` publishes a self-contained engine and the
web pages, and `scripts/server/` holds the systemd units, nginx, the Postgres role, the backup
timer and the tunnel. Docs reorganised into `docs/project-plan.md` and this log.

## 2026-10-16 — Mongolian, by Claude

No translator is coming, so Claude writes the Mongolian in the game's voice: every app line
(`mn.json`, 1,100+ keys), place names (the city picker searches both spellings), the icebreaker
and Trial banks (`QuestionsMn`), pushes (`PushCopy`) and the Codex (`CodexSeed`). The language
switch refreshes loaded content. Tolgee is gone; a jest test fails on any key missing its
Mongolian.

## 2026-10-16 — Figma pass, glow and motion

Every S1–S7 frame has a screen; ~45 were checked on the A51 beside their frames (the A51's font
scale is 0.9, so text reads ~10 % small — not a bug). The tier-up light became one dithered bloom
that swells and breathes; Seek's stele spans the gutter; the Guild House hangs its name on the
chained sign; the Rite's ember bowl fills its slot. Lists ink-bleed in row by row on first show
(`Cascade`), the XP bar draws and glides, the tab bar's ember tick draws out, the honour detail
sets its emblem down. Fixed: a 204 reply crashed the Bond (now null).

## 2026-10-15 — App icon; phone pass

The guild's wax seal (crimson, pressed with the knot, on the night sky) is the icon, the Android
adaptive set (with a monochrome for themed icons), the splash mark and the favicon. Phone pass on
the A51: a claimed quest kept its deed; wide art centred (`FillArt`); labels and closed screens
line up with Figma. Decided with the user: a Sign out row in the War Room (names the 150₮ to come
back); finishing pays +50 so Opal takes doing; candles are counted only when five or fewer are
left.

## 2026-10-11 — Stage 6: Business (6a–6c)

- **6a — membership & payments.** `Membership/` (floors as grants) and `Payments/` (QPay and
  RevenueCat clients with fakes, the Guild auth scheme, the one-minute payment sweep, dev paths to
  walk a purchase locally). App: the Guild House, `lib/store.ts`, the War Room's floor row,
  Abandon's note. Web: `/guild/` as a second page of the admin build. Admin: Payments, invoice
  (refund / by hand / handled), the user's floor and payments. Checked: the web flow bought the
  Hall; on the A51 a climb to the High Table arrived live.
- **6b — the paid floors.** Candles and seats by floor (`FloorPerks`), Seek filters (narrow, never
  reorder), the second look, the deep profile (revealed at the fourth seal to members), ger rests,
  the High Table's first seat at the square. Decided (the user may overrule): Figma over the spec —
  the Yard neither fills nor reads the deep profile; ger rests are spent on return, not by a sweep;
  "first seat" is a ten-minute lead after a bell is rung.
- **6c — statistics & ops.** `Stats/`: `stats_daily` by day, metric and five dimensions, 34 metric
  sources, the hourly `StatsSweep`, today counted live by the same SQL. Admin: Dashboard (the
  landing), Statistics with SVG charts and CSV, Deletions, Ops (health reaches QPay, RevenueCat,
  Agora, verify.mn).

## 2026-10-11 — Stage 5: The world

Three daily quests and one weekly fill from play and pay when claimed; the day's third claim
leaves a bounty chest; the seventh dawn has its ceremony. 21 honours and feats with ceremonies and
a case (backfilled at boot). The Encounter Log, the Hearth, the Hold, the Hall of Names. A bond's
Campaign, the weekly trial (the Three Games in Naadam), retiring together. Fated Threads and Invite
an Ally. The Town Square: seats live, paired video rounds (voices only when masked), the bell, two
yeses make a bond. Festivals dress the square and Seek. Admin: Fated Threads, Town Square with the
festival calendar, Codex pages, audit log. Progress and honours flow through one
`IWorldEvents.Raise` inside the caller's transaction.

Decided (the user may overrule): no wax (letters are never gated); the Campaign, weekly trial and
retire sit under the Bond's options and the Campaign map; thread and square bonds may pass a full
fire. Fixed on device: festival ornaments at Figma's opacity; a dropped call shows "connection
lost" after 8 s (Agora never reports "failed" for a lost network) and a rejoin binds the faces
again; the Hold's edge rooms and long honour names were cut off; the admin e2e had been writing
into the dev database (now its own).

## 2026-10-10 — Stage 4½: Account & system

The War Room (pause, sound / haptics / notifications per device, language, the Codex and Terms,
the Frozen Gate), your sigil (a new verify.mn-proven number, other devices signed out), Abandon
(30 days, undone by Keep or any sign-in; the sweep deletes the portraits and the account and frees
the number). "The road is cut" and the letter outbox; "The path falters"; the fire burns low.
Fixed on device: Hermes has no `Intl.PluralRules` (the departing date crashed); "Return to the
Hearth" re-drew the broken screen; a bond opened offline was blank.

## 2026-10-10 — Stage 4: Encounters

The Icebreaker, the Trial, the Flame Rite (a real Agora call the engine counts through the signed
NCS webhook; AccessToken2 built in the engine), meetings at verified venues with pledge / counter /
call-off and "Share safety info", attendance with its outcome table, venue ratings, the Oath
Proven. Admin: Venues with photos, and the user's encounters, no-shows and Oath. The tier-up
ceremony was rebuilt as a Skia light layer on one UI-thread clock. Production refuses to start
with video on and Agora unset. Fixed on device: the World Floor crashed on gradients with alpha
stops; a leave at 0:00 lost the time already shared; the ceremony restarted when Continue
appeared.

## 2026-10-10 — Stage 3: Core loop

Seek with candles, summons, bonds with seats under a row lock, letters and the four seals,
points, the dawn streak and tiers with the tier-up ceremony, embers and gone cold (the 5-minute
`SKIP LOCKED` sweep), sever / cast out / report, the Frozen Gate, the Ascent, the Chronicle of
Deeds, Expo push per device session, nudges. Admin: Reports and the user's score and bonds. The
brass Nameplate and drum counter became NameTitle and the lit points number, in code and Figma.
Fixed on device: a ceremony over a focused composer left the keyboard up (every overlay now puts
it away); the bond options were cream on parchment (a dark menu Sheet); long Mongolian titles and
labels shrink to fit instead of clipping.

## 2026-10-07 — Stage 2: Foundation

Sign up with your phone on a real device, see and edit your Character; the admin shows sign-ups
live.
- **Engine:** verify.mn sign-in; its own sessions (rotating refresh tokens, a 30 s duplicate
  grace, a replay revokes the device); live events only after commit; DB-backed config; portraits
  in a private Supabase bucket (SkiaSharp re-encode, ThumbHash, signed URLs); a separate admin
  scheme with a login throttle; rate limits on every write; the seed CLI and the 48-person crowd;
  Sentry with personal data scrubbed. Tests run on their own throwaway Postgres.
- **App:** tokens, art and glyphs generated from Figma; the World Floor on one Skia canvas; motion
  and feedback tables; 30+ components with a gallery; one gate, no redirects; onboarding resumable
  from the server; a dev Tools screen.
- **Tooling:** `scripts/dev.sh`, `check-all.sh` and CI (three jobs); Maestro flows and a device
  pass that diffs screens against their Figma frames.
- **Decided:** bio limit 300 (Figma); SkiaSharp over ImageSharp (licence); Sheet and Dialog in an
  in-window OverlayHost, not RN Modal; the language switch remounts leaf screens; strict JSON
  numbers so the OpenAPI types are clean.
- **Fixed on device:** a launch SIGSEGV (~1 in 5 relaunches) — react-native-screens 4.28's fix
  backported in `patches/`; the city search dropped keys (now uncontrolled); removing a portrait
  could drop you into onboarding (now `409 photos.min`); a live event for an unmounted screen was
  lost (`refetchOnMount` on); engine errors showed in English in every language; the keyboard
  covered fields; a tale was lost on stepping back.
