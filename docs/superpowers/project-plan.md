# MingldIngl — Plan

The live plan for the initial version. One rule above all: **nothing is designed in code** — an
app whose look is invented screen by screen in code grows costly to change. The product's rules
are below ("Domain Model", "Hard-won rules").

When a stage ships, its record moves to [`shipped-log.md`](shipped-log.md) as a short outcome
summary.

---

# Workflow rules

1. **Figma is the source of truth for everything visible.** If a screen needs something the Figma
   library does not have, it is added to Figma first, approved, then built. Code never invents a
   colour, size, texture, motion or component.
2. **Study before making.** Every art category (gems, materials, ink, stone, ornament, motion) is
   researched from real references first and ends in written rules; assets are made from the rules.
3. **One stage at a time, finished.** Each stage has its own short spec section here, then a plan,
   then the build, then a device check. The next stage starts only after the check.
4. **English first, Mongolian-ready.** Copy is designed in English; every text slot is sized for
   Mongolian (≈1.4× longer) so translation never breaks a layout. Claude writes the Mongolian in
   the same change (the user's call, 2026-10-16).
5. **The style is fixed:** RPG / Warcraft / dungeon-crawler, forged and gamified — stone age →
   bronze age → forged medieval, with a scent of Mongolian heritage. Ink and brush, dark and
   mysterious, iron / gold / ember. Signature elements: ink-stroke glyphs, ink splatter,
   brush strokes, gems that visibly upgrade by tier, animated effects.

---

# Principles (the user's, 2026-10-05 — every stage and review checks against these)

1. **Nothing that bothers or is redundant gets built** (list below). The hard-won rules are in
   "Hard-won rules".
2. **Everything is live.** No pull-to-refresh, no refresh-on-focus, no polling, no "tap to
   reload". The engine pushes a change to every screen that shows it.
3. **No navigation loops or router hell.** One place decides where a person belongs; screens
   never redirect on their own.
4. **Scalable, well-structured architecture** — feature folders with clear boundaries in all
   three projects; no file that grows into a god-object.
5. **No session issues.** Nobody is signed out by a race, a stale token or a relaunch.
6. **No unnecessary cache build-up** — memory and disk caches are bounded and keyed so they cannot
   grow without limit.
7. **No heavy loads, build-ups or jank** — 60 fps on the A51 is the bar.
8. **Motion, sound and haptics are part of the build**, not a later pass.
9. **Mongolian is handled during the build**, not after it.
10. **No git during the build.** Nothing is committed, branched or tagged; the user sets git up
    once the stage is done.

## What is never built

Supabase Auth, anonymous identities and the aliasing middleware; the JWT `user_metadata.phone`
fallback; Supabase Realtime and `subscribeWithRetry`; public `/uploads` and local-disk photos;
hand-written theme files and colour literals; live `react-native-svg` glyphs; pull-to-refresh and
refresh-on-focus; integration tests sharing the dev database; petroglyph carvings; AGENTS.md / SDK
mismatch notes; a migration history (one initial migration).

---

# Roadmap

| Stage | What | Done when |
|---|---|---|
| **0. Visual system** (Figma) | Art study, motion language, tokens, art assets, glyphs, components | The user looks at the library and says "this is the app" — **approved 2026-10-05** |
| **1. Screen designs** (Figma) | Every screen of every feature, built only from stage 0, flows linked | All screens approved; nothing visual left to invent — **approved 2026-10-05** (129 screens, S1–S8) |
| **2. Foundation** (code) | Engine + app + admin; design system coded 1:1; phone sign-in (verify.mn); profile | Sign up and see your profile on a phone — **built 2026-10-07** |
| **3. Core loop** | Discovery, matching, chat, progressive reveal, score & tiers, ghosting | Two real people can match, talk and climb — **shipped 2026-10-10** |
| **4. Encounters** | Icebreaker, quiz, Flame Rite video, dates & venues, no-show check, the Oath | A match can become a real date — **shipped 2026-10-10** |
| **5. The world** | Quests, honours, the road, Campaign, Fated Threads, Recruit an Ally, Town Square | Full game — **shipped 2026-10-11** |
| **6. Business** | Membership & payments (store billing + QPay on the web), admin statistics, launch on the home server (Android first) | Ready for real users — **6a–6c built 2026-10-11; launch (6d) waits on the user's accounts** |

Stack and architecture: see `CLAUDE.md`. Each stage gets its own spec section here before it
starts; when it ships, the spec is pruned to what later stages still need and the record goes to
the shipped log.

---

# Visual system — what was decided (Stage 0, approved 2026-10-05)

The library lives in the Figma file (pages 01–07); code reads it through `scripts/gen-tokens.js`
and `scripts/export-art.py`. The decisions behind it, to check new art and screens against:

- **Gem ladder** — each tier a later age: Garnet raw crystal in rock (stone age) → Opal polished
  cabochon in rawhide (bronze-age nomad) → Amethyst first step cut in riveted iron prongs →
  Sapphire brilliant cut in verdigris bronze with a deer-stone band → Ruby cushion cut in Xiongnu
  animal-style gold, fire inside → Emerald royal cut in gold with Ulzii filigree and a halo. Motion
  grows with the tier (ember pulse → colour flashes → glint → breathing light → inner fire →
  aura, glint, motes). Rules G1–G8: 70–80 % shadow, three light layers, no outlines, the setting is
  the forge, one camera and one light.
- **Type** — Pirata One blackletter, used rarely (English room titles only); Yeseva One display
  (names, numbers, headings; Mongolian room titles too); EB Garamond body and italic.
- **Base colour: Night sky** (replaced the brown, 2026-10-05) — near-black `#060912` with a navy
  glow at the top of the world floor and sparse faint stars; panels `#0f1424`. Warmth comes only
  from fire, gold, wax and gems. Screens are transparent over one World Floor component.
- **The ember** (2026-10-05) — a hidden fire's light rises from below every in-world screen, with
  drifting sparks: component **Ember Glow** nested in World Floor, `Fire` = Lit (default) /
  Roaring (the Hearth, Flame Rite) / Out (gone cold, severed, the Frozen Gate; the admin panel has
  no world floor). The ember is the fire being alive. **In the app it must be animated** (the user,
  2026-10-05: static in Figma on purpose, "animated in real"): each spark a live particle (Skia)
  rising, swaying and fading on its own speed and delay — never one baked sprite sliding up — and
  the glow breathing ±10 % on a 4–6 s loop.
- **Brass hardware** (2026-10-05) — rule: hardware only where two things join or something opens;
  two to four pieces per plate, never a decorative border. Components on page 06: **Fastener**
  (rivet + four screw turns, varied so no neighbours align) — the forged buttons' two dots are now
  rivets; **Corner Cap** (TL/TR/BL/BR, each lit separately) on the Dialog and a *selected* Choice
  Card; **Drawer Pull** as the Sheet's grip; **Clasp** (hasp + padlock) on the locked Notice;
  **Maker's Mark** (a flame in a lozenge, one per plate, never on buttons). The button brass is
  now worn: polished where the thumb presses, tarnished at the ends. Names (Character, Seek card,
  Companion) are no plate: **NameTitle** sets the name in Yeseva with a soft gold glow, the age
  smaller in gold, a gold rule and lozenge beneath (the brass Nameplate was dropped 2026-10-09).
  Leather/felt and wax drips/soot were considered and declined.
  **Points Counter** (in the XP Bar, so the Character screen and the Ascent): the points as a lit
  gold number (Yeseva, glowGold), no leading zeros, no housing (the brass drums were dropped
  2026-10-09); on a gain the units roll first and each carry rolls the next digit (360 ms per
  digit, anvil settle, a metallic tick each). The XP track beside it is a rounded ember→gold
  fill with a glowing tip, and the next gem's art sits after "N to <gem>". **Gate Chain**: a frosted iron chain padlocked across the foot of both Frozen Gate
  screens (on "Let in" the lock drops and the chain slackens). **Hanging Sign**: the Guild House
  screens' title is an old brass Nameplate in blackletter hung on two iron chains (slow 2° sway on
  arrival). Gem settings per tier were already painted into the six gem arts. Painted by
  `~/ComfyUI-models/hardware.py` (height maps, one light from the top-left). Painted by `~/ComfyUI-models/ember.py`; capped so gold link text over it
  stays ≥ 4.5:1.
- **Gold: Rich gold** (replaced the pale gold, 2026-10-05) — gold/500 `#D9A21B`, gold/300
  `#F5C542`, gold/700 `#8F6410`, gold/100 `#FBE6A6`: saturated and warm, like a struck coin.
- **Italic is only the app's voice.** My letters sit on parchment, theirs on dark stone (italic never
  means two things).
- **Motion:** 5 durations (tap 120, shift 240, travel 360, ceremony 1.2–3 s, loop 2.4–6 s), 4
  easings (forge-out, ember-in, anvil, breathe), 17 named motions — on Figma page 02.
- **Art is generated locally** (ComfyUI + FLUX.1 schnell on the RTX 5060), not with Weave.

---

# Stage 1 — Screen inventory (every screen gets a Figma mockup)

Names are the English titles; each screen is designed with its states — **loaded, empty,
loading (waiting), error, and offline** — plus any variant listed. Nothing below is built in code
until its mockup is approved.

**Entry & onboarding**
- Splash / the Gate scene (first launch)
- Prove your number — phone entry
- Verify — verify.mn instruction, one-tap SMS, waiting for the code, expired, resumed session
- Onboarding: name & age → gender → photos (up to 6, reorder, upload failed, permission denied)
  → about (bio, city) → the Oath (Bond / Fate / Kinship) → welcome / first steps
- **City / province select** — the picker (search, province → district/soum, GPS "use my
  location", denied location), used in onboarding and profile edit
- Account suspended ("Cast Out"), account deleted, forced update / maintenance

**Main tabs** (tab bar design included)
- **Seek** — candidate card (sealed photo, name, tier gem, oath, district), summon, pass, daily
  budget used up ("The Realm Rests"), party full ("Your fire is full"), empty ("The tavern is
  empty")
- **Quest Log / matches** — rows per match (sealed / revealed portrait, last letter, whose turn,
  ghosting warning "embers", frozen "Gone cold"), Fated Threads section, empty
- **Missions** — daily quests, quest board, streak, chest, getting-started board
- **Town Square** — next gathering, RSVP, plaza (open / locked / quiet), session status
- **Character** — own profile: character card, tier gem, XP bar, standing, oath card, honours
  preview, deletion-pending banner

**Hubs & rooms**
- **The Hearth** — home hub: sky window by time of day, candle row, destinations
- **The Hold** — the world map / atlas with "you are here"
- **The Ascent** — tier ladder (gems in the cliff), points to next tier, perks per tier
- **Chronicle of Deeds** — score history
- **Hall of Names** — leaderboard
- **Honours** — the honour case (all honours, earned / locked, detail)
- **The Satchel** — inventory (oath, items, chests)
- **Encounter Log** — dates kept, waypoints charted, scars
- **Thread Log** — Fated Threads history

**Match & encounters**
- **The Bond (chat)** — letters, day headings, seal dots / seals sheet, unsealing (reveal level
  up), seal-break row, frozen over (ghosted), quiet, severed, bond-trial card, next-action card,
  composer, chat options (unmatch "Sever this bond?", block "Cast them out?", report)
- **Report** — report sheet, sent, failed
- **Icebreaker** — answer, waiting for partner, reveal together
- **Quiz** — five questions, waiting, compatibility result
- **Flame Rite** — propose, accept, the video call (controls, countdown, connecting, connection
  lost, end "Douse the fire?"), completed
- **Activities** — suggested activities and venues, pledge, date confirmed
- **Venue** — business detail (photos, category, district, rating), venue gone, rate after date
- **Attendance check** — "Did they show up?"
- **The Campaign** — per-match map, rooms, boss, "the seal is broken"
- **Weekly trial** — The Exchange / The Rite cards, claim
- **Retire together** — propose, accept, retired (closing page)
- **Weave a Thread** — Fated Threads: create, invite code, pending, sparked
- **Invite an Ally** — referral

**Town Square live**
- Round screen — waiting for round, round prompt, live video pair, yes/no, it's a match, round
  over, left / leave confirm, join failed, connection error

**Account & settings**
- **The War Room (settings)** — sections, sound, haptics, language, notifications, links
- **Profile edit** — photos grid, name, bio, city (picker), gender (locked), deep profile
  (membership-gated), save / discard
- **Change your sigil** — phone change with verify.mn proof
- **The Frozen Gate** — blocked users
- **The Guild House (membership)** — Yard / Hall / High Table, 1/3/6-month cycles, payment
  hand-off, pending, success, "The Coffers Are Sealed"
- **Abandon this character** — delete account confirm, scheduled, pending
- Guides (the Codex), Terms, Privacy

**Ceremonies, overlays & system**
- Tier-up ceremony, reward / loot toast, chest opening, streak bonus, honour earned, nudge toast,
  generic toast, alert / confirm dialog, bottom sheet, offline banner, error boundary ("The Path
  Falters"), push-notification permission prompt, push notification appearance

**Details that must not be lost**
- **The seven rooms** of the world — The Gate, The Long Road, The Tavern, The Hearth, The Forge,
  The Hall, The Deep — each with its own light and floor texture (no petroglyph frieze); every screen
  belongs to one. Four sky phases (night / dawn / day / dusk) and festival variants (Naadam
  Trials, White Moon Rite) tint them.
- **Share character** — the shareable character-card image with its keepsake line ("N dawns and
  burning"), share-unavailable / failed states.
- **Share safety info** — before a date, send activity + district to a friend.
- **Pause profile** — hide from Seek while keeping matches (War Room toggle).
- **Milestones / feats** (First Bond Forged, Ice Broken, Face to Flame…) and **items / honours**
  (Ally-Caller, Seal-Breaker, Flamekeeper, Cartographer, Mended, Hearthbound, Of the Naadam…) —
  each needs its emblem; the honour detail and the claim moment.
- **Chronicle lines** — every score event has its own icon and sentence (≈22 kinds).
- **Deep profile fields** — kids, habits (smoking, drinking), lifestyle, religion: their pickers.
- **Location** — detecting, denied ("Pick the city you call home"), the 30 province/district
  names.
- **Town Square bell** — "The Nth Bell", the question at the bell, decide.
- **Fated Thread invitations** — share the first / second invitation.
- **Realtime nudges** — new match, message, icebreaker answered, quiz completed, date confirmed.
- **Sound & haptics** — every world event has a haptic and an (opt-in) sound; designed with
  motion.

**Admin panel (mingldingl_control)** — same visual system, desktop layout, calmer and denser
- Login, Dashboard, Analytics, Users list, User detail, Reports, Deletion requests, Business
  list, Business form, Fated Threads (Ships), Town Square sessions, Config, Content pages +
  edit, Audit log, Ops

---

# Stage 2 — Outstanding follow-ups

Stage 2 shipped 2026-10-07 (record in the shipped log; its architecture is in `CLAUDE.md`). Left over:
- **Owed checks:** the Mongolian half of the device pass (`LOCALES=mn .maestro/device-pass.sh
  <device>`); the A51 frame-rate measurement (screen travel, the ember, the counter roll) on a
  production bundle.
- **Needs the user:** `EXPO_PUBLIC_SUPPORT_EMAIL` (the Cast Out screen says "write to them" with
  no way to until then).
- **Settle when deletion is built:** the Deleted screen promises "a new beginning at the Gate", but
  the number stays bound to the deleted account.
- **Known, harmless:** a fast burst into the tale logs React's dev-only "Maximum update depth"
  warning (RN 0.86 multiline TextInput).

---

# Stage 3 — Core loop (spec, written 2026-10-07)

**Done when:** on two phones, two new people find each other in Seek, one summons, both see the
bond made live, they write letters, the seals break at the agreed counts and reveal portraits,
age and district on both sides live, points and tier move (with the tier-up ceremony), one side
falls silent and the bond goes cold with the penalty, and the other can cast them out or report
them — every screen matching its Figma frame, in EN and MN. The Principles above hold unchanged.

**Screens (Figma):** Seek — a companion / the realm rests / your fire is full / the tavern is
empty (26:3, 26:19, 26:138, 26:230); Quest Log — bonds / empty (26:322, 26:470); Bond — new /
talking / a seal breaks / embers / gone cold / severed / options (31:3, 31:97, 31:184, 31:262,
31:343, 31:421, 31:492); Report / Report sent (31:590, 31:686); The Ascent (28:191); Chronicle of
Deeds (28:332); The Frozen Gate — blocked / empty (35:617, 35:692); Ceremony — a bond is made, tier
up 1–3 (36:3, 36:88, 36:147, 36:201); Toast — reward (36:457); the five nudges (70:5304, the
icebreaker/quiz/date ones arrive in stage 4); Push — permission and lock screen (36:678, 36:740);
admin Reports (S8). Rows of Figma that belong to later stages (Fated Threads in the Quest Log,
Share safety info and Break the ice in the Bond) are hidden until their stage.

## Rules

- **Seek** shows one companion at a time: their sealed first portrait (ThumbHash only), name,
  age, tier, province (or "Ulaanbaatar" — the district is a seal's reward; Figma's Seek card shows
  a district, the Bond frames reveal it at the third seal, and the seal wins), oath and their tale. *Summon* makes the bond at once
  (no request/accept): both sides get the "A bond is made" ceremony live. *Pass for tonight*
  hides that person until the next day.
- **Who can be seen:** finished onboarding, Active, opposite gender, neither has cast the other
  out, never bonded before, not passed today, not yourself. Order: same district → same aimag (or
  Ulaanbaatar) → elsewhere; inside each, the same oath first, then nearest tier, then most recently
  seen, then reputation. One indexed SQL query, paged by a cursor — discovery never loads every
  eligible person. No coordinates are stored, so there is no km band and no PostGIS yet.
- **Candles (the daily summon budget):** Free 5 a day, +1 per 50 points and +1 per tier index,
  capped at 12 + tier index (membership floors arrive in stage 6). The day is the Ulaanbaatar
  day from `IClock`; "new candles at dawn" counts down to it.
- **The fire (party seats):** live bonds are capped at 4 + 1 per tier index. A full fire refuses
  a summons ("Your fire is full"); the seat is taken under a row lock so concurrent summons cannot
  overflow it. Severed, cold and faded bonds free their seat.
- **Letters:** text only, 1–1000 characters, rate-limited. Day headings and times are local.
  Whose turn it is = the other side of the last letter.
- **The four seals** (config, counted as `min(letters each)` so a monologue never climbs):
  1st breaks at 5 — the first portrait; 2nd at 10 — the second portrait; 3rd at 15 —
  the third portrait and district; 4th at 30 — every portrait and the rest of the character
  (deep fields arrive with stage 6). Until a seal breaks, the engine sends only the photo's
  ThumbHash. A seal breaking is a live event on both sides with its ceremony row in the letters.
- **Embers and gone cold:** when it has been your turn for 36 h the bond shows embers ("12 hours
  before the fire dies") and you get a push; at 48 h it goes cold: the silent side loses 15 points
  and 5 reputation, both sides are told live and by push, the letters freeze, the seat frees. A
  bond where nobody has written fades quietly after 7 days — no one is at fault. A sweep every 5 minutes finds them with `FOR UPDATE SKIP LOCKED`.
- **Sever this bond** closes the letters for both, no penalty. **Cast them out** (block) severs
  any bond and hides both from each other everywhere; the Frozen Gate lists them and can let them
  in again (they still never re-bond). **Report** (Rude / Asked for money / Not who they claim /
  Under 18 / Something else, an optional note ≤1000) goes to the admin; nothing happens to
  anyone's points until an admin decides: dismiss, penalise (−30 points, −10 reputation) or cast
  out the account (suspend).
- **Points (stage 3 events):** a finished character +50 (paid once, also to stage-2 accounts; below Opal, so the first gem takes doing — 2026-10-15);
  the first letter of a bond +10; a reply +10, at most 10 per bond per day; returning each day
  +5 × streak (streak capped at 7, +50 on the seventh dawn); gone cold −15; penalised −30. Every
  change is one row in the score ledger (the Chronicle of Deeds) with its kind and amount; points
  never go below 0. Icebreaker, quiz, dates and quests add their kinds in later stages.
- **Tiers** from points: Garnet 0 → Opal 100 → Amethyst 300 → Sapphire 600 → Ruby 1000 →
  Emerald 2000 (config, strictly increasing). A tier change raises the three-part tier-up
  ceremony once, on whichever device is open, and is never replayed.
- **Reputation** (0–100, starts at 100) is not shown as a number; it only orders Seek.
- **Live events (new kinds):** `bond.created`, `bond.updated` (seal, turn, embers, cold,
  severed), `letter.created`, `score.changed`, `seek.changed` (candles or fire changed),
  `block.changed`; admin `report.created`. Each still carries only `{ kind, ids }`.
- **Push** (Expo push service): asked for only after the "May we ring for you?" screen, which
  appears after the first bond is made. Kinds: a letter, a bond made, embers, gone cold. Copy is
  one table of EN + MN lines, sent after commit and off the request
  path; tokens are per device session and dropped when that session is revoked. No push while the
  app is open on that bond.
- **Nudges:** a live event for something not on screen shows the matching nudge toast
  (Figma 70:5304) with its haptic and sound from the feedback table.
- **Admin:** Reports (list, detail with the bond's last letters for context, resolve), and the
  user detail gains points, tier, reputation, live bonds and the score ledger. New config keys for
  every number above.

## Stage 3 — Where it stands

Shipped 2026-10-10 (record in the shipped log). Still owed, none blocking stage 4: Firebase for
Android push (the user), a Figma frame for
Companion if wanted.

## What stays out of stage 3

Icebreaker, quiz, Flame Rite, dates, venues (stage 4); quests, streak chest, honours, the Hearth,
Hold, Hall of Names, Fated Threads, Town Square (stage 5); membership, deep profile (stage 6).

---

# Stage 4 — Encounters (spec, written 2026-10-10; shipped 2026-10-10)

**Done when:** on two phones, a bond at the first seal answers the icebreaker (both answers open
together), takes the five-question Trial and sees the same score, lights the Flame Rite and holds
a real 5-minute Agora call that the engine counts, picks a verified venue and both pledge, then
after the meeting both answer "Did they come?" — a kept encounter on both sides, the venue rated,
and after a second kept encounter the Oath turns Proven — with a no-show and "I could not go"
also exercised, all live, every screen matching its Figma frame in EN and MN. The admin adds,
edits and removes a venue. The Principles hold unchanged.

**Screens (Figma):** Icebreaker — answer / waiting / revealed (31:755, 31:827, 31:892); Quiz —
question / result (31:962, 31:1056); Flame Rite — propose / they proposed / completed (33:979,
33:1050, 33:1346); Video — live / connecting / connection lost / douse (33:1120, 33:1141, 33:1210,
33:1279); Activities — where to meet / pledge / meeting sworn (33:1414, 33:1487, 33:1566); Venue —
detail / gone (33:1635, 33:1701); Rate the venue (33:1765); Attendance (33:1845); the Bond's
next-action card (the hidden "Break the ice" row of the Bond frames) and the icebreaker / quiz /
date nudges (70:5304); admin Venues and Venue form (39:582, 39:667). The Bond options' "Share
safety info" row turns on. The Encounter Log, waypoints and scars as screens are stage 5; stage 4
stores what they need.

## Rules

- **What opens when** (each a config key; letters are never gated): the **Icebreaker** at the 1st
  seal; the **Trial** (quiz) at the 2nd seal; the **Flame Rite** once both answered the
  icebreaker; **choosing a meeting** at the 3rd seal and, while `video.required` is on, after a
  completed Rite. The Bond shows one next-action card for the earliest open step not yet done
  (icebreaker → trial → rite → meeting); each opening is a live event and a nudge. Only Live
  bonds run encounters; a bond that goes cold, is severed or faded cancels its open steps.
- **Icebreaker:** a bank of questions in the DB (seeded in English; admin editing is stage 5's
  Codex). The engine picks one per bond at the 1st seal, not seen by either before. Each answers
  once, 1–300 characters, and cannot change it. Neither sees the other's answer until both
  answered; then it opens for both live. +20 to each on the reveal (once per person per bond).
- **The Trial (quiz):** a bank of questions with four choices each; the engine picks five per
  bond at the 2nd seal. Each answers all five (in order; a half-finished trial resumes). When both
  are done the result opens for both: the match % = same answers / 5, "Kindred in N of five", and
  a summary line built from per-question "same" / "differ" phrases written with each question.
  +15 to each on the result.
- **Flame Rite:** either side proposes; the other accepts or says "not now" (the proposer may
  propose again after `video.reproposeHours`). An accepted Rite opens a call: the engine creates an
  Agora channel per attempt and issues each side an RTC token valid for the call plus a minute.
  The 5 minutes run from the moment the second person joins (as the engine learns it) and the
  call ends itself at 0:00 for both. **Completion is never the app's word**: in
  production Agora's webhook (NCS, signed with the secret) reports joins and leaves; the Rite is
  completed when both were in the channel together for ≥ `video.minSeconds` (60). In Development
  (no public URL for webhooks) both apps report join/leave and the engine accepts the overlap only
  inside the token's window. Completion pays +30 to each, once per bond. Either side can douse the
  fire (ends the call for both, no penalty); a lost connection offers "Try again" (a new attempt,
  the five minutes start over). Calls are never recorded; only attempt start/end and completion
  are stored. `video.enabled` off hides the Rite and lifts its gate (kill switch hides the entry).
- **Meetings:** at the 3rd seal (and after the Rite while required) either side opens "Where
  shall you meet?" — Active, verified venues ordered by the bond's districts (either side's, as
  revealed at the 3rd seal) then rating — picks one, a day and a time (from now + 2 h to 30 days,
  Ulaanbaatar time) and pledges. The other pledges too (sworn) or suggests another time (a new
  proposal replacing the first; the proposer's pledge is dropped). One open or sworn meeting per
  bond at a time. **Sworn:** +50 to each, live on both sides, a push; "Share safety info" opens
  the phone's share sheet with the venue, its district, address and the time. Either side may call
  off a sworn meeting until it starts, without penalty (the other is told live and by push).
- **Attendance:** `attendance.afterHours` (3) after the meeting time both get "Did <name> come?"
  (a push and a card in the Bond) with `attendance.windowHours` (48) to answer. Answers: *We met*,
  *They did not come*, *I could not go*. Each answer is private. Outcome when both answered or the
  window closes:
  - both *We met* → **kept**: an encounter row for each (venue, time), each may rate the venue
    1–5 once (Rate the venue, skippable);
  - *They did not come* from one side → a **no-show** recorded against the other — unless the
    other answered *We met* or *They did not come* too (a disagreement: recorded as disputed, no
    one penalised); if the other answered *I could not go*, honesty closes it with no penalty;
    only silence from the other lets the no-show stand. A third no-show inside `attendance.noShowDays` (90) costs
    `reputation.noShow` (10);
  - *I could not go* → closed, no penalty for either side; no answer is the same as no claim
    (one *We met* and silence: not kept, no penalty).
  The sweep (stage 3's 5-minute `SKIP LOCKED` loop) opens checks and closes expired windows.
- **The Oath:** Sworn at onboarding; **Proven** after `oath.provenEncounters` (2) kept encounters
  with anyone: +40 once, a reward toast, Character's oath row reads "Proven".
- **Venues:** kinds Cafe / Restaurant / Bar / Entertainment / Outdoor / Culture; name (EN and
  MN), kind, district (the city picker's keys), address, hours, a short
  description, up to 4 photos (the private bucket, signed URLs, re-encoded like portraits),
  verified flag. Rating = mean of ratings from kept encounters, with the count. Removing a venue
  hides it from new meetings; a meeting already pointing at it shows "This place is gone —
  choose another" until rechosen. No featured placement (design intent only).
- **Points (stage 4 kinds):** icebreaker +20, trial +15, Flame Rite +30, meeting sworn +50, Oath
  proven +40 — each one ledger row with its kind, all config.
- **Live events (new kinds):** `encounter.updated` (any icebreaker / trial / rite / meeting /
  attendance change on a bond: `{ ids: [bondId] }`), `video.call` (start / end of an attempt, to
  both sides), `venue.updated`; admin `venue.updated`. **Push kinds:** a Rite proposed, a meeting
  proposed, a meeting sworn, a meeting called off, the attendance check.
- **Admin:** Venues (list, add, edit, verify, remove, photos), and the user record gains
  encounters kept, no-shows (with disputes) and the Oath state. New config keys for every number
  above.

## Engine shape

New feature folders, each talking to the others only through services: **`Encounters/`**
(icebreaker, trial, meetings, attendance, the next-step rule and its sweep), **`Video/`** (Agora
token builder, attempts, the NCS webhook, the dev report path), **`Venues/`** (venues, photos,
ratings, admin endpoints). Question banks are seeded by migration-time seed data in `Encounters/`.
Agora's app ID and certificate come from `Agora:AppId` / `Agora:AppCertificate` , the webhook secret from `Agora:NcsSecret`; startup refuses `video.enabled`
outside Development without them.

## Stage 4 — Where it stands

Shipped 2026-10-10 (record in the shipped log). Still owed, none blocking stage 5: the Agora NCS
webhook URL once the engine is public, photos
for the seeded venues.

## What stays out of stage 4

The Encounter Log, waypoints, scars, honours and the Campaign as screens (stage 5); venue featured
placement and partner dashboards (out of scope); deep-profile fields in the 4th seal (stage 6).

---

# Stage 4½ — Account & system (spec, written 2026-10-10)

The user's order (2026-10-10): every remaining Figma screen, in blocks — this block, then stage 5,
then stage 6 — checking in after each.

**Done when:** from Character's "⋮" the War Room opens and every row works on the A51: pause hides
you from Seek (bonds go on), sound / haptics / notifications switch per device, language switches,
your sigil moves to a new proven number (other devices signed out), the Codex and Terms read from
the engine, Abandon schedules deletion and "Keep my character" undoes it; offline shows "the road
is cut" and a letter written then goes out when the road opens; a crash shows "The path falters";
after 40 minutes the fire burns low. EN and pseudo-MN fit.

**Screens (Figma):** War Room 35:3, Change your sigil 35:547 (then the Verify screens), Abandon
confirm 35:1054, Deletion scheduled 35:1121, Deletion pending banner 35:1187, Codex 35:1254 and
reading page 35:1348, Terms & Privacy 35:1410, Offline 36:535, Error 36:614, Rest 45:639. The
push ask (36:678) exists. "Your floor" shows The Yard and opens nothing until stage 6.

## Rules

- **Pause:** a profile flag; Seek never shows a paused or departing character. Bonds, letters and
  encounters go on.
- **Your sigil:** the same verify.mn proof, started from inside the world; a number another
  account holds is refused (`409 auth.phone_taken`). Completing it moves the account to the new
  number and revokes every other device.
- **Abandon:** schedules deletion `account.deleteDays` (30) ahead; the person stays signed in and
  hidden from Seek, Character shows "fades in N days", and "Keep my character" (or any sign-in
  before the day) cancels it. On the day the sweep burns it: photo files, then the account row
  (everything cascades); the other side of each bond hears it live. The number is free again —
  which settles stage 2's "a new beginning at the Gate".
- **Codex:** pages in the DB (slug, kind guide/legal, order, title, summary, body per locale),
  seeded in English at boot; the admin edits them in the admin block. `codex.updated` live.
- **Offline:** the road is cut when the live connection has been down 5 s; a letter written then
  waits in an in-memory outbox (shown as unsent) and goes out, in order, when the road opens.
- **Rest:** device-local; after `app.restMinutes` (40, 0 = off) of continuous foreground use the
  floor dims over a minute, then "The fire burns low". Rest now leaves the app; A little longer
  starts the count again. Never a lockout.
- **Error:** an error boundary on the world shows "The path falters"; "Return to the Hearth"
  retries and goes home (Seek until the Hearth exists).

## Stage 4½ — Where it stands

Shipped 2026-10-10 (shipped log). Owed: the
Codex's guide texts other than "The fire and the cold" were written from the rules, not Figma —
the user may want to reword them (admin editing comes with the admin block). Next: stage 5.

---

# Stage 5 — The world (spec, written 2026-10-10; shipped 2026-10-11)

**Done when:** on two phones every Stage 5 frame works live and matches Figma in EN and pseudo-MN:
today's quests fill as you play and pay when claimed, a chest opens, the seventh dawn lands its
ceremony; honours are earned with their ceremony and fill the case; the Encounter Log shows word,
scars and waypoints; the Hearth, the Hold and the Hall of Names open; a bond's Campaign clears
chambers as the pair plays, the week's Trial is answered by both, and a pair that met retires
together; a thread is woven between two numbers and sparks; an ally's code brings a new person in;
a Town Square bell is rung in the admin, two phones take seats, meet in a live round, both say yes
and a bond is made; a festival changes the square and Seek. The admin edits Codex pages and sees
the audit log. The Principles hold unchanged.

Built in five blocks, in this order: **5a the road** (missions, chests, honours, Encounter Log,
Hearth, Hold, Hall of Names, keepsake), **5b the bond's road** (Campaign, weekly Trial, retire
together), **5c threads & allies**, **5d Town Square & festivals**, **5e admin** (Codex pages,
audit log).

**Screens (Figma):** Missions 26:570; Town Square — next gathering / seat held / quiet (26:717,
26:820, 26:929); Character's rows 26:1029; the Hearth 28:3; the Hold 28:109; Hall of Names 28:429;
Honours — case / detail (28:556, 28:679); the Satchel 28:743; Encounter Log 28:840; Thread Log
28:937; Share character — keepsake 28:1019; the Campaign 33:1929; Weekly trial 33:1991; Retire
together — propose / they asked / done (33:2059, 33:2129, 33:2199); Weave a thread / invitations
(33:2263, 33:2338); Invite an Ally 33:2411; Square live — waiting / live round / the bell / match /
not this time / closed / leave / join failed / connection lost (34:3–34:489); festivals — Tsagaan
Sar, Naadam bell, last bell of the year, Day of the Bond, March 8, the Three Games trial, the
masked round, Seek during Tsagaan Sar (47:479–47:1206); ceremonies — chest 36:266, honour earned
36:329 and 97:730, seven dawns 36:388; the Quest Log's Fated Threads row (26:322); admin — Fated
Threads 39:751, Town Square 39:831, Codex pages / edit (39:1015, 39:1095), audit log 39:1163.
Dashboard, analytics, deletions and ops are stage 6.

## Rules

**5a — the road**
- **Quests:** each Ulaanbaatar day everyone gets three daily quests, and each week (Mon–Sun) one
  weekly quest, drawn from a pool in the engine (kind, target, points, all config): *Light the
  hearth* (return today, 1, +20), *Answer three letters* (3 replies, +30), *Write a first letter*
  (1, +20), *Summon a companion* (1, +15), *Break the ice with someone* (1 icebreaker answered,
  +25), *Take a trial* (1, +25); weekly *Keep a pledged encounter* (1 kept, +50), *Light the Flame
  Rite* (1 completed, +40), *Break a seal* (1, +40). The draw is fixed per person per day (seeded
  by account and day) and never offers what cannot be done (no summons left → no summon quest).
  Progress comes from the events that already happen (letters, summons, encounters) — never from
  the app. A finished quest reads "Done — claim your bounty"; claiming pays its points (kind
  `quest`). Claiming the last of the day's three puts a **bounty chest** in the Satchel.
- **Chest:** opening it shows what is inside first (no gamble), then pays `chest.points` (30,
  kind `chest`). Chests do not expire. **Wax is not built:** Figma's chest and Satchel show
  "1 wax / three seals to send letters", but letters are never gated, so the chest holds points
  only and the Satchel has no wax row.
- **Seven dawns:** the streak dots on Missions are stage 3's return streak; the seventh dawn's
  +50 now raises the "Seven dawns" ceremony once.
- **Honours** — 14 honours and 7 feats, each with its emblem (Figma "Art — Honours & feats"),
  earned once (the two festival honours once per year, the count shown), never lost, no points:
  Seal-Breaker (break a first seal), Bond-Keeper (a bond reaches the fourth seal), Flamekeeper
  (three Flame Rites completed), True to Word (five kept encounters and no no-show against you),
  Oath-Keeper (every chamber of one Campaign cleared), Seven Dawns (a seven-dawn streak), Ally-Caller (an
  ally answered your call), Thread-Weaver (a thread you wove sparked), Fate-Seer (two yeses at the
  Town Square), Mended (a scar closed), Cartographer (three districts charted), Hearthbound
  (retired together), Of the Naadam / Of Tsagaan Sar (a kept encounter during that festival);
  feats First Bond Forged, Ice Broken, First Trial Taken, Ten Words Exchanged (ten letters in one
  bond), First Encounter Pledged, Face to Flame, Oath Fulfilled. Earning one is a live event and
  the honour-earned ceremony; the case shows earned ones and "???" for the rest; the detail shows
  the earned date in the world's calendar ("the fourth dawn of the tenth moon"), what it was for
  and its line. Existing accounts are backfilled from their history at boot, without ceremony.
- **Encounter Log:** *Word* = kept of (kept + no-shows against you); *Scars* — going cold on
  someone leaves a scar; two kept encounters after it close it (Mended); *Waypoints* — each
  district a kept encounter's venue stands in is charted (three → Cartographer); *Season* — the
  current or next festival's honour line. Then every encounter, newest first: name · venue, the
  outcome and what was charted.
- **The Satchel:** your Oath (state), unopened chests, keepsakes (the character card).
  **Keepsake:** your card (first portrait, name, gem, tier, "N dawns and burning" + a line) shared
  as an image through the share sheet; "share unavailable" if the phone has none.
- **Character** gains rows Honours (N of 21), the Satchel (count), Encounter Log (districts
  charted), as Figma 26:1029.
- **The Hearth:** the home hub. The ← on every tab room opens it; it opens nothing on launch
  (Seek stays the landing). Sky window by the Ulaanbaatar hour (night / dawn / day / dusk) with its
  line ("Dusk. The fire is lit."), the candles row = today's summons left, six doors: the Fire →
  Seek, Letters → Quest Log, the Square, the Forge → Missions, the Mirror → Character, the
  Satchel. Its ⋮ opens the Hold.
- **The Hold:** the seven rooms on the mountain; tapping one goes there — the Gate → Invite an
  Ally, the Tavern → Seek, the Long Road → Quest Log, the Hearth, the Forge → Missions, the Hall →
  Hall of Names, the Deep → Encounter Log. "You are at the Hearth" (or wherever you came from).
- **Hall of Names:** your cohort (Ulaanbaatar, or your aimag), the top five by points as "a sigil
  in the stone" with their gem and points (names hidden), "…", then
  your torch with your rank. Paused, departing and retired characters are not listed; the foot
  counts pairs retired together. Refreshed live on `score.changed` for your own row, the top
  five at most once a minute (cached in the engine).

**5b — the bond's road**
- **The Campaign** (per Live bond, from the Bond's ⋮ or its next-action area): seven chambers,
  each opened by a deed the pair does together — letters exchanged, the first seal, the
  icebreaker, the Trial, the Flame Rite, the third seal, and the boss: a kept encounter. Each
  chamber pays `campaign.room` (+5) to both, the boss `campaign.boss` (+25); all seven cleared earn
  Oath-Keeper. The Campaign then stays cleared and the bond goes on. Existing bonds are backfilled without points.
- **Weekly trial:** every Live bond past the first seal gets one prompt a week (Mon–Sun) from a
  bank ("The Exchange: each tell the other one thing you have never told anyone here"); answered
  like the icebreaker (1–300 chars, hidden until both answered) for +25 each. During Naadam it is
  **the Three Games**: strength (who gives way in an argument — each picks *I do* / *They do*),
  aim (guess their answer to a four-choice question; they answer it for themselves), speed (a
  prompt answered within an hour of opening it); +25 each per game won by both answering
  (aim and strength pay whatever the answers). Ends Sunday midnight; an unanswered trial lapses
  quietly.
- **Retire together:** after at least one kept encounter in the bond, either side asks; the other
  retires too or says not now. Retiring closes this bond as complete (it stays in the Quest Log),
  pauses both characters (out of Seek, the Hall and the square), closes their other Live bonds
  quietly (the other side reads "retired from the road", no penalty), and earns Hearthbound. The
  War Room's Pause can bring a retired character back to Seek later; the bond stays complete.

**5c — threads & allies**
- **Weave a thread:** two Mongolian numbers, not your own, not the same, at most
  `threads.perDay` (2) a day. Each person gets an invitation the weaver shares (share sheet;
  first and second separately) with a code. A number that already has an account sees the
  thread in its Quest Log ("A thread from Bat — woven by Bat · waiting for both") as soon as it
  is woven; a new person who signs up with that number finds it there too (the number is the
  key; the code only opens the app to it). Each answers *Yes* / *No* privately, never learning
  the other's name before both say yes. Two yeses and the pair eligible (one rule with Seek:
  opposite gender, no cast-out, never bonded, both Active and not paused) → a bond is made for
  both (no candle spent, and like the square it may go past a full fire — a friend's thread is rare,
  two a day per weaver) and the weaver earns `threads.sparked` (+40) and
  Thread-Weaver. A No, an ineligible pair or `threads.expireDays` (14) without both answers cuts
  the thread; the weaver sees only Sparked / Waiting / Cut in the Thread Log.
- **Invite an Ally:** everyone has one code (`MNKH-4821` form). The share text carries the code
  and the app link; opening the link stores the code on the phone, and the sign-up that follows
  carries it. When that person finishes their character, both earn `ally.bounty` (+50, kind
  `ally`) and the caller gets Ally-Caller; "N allies have answered".
- Admin Fated Threads: every thread (weaver, masked numbers, woven, status).

**5d — Town Square & festivals**
- **Gatherings** are rung in the admin: a name ("the Fourth Bell"), a time, rounds (6), round
  minutes (5), seats (16, half for each gender — the square pairs strictly man × woman), an optional festival and the masked flag. The Square tab shows the next gathering,
  "Take a seat" while your side has room ("12 of 16 seats taken"), "Your seat is held" after, and
  "The square stands quiet" when none is rung. Paused, departing or retired characters cannot
  sit. Giving up a seat frees it. A minute before, a push calls the seated.
- **The night:** the seated who open the square join; at each bell the engine pairs the present
  by gender, never two who are bonded, cast out or already met that night, preferring the same
  oath; an odd one out waits the round ("the square is filling"). A pair gets an Agora channel and
  tokens for the round; the round's question shows at the foot; 5 minutes, then **the bell**:
  Yes / No within `square.decideSeconds` (30). Two yeses → a bond is made at once for both (no
  candle; it may exceed the fire — the square's one exception), Fate-Seer to both; otherwise "Not
  this time" (neither learns the other's choice). After the last round "The square has closed — N
  bonds made tonight". Everyone who sat through at least one round earns `square.attend` (+10,
  kind `square`). Leaving gives up the remaining rounds; a dropped connection
  rejoins the round in progress if it is still running ("connection lost" → retry), otherwise
  waits for the next ("couldn't join the round").
- **The masked round:** in a masked gathering cameras stay off — voices only — until the bell.
- **Festivals** (a calendar the admin keeps; seeded: Tsagaan Sar — the dates set yearly, Naadam
  July 11–15, Day of the Bond Feb 14, March 8, the last bell Dec 30): while one runs, its bell
  card and header art replace the square's, Seek shows its banner ("Tsagaan Sar is here. Keep an
  encounter this season for its honour") and its title reads "The Tavern", the Encounter Log's
  Season line names it, the weekly trial becomes the Three Games during Naadam, and a kept
  encounter earns the festival's honour.
- Admin Town Square: list (bell, when, seats, rounds, status · bonds made), "Ring a new bell",
  edit before it opens, cancel (seated people are told).

**5e — admin**
- **Codex pages:** list (page, languages, updated, status — "Needs MN" when the Mongolian body is
  empty) and the edit form (title, summary, body per locale, order, kind); saving fires
  `codex.updated`.
- **Audit log:** every admin write (report resolved, config changed, venue edited, user cast out,
  bell rung, codex saved) is one row: when, keeper, action, target. Written in the same
  transaction as the change.

**Points (stage 5 kinds, all config):** quest (per quest), chest +30, campaignRoom +5,
campaignBoss +25, weeklyTrial +25, threadSparked +40, ally +50, square +10.

**Live events (new kinds):** `quests.updated`, `honour.earned`, `campaign.updated`,
`trial.updated` (weekly), `retire.updated`, `thread.updated`, `square.updated` (gathering, seat,
round, pair, bell, result — `{ ids: [gatheringId] }`), `festival.updated`; admin `thread.updated`,
`square.updated`, `audit.created`. **Push kinds:** a thread woven for you, a thread sparked, the
square's bell in a minute, a retire request, the week's trial opened.

## Engine shape

New feature folders: **`Quests/`** (pool, daily/weekly draw, progress from domain events,
claims, chests), **`Honours/`** (the 21 definitions, award + backfill, Encounter Log standing,
scars and waypoints), **`Hall/`** (cohort leaderboard), **`Campaign/`** (chambers, weekly trial,
retire), **`Threads/`** (threads, allies), **`Square/`** (gatherings, seats, rounds, pairing,
decisions; Agora tokens through `Video/`), **`Festivals/`**; `Admin/` gains Codex pages, threads,
gatherings and the audit log. Progress and honours hook in through one in-process domain-event
call (`IWorldEvents.Raise(...)`) that services already making the change invoke inside their
transaction — no feature reads another's tables.

## Stage 5 — Where it stands

Shipped 2026-10-11 (record and decisions in the shipped log). Owed, none blocking stage 6:
The Hearth's night / dawn / day skies (Figma
paints dusk only); Naadam's pennant art; Firebase push (the user). Next: stage 6.

---

# Stage 6 — Business (spec, written 2026-10-11)

**Done when:** on the A51 a person buys the Hall through Google Play (a test track) and the floor
appears live; on the web pay page another buys the High Table with a QPay QR (sandbox) and the app
shows it live; a paid floor's seats, summons, deep profile, Seek filters, Second look and Ger rest
work, and losing the floor takes them away without breaking a bond; a stuck QPay invoice is found
by the sweep and credited, and an uncreditable one is refunded from the admin; the admin's
Dashboard, every Statistics page (with its filters and CSV) and the ops pages show true numbers;
the engine and admin run on the home server reachable over HTTPS; a closed-test Play build runs
against it. Every new screen exists in Figma first and the user has seen it. EN and pseudo-MN fit.
The Principles hold unchanged.

Decided with the user 2026-10-11: **both** store billing (in the app) and QPay (on the web);
QPay is paid per cycle, never auto-renewed; **Android first** (iOS once there is an Apple
account and an iPhone to check on); the engine and admin go on **the home server** (myserver,
192.168.1.102). **No one's money may ever be locked**: every payment ends credited or refunded.
Perks built: seats/summons, deep profile, Seek filters, Second look, Ger rest, High Table's first
seat. Not in stage 6: Travel mode, Fun tags, cosmetics (they need new art).

Built in four blocks, each checked before the next: **6a membership & payments**, **6b the paid
floors**, **6c admin statistics & ops**, **6d launch**. Figma first for every block: the Guild
House screens are checked against S7 and anything missing is drawn (the web pay page, payment
states, "refund on its way", filters, Second look, Ger rest, deep-profile pickers, the admin
Dashboard, every Statistics page, Payments, Deletion requests, Health), shown to the user, then
built.

## Rules

**6a — membership & payments**
- **One membership record per person** decides the floor: floor (Yard / Hall / High Table),
  source (store / qpay), ends at. Several sources at once → the highest floor; QPay time bought
  while a store subscription runs starts when the store period ends (nothing paid is lost).
  `membership.updated` live to the person and the admin. The app only reads it.
- **In the app (store):** the Guild House (Figma S7): floors, 1/3/6-month store products,
  Google's purchase sheet through **RevenueCat**, then pending → success live. RevenueCat's
  webhook (signed, `RevenueCat:WebhookAuth`) is the only thing that grants, renews, expires or
  revokes a store floor — and the engine never takes the word of the webhook or the app: either one
  only prompts it to ask RevenueCat (`/v1/subscribers/{account}`) and store exactly what is there,
  so a missed webhook loses nothing (the app asks right after a purchase). RevenueCat acknowledges
  the purchase to Google itself.
- **On the web (QPay):** a small page `/guild` served with the admin build (its own route, the
  app's visual system): sign in with verify.mn (the same flow, a web session that holds only
  membership rights), pick a floor and 1/3/6 months (0/10/20 % off, prices admin config:
  Hall 10,900₮, High Table 21,900₮ a month), pay by QPay QR (or a bank deep link on a phone).
  The app never links to or names the page (store rule).
- **No locked money (QPay):** an invoice row is written before the QR is shown (idempotency key,
  amount, floor, months). QPay's callback credits it; the sweep also asks QPay `payment/check`
  for every open invoice until it expires, so a lost callback never loses a payment; a payment
  that lands after expiry is still credited. A paid invoice that cannot be credited (account
  gone, paid twice) goes to the admin's "Needs attention" with a one-click QPay refund; the page
  shows "refund on its way". Every credit, refund and expiry is one payments row, written in the
  same transaction as the membership change, and shown on the admin user page.
- **Ending:** QPay time never renews; three days before a floor ends a push says so (no
  countdowns, no "last chance"). Abandon says plainly that a store subscription must be cancelled
  in Google Play (link) and that QPay time left is not refunded, before the person confirms.
- **Kill switch:** `membership.enabled` off hides the Guild House entry and the web page.

**6b — the paid floors**
- Hall: 12 summons a day (cap 25), +2 party seats; High Table: 20 (cap 40), +4 — config keys as
  decided 2026-10-05. Losing a floor never breaks a bond; it only blocks new ones until under the
  cap.
- **Deep profile:** children, smoking, drinking, faith, lifestyle (pickers from Figma). Members fill
  it and read another's, only after the 4th seal (Figma 35:475: the Yard sees it sealed).
- **Seek filters** (Hall+): age range, district, oath, deep-profile answers. They narrow, never
  rank — paying never raises anyone in someone else's Seek.
- **Second look** (Hall+): bring back today's last pass, once a day.
- **Ger rest:** keeps the seven-dawn streak over a missed day — Hall 1, High Table 2 a moon,
  spent automatically when the person returns.
- **High Table's first seat:** for `square.highTableLeadMinutes` (10) after a bell is rung only the
  High Table may take a seat; then everyone.
- Paying never buys score, tier, reputation or forgiveness.

**6c — admin statistics & ops**
- **Dashboard:** today, live — sign-ups, active people, bonds, letters, encounters kept, money
  in, and "Needs attention" (reports, stuck payments, deletions).
- **Statistics**, every chart with a range (day / week / month / custom) and filters (city/aimag,
  gender, age band, tier, floor), each table exportable as CSV:
  - Growth — sign-ups, onboarding drop-off per step, allies, threads woven/sparked;
  - Engagement — DAU/MAU, the dawn-streak spread, quests claimed, time in app;
  - Matching — summons sent/answered, bonds by source (Seek / thread / square), seals broken,
    bonds gone cold or severed, the ghosting rate;
  - Encounters — icebreakers, trials, Rites, meetings sworn/kept/no-show, top venues;
  - Town Square — seats filled, rounds, yes rate, bonds per bell;
  - Money — revenue by floor, cycle and channel, new/renewed/lapsed members, refunds, Yard → paid
    conversion;
  - Cohorts — share of each sign-up week active on day 1, 7, 30.
- **How it is counted:** a nightly job writes daily rollups (one table, keyed by day and the
  filter dimensions); today is counted live. Nothing heavy on the request path.
- **Ops:** Deletion requests; Payments (search, refund, stuck invoices); Health (engine version,
  DB size, sweep and outbox state, Agora and QPay reachable, last backup). Every keeper write is
  in the audit log.

**6d — launch (Android)**
- **The home server** (myserver): the engine, admin and `/guild` page run natively (no
  Docker: systemd engine, nginx static pages, `scripts/server/`) with their secrets, Postgres on the server, reached from the internet over
  HTTPS through a tunnel (no router port forwarding; the domain is the user's). Nightly backups,
  and one restore actually done.
- Agora NCS webhook URL, Firebase push (the user's `google-services.json` + FCM key), QPay
  merchant account (the user), RevenueCat project + Play products, Sentry for app and admin.
- Play listing: screenshots, data-safety form, privacy policy and terms (from the Codex), store
  text in EN and MN (Claude writes the MN), content rating; the 18+ gate is onboarding's.
- A closed test track with real testers, then a last check against the Principles and a load
  test of Seek and the Square with the seed crowd.

**Live events (new kinds):** `membership.updated`, `payment.updated` (web page); admin
`payment.updated`, `stats.updated` (the dashboard's today). **Push kinds:** a floor ending in
three days, a refund sent.

## Engine shape

New feature folders: **`Membership/`** (the record, floor rules, perks queries other features
call), **`Payments/`** (QPay client, invoices, callback, check sweep, refunds; RevenueCat
webhook), **`Stats/`** (rollup job, queries, CSV); `Admin/` gains dashboard, statistics, payments,
deletions, health. Seek, Bonds, Square and the streak ask `Membership` for a person's floor —
they never read payments.

## Stage 6 — Launch (6d)

**6d — launch checklist** (the server parts are scripted; the accounts are the user's):
1. *Server* — myserver on (it was off the network on 2026-10-11) with its LAN address reserved;
   no Docker (removed 2026-10-17); `./scripts/deploy.sh --setup` installs `scripts/server/` (systemd units,
   nginx, the `mingldingl` Postgres role, the backup timer) and `/etc/mingldingl/engine.env` from
   `scripts/server/engine.env.example`. `./scripts/deploy.sh` builds here and ships the engine and web
   (panel + `/guild/`); `./scripts/restore-check.sh` restores the newest backup into a throwaway database.
2. *Domain + tunnel* (user) — a domain on Cloudflare; a tunnel with two public hostnames: the API →
   `http://localhost:8080`, the panel → `http://localhost:8081` (the web page is its `/guild/`); its token as
   `TUNNEL_TOKEN` in the server's `engine.env`, then `./scripts/deploy.sh --tunnel`. `PUBLIC_API_URL`, `QPay__CallbackBase`, `Cors__AllowedOrigins` to match.
3. *Accounts* (user) — QPay merchant (client id/secret, invoice code); Google Play Console app
   `com.mingldingl.app` with subscriptions `hall` and `high_table` (base plans `m1`, `m3`, `m6`,
   priced as config); RevenueCat project (Play service account, entitlements `hall` /
   `high_table`, webhook `POST {API}/payments/revenuecat` with the `.env` Authorization value);
   Firebase `google-services.json` + FCM V1 key on EAS; Sentry DSNs; Agora NCS webhook URL
   `{API}/video/ncs`.
4. *EAS production env* — `EXPO_PUBLIC_API_URL` (the API hostname),
   `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_SUPPORT_EMAIL`;
   then `eas build --profile production --platform android` and a closed-testing track.
5. *Listing* — the EN draft below; MN by Claude; screenshots from the device pass;
   content rating questionnaire (dating, 18+); data safety as below.
6. *Last checks* — the Principles; a load test of Seek and the Square with the seed crowd on the
   server; the admin's Ops page all "Reachable".

Play listing, EN draft (the user may reword):
- *Title:* MingldIngl — meet, keep your word
- *Short:* A dating game where letters break seals, encounters are real and ghosting costs.
- *Full:* MingldIngl is dating as a slow, forged game. Each night the tavern brings you one
  traveller at a time. Summon someone and a bond is made — then letters break four seals, one
  portrait at a time. Break the ice, take the Trial, light the Flame Rite, and meet at a verified
  place. Keep your word and your gem climbs from Garnet to Emerald; let a fire go cold and it
  shows. Quests, honours, Fated Threads from friends and the Town Square's live rounds make the
  world. Every floor plays the same game: the Hall and the High Table add reach, never score.

Data safety (Play form): collected — phone number (account, verified by SMS), name, birth date,
gender, city, photos, messages (letters), in-app interactions; deep profile answers (members);
purchase history. Shared — none sold; processors only (Supabase storage, Agora video — not
recorded, RevenueCat, QPay, Expo push, Sentry crash reports with personal data scrubbed).
Encrypted in transit; deletion on request in the app (Abandon, 30 days) and by the keepers.

## Stage 6 — Where it stands

6a (membership & payments, the Guild House web page), 6b (floors in the game, deep profile) and
6c (statistics) are built — records in the shipped log. 6d is scripted but not deployed: it waits
on the home server and the user's accounts and keys (checklist above). Decisions the user may
overrule are in the 6b record.

---

# Technology noted for later stages

| Tool | Stage | Why |
|---|---|---|
| **PostGIS** | if a distance band is wanted | Stage 3 stores no coordinates (district → aimag → elsewhere), so it was not needed. |
| **Quartz.NET** (or Hangfire) | 4–5 | Stage 3's 5-minute `SKIP LOCKED` sweep covers embers and cold; reconsider for no-show checks and Town Square rounds. |
| **LiveKit** | 4 | Open-source video; compare cost and quality with Agora before Town Square scales. |
| **Rive** | 5 | State-driven ceremony animations (tier-up, chest); Skia stays for particles. |
| **Redis** | when there is more than one engine instance | SignalR backplane and shared rate-limit store. |
| **Photo moderation** (AWS Rekognition / Google Vision / Sightengine) | before launch | Nudity check on every upload; a face in the first photo. |
| **Selfie liveness + face match** | before launch | A "verified" mark against scam profiles — accountability again. |

---

# Domain Model & Product Background

Every number is a default that the admin can
tune (DB-backed config).

A gamified dating app for the Mongolian market, built against ghosting, swipe fatigue and shallow
engagement, open to all ages and situations. It replaces the swipe loop with a score economy,
gemstone tiers and progressive profile reveal that rewards real conversation.

### Identity

- **Profile** — basic (name, age, gender, city, photos, bio; free) and deep (kids, habits,
  lifestyle, religion; membership-gated). Max 6 photos. A complete profile at sign-up pays +100.
- **Gemstone tier** from total score, never purchasable: Garnet 0 → Opal 100 → Amethyst 300 →
  Sapphire 600 → Ruby 1000 → Emerald 2000 (strictly increasing).
- **Reputation** — docked by ghosting, no-shows and admin-resolved reports.
- **Membership** — Free / Silver / Gold, shown as the Guild House floors Yard / Hall / High Table.
- **The Oath** — Bond / Fate / Kinship; Sworn, then Proven by real encounters.

### Score economy

Earn: daily login +5 × streak (cap 7) and +50 on the seventh day; first message +10; icebreaker
+20; quiz +15; reply +10 (capped 10 per match per day); date confirmed +50; video call +30; Fated
Thread sparked +40; Oath proven +40; campaign room +5 / boss +25; quests per config, chest +30.
Lose: ghosting −15; a report an admin resolves as Penalised −30 (never automatic).

**Daily match budget:** base Free 5 / Silver 12 / Gold 20, +1 per 50 score and +1 per tier index,
capped at Free 12 / Silver 25 / Gold 40 plus the tier index.

### Matching and reveal

- Candidates: Oath affinity leads inside a 25 km band, then both-Proven, then score/tier
  proximity, location and the user's age range. One eligibility rule shared by discovery and match
  creation; blocks checked on every match-creation path.
- **Progressive reveal:** match → first name, one sealed photo, bio; 5 mutual messages → 2nd
  photo, age; 15 → 3rd photo, district; 30 → deep fields if membership allows. "Mutual" is
  `2·min(a,b)+1`, so a monologue cannot climb. A candidate only ever receives the sealed (blurred)
  first photo.
- **Ghosting** after 48 h of silence on your turn: score penalty and a reputation dock, pushes to
  both sides; reveal freezes. Someone who never sent a message is never at fault. Accountability
  is the product's thesis, not a burnout risk to soften.

### Engagement

- **Icebreaker** — both answer independently, revealed together; unlocks video.
- **Quiz** — five questions, compatibility %.
- **Activity suggestions** after 15 messages; both pledging confirms a date (+50). The pledge needs
  a completed **Flame Rite** (a consented 5-minute video call) while required; video off lifts it.
- **No-show check** 48 h after a date; repeated mismatches dock reputation.
- **Fated Threads** (a Weaver pairs two numbers, double-blind), **Recruit an Ally** (referrals),
  **Town Square** (scheduled speed-dating rounds over video), **the Campaign** (a per-match map
  derived from progress), daily quests, streaks and honours.
- **The road:** party seats cap live matches (4 + 1 per tier); a ghosting leaves a scar that two
  kept encounters close; kept encounters chart waypoints; festival seasons (Naadam, Tsagaan Sar)
  give their own honour; each match gets a weekly shared trial (+25 each); a pair who met can
  retire together.
- Video is Agora; call history is not stored.

### Business partners

Verified venues (Cafe / Restaurant / Bar / Entertainment / Outdoor / Culture) appear in activity
suggestions; after a confirmed date both users rate the venue 1–5. Paid featured placement is
design intent only.

### Monetization

Only membership (1/3/6-month cycles at 0/10/20 % off, admin-tunable prices). Free users get the
full game; membership changes reach and depth, not the rules.

| Floor | Price / moon | Summons a night | Party seats | Also |
|---|---|---|---|---|
| The Yard (free) | — | 5 (cap 12) | 4 + 1 per tier | the whole game |
| The Hall | 10,900₮ | 12 (cap 25) | **+2** | deep profile |
| The High Table | 21,900₮ | 20 (cap 40) | **+4** | deep profile, first seat at the Town Square draw |

**Decided 2026-10-05: paid floors add party seats** (new config `party.seats.silver_bonus` = 2,
`party.seats.gold_bonus` = 4). If seats ignored membership, a paid floor's extra summons could
not become extra bonds once the fire was full — the headline perk would do almost nothing.
Paying still never buys score, tier or reputation; every extra seat carries the same ghosting
accountability.

**Paid perks (decided 2026-10-05)** — paying buys reach, depth and style, never score or
forgiveness:

| Perk | The Hall | The High Table |
|---|---|---|
| Fun tags — gift a bond a playful title shown on their card; positive only, one per bond, the recipient can hide it; **no points** (points would let payers farm each other) | ✓ | ✓ + a monthly pack of rarer tags |
| Seek filters — age, district/distance, oath, deep-profile answers | ✓ | ✓ |
| Travel mode — seek in another city before going there | — | ✓ |
| A second look — bring back tonight's last pass, once | ✓ | ✓ |
| Cosmetics — your own tamga (wax seal design), gem settings and avatar frames, letter parchments | some | all |
| Ger rest — freeze the seven-dawn streak for a day | 1 a moon | 2 a moon |

Rejected: Reputation Repair (sells forgiveness for ghosting), Score/XP boosters (pay-to-win),
"see who liked you" (no likes exist), Profile Boost (tilts fairness).
**Not social media:** no feeds, followers, public posts or like counts — ever.

**Attention rules (decided 2026-10-05)** — the app saves attention instead of draining it:
- **The fire burns low** — after ~40 minutes of continuous use the hearth dims and says so; a
  gentle stop, never a lockout.
- **No typing dots, no "seen"** — letters arrive whole; nothing to stare at.
- **Chests are never gambles** — contents are shown before opening; no random loot, no
  near-misses. The biggest rewards come from real life (a kept meeting).
- **Dawn is once a day** — the daily reward is for lighting the hearth once; extra app opens earn
  nothing.
- **Slow reveal stays slow** — portraits open through conversation only.
**Festival seasons (decided 2026-10-05)** — a festival changes the world, not the pressure: the
sky, light, ornaments and seal colour shift; a festival Town Square bell; a keepable honour for an
encounter sworn and kept in the season. No limited-time sales, no countdowns, no "last chance"
pushes; a festival honour returns every year.

| Season | Weight | The vibe |
|---|---|---|
| **Tsagaan Sar** (Lunar New Year — keep the Mongolian name; "White Moon" is a mistranslation) | big | white and blue world, khadag blue, a quieter family-time bell; honour "Of Tsagaan Sar" |
| **Naadam** | big | the Three Games — a wrestling / archery / horse-race weekly trial, a festival bell, the Naadam honour |
| **New Year** (incl. the Christmas season) | big | fireworks in the night sky, snow, the "Last Bell of the Year" gathering, the year's Chronicle |
| **Valentine's Day** (Feb 14) | gathering | the Day of the Bond gathering, warm rose-gold light |
| **March 8** (Women's Day) | light | a warm world tint, a gathering |
| **Halloween** | light | a masked Town Square round — faces hidden until the bell |

Considered and not taken: dusk-only candidate drops, a single evening digest, overnight quiet
hours with the ember clock paused, a monthly Chronicle scroll. Payments: decided in stage 6
(store billing in the app through RevenueCat, QPay per cycle on the web; HiPay not used). QPay:
₮300,000 + 1 %/transaction, `ebarimt_v3` tax receipts, a sandbox. Designed, not scheduled: Fun Tags, Reputation Repair, Score Boosters,
Profile Boost.

### Constraints and out of scope

Solo developer, monolithic engine, minimal cost; mn + en from day one; Expo web is for dev and
tests only. Out of scope: AI matching, a partner self-service dashboard, the paid extras above.

---

# Hard-won rules (apply in the stage that builds them)

- **Phone ownership is proven by the engine via verify.mn** (Mobile-Originated SMS: the user texts
  a code to 144773), never by the client. Account creation and phone change require a claimed
  verification; the JWT's phone claim is never trusted. A pending session is never handed to a
  caller who cannot name it; one number holds at most 5 live sessions, a sixth supersedes the
  oldest. The engine issues the session; no anonymous identities or aliasing.
- **Admin auth is a separate JWT scheme**, never the default, never valid on app endpoints.
- **Realtime goes per user**, never a shared topic; the engine pushes after each write (its own
  SignalR hub, authorised per user — see Stage 2).
- **Business rules travel as a domain exception** mapped to a status code; never framework
  exception types.
- **Push copy is a table** of kinds with EN + MN text, sent off the request path.
- **Every tunable number is admin config** with bounds; thresholds stay strictly increasing.
- **Deleting a user deletes their files**; public uploads are keyed-hash named.
- **Server-side "today" should be Asia/Ulaanbaatar**, not UTC (else days roll over at 08:00 local).
- **Discovery must not materialise every eligible user** — design the candidate query to scale.
- **`POST /video/complete` must be corroborated** (Agora webhooks), not a client assertion.
- **Rate-limit every write** from day one, not just the fan-out ones.
- **Push tokens can be re-registered by another account** (same device + new account looks like a
  hijack) — bind a token to a device-side proof when push is built.
- **Throttles and rate limits held in memory are per instance** — a second engine instance halves
  them; move to shared state (Redis) before scaling out.
- **Discovery tie-breaks and eligibility are one rule** shared by the feed and match creation;
  blocks are checked on every path that creates a match (summons, Fated Threads, Town Square).
- **Mutual messages = `2·min(a,b)+1`** so a monologue never climbs the reveal; capped reply score
  is still farmable by two colluding accounts (~500/day) — add minimum length or decay.
- **Concurrent summons can overflow party seats by one** (fast-path check) — take the seat
  under a lock.
- **A kill switch must hide its entry point**, not show copy on a 404 (`townsquare.enabled`).
- **Every engine error code needs app copy** — never the caller's generic message.
- **The app must be able to read tunable numbers** (one config read path) — hardcoded point
  badges go stale.
- **Sounds on Android follow media volume**, not silent/vibrate (`playsInSilentMode` is iOS-only;
  a fix needs a native ringer-mode read). Sounds must not take audio focus (they paused music).
  expo-haptics impact styles are weak on the A51 (0.12–0.27 amplitude); `heavy` moments use the
  system long-press preset.
- **The engine stores place names in English**; a cohort/leaderboard must group GPS districts and
  seeded "Ulaanbaatar" together, not by raw string. Coordinates need a Mongolia bounding box (`(0,0)`
  must not snap to Ölgii).
- **Mongolian grammar:** case suffixes follow the name's vowels (Мөнхболдтой, Сэлэнгэтэй), so
  never hardcode `{{name}}-тай`; compose lines in one locale; Pirata One has no Cyrillic.
- **Copy traps:** one word meaning three things ("sigil"); the loudest button on Settings
  being account deletion; a buy button that doesn't name what it buys; "3/3 minimum" at or above
  the minimum; an empty state with no way forward; a map with no "you are here".
- **Town Square:** pairing, overflow RSVPs and attendance score are each designed before building
  it.
- Product decisions to settle in the stage that builds them: chat gated on the
  icebreaker or not; whether summoning reveals the first photo; a match nobody messaged can never
  be ghosted (no party to blame); retiring together and the pair's other matches (close them or
  not); the leaderboard's anonymity (rows read `#N ◆ 3,724 pts`); the video countdown anchored to
  the token, and what 0:00 does; whether beating the campaign boss ends it; a third gender's
  matching semantics.
