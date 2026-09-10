# MingldIngl — Shipped Log

Archive of everything that has shipped, pruned to outcome summaries. The step-by-step plans,
task ledgers and review narration are gone now that the code exists and is the authoritative
reference. What is kept is what a future reader needs: what shipped, the mechanics that are not
obvious from a file listing, what deviated from the design, and the decisions worth not
re-deriving. Open items live in [`project-plan.md`](project-plan.md) under Outstanding
Follow-ups, not here.

Check this file before assuming a feature doesn't exist yet.

---

## Authored cast reseed + device style sweep (2026-09-10)

The dev seed's people were a modulo expression over a name list, their photos were letter
placeholders, and every match's "conversation" was the same eight lines looped. Replaced with an
authored cast and real portraits, then swept the app on the Galaxy A51 for what real photographs
and real threads exposed.

**The seed.** 19 people with hand-written bios, real UB districts and coordinates, spread across
every tier, oath, membership and lifecycle state, plus nine matches each carrying one authored
Mongolian conversation (2 to 34 messages) that reads as two people actually talking. Reveal levels
now span 1-4 across the fixtures.

**`InitiatorMessageCount`/`ReceiverMessageCount` were never seeded.** `RevealService.MutualMessageCount`
reads the per-side counts, so with both at 0 a 35-message thread computed `min(35, 2*0+1) = 1` and
rendered as "1 of 3 photos revealed · next reveal at 5 messages". Every seeded conversation
contradicted its own reveal strip. The seed writes both counts now.

**Portraits are StyleGAN output** (`scripts/gen-cast-photos.py`) — photorealistic but depicting no
real person, because a dating-app fixture must not put identifiable people on fabricated profiles.
Frames are square: the discover card covers its photo into a box that is landscape on a tall phone,
so a 3:4 portrait was being scaled up ~1.5x and cropped to a nose. They live under
`seed/c2/` — a cast version, because expo-image caches by URL and a reseed reusing
`seed/<slug>-1.jpg` left every device that had seen the old cast showing the old picture.

**Style fixes the placeholders had been hiding.** The chat screen is transparent so the world floor
shows through, and that floor sits at very nearly `COLORS.panel` — an incoming bubble's edge scored
**1.03:1** against what was actually behind it, so a received message read as bare text with no
bubble. Fill cannot carry it in a palette this dark (`panelRaised` only reaches 1.09:1); the bubble
takes the same `LINE.edge` hairline every other panel uses, measured at **3.10:1** on device. The
discover card's photo-progress dots were `COLORS.text` at 30% alpha directly on the photograph —
**1.01:1** on a pale portrait, i.e. gone; they are opaque now over their own top scrim, worst case
**3.5:1** (a translucent dot darkens along with the scrim, so the scrim alone made it worse).
`formatCountdown` had no day rung, so Town Square's next-session card counted in raw hours and a
gathering nine days out read "216ц 0м".

**A test that only passed on an empty database.** `GetNextSession_NoUpcomingSession_ReturnsNullSessionId`
asserted a claim about the whole table while the integration tests share the dev database, so it
went red against any reseeded DB and stayed green on CI. It now clears live sessions inside its own
rolled-back transaction.

Engine 939/939, app 688/688, control lint + build green.

---

## Second real-device sweep — 11 fixes (2026-09-06)

A pass over the parts nothing had driven end to end: Town Square (a real session RSVP'd, locked,
started, answered and left), the Mission Board and venue detail, the character sheet and its
sub-screens, the per-match activity sheet, and a chat thread. What it changed:

**Layout collisions that only a device shows.** The Town Square round card sat at a fixed
`bottom: 100` while the call controls are laid out from the safe-area bottom, so on any device
with a navigation bar the mic and hang-up buttons covered the Yes/No row and the waiting text —
`RoundPrompt` now clears them off shared `VIDEO_CONTROLS_BOTTOM`/`VIDEO_CONTROLS_SIZE` constants,
with a test that asserts it. `AppCard` carries no padding of its own, and the icebreaker and quiz
question/completion cards never supplied any, so a long Mongolian question ran into the ulzii
corner knots; the icebreaker's submit button was also half-swallowed by the navigation bar
(`useScrollTail`, the hook written for exactly that, was not applied there). The candidate card's
photo placeholder was centred with a fixed `paddingBottom: '32%'` guess and drew a silhouette
straight through the name; it now measures the plaque and scales the figure to what is left, and
the scrim starts above the measured plaque instead of at a fixed 0.35 so a bright photo can't
leave the name on near-white.

**A chat thread that never reached its own bottom.** Message rows are variable height, so the
single `scrollToEnd` on layout ran against a still-settling content height and landed a few
bubbles short — which then latched `nearBottomRef` false, after which the thread never followed a
new message again, including one you had just sent. `scrollToEndSoon` does a second pass on the
next frame, and sending re-arms the flag.

**Vocabulary drift between the three repos.** The venues the engine actually holds are
`Cafe/Restaurant/Bar/Entertainment/Outdoor/Culture`; the app's Mission Board icon map and
`mingldingl_control`'s BusinessForm both used `Cafe/Cinema/Hiking/BoardGameCafe/Other`, which
shared exactly one value with reality — so every restaurant, bar and museum drew the generic pin,
and editing any of them in the admin panel opened a category select with nothing selected. Both
lists now name the real six.

**Reveal masking that disagreed with itself.** The engine sends `DisplayName` from reveal level 1;
the quest log and chat header keep a match nameless until level 2. The character sheet's What's
Next card followed the engine, so it named a match the rest of the app was calling "??? • Mystery".
It masks on the same threshold now.

**`RsvpOpensAt` did nothing.** Sessions are created `Open`, and neither `RsvpAsync` nor
`GetNextSession` ever looked at the RSVP-opens date, so a gathering scheduled with a window opening
next week took RSVPs immediately and the app announced "RSVP closes in …" for it. The service now
refuses an early RSVP (`square.rsvp_not_open`, translated both ways) and `next-session` only
surfaces an Open session whose window has opened.

**Dev seed.** `reseed-dev-db.sql` wrote Town Square sessions with `Status = 'Scheduled'` — a status
the engine neither creates nor reads, so the seeded gathering was invisible and nothing ever opened
it, and the Town Square tab read "the square stands quiet" forever. It also hardcoded
`http://localhost:5150` into every seeded `PhotoUrls`, which resolves to the phone on a real
device, so every candidate photo 404'd; the host is now `API_HOST`, defaulting to localhost for the
web build. Venue detail and the Encounter Log now draw a glyph where a venue has no photo instead
of a blank slab.

---

## The World Pass — Shipped (2026-09-06)

**What it is.** The app stopped being screens wearing a theme and became one place. Every screen
is a room in a hold; the room it is in decides its light, its floor, what drifts through it, and
what your body feels crossing into it. Nothing gates on it, no screen was renamed, and the map is
never on the way to anything.

**One table is the whole hold.** `lib/world/rooms.ts` holds seven rooms — Gate, Long Road, Tavern,
Hearth, Forge, Hall, Deep — and each row carries its route prefixes, light signature, floor
texture, vfx, depth, atlas coordinate and i18n key. The atlas and the lighting both read that one
row, which is the point: a map and a light that read the same fact cannot disagree. `matchRoom` is
strict (longest prefix wins, no fallback) and `roomFor` adds `DEFAULT_ROOM`; the route-coverage
test walks the real files under `app/` through the *strict* one, so a new screen either has a place
in the hold or has said out loud that it does not. `video/*` is the one `UNLIT` route — Agora
composites onto black.

**Light means something.** Six signatures in `lib/world/light.ts` (`cold`/`neutral`/`warm`/`soft`/
`dark`/`hot`), picked the way a button picks a metal from `BUTTON_METALS`; a room's own state then
moves it inside that range — the Road by unspent daily budget, the Hearth a lamp per live match to
a crowd of three, the Tavern by session then RSVP, the Deep a torch per campaign room cleared, the
Forge by profile completeness, the Hall a sconce per honour. Light functions are pure
`(WorldState) => number | null` and unit-tested with no renderer. Three rules stop it reading as
jitter: **no data is not darkness** (null holds at base), light never eases down for a refetch
(only for a value that genuinely fell), and one speed everywhere (600 ms). A room change is a cut,
not a fade, and a change into a room with nothing to say resets to base rather than inheriting the
last room's brightness.

**Floor and canopy, deliberately split.** `WorldFloor` sits behind the navigator and needs each
screen to have given up its own opaque ground; `WorldCanopy` sits above it with `pointerEvents:
none` and needs nothing from anybody. That is what let the migration land screen by screen —
a half-migrated screen keeps its own wall and still gets its light. 37 hand-placed
`<TiledBackdrop>` calls across 23 files were deleted; the Tavern's parchment floor survived as
`RoomTexture` rather than being flattened into one wall.

**`useWorldState` reads caches and never fetches.** It subscribes to the query cache through
`useSyncExternalStore` rather than mounting `useQuery` observers, because the world is a passenger:
it must never be the reason the app makes a request, and a second observer on keys whose refetch
behaviour is tuned per screen would be exactly that.

**The atlas is a view of the hold, never a hallway through it.** A ⟡ sigil drawn by `HeaderBar`
itself (not its `right` slot, which several screens already occupy) opens a `Modal` — not a route,
so it never enters the back stack and dismissing always returns you where you were. Medallions
reuse the existing `knotDim`/`knotGold`/`knotEmber` ornaments as the unlit/lit/stakes ladder, so
the map needed no new art. The Deep is not one room but N delves: it carries a count and routes to
the Hearth. Every room on it is reachable without it.

**Feedback: haptics always, sound opt-in.** `lib/world/feedback.ts` maps six moments —
`enterDeep`, `ascend`, `tierUp`, `sealBreak`, `honour`, `pledgeKept` — to a haptic and a sound, the
way `PushCopy` maps a push kind to its copy. Haptics fire regardless (the OS owns the user's
system preference); sound stays off until Settings turns it on, loads nothing until then,
releases its players when switched back off, and sets `playsInSilentMode: false` because a dating
app that speaks while the phone is silenced is a bug no setting excuses. Muted for the duration of
a call — the same fact as the video route being unlit. `scripts/gen-sounds.js` synthesises the six
WAVs from description (additive synthesis plus a one-pole lowpass over deterministic noise, pure
Node, 156 kB total), the same doctrine as `gen-ornaments.js`.

**Travel encodes depth**, not identity: entering a delve opens from below and thuds, coming back up
rises, and a tab switch between rooms at the same depth says and does nothing. Stock React
Navigation animations only; reduce motion collapses every transition to a fade and makes light jump
rather than ease.

**The bug that only a screenshot could find.** React Navigation paints `theme.colors.background`
(#F2F2F2) behind every navigator and `card` behind every screen. Both had been invisible for the
life of the app because every screen covered them with an opaque ground of its own — the moment
the screens went transparent, the hold rendered **white**. Fixed with a `HOLD_THEME` whose
`background` and `card` are transparent, plus `contentStyle` on the Stack (native screens take
their ground from `contentStyle`, not the theme) and `sceneStyle` on the Tabs. Typecheck and 612
tests were green while the app was unusable; the export-and-look pass is what caught it.

**Cleared on the way:** the `transformIgnorePatterns` Skia gap is fixed properly — `jest.setup.js`
registers Skia's own `jestSetup` and an `expo-audio` mock once, and `ProfileAvatar`'s hand-written
`TorchGlow` mock is gone. `AWAITING_MN_TRANSLATION` in `lib/i18n/index.ts` now carries the eleven
English-only keys, and the parity test enforces the list in both directions so a key that gets
translated has to leave it.

**Verified 2026-09-06:** web export bundles all six WAVs and the ornaments; the Gate renders with
its stone floor, vignette and gold wordmark and throws no page errors. Only the Gate is reachable
without a running backend — everything below it is owed a pass.

---

## Membership Billing Cycles — Shipped

Duration-based pricing (1/3/6 months at 0/10/20 % off) computed from each tier's monthly price,
no separate pricing table. `User.MembershipExpiresAt` tracks expiry, the `Membership` table is the
append-only purchase log, and `DailyMaintenanceBackgroundService` downgrades lapsed memberships.
App: a duration `ChoiceRow` on the membership screen. No payment gateway — upgrades are mocked
(see the Payment Provider Research memory). Prices and discounts became admin config on
2026-09-04.

---

## RPG Atmosphere Consistency Pass — Shipped (2026-07-28)

Eleven screens moved onto the shared `ScreenHeader` / `GameHeader` / dungeon-wall backdrop
pattern, with eight i18n keys rewritten into the game voice. Live-verified on the seven screens
reachable without seeded match data.

**Decisions and fixes worth keeping:**
- `mn` was deliberately not touched by the voice rewrite — no AI-guessed Mongolian; `en`/`mn`
  diverge in voice pending a native speaker.
- House convention for destructive actions: plain trigger label, flavourful confirm
  ("Block" → "Cast Them Out?"). Moderation/safety and account-security labels stay plain.
- `app/_layout.tsx`'s `useFonts()` gate includes `MaterialCommunityIcons.font`; before that,
  icon-using components could paint before the icon font arrived and show a bare glyph numeral.
- Avatar tap opens the shared choose-source sheet (library / camera / back) with a permanent
  pencil badge; `PhotoGrid` deletes confirm like every other destructive action.
- Every optimistic mutation reverts on failure and surfaces a failure alert (icebreaker and quiz
  answers, settings toggles, edit-profile city, chat unmatch/block, activity photo); the
  blocked-users unblock spinner is per row.
- `lib/api.ts`'s offline mock fallback only fires on a true network failure (`!error.response`).
  It used to swallow real HTTP errors on mocked endpoints and hand back fake success, which hid
  three of the failure-handling fixes above until a live induced-500 pass caught it.

---

## Admin Config Foundation — Shipped (2026-07-29)

The generic store the later config work plugs into: `AdminConfigs` table, `ConfigService`
singleton in-memory cache, `ConfigKeys` registry seeded on boot, `AdminConfigController`
list/update/revert with validation and audit logging, and the control panel's Config page. Proven
by migrating the Sapphire tier threshold off its constant. `Revert` filters to
`Action == "UpdateConfig"` rows so a second revert does not un-revert the first. The rest of the
roadmap (all deltas, thresholds, quests, pricing, kill switches) landed 2026-09-04.

---

## Recruit an Ally — Shipped (2026-08-14)

Referral codes: generated on `GET /users/me`, redeemed through the onboarding `ReferralCode`
field on profile completion (`UsersController.Upsert`), inviter reward surfaced asynchronously via
`GET /scores/me/detail` and cleared client-side the moment the header toast consumes it (the
server's read-once was not mirrored in the React Query cache, so the toast replayed on every
screen that mounted `GameHeader`). Anonymisation nulls `ReferralCode` and redemption is refused
when the inviter is `IsDeleted`. `CreateUserRequest.ReferralCode` is shared with Fated Threads'
invite codes; the server disambiguates, the field name is settled. The inviter's reward was a
random item until 2026-09-05; it is now the Ally-Caller honour, once, on the first recruit.

---

## Fated Threads — Shipped (2026-08-14)

**What it is.** A double-blind mutual opt-in for friends who want to set two people up. A
"Weaver" nominates two people by phone number; each nominee gets a low-pressure prompt without
knowing whether the other has answered; only if both accept does an ordinary `Match` tagged
`ShipId` appear. Neither nominee ever sees a rejection and the Weaver never learns who passed.
Internal naming is `Ship`/`ShipService`; user copy is Fated Threads / Weaver / "the thread frayed".

**Shipped:** engine `ShipService`, `ShipsController`, `AdminShipsController`, the `/public/ship`
landing page + `/public/ship-invite` check in `PublicController`, model `Ship`, `Match.ShipId`,
migration `AddShipsAndMatchShipId`, `InviteCode` (shared alphabet). App: `app/ship/new.tsx`,
`FatedThreadsSection` + `usePendingShips` on the Missions tab, the honours on the profile,
`lib/shipInvite.ts`, "Woven by" banners in chat and on Matches. Admin: `pages/Ships.tsx`.

**Mechanics (code is authoritative — `ShipService.cs`):**
- `POST /ships { slotAPhoneNumber, slotBPhoneNumber }` — 8-digit validation, rejects the same
  number twice and self-nomination, enforces `ships.daily.cap` (default 3, UTC day). Each slot
  resolves by `PhoneNumber` to an existing user or to a fresh 6-char invite code; a code is
  returned for **both** branches so the response never reveals whether the number has an account.
  If a nominee has blocked the Weaver, or the two are already matched, the response is the same
  success shape and no row is written.
- `GET /ships/pending` → `[{ shipId, weaverDisplayName }]`, nothing about the other slot.
- `POST /ships/{id}/respond { accept }` → `{ sparked }`. The caller's slot is written with
  `UPDATE … RETURNING`; any decline closes the thread `Declined`; both accepted re-checks
  `MatchPairing.PairAlreadyMatchedAsync` / `IsPairBlockedAsync` (either → quiet `Expired`), then
  `MatchPairing.NewMatch(a, b, shipId)` — reveal level 1, no `DailyMatchesUsed` increment — and
  claims the thread with a conditional `SET "Status" = 'Sparked' WHERE "Status" = 'Pending'`, so
  the spark runs exactly once under concurrent responses.
- Spark payout: Weaver gets `ShipSparked` +40 and the Thread-Weaver / Fate-Seer / Bond-Keeper
  honours at 1 / 5 / 10 sparks (surfaced through `pendingShipReward` on `GET /scores/me/detail`,
  acked by `POST /scores/me/notifications/ack { kind: "ship" }`); both nominees get `first_match`,
  a push and a `match_created` broadcast. `ships.enabled=false` makes `POST /ships` a 404.
- Invite codes resolve through the onboarding `ReferralCode` field; `CodeExistsAsync` checks
  `Users.ReferralCode` plus both `Ships` code columns. `/public/ship?code=` validates the code and
  deep-links `mingldingl://`. `Pending` threads expire after `ships.expiry_days` (default 14).

**Deviations from the spec:** `BlockWeaver` on Pass was never built (only the check on
`POST /ships`); the armory shrank to the three honours; the opt-in prompt lives only on the
Missions tab; reward surfacing uses an ack endpoint and two `Ship` columns rather than a
read-once field; same number in both slots is a hard 400; "already matched" returns the silent
success shape.

---

## No-Show Tracking — Shipped (2026-08-18)

**What it is.** Objective attendance accountability. `dating.attendance_check.delay_hours` (48)
after both sides confirm a date, each is privately asked whether they met; a single mismatch is
recorded but inert, and only a pattern of mismatches across distinct matches docks
`ReputationScore`. Deliberately *not* a conduct rating — subjective ratings are a retaliation
vector; the standing decision is "block + unmatch is sufficient, no Report flow".

**Mechanics (code is authoritative — `ActivityService.cs`):** `ConfirmAsync` stamps
`CompletedAt`; `GET /activities/{matchId}/attendance-check` → `{ due, activityTitle }`;
`POST … { attended }` is participant-only and idempotent. When both slots are set and differ, the
`false` side's `NoShowFlagCount` increments once per confirmation (`PenaltyApplied` guard); at
`>= dating.noshow.threshold` (3) `ApplyReputationPenaltyAsync` docks `reputation.penalty_dock`
(0.1, floor 0) and writes a `Delta = 0` `RepeatedNoShowPenalty` event for the audit trail. Neither
answer is shown to the other party; the Date Log renders a mismatched trophy as "Unconfirmed".
Both sides answering yes grants the True to Word honour. The prompt is a modal on the chat screen,
not a "What's Next" card; the penalty fires on every mismatch at or above the threshold, not once.
Admin: `noShowFlagCount` on `UserDetail`, `POST /admin/users/{id}/reset-noshow`, an analytics tile.

**Verified live 2026-09-01:** mismatch → flag walk with two real users (count 0→1,
`PenaltyApplied` latched, reputation untouched below threshold).

---

## The Oath & The Flame Rite — Shipped (2026-08-19)

**What it is.** **The Oath** is a public, behaviour-backed statement of intent — *Sworn* on
selection, *Proven* only after real encounters with no ghosting — that outranks proximity in
matching. **The Flame Rite** moves the video call from after the date pledge to a required,
mutually-consented five-minute call before it, so screening a stranger is something everyone does.

**Mechanics (code is authoritative — `OathService.cs`, `MatchesController.cs`,
`VideoController.cs`, `ActivityService.cs`):**
- Oath ∈ `Bond` / `Fate` / `Kinship`; null = never sworn, sorts last but is never excluded.
  Re-swearing resets `OathSwornAt` and costs Proven status — that is the entire stake.
- Proven (`RefreshAsync`, event-driven from encounter completion and ghosting, no sweep):
  `oath.proven.encounters` (2) distinct matches with a completed `DateConfirmation` since sworn,
  and zero `GhostPenalty` events in that window. A ghost demotes Proven → Sworn. First Proven pays
  `OathProven` +40, milestone `oath_proven` and the Oath-Keeper honour; the milestone row is the
  once-per-user guard. `OathProven` is server-owned.
- Matching: `Affinity` — same 2, adjacent 1, opposite 0, null → null — leads the candidate sort
  inside a 25 km band for every membership level, then both-Proven, then the prior chain.
- Rite: `propose` / `accept` / `decline` require `IcebreakerComplete`; `propose` 409s while one
  is open and pushes; `decline` clears with no penalty. `POST /video/token` requires
  `FlameRiteAcceptedAt`; TTL is `dating.flamerite.duration_minutes` (5) until `FlameRiteCompletedAt`
  is set by `POST /video/complete`, the long TTL afterwards. `ConfirmAsync` refuses a pledge with
  `FlameRiteIncomplete` while `dating.flamerite.required` is on — flipping it is the retreat, and
  `video.enabled=false` also lifts it so pledges cannot deadlock. The completer earns the
  Flamekeeper honour on the first rite; both participants are paid `VideoCallDone`.
- Realtime: four events on `app-nudges` (`flame_rite_proposed|accepted|declined|completed`), not
  the spec's single one. The locked pledge CTA is on the per-match activity screen.

**Known deferral:** the second photo still unblurs at 5 messages, so a pair who just met on
video may still have a blurred photo between them; milestone-based reveal and un-paywalling
`HasKids` were explicitly deferred.

**Verified live 2026-09-01:** the full two-account ladder at the API level, including the
`dating.flamerite.required` retreat and return.

---

## Duplication & Round-Trip Audit — Shipped (2026-08-19)

- **Real defect:** only `RequestMatch` checked `BlockedUsers`; Ships checked nominees against
  the Weaver but not each other, Town Square not at all — and the circle method makes a blocked
  pair on opposite sides of a roster meet with certainty. `Services/MatchPairing.cs` now owns
  `IsPairBlockedAsync` / `PairAlreadyMatchedAsync` / `PairLockKey` / `NewMatch` and all three
  creation paths route through it, failing quietly so a block cannot be inferred.
- Extracted `MatchAccessExtensions.LoadParticipantMatchAsync` (was 20 identical guards),
  `InviteCode` (shared alphabet), `components/ui/HeaderBar.tsx` (composed by both headers, which
  were not merged because `GameHeader` also owns the HUD and toast stack).
- `TotalScore` / `GemTier` / `ReputationScore` left `UserResponse`; only `ScoreDetailResponse`
  carries them, since only `scoreDetail` is refreshed by `applyScoreBump`. Discover candidates got
  their own `Candidate` type for the other user's tier.
- The 15–30 s `refetchInterval` safety nets behind broadcasts were kept on purpose:
  `SupabaseBroadcastService` is best-effort and nothing is broadcast on Town Square's
  `Open → Locked` transition.

---

## Town Square — Shipped (2026-08-14; recorded from the code 2026-08-31)

**What it is.** Scheduled speed-dating over video: RSVP, roster locked at the deadline into a
round-robin of short Agora calls seeded with an icebreaker question, private Yes/No after each
round, mutual Yes creates an ordinary `Match`.

**Mechanics (code is authoritative — `TownSquareService.cs`):**
- `TownSquareSession.Status`: `Open → Locked → InProgress → Completed`, or `Cancelled`.
  `POST|DELETE /townsquare/rsvp` only while `Open`; `GET /townsquare/next-session`.
- `TownSquareSchedulerBackgroundService` sweeps every 10 s (singleton + hosted): locks rosters
  past `RsvpClosesAt`, starts past `ScheduledStartAt`, advances rounds as they elapse. While
  `townsquare.enabled` (or `video.enabled`) is false it only advances sessions already in
  progress; the user controller returns 404 `square.disabled` via `TownSquareEnabledFilter`.
- Roster lock: RSVPs by `RsvpAt`, split `Male`/`Female`, each side capped at
  `townsquare.max_per_side` (5) and truncated to the smaller side; zero pairs → `Cancelled`.
  `GenerateRoundRobin` yields n rounds of `townsquare.round_seconds` (240), each with the r-th
  active icebreaker as a conversation prompt.
- `GET /townsquare/session/{id}/current-round` returns the pairing, an Agora token on the pairing
  id, the prompt and `roundEndsAt`. `POST /townsquare/pairing/{id}/respond { Yes|No }` writes the
  caller's slot atomically; both Yes → block check → `CreateOrReuseMatchAsync` under the shared
  advisory lock, returning `matchId`, pushing both users and broadcasting `match_created`.
- Realtime topic `townsquare:{sessionId}`: `session-started`, `session-cancelled`,
  `round-advanced`. Admin: paged sessions with RSVP counts, per-round pairings, and (since
  2026-08-31) create + cancel — sessions are scheduled one at a time by an admin; no recurrence.

**Not built:** pairing is strictly `Male × Female` and any other `Gender` RSVPs but is never
rostered; overflow RSVPs are dropped at lock time with no notice; no score, quest or honour is
attached to attending; the icebreaker is never answered (the scaffolded response table was
dropped 2026-09-04).

---

## Phone Verification via verify.mn — Shipped (2026-08-31; hardened 2026-09-06)

Replaced the stubbed OTP flow (any 6 digits accepted; anyone could claim any number) with real
ownership proof via **verify.mn**, a Mongolia-only **Mobile-Originated** SMS API: the user texts
*our* code *to* shortcode 144773. No outbound SMS, nothing to type — the auth screen shows
verify.mn's Mongolian `displayInstruction` verbatim, a one-tap `sms:` button, a TTL countdown and
a 3 s poll.

**Shipped:** `VerifyMnClient`, `PhoneVerificationService`, `AuthController`
(`/auth/phone/start|status|callback|claim`), `PhoneVerification` + `AddPhoneVerifications`
migration; app `useAuth` rewritten around start / poll / complete, `(auth)/otp.tsx`,
`PhoneChangeModal` for the settings phone change.

**Decisions worth keeping:**
- **The engine owns the proof.** `POST /users` refuses a new account without a claimed
  verification and takes `PhoneNumber` from it; `PUT /users/me/phone` requires the same proof.
  The JWT's `user_metadata.phone` is client-written and, since 2026-09-06, consulted nowhere
  while verification is configured (it had still been driving the returning-user alias — see the
  2026-09-06 entry).
- **A claim is single-use** (conditional `UPDATE … WHERE "ClaimedByUserId" IS NULL`), has a
  30-minute window, and is refused when an *existing account* proves a number that belongs to
  someone else. An account-less identity proving such a number is sign-in: the middleware aliases
  it onto the owning account (`PhoneVerificationService.ResolveAliasAsync`).
- **Sessions are per caller.** `start` is anonymous, so a pending session is only resumed for a
  caller presenting its id (`ResumeVerificationId`, which the app remembers per number so
  re-entering it costs one SMS, not two — each SMS costs the user 150₮). One number holds at most
  five pending sessions (`429 phone.too_many_attempts`). Until 2026-09-06 the in-flight session
  was returned to anyone who asked, which let an attacker race the owner's claim.
- **Unset key = inert enforcement.** With no `VerifyMn:ApiKey`, `IsConfigured` is false and
  the pre-verify.mn behaviour stands (tests rely on it). **Production must set the key or the gate
  is off.**
- **The callback is a hint, never evidence.** No body, no signature; it only triggers a re-read
  of `GET /sessions/{id}`. `CallbackBaseUrl` stays empty unless the engine is publicly reachable,
  because verify.mn retries failed callbacks.

---

## Security & Data-Hygiene Hardening — Shipped (2026-08-31)

- **Admin login lockout.** `LoginThrottleService` locks a username+IP pair for 15 minutes after
  5 failures in 15 minutes, 429 with `Retry-After`. In-memory, per-instance.
- **Deletion deletes.** `/uploads` is public, so anonymisation and `PUT /users/me` call
  `LocalFileStorageService.DeleteByPublicUrl` (matching on the path beneath the uploads root, since
  `Storage:PublicBaseUrl` legitimately differs per environment); `PhoneVerifications` rows are
  purged for anonymised users and stale unclaimed rows after 24 h; the service refuses paths that
  escape the root.
- **Input length caps** centralised in `DTOs/FieldLimits.cs`; the app composer caps at the same
  2000 chars. Validation attributes on record DTOs must sit on the constructor parameter —
  `[property: …]` throws at model-binding time, which only a live smoke test caught.
- **CORS allowlist.** `Cors:AllowedOrigins` from config; Development without it is permissive
  but drops credentials; Production refuses to boot without it.
- **Sweep no longer loads whole tables:** staleness in SQL via `GhostingService.StaleAfter`,
  budget reset and membership expiry as single `ExecuteUpdateAsync` statements.
- **Reveal floor.** The stored `RevealLevel` is a floor (`Math.Max`) over the message-count
  level, so a fresh match shows name + photo + bio instead of nothing.
- Not done: general API rate limiting beyond the admin login.

---

## Error-Handling Consolidation — Shipped (2026-08-31; codes 2026-09-01)

`DomainException` carries business rules and `ExceptionHandlingMiddleware` maps it centrally;
services no longer signal rules with framework exception types (which EF also throws, so a
controller catching them could echo internal text as a 400). Every error response carries a
stable `code` beside its English `error` (`ErrorResponse(Error, Code)`); the app maps `code` →
`err_<code>` i18n keys (EN + MN) and an unmapped code falls back to the caller's localised copy,
never the server's English. App: a global `QueryCache.onError` with a 10 s cooldown for reads
(screens with their own error state opt out with `meta.silentError`), `notifyUser()` throttled.
Control: `lib/apiError.ts`'s `serverError` on every page's `onError`, still keyed on the English
`error` (internal tool; `admin.*` codes are English-only on purpose).

---

## Dev Database Reseed + Behavioural Pass — 2026-08-31

`mingldingl_engine/scripts/reseed-dev-db.sql` is the standard reseed (it exempts `AdminConfigs`
and `ContentPages` — the first run destroyed the authored guides copy, restored from a `pg_dump`).
The old database had zero icebreakers and quizzes, which hid a **P0**: `GET /engagement/icebreaker`
drew a random question per request while completion required both users to answer the *same* one,
so the icebreaker completed ~14 % of the time and the quiz had the identical bug. Both now pick
deterministically from the match id (`StableIndex`, SHA-256 — not `GetHashCode`, which is
per-process randomised). Seven tests that only passed on an empty database were scoped to their
own fixtures. The reveal ladder was walked against real data exactly per the design table.

---

## The Campaign (Dungeon Crawl) — Shipped (2026-09-01)

**What it is.** A per-match "dungeon map" rendering the existing engagement ladder as seven
rooms a pair clears together. **The anti-annoyance rule is structural:** the campaign is a lens
over the ladder, never a gate on it. Room state is purely derived from match state — no
progression state machine, nothing to desync, no new preconditions on any flow, no new pushes.
The only interaction is optional chest claiming; ignoring it costs nothing.

| RoomId | Name | Cleared when (derived) |
|---|---|---|
| `gate` | The Meeting Gate | always |
| `echoes` | Hall of Echoes | `Match.IcebreakerComplete` |
| `runes` | The Rune Chamber | both users have a `QuizResponse` for the match's quiz |
| `voices` | Gate of Voices | `Match.MessageCount >= campaign.voices.messages` (15) |
| `flame` | The Flame Altar | `FlameRiteCompletedAt != null \|\| VideoRewardClaimed` |
| `bridge` | The Pledge Bridge | a completed `DateConfirmation` |
| `threshold` | The Dragon's Threshold (boss) | both sides answered attended = true |

Rooms are independent; "current room" is the first uncleared one. `CampaignRoomClaim`
(unique `(MatchId, UserId, RoomId)`) records per-user chest claims; `CampaignService.ClaimAsync`
409s an uncleared or already-claimed room and pays `campaign.room.bonus` (5) / `campaign.boss.bonus`
(25) as `CampaignRoomBonus` / `CampaignBossBonus` events; the boss grants the Seal-Breaker honour.
`campaign.enabled=false` makes both endpoints 404 and the app hides its chat entry banner. The
claim endpoint works on ghosted matches on purpose (already-cleared rooms stay claimable). App:
`app/campaign/[matchId].tsx` (vertical path, knot medallions, current-room `QuestBanner` deep
link), `useCampaign`, invalidation added to the five realtime handlers that clear rooms.

**Verified live 2026-09-01:** the full seven-room two-account walk, the ledger, and the kill
switch (via the `AdminConfigs` row + restart; the admin Config page path was not exercised).

---

## Ulzii Design Language — Shipped (2026-09-01)

Mongolian ornament rendered from geometry replaces the generic-fantasy corners, rivets and
dividers: **өлзий** (the endless knot, a billiard-path interlace) and **алхан хээ** (the walking
fret). Doctrine: edges and thresholds only, never behind text or over photos; three metals with
three meanings (gold default, ember for stakes — boss, Rite, Oath — brass for utility, no fourth);
a density ladder (2×2 corners, 3×4-ish sigils, 5×5 set pieces, at most one grand knot per
screen); static PNG by default.

`mingldingl_app/scripts/gen-ornaments.js` (pure Node, no dependencies) rasterises the nine
assets in `assets/ornaments/` at 3×; `lib/ornaments.ts` is the registry. Carriers: `AppCard`
corners, `SectionDivider`, `XPBar` fret, `QuestBanner medallion="knot"`, `CharacterCard`'s woven
frame, `OathSigil` (per-oath sigil images), campaign room medallions. `Alegreya SC` is
`FONTS.utility` for small-caps labels. Deferred: Skia shimmer on the Oath sigil / boss seal,
unlit empty-state knots, festival-tinted variants. Playwright note for RN-web: `fill()` does not
reach a controlled `TextInput` (focus + `page.keyboard.type` does) and button presses need
`element.click()` in `evaluate`.

---

## Design Token Consolidation — Shipped (2026-09-01)

`lib/theme.ts` is the single source of every colour, size and space value. `FONT_SIZES` had been
imported by nothing while 241 raw `fontSize` literals spread across 19 values; every size, spacing
and radius literal in `app/` and `components/` was snapped to the scales by codemod, `SPACE` is a
strict 4 px grid, `RADIUS.pill` and `circle(size)` exist, all raw `rgba()` route through
`tint()`/`overlay()`/`FILL`, and `BUTTON_METALS` holds GameButton's variant table unchanged.
`components/ui/CardEyebrow.tsx` replaces ten hand-copied eyebrow labels and sets them in
`FONTS.utility` (verified `AlegreyaSC_700Bold` carries Cyrillic Ө/Ү). `lib/tiers.ts` references
`COLORS` instead of restating hexes; the twelve gem/shade hexes there are a deliberate second
palette. Not checked on a device — Mongolian labels are longer than English.

---

## Admin Control Expansion — Shipped (2026-09-04)

`ConfigKeys.All` grew from 9 to 61 keys (Scoring 23, Budget 7, Membership 4, Quests 12, Safety 7,
Growth 8): every score delta, the four remaining tier thresholds, the reputation dock, daily-match
base/cap/divisor per membership, membership prices and discounts, quest XP and targets, ghosting
staleness, attendance-check delay, deletion grace, ship expiry, Town Square sizing, the campaign
Voices threshold, and three kill switches — `ships.enabled`, `townsquare.enabled`,
`video.enabled`. `ConfigKeyDefinition` carries optional `Min`/`Max` enforced on write and re-checked
on boot (`AdminConfigSeeder` resets an out-of-bounds value, and a tier ladder that is not strictly
increasing, to defaults with a warning). `ScoreService.GetDelta` / `DailyMatchBudget`,
`GhostingService.IsStale`, `QuestService.QuestsForDate` and the membership tier list stopped
being static; `MembershipCatalog` serves the app, admin pricing and analytics from the same keys,
and `ScoreService.BaseBudgetFor` keeps advertised and enforced daily matches identical. Config
edits never rewrite `ScoreEvents` history — `Delta` is stored per event.

**Kill-switch semantics:** `townsquare.enabled=false` (or `video.enabled=false`) is a 404
`square.disabled` on every user route via `TownSquareEnabledFilter`, and the scheduler only
advances sessions already in progress; `video.enabled=false` also 404s token minting and the rite
endpoints, and `ConfigService.FlameRiteRequired` folds it into the pledge gate so no match is
required to complete a rite it cannot start; the chat hides `FlameRiteCard` via
`MatchResponse.VideoEnabled`. The app shows the localised code copy rather than hiding entry
points. `score.event.GhostPenalty = 0` still writes the event the Oath logic reads;
`score.quest_chest` and `score.event.DailyLogin` have Min 1 because a zero claimed award is refused.

**Deliberately kept hardcoded:** login throttle, password hashing, phone-verification windows,
photo compression and upload limits, page sizes, sweep intervals, the reputation floor, streak
halving. `ConfigField` in the control panel still ignores bounds (the server error shows in the
toast).

---

## Screens stand on their own ground — the transparent-transition glitch (2026-09-10)

Pushing The War Room (and any other screen) drew the incoming and outgoing screens *through each
other* for the whole transition: ~350 ms of the War Room superimposed on the Character Sheet, and
the Quest Log visible through a chat as it slid up. Recorded on the Galaxy A51 with `screenrecord`
and read frame by frame. Root cause: every screen was transparent (so the one world floor behind
the navigator could show through), and a native stack keeps the outgoing screen attached until the
incoming one has appeared — with both transparent, every animation is an overlap, and even
`animation: 'none'` left a frame or two of composite. Fix: the Stack's `screenLayout`
(`ScreenGround` in `app/_layout.tsx`) wraps every screen in an opaque `COLORS.bg` view that carries
its own `WorldFloor`, so screens stay background-free but cover each other properly; the root-level
floor is gone. `animationFor` now returns `'none'` for lateral moves (it said "instant" and
returned the platform default), keeps `slide_from_bottom` into a delve — which now reads as a real
slide — and `fade` under reduce-motion. `lib/world/__tests__/travel.test.ts` pins the table.
Verified: the War Room push is a clean cut and the chat push an opaque slide.

---

## The Answering Hold — creative effects wave — Shipped (2026-09-10)

**Why.** What makes a mobile game feel alive is feedback and rhythm, not art: every action answers
back, the screen moves on its own, and progress is always visible with a gap to close. The app had
the ceremonies and the world layer but ordinary taps went quiet, numbers jumped and most gaps were
hidden. Eleven pieces shipped in one wave, built by parallel agents from one plan and verified
together (app 845+ tests / 93 suites, engine 935, typecheck, control lint+build) and on the
Galaxy A51. Left out on purpose because a phone would struggle or the data does not exist yet:
parallax, ambient soundscapes, continuous Skia shimmer, lit windows on the atlas, "held by few".

**Every action answers back.** `GameButton` squashes to 0.97 and fires a new `press` world event
(soft haptic + `tick.wav`); `horn.wav`/`horn` added for the Gate — both rendered by
`scripts/gen-sounds.js` (now eight sounds). `components/ui/CountText` ticks any number from its
previous value (600 ms ease-out, static under reduce-motion) and is used by `ScoreHUD`, `XPBar`,
`DailyBudgetMeter` and the profile total; `ScoreHUD` floats a `+N`/`−N` from the score on change.
Tier-up is a ceremony (`TierUpCeremony`): the old gem shakes, cracks and dims, burst, the new gem
springs in under its torch glow; on dismiss `lib/world/session.ts` remembers the tier colour for
the session and `WorldFloor` paints it as a faint second tone (alpha 0.10). A chat whose only
message is the other person's first renders it as a folded letter with a wax seal
(`SealedLetter` + `useSealedLetter`, once per match per session); tap breaks the wax and folds it
away into the bubble.

**The hold moves on its own.** `dayPhase()` (dawn/day/dusk/night) offsets every room's light
(−0.10/0/+0.08/−0.15) and gives the canopy vignette the phase's temperature, re-evaluated each
minute in `WorldProvider`. In the Deep, `delveLight` is the warmer of campaign torches and
`conversationWarmth`: 1 within an hour of the last message, ebbing to 0.1 at the 48 h ghosting
window — the pre-ghost nudge told as a fire going out. `useWorldState(matchId)` reads the messages
cache for it. Ember honours breathe (opacity 0.75↔1, 2.4 s); gold ones shimmer once on mount.
Festival days (`useActiveFestival`) tint every card corner and divider in the festival colour and
give the Town Square card a festival eyebrow.

**Progress with a gap to close.** The hall: an emblem per honour (`HONOUR_ICONS`), ignition when
an honour arrives while watching (`useIgnition`: burst, outline→metal, border sweep, `honour`
signal), near-miss rules on dark slots (`useHonourProgress`: streak of 7, oath encounters, threads
sparked 1/5/10 — the engine's `ScoreDetailResponse` gained `ThreadsSparked`), the thread triptych
drawn as one chained row with a thread lighting between held neighbours, and long-press for a lore
line (`honour_lore_*`) with Wear / Take off. The streak is a lantern (`Lantern`): one flame per day
toward seven, "4 of 7 dawns", lost flames blow out. Score history is a chronicle
(`CHRONICLE_KEYS` → `chronicle_*`, EN+MN, one saga line per event type with a small-caps dateline).

**Reasons to return.** `NextGatheringPill` (horn + countdown to RSVP close or start) on Seek and
the Hearth tab. The verify screen is the Gate (`GateScene`): closed while the gatekeeper listens,
the horn sounds when the SMS app opens, the gate swings open with `ascend` on VERIFIED, barred on
expiry.

**Device-verified:** countdown pill, streak flame in the HUD, the hall (emblems, 4 of 7, 0 of 2,
0 of 1/5/10, triptych), long-press story, ignition (Flamekeeper lit in place), two chest opens, the
Amethyst reforging and the purple floor tint after it, the lantern, the chronicle, the sealed
letter and its unfold, the warm Deep after a fresh message. Two fixes from the device pass: the
ceremony printed the tier name twice and said "Take Bounty" (now the coloured title alone and
"Continue"), and the wax seal sat over the letter's caption. Not device-verified: the Gate (needs a
sign-out and a SIM), festival tint (no festival today), time of day (daytime offset is 0).

**Wave 2, not started:** the personal sigil and the knot of two, the encounter scroll.

---

## Honours as a Trophy Hall — Shipped (2026-09-10)

The Honours card mixed nine deed-granted titles with "Rings of the Tiers", a six-slot picker of
frames unlocked by gem tier. The rings said nothing (ring colour = tier colour, already the gem
badge on the same screen), a ring below one's tier was a choice nobody wanted, and only the wearer
ever saw it — so the card read as a wardrobe under copy that promised "earned by deeds". **Tier
frames are gone end to end:** migration `RetireTierFrames` drops `Users.EquippedFrameId`;
`EquippedFrameId` left `UserResponse`, `CandidateResponse` and `PartialUserProfile`;
`HonourService` is titles-only (`Honours`, `Find`, `GrantAsync`; `Catalog`/`TierFrames`/frame
helpers removed); `ScoreService` no longer clears a frame on demotion; `GET /users/me/items`
returns held honours newest-first and `POST /users/me/items/{id}/equip` toggles the title only.
The avatar ring takes the tier colour on the client (`ProfileAvatar` has one `tierColor` prop).

The card is now a **trophy hall**: all nine honours always shown in catalogue order
(`HONOUR_IDS` in `lib/tiers.ts`), lit in their Ulzii metal with the date earned, dark with the
deed as the hint (`HONOUR_DEED_KEYS` → `honour_deed_*`, EN + MN) until then, `n / 9` in the eyebrow
row, `honours_hint` under it. Tapping a lit honour wears it as the title (toggle); dark slots are
inert. Milestone chests keep their row. Removed copy: `no_honours`, `frames_title`,
`frame_locked_at`, `item_frame_*`. Verified on the Galaxy A51: 0/9 dark hall, two honours
granted → lit with dates, tap → "Equipped" and the title under the display name, ring stays Opal.
Tests: 934 engine, 711 app. API types regenerated in both frontends.

---

## Honours Replace Loot — Shipped (2026-09-05)

Random loot drops (`LootService`, catalogue of frames/emblems/titles, daily 3-drop cap,
`DuplicateLoot` +10) were retired for nine **named honours granted for a deed, once**
(`HonourService.GrantAsync(userId, itemId, deed)`; a second grant is a no-op). The wire field
`rarity` survives carrying the Ulzii metal — `Ember` for honours with stakes, `Gold` for the rest.

| Honour | Deed | Hook |
|---|---|---|
| Oath-Keeper | Oath proven | `OathService` |
| Flamekeeper | first completed Flame Rite | `VideoController.MarkComplete` |
| Seal-Breaker | campaign boss claimed | `CampaignService.ClaimAsync` |
| Thread-Weaver / Fate-Seer / Bond-Keeper | threads sparked 1 / 5 / 10 | `ShipService` |
| Ally-Caller | first completed recruit | `ReferralService` (inviter only) |
| True to Word | an encounter both sides confirmed attended | `ActivityService.SubmitAttendanceAsync` |
| Seven Dawns | seventh consecutive daily login | `ScoresController.DailyLogin` |

Icebreaker/quiz responses lost `droppedItem`; the quest chest and milestone open pay XP only;
`POST /users` no longer returns a referral item. **Tier frames are derived, never stored:**
`GET /users/me/items` lists honours plus `HonourService.FramesUnlockedFor(user.GemTier)`; equip
validates against the tier; a negative score delta clears a frame that now sits above the tier.
Migration `RetireLootForHonours` is data-only (hand-written; applied with `dotnet ef database
update` — `Program.cs` does not auto-migrate). App: `HonourCase` (honours grid + six-tier ring
ladder), `METAL_COLORS` / `frameIdForTier` in `lib/tiers.ts`, "Honour earned" toast. A
traditional-Mongolian-script seal layer was built and removed the same evening at the user's
request; do not propose it again.

---

## Audit Fixes — 2026-08-31

`date_confirmed` broadcast carries `userId`; chat history pages via
`GET /matches/{id}/messages?before=&limit=` with a "load earlier" control; reveal fields and the
daily-match budget are actually rendered (Matches list gating, `DailyBudgetMeter` on Discover);
admin `UserDetail` shows Oath state, `noShowFlagCount`, ban and membership expiry with
`reset-noshow`; analytics tiles for Oath / No-show / Flame Rites / Ships / Town Square;
`match_created` broadcast + push on the Fated Threads spark and Town Square mutual-yes; the ship
share text finally carries the `/public/ship?code=` URL.

---

## Bug Sweep — 2026-09-05

Latent defects found by inspection while the whole suite was green, each closed with a test that
fails on the old code:
- **`/public/ship` never rendered.** Its inline script had an unterminated string literal, so the
  browser discarded the block and every visitor sat on "Reading the thread…". The existing test
  found the copy — inside the dead script. `LandingPageScript_HasNoUnterminatedStringLiteral`
  now scans both public pages.
- **Only one Flame Rite participant was ever paid.** `VideoRewardClaimed` was one flag per match;
  now per participant (`Initiator|ReceiverVideoRewardClaimed`, migration
  `AddPerParticipantVideoRewardClaims`, backfilled so no historical match pays twice).
- Ghosting clamped `RevealLevel` against the stored floor; `SendMessage`'s retry lambda detaches
  its own stale `Added` message so a retried send cannot insert twice; message pages order by
  `(CreatedAt, Id)`.

---

## Drift & Gap Audit — 2026-09-05

- The app pinned its own reveal ladder (`[5, 15, 30]`); `GET /engagement/reveal-thresholds` now
  serves the effective ladder and `lib/reveal.ts` hydrates it. Activity suggestions gate on
  `activity.suggestions.messages` instead of a literal 15.
- **Push notifications localised per recipient.** `User.PreferredLocale` (set at `POST /users`,
  synced by `useSyncPreferredLocale`), `PushCopy` carries every kind in EN + MN, `NotifyUserAsync`
  takes a `PushKind`. Four kinds added (`flame_rite_accepted`, `date_confirmed`, `match_ghosted`,
  `townsquare_started`). The Expo round-trip moved off the request path into
  `PushDispatchBackgroundService`, which also deletes tokens Expo reports `DeviceNotRegistered`;
  anonymisation purges `PushTokens`.
- `CorsOrigins.Parse` accepts a comma-separated list, which docker-compose passes.
- Spec drift in the plan corrected (fonts, gem hexes, OTP screen, route inventory, score table,
  the never-built call cap, chat not gated on the icebreaker).

---

## Untouched-Code Bug Hunt — 2026-09-06

Every file with one or two commits since the repo began was read end to end. Two serious findings
sat in the phone-identity path, unrevisited since verify.mn replaced Supabase OTP; each fix landed
with a test that fails on the old code.
- **Anyone could become any user by typing their number.** `CurrentUserMiddleware` aliased an
  account-less `sub` onto whichever account owned the phone in the JWT's `user_metadata.phone` —
  a field the app writes with the anon key, so an attacker could write a victim's number after an
  anonymous sign-up and run as them. The alias now goes only through a claimed verify.mn proof
  (`ResolveAliasAsync`); the metadata alias survives only while `VerifyMn:ApiKey` is unset.
  `ClaimAsync` lets an account-less identity prove a number that already has an account (that is
  sign-in) while an existing account still cannot take another's number.
- **A pending verification could be hijacked.** `StartAsync` returned the in-flight session for
  a number to whoever asked, so an attacker polling `start` for a target saw the same id and code
  and won the single-use claim by polling faster. Sessions are now resumed only with
  `ResumeVerificationId`, capped at five pending per number; the advisory lock that serialised
  starts per phone went with the sharing.
- Anonymisation purges verification rows by number as well as claimant (an aliased identity's
  rows are claimed by the `sub`, not the account id); the admin login throttle evicts stale
  unlocked entries instead of failing open when full; a malformed `Admin:PasswordHash` is a 401,
  not a 500.

---

## Moderation, image safety and notification delivery (2026-09-08)

A hunt across image upload, banning, reporting and notifications turned up 14 findings; all are
fixed. The through-line is that three of the four areas had a lever missing rather than a lever
broken.

### Reporting, which did not exist

`ScoreService` had carried a `ReportPenalty` delta since the beginning that nothing could ever
award: there was no report endpoint, no table, no admin queue, and no UI. Blocking was the only
lever a user had, and `POST /matches/{id}/block` only reaches someone you are already matched with —
so a Town Square stranger could not be blocked at all. Now: `UserReport` + `ReportService`,
`POST /reports` (seven reasons, optional details, one open report per pair), a `ReportUserSheet`
reachable from the chat options and from the Town Square round screen, and `/admin/reports` with a
queue, per-user report history and four outcomes. `Penalised` is the only thing that spends the
score delta and `Banned` suspends the account — both admin decisions, never automatic, or any two
accounts could drive anyone's score down on demand. Filing a report blocks the reported user and
ends the conversation in the same write.

The sheet's copy is English-only for now and sits on `AWAITING_MN_TRANSLATION`; the error strings
are translated. Safety copy is the last place for a guess at Mongolian.

### Photo ownership

`IsOwnedPublicUrl` validated a photo URL's *origin* but not whose directory it named, and
`GET /matches/candidates` hands out every candidate's full photo list. So anyone could put someone
else's photo on their own profile — wearing that person's face — and then, by dropping it again,
run `PUT /users/me`'s unlink against the victim's real file on disk. The check is now scoped to
`photos/profiles/{ownerId}/`, and both unlink paths (the update, and deletion-anonymisation) refuse
a file that is not the user's own, so a URL stolen before the fix cannot destroy anything either.

### The rest

- **Decompression bomb.** `Image.LoadAsync` ran on up to 15MB of attacker-chosen bytes with no
  pixel cap; a ~1MB PNG declaring 30000×30000 takes the process to several GB. The header is read
  first now (`MaxPixels`, ~60MP), and `POST /photos/upload` is rate-limited per user.
- **Orphaned uploads.** An upload is issued when a photo is picked and only lands on a row when the
  profile is saved, so every abandoned edit left a permanently public file behind and nothing
  bounded the disk. The daily sweep now deletes unreferenced photo files older than 24h, comparing
  relative paths (a live photo recorded under an older `PublicBaseUrl` must not read as an orphan).
- **Long Mongolian messages produced no push at all.** A chat push carries the message verbatim and
  2000 characters of Cyrillic is ~4000 bytes against Expo's 4KiB limit; the `MessageTooBig` ticket
  was discarded along with every other non-`DeviceNotRegistered` error, and the HTTP status was
  never checked. Copy is truncated to a byte budget on a rune boundary, and Expo's refusals are
  logged.
- **Push registration was tied to mount, not to the session.** Signing out unregisters the token,
  so the next person to sign in on the same launch had no notifications until a force-quit; a cold
  start could also register before the stored session was restored and swallow the 401. The effect
  now keys on the user id. Android had no notification channel at all, so every push landed in
  Expo's fallback channel at default importance — no heads-up banner, no sound.
- **`POST /push/unregister` matched on token value alone** — an IDOR letting any account silence any
  device whose token it could name. Tokens are also now format-checked and capped at 10 per user,
  and the DTO has a length limit like every other string on the API.
- **A ban left the other side stranded.** Banned accounts kept receiving pushes and their partners
  sat in Active threads that could never be answered. Banning now ends those conversations, and
  `NotifyUserAsync` skips suspended and pending-deletion recipients.
- **Blocking did not reach Town Square.** The round-robin seated every man opposite every woman;
  the block check ran at match time, long after the encounter it was meant to prevent. Blocked
  pairs are dropped from the rounds (both sit that one round out), and the start notification now
  reads the whole session rather than round one.
- **Admins could not remove a single photo** — the only answer to one objectionable image was
  banning the account. `POST /admin/users/{id}/photos/remove` takes it off the profile and deletes
  the file.
- The ban 403 now carries a `code` like every other error, and the app renders a suspension screen
  instead of failing every query with a shrug. `image/heic`/`image/heif` left the upload allowlist:
  ImageSharp cannot decode either, so they always failed as "unreadable". Picking the same photo
  twice no longer duplicates a grid key, uploads the file twice or deletes both tiles at once.
  Upload failures now show the engine's own reason.

939 engine tests, 687 app tests, control builds clean.


## The world layer switched back on, and the reveal got its moment (2026-09-10)

An audit of the visual-effects layer found the machinery in good shape and the *values* switched
off — a lighting system built, then turned down to nothing to work around a texture bug.

**Rank became visible again.** `TIER_PRESENCE` (ring weight + glow per tier) had been defined and
tested for weeks and read by no component; `GemTierBadge` still gated all three of ring, glow and
shimmer on a hard `tierIndex >= 3` cliff, so tiers 1-3 rendered identically to each other and tiers
4-6 identically to each other — six rungs of data drawn as two, on the badge that carries the
product's whole identity. `presenceForTier` turns one row of the table into the three numbers a
badge needs, clamped for the size it is drawn at, and `TorchGlow` gained a `strength` scale.
Normalised against the table's own top, so the hero badge is unchanged and only the lower rungs
dim. Regression-tested as a ladder rather than through a render.

**Effects stopped being invisible on the surface they are developed on.** `VfxLevel`'s `reduced`
conflated two unrelated facts — "no Skia renderer here" (web) and "this person asked for less
motion" — and `EmberField`, `FogDrift` and `ChestBurst` all answered it by rendering *nothing*, so
the entire vfx layer was blank in the browser. The levels are now `full` / `plain` / `still` /
`off`, precedence off > still > plain > full: `plain` gets React Native `Animated` fallbacks at
half density, and `still` renders each effect's static form — nothing at all for the ones that are
purely motion, since a still ember is a speck of dust rather than a dim ember. Travel animation
and the light fade followed the same correction, having both been gated on "is this Skia".

**Six light signatures that rendered as one.** After the brick floor was replaced, both floor
textures resolved to the same colour and all six signatures washed `silver` at 0.00-0.06 alpha —
the Gate and the Tavern were the same room. The wash had twice failed the same way: painted in
front of the content, any colour strong enough to tell rooms apart read as a film over the UI.
The room's `tone` therefore moved to `WorldFloor`, *behind* the navigator, as a bottom-anchored
gradient where it cannot touch a word of text and can be as warm as the Tavern needs; the canopy
kept only the vignette, which now carries a per-room `edge` because night has a temperature too.
The test that guarded the old rule ("every wash is the same colour") was replaced by one that
guards the failure it caused: no two signatures may render identically.

**The Unsealing.** Progressive reveal is the mechanic the product is built on, and its entire
visual treatment was a 36px tile swapping a padlock glyph for an image. Crossing a rung now dims
the room, sets an Ulzii knot as the seal, breaks it into the existing chest-burst particles with
the `sealBreak` haptic, and resolves the newly unlocked photo out of blur. `useUnsealing` reports
only a level that climbs *while you are watching* — the first level seen for a match is recorded
silently, so opening an old conversation never replays a ceremony it earned days ago. It adds no
new copy: headline and subline are the strings the reveal strip already uses, so it shipped in both
languages rather than joining the `AWAITING_MN_TRANSLATION` list.

**Light that arrives rather than catches up.** Rising light springs with a small overshoot and
settles; falling light keeps the flat fade. A match landing makes the Hearth swell; losing
something is not given a flourish.

Device-verified on a Galaxy A51: the Tavern reads as firelight on the floor with the panels and
body copy untouched (bottom gutter measured warm at (36,26,17) against the Road's cool (19,22,29)),
and the ceremony was driven end to end by crossing a real reveal threshold in a seeded chat. Two
defects the device caught and the tests could not: the scrim was sheer enough that chat bubbles
showed through the headline, and the plate was too small — both fixed and re-verified.

939 engine tests, 710 app tests, control builds clean.
