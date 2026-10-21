# MingldIngl — Shipped log

Newest first. One short entry per finished piece of work: what a person can now do, what was
decided, what was fixed on a device. Open items live in the plan's Backlog, not here.

## 2026-10-22 — The face check; launch accounts

Optional face check: Character → Your face takes two front-camera selfies (straight, then turned),
the engine matches them against the portraits with YuNet + SFace on ONNX Runtime (scores checked
against OpenCV's) and keeps only the answer; a match puts "Face proven" on the card in the Tavern
and in bonds, a portrait change takes it off, 3 tries a day. Admin shows it; the privacy page says
so (EN + MN). Decided: two genders, each sees the other; the art stays for launch. Done: QPay's
live keys accepted on the server; the Sentry org token on EAS (production uploads source maps);
the server redeployed to `0dda253`; WeSend Active (a real code went to the user's number through
the server). Figma: "Your face" row on Character — own, "Seek — a companion · face proven" (S2), four
Prove your face frames (S6, y 5760). Play build 6 built locally (EAS's queue held build 5 for 25 minutes;
cancelled). A proven face also earns 20 points once, skips the newcomer's summons limit, comes first
among equal companions in Seek, and members can filter the Tavern to proven faces.

## 2026-10-21 — First live run on the server; Play billing set up

On the A51 against `api.mingldingl.com`: a real WeSend code signed in, a character was made through
all six steps, and the Guild House signed in by its own code and wrote a real 10,900₮ QPay invoice
(unpaid; the sweep cancelled it with QPay and checked once). Two fixes from it: WeSend's
`auth.provider_unavailable` is now 503 — Cloudflare swaps an origin 502 for its own plain text,
which the page read as "no connection" (WeSend had run out of credits); and Enter/Go sends the
Guild House's number. Decided: the app sells floors only through the stores, QPay stays on the web
(store rules). Play: payments profile made (public name MingldIngl, statement MINGLDINGL), the
tester list made license testers; build 3 (1.0.0) on internal testing; subscriptions `hall` and
`high_table` with auto-renewing `m1`/`m3`/`m6` base plans active in MNT; RevenueCat's Play service account
(`revenuecat@mingldingl.iam.gserviceaccount.com`, Play Developer + Reporting APIs on) validates all
three checks. First real store purchase: the Play build on the A51 bought the Hall as a license tester, the
engine asked RevenueCat and the app opened "Welcome — the Hall" by itself; RevenueCat: Play products `hall:m1…m6` and `high_table:m1…m6`
attached to their entitlements, webhook to the engine confirmed. check-all passes.
The Guild House's hanging sign now hangs below the status bar (only the chains cross it; it
covered the clock on the A51) and its "How long" label is flush with the chips — app and Figma
(Hanging Sign 155:314).

## 2026-10-21 — QPay by its own rules

Read QPay's Merchant V2 docs (developer.qpay.mn) against our client and fixed four breaks: the
token was fetched anew on every call (the typed client is per request — now one shared
`QPayTokens`), `expires_in` was read as seconds (it is a unix timestamp; `auth/refresh` now renews
it), and `payment/check` was polled every minute and on every 3-second page tick, which QPay
forbids. Now QPay's POST callback prompts the check; the sweep only cancels a code gone cold and
checks it once (a lost callback still costs nothing). Callbacks are limited per invoice, the
invoice text has no special characters, and QPay's error codes are logged (`INVOICE_PAID` on
cancel means "check now"). Five client tests against QPay's documented answers; 265 engine tests
pass. The merchant id, secret and invoice code (`MINGLDINGL_INVOICE`) came in.

## 2026-10-21 — Figma and code parity pass

Reviewed all 193 S1–S9 frames and swept every page for rejected art and stray source layers.
Figma caught the missed privacy/portrait copy, nameless Seek menus and card geometry, children-aware
deep profiles, festival copy, Missions glyph and all 33 admin sidebars; the glyph board lost its
obsolete ring/wick samples. Admin and web fields, disabled plates and sizes now follow the shared
controls; the Guild House uses the exported sky, ember and hanging-sign art. Removed the remaining
unused festival cup files and corrected the Gallery's Missions glyph. Tokens match the live file.
App typecheck/lint and all 346 tests passed; admin lint/typecheck/build passed. Open design and
uncoded-action gaps are in the plan; this was a frame/code review, not a new A51 device pass.

## 2026-10-21 — Mongolian that reads as Mongolian

Two passes over every Mongolian line a player reads (app, date questions, Wanderings, pushes,
Codex, Guild House, legal pages), about 480 lines in all, fixing calques, wrong meanings ("Чамд нэг
ч төгрөг төлөхгүй" said we would not pay you), wrong words (хөнгөлөлт for a grace period, хуулах
for upload), passives and misspellings. The user's terms, now everywhere: the Square is
**Чуулган**; a date is **болзоо / болзох**, set by товлох (санал болгох → болзохоор тогтох), and
тангараг is only the onboarding oath; the world is the **хэрэм**, entered by the **Дааман хаалга**,
with the **цайз** on the mountain, and retiring together is **хэрмээс гарах**; the floors are
Хашаа / Танхим / **Дээд танхим** and the Hall of Names is Алдрын танхим; the Wanderings are
**Хэсүүл**; "both" is **хоёул**. The rules are in CLAUDE.md. The privacy and deletion pages lost
the old verify.mn sign-in and its 150₮ charge. The Wandering and Codex seeds only add what is
missing, so the dev database was refreshed by hand; the server's needs the same after deploy.

## 2026-10-21 — Unlit iron, ink-lined fields, a lozenge for a switch

From the atmosphere pass. A disabled button was dimmed brass, a brown stain on the night; it is now
unlit iron (hairline outline, faint words, no brass), and so is the letter's send boss with nothing
to send. Fields were pure black boxes, holes in the night; they now sit on the panel's tone with a
hairline frame and an ink underline that turns gold on focus and ember on error (Input, TextArea,
the letter field). The War Room's switches were a phone's pill and round knob; the Toggle is now
the name rule's lozenge riding a cut slot, gold and glowing at the right when on, unlit iron at the
left when off. The Hearth's window no longer ends in a hard rectangle: its stone dissolves into the
night (`FadedArt`). Venues carry their address, hours and description in Mongolian beside the name
(engine, admin form, app; existing databases gain the columns at boot), so a Mongolian reader no
longer meets English lines on a venue page; the 15 seed venues have theirs. Figma matches: Button
and Send Button disabled, Input, Text Area, Toggle, the Hearth window (S3 and page 07), and the
admin venue form.

## 2026-10-21 — The profile's language travels

A phone signed in to a Mongolian profile but left in English showed English screens with Mongolian
road names, pushes and questions: the app never took on the profile's language, and the dev Tools
switch changed only the phone. Signed in, the app now speaks the profile's language (`useGate`), and
the Tools switch writes the profile as the War Room does. Checked on the A51: all 13 Wanderings and
all 15 venues show, each in one language.

An atmosphere pass over ~30 screens on the A51 (in Mongolian) fixed two more: the Hall of Names
said "Ulaanbaatar" in Latin letters (the cohort now goes through `tPlace`), and the Frozen Gate's
frost was drawn over the room, hiding the back arrow and frosting the title; it now lies beneath,
as in Figma 35:617.

## 2026-10-21 — The doors belong to the night; cards inside a gold line; ink dawns

The tab bar read as a stock Android bar under a handmade world. It lost its slab and hairline:
the night now deepens under the doors so the stars run on beneath, with the room title's
dry-brush rule along the top. The open door has a gold lozenge (the name rule's) in place of
the ember tick and a still hearth glow behind its glyph. Picked from three mocks in Figma and
checked on the A51; the Figma Tab Bar / Tab Item components match.

The arch-topped card (rounded top, square foot) is gone. Every card that had it now sits inside
a fine gold line with the name rule's lozenge at its crown, drawn in code (`Candlelit`). The
Tavern's companion is candlelit: the night art warmed from below by the candle row, its edge
fading into the World Floor instead of ending. The Square's bell, the festival bells and the
Satchel's character keepsake are a flat panel inside the same line, with no canvas, so a shared
keepsake is captured whole. The bell card is one fixed size for every gathering, and the Tsagaan Sar cup under it is gone.
Painted frames (basalt, steel, oak and filigree) were tried and dropped by the user as AI-made.

The Missions dawn streak lost its yellow dots for the Chronicle's ink: a rising sun (`dawn`) per
day, gold once risen, and the star for the seventh (painted braziers were too much).

Figma caught up: the Row's leading glyph, the hearth on every tab room's header, the nameless
Tavern card, the fixed bell cards, Choice Card's glyph property (the app's marks in place of the
knot), the Guild page's floor picker without the Yard; page 07 is five current screens, and the
art and components pages are clean. Checked on the A51.

## 2026-10-21 — Tidier tests

The test suites lost about 370 lines of copied setup and three duplicate tests (engine 260, app 346,
admin 10). Engine helpers moved into `Infrastructure/` (`MeetingWorld`, `PaymentDriver`, one
config write, one daily sweep); the app's world-screen tests share `src/lib/testing/world.tsx`,
and its run prints no React warnings; the admin spec shares its login and dialog steps. Fixed on
the way: `two-devices.sh` and `live-latency.py` still signed in through the pre-WeSend
`/auth/phone/status` step.

## 2026-10-21 — The device pass runs again

The pass had broken in three places since the face check and the WeSend code:
- The seed album was ink figures, which the face check now refuses. `push-seed-photos.sh` now
  pushes one crowd traveller's six photos.
- "The gate opens" holds for only 1.2 s, and Maestro often types the code too slowly to see it.
  Its frame is now taken when it can be and no longer fails the pass.
- A reseeded character reopens on the tab it left, not always the Tavern.

Watching that screen frame by frame turned up a real bug: the number keyboard stayed up over the
seal. It is now dismissed while the code field still has the focus.

## 2026-10-21 — Short replies earn nothing

Two colluding accounts could farm the reply score with one-word volleys, up to the daily cap on
every bond. A reply now pays only at 20 characters or more (`score.reply.minLength`, in the
panel's config). A shorter letter is still a reply: it passes the turn and counts toward the seals.

## 2026-10-21 — One glyph, one meaning

The ← on the five tab rooms went to the Hearth, not back; it is now the hearth glyph (`RoomHeader
onHome`, "To the Hearth" / "Гал голомт руу"). An audit found `knot` on almost every choice card,
glyphs with three or four meanings, and tabs and Hearth doors that disagreed. Now: Missions is the
Forge and Character the person on both; choice cards carry their own marks (oath, gender, floors,
yes/no, attendance; a riddle's answers none); the deep profile, War Room rows, error toasts, the
camera, pledges and the trial have theirs; all 22 Chronicle deeds have one; `Row` takes a glyph
(Character, bond options, Satchel, Seek menu, thread states). Figma page 05 gained eleven
hand-inked glyphs (warning, kin, cradle, pipe, road, speech, plus, tally, ♂, ♀, post), and twelve
drawn but never exported now are. Panel: Analytics is the tally, the Guild House floors are feast
and crown, detail pages gained their back link, and the main actions carry glyphs.

## 2026-10-21 — The world's sounds, remade

The ten event sounds were bare sines and noise with no room around them, and they sounded like drum
samples. `scripts/gen-sounds.js` now models each thing itself. Struck objects are banks of decaying
modes, and metal comes in beating pairs. A plucked yatga plays D major pentatonic runs for honour,
rise and the anvil's sweep. A shaman's drum is the penalty. The bell has a real bell's partials.
Every sound sits in a Freeverb room, at 32 kHz. Loudness on the phone speaker matches the old set,
so the balance is unchanged. The whole set is 0.77 MB, up from 0.26. Tools has a new "Hear every
sound" section, which plays them even with Sound off. Testing on the A51 found that every sound
took audio focus and paused the person's own music. They now mix under it (`interruptionMode:
'mixWithOthers'`).

## 2026-10-21 — Rooms change without the glitch

A screen-recording on the A51 (release build) showed what went wrong. A tab's first visit showed
an empty room that filled in over 4–6 frames. The Town Square flashed "the square is quiet" before
its bell appeared. Opening or leaving a room showed both rooms through each other for about 170 ms,
because every screen is transparent over the World Floor. After a few visits it looked fine,
because visited tabs stay mounted with their data. Now the tabs are drawn out of sight soon after
the world opens (`WorldTabs` preload), so a first visit arrives whole. The world stack swaps rooms
without a native animation. A new room waits for its first reads (at most 700 ms) and then fades in
(Room travel, 360 ms). A room left by Back goes dark at once, unless it refuses to go (unsaved
edits). Bundled art no longer fades in (Android fades every `Image` over 300 ms), and `FillArt`
plates no longer arrive a frame late. One frame of missing Seek card art is left on its first visit:
Android decodes a hidden tab's images only when it is shown. A later A51 recording still caught one
or two frames of bare floor on some tab switches and on Back between tabs: the navigator detached
tabs that were not open, and a reattached tab took a frame or two to draw. Tabs now stay attached
and the ones not open are hidden (`tabLayout`: unseen, untouchable, out of TalkBack's reach). In 14
recorded switches, Backs included, no blank frame was left.

## 2026-10-21 — The seeded world has its occasions

`seed crowd` now seeds the world's occasions: seven Town Square gatherings (last Naadam's with a
match, a masked night, a cancelled one, tonight's open bell with the tester seated, one still in the
High Table's lead, and two coming), a meeting kept on Naadam and three Wanderings, five Guild House
floors (store renewing and ending, lapsed, QPay, a keeper's gift) and one late QPay payment to
refund, someone away, leaving and paused, seven deep profiles, and the troll cases (Мөнхбат hidden
by reports, barred 99108801, Temuujin and Цогтбаяр on flagged phones, newcomer Номин). Fixed: the
world seeder now starts with a clean database context, so values set after a bulk reset are written.

## 2026-10-21 — Fresh accounts can't troll for free

A portrait with no human face is refused at upload ("We could not find a face in this portrait"):
a 1.2 MB CPU face detector, nothing about the face kept. It found a face in all 183 crowd portraits
and none of the ink figures; a second pass over zoomed pieces lets half- and full-body photos pass
(a face down to ~2% of the height), and at most two checks run at once (2 of the server's 8
threads). Open reports from three people hide someone until a keeper decides; a character in its
first two days has three summons a night unless on a paid floor; a suspended account's number, or
one that left with reports open, is barred once it burns (Reports → Barred numbers). The app sends
its install id (hashed), and a new character on a removed or suspended character's phone is flagged
"shared device". Privacy page updated in both languages; needs a new development build
(`expo-application`). Found on the A51: a refused portrait showed as a lost upload; now it leaves
the grid with its reason, and only a lost upload offers a retry.

## 2026-10-21 — Portraits come up out of the dark

A portrait being uploaded now shows the picked photo itself under a breathing dark veil, with a
flickering candle and an ember running along its foot (there is no byte count to show, so it runs
rather than lying at 0%). When it lands, the tile keeps the device's own copy until the stored one
loads, so it no longer drops to a ThumbHash blur for a moment. A lost upload shows the photo dimmed
behind "Lost — tap". Reduce Motion holds all of it still.

## 2026-10-21 — The keeper's hand

A keeper can act on one person directly from their record, each action with a reason the audit
log keeps beside it (a new Reason column): suspend (signs out every device, severs their bonds)
and **lift** it, which no one could before; sign out everywhere; delete now (the 30-day burn at
once, for a legal request); clear a name (it becomes Аянчин) or a tale (they are sent back to write
one); remove one portrait (below the minimum they are asked for another); give the Hall or the High
Table for some days (a gift that never renews; the app reads "A gift from the keepers"); and
adjust points and reputation by hand (the ledger reads "The keepers set your points right"). The
record says when and why someone was suspended. Names in the report list and the "Often severed"
table open the person; a gathering not yet begun can be edited. Figma S8 266:2253–266:15296; S8's
dashboard and health frames no longer overlap the Cohorts frame. The single migration was
regenerated again.

## 2026-10-20 — The Wanderings

Thirteen side roads for two, off a bond's Campaign (Тэнүүл in Mongolian): six first roads open
after the pair's first kept meeting, seven trusted roads after the second. Offrail: never required,
never expiring, no points, nothing lost. One asks, the other answers *Let's go* or *Not this one*;
after it, each writes what they will remember, sealed until both have written. Three kept make the
honour **Fellow Traveller** (Замын нөхөр; it wears the Cartographer's emblem until its own is
painted). Each names its real places (checked 2026-10-20: the Chinggis Khaan National Museum, Tumen
Ekh, Zaisan, the Tuul's ice, Terelj, Lucky Paws…) and the venue kinds that suit it; the keepers'
verified venues of those kinds are offered, and *Swear it as a meeting* opens the usual meeting.
Boot seeds missing Wanderings; the keepers edit words and kinds in the admin's Wanderings page.
Statistics counts `wanderings` kept. Figma 260:2809–262:3214 (S4). The single migration was
regenerated again.

## 2026-10-20 — Three guides, and away by the fire

The Codex has three new guides, in English and Mongolian, linked where they are needed: *Your
first letter* (under a new bond's "No words spoken yet"), *Before you meet* (on the sworn meeting)
and *When to let go* (in a bond's options, above Sever). Boot now writes any first page that is
missing in either language, so a release can add guides to a running Codex. *Away by the fire*
(War Room): for one, three or seven days nothing goes cold on your turn and the 48 hours count again
from your return; you are out of Seek and of others' threads, everyone at your fire sees "Away
until Thursday", and a letter or a summons brings you back early. Once in 30 days
(`away.maxDays` 7, `away.everyDays` 30). Figma: 258:2489–258:2774 (S4), 259:2042, 259:2231 (S6).
The single migration was regenerated again.

## 2026-10-20 — Fairness: children, a soft Sever, meeting again

Anyone, free or paid, says whether they have children and may show it in the Tavern at once (a
"Has children" line on the Seek card and in every bond) or keep it for the fourth seal. The deep
profile's children question became three: has children (everyone's), wants children and a
partner's children (welcome / open / prefer none), the last two the Hall's; the Hall's children
filter can now find those who welcome a partner's children. Severing is softer for the side let go:
"The paths parted", no blame, and the candle spent on them that night is lit again; the one who
severed reads that the paths may cross again. A severed or faded pair may meet again in Seek after
`seek.remeetDays` (90); a pair gone cold or reported never does. Statistics counts a Sever against
the side let go, and Matching lists the often severed (three or more in the range). Figma:
254:6663–254:7018 (S6), 254:13347 (S2), 254:13475–254:13550 (S4). The single migration was
regenerated, so the dev and server databases need making again.

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
