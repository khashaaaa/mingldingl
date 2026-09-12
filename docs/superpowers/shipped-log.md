# MingldIngl — Shipped Log

Archive of everything that has shipped, pruned to outcome summaries: what shipped, the mechanics
that are not obvious from a file listing, what deviated from the design, and the decisions worth
not re-deriving. The code is the authoritative reference for everything else. Open items live in
[`project-plan.md`](project-plan.md) under Outstanding Follow-ups, not here.

Check this file before assuming a feature doesn't exist yet. Entries are in the order they were
written, not by date.

---

## Sealed Fire — Wave 1, the kit (2026-09-12)

Sixteen commits `c422a4a..e4399b7`, no behaviour change, no new i18n key, nothing written in
Mongolian. Verified on the Galaxy A51 dev build (Seek, Quest Log, Town Square, Missions, Character,
War Room, the photo-source sheet, the phone-change strip with the keyboard up).

- **Glyphs.** `components/ui/Glyph.tsx`: fourteen woodcut SVG glyphs (`react-native-svg`
  15.12.1 — a native module, so a new EAS dev build was made and installed), stroke 2.4, square
  caps, mitre joins, on the five tabs and six quests. `Icon` (MaterialCommunityIcons) stays for
  everything else, including header room icons — a Wave 2 candidate.
- **Rooms.** `lib/world/light.ts` recipes pushed (`warm`/`hot` tone alpha 0.45, `cold` on
  `TONE.ink`, `dark` on `TONE.soot`); a room-distinctness test resolves floors through
  `resolveFloorColor`, a model of `WorldFloor`'s compositing, and asserts an RGB distance floor.
- **One hero.** `AppCard hero` replaces `textured`: knots, parchment and glow only on the one
  hero per screen (four heroes; eleven screens have none because their board draws no knot).
  `lib/__tests__/hero.test.ts` caps `hero` at one per file via the JSX scanner now exported
  from `lib/testing/sourceTree.ts`.
- **One forged button.** `GameButton ink` (underlined hairline text, no metal). Exactly one
  forged (`primary`/no-variant) button per file outside `components/modals/**`, and every
  `ghost`/`brass` secondary outside modals is ink except sheet-picker rows and the gender
  chip pair (a state). `lib/__tests__/forged.test.ts` guards both, with a `BRANCHED` allowlist
  for `PhoneChangeModal` (two primaries in mutually exclusive branches).
- **States.** `Waiting` is a flickering candle (still under reduced motion); `LongWait` burns the
  same candle; `StateBlock` draws a place per icon name from `components/ui/Places.tsx` (ten
  drawings) or the ember for danger/warning — tone beats name.
- **Interruptions.** `AlertModal` and `SheetModal` are bottom parchment strips (`DialogStrip`:
  2px top rule, parchment gradient, transparent backdrop, keyboard clearance via
  `useAndroidKeyboardHeight` on Android and `KeyboardAvoidingView` on iOS). The dismiss goes
  ink when a child deed is present. Chest and Ascension ceremonies unchanged.
- **Blackletter titles.** `HeaderBar` uses `FONTS.wordmark` at `FONT_SIZES.roomName` (44, compact
  34) for EN Latin titles (`isLatin` in `lib/i18n`); Mongolian stays in Yeseva.
- **Temperature and law.** `TEMPERATURE` tokens (`furnace`, `furnaceBright`, `rime`, `ice`,
  `glacier`) with palette assertions and a furnace-allowlist test; `components/vfx/FrostEdge.tsx`
  drawn but unmounted until Wave 3; EN law rewrites on existing keys (`Summon`, `Dismiss`,
  `A Bond`/`Fate`/`Kin`, `Light it`/`Dismiss` for the Square round, `Pledge`). The Square pair and
  the pledge follow their boards, not the plan's "Choose/Decide" word list.
- **Chrome off Seek.** `GettingStartedCard` and `DailyBudgetMeter` sit on the Character sheet
  below its cards, `NextGatheringPill` on the Town Square tab (where its own tap is a no-op; Wave
  4's hearth takes all three).
- **Deliberately left:** header room icons still MCI; `SheetModal` fades while `AlertModal`
  slides; `DialogStrip` repeats `AppCard`'s parchment layer; the hero/forged rules are per file,
  not per route; `FrostEdge` still `importantForAccessibility="no"` until mounted; the dropped
  fills on the fire/flame glyphs vs the board. Test count 931 → 1020.

## The design system finished — pigments, ladders, shared surfaces (2026-09-10 → 11)

- **No component knows a pigment.** Every raw `COLORS` reference outside `lib/theme.ts` was mapped
  to a role: `textDim` → `INK.dim`, `text` → `INK.primary`, `brass` → `METAL.brass`, `ember` →
  `METAL.ember`, `goldBright` → `ACCENT.bright`, `gold` → `ACCENT.base` (attention) or `METAL.gold`
  (an object made of gold — seal, medallion, rarity metal). `palette.test.ts` asserts nothing
  outside `lib/theme.ts` reaches `COLORS`, with no allowlist — `lib/world/light.ts` and
  `lib/festivals.ts` got roles of their own instead of exemptions.
- **Ladders:** `LEADING`, `TRACKING`, `SCRIM`, `PRESS`, `BADGE_SIZES` (`lib/__tests__/ladders.test.ts`
  asserts each is monotonic, gapped and actually used); `HEAT`, `TONE`, `STATUS_DEEP`, `NIGHT`,
  `GROUND`, `MEMBERSHIP_METALS` replace `FILL` and hand literals. `FILL` is gone.
- **Shared primitives:** `StateBlock` (loading/error/empty), `DialogSurface` (scrim + panel; exposes
  its scrim style), `Tap` (the press axis), `Vignette` (extracted from `RoomLight`/`WorldCanopy`).
  `lib/testing/sourceTree.ts` is the one source walker the guard tests share.
- **The app is linted:** `.oxlintrc.json` (hooks rules, `no-unused-vars` at error) plus
  `noUnusedLocals`/`noUnusedParameters`, wired into `check-all.sh` (both modes) and CI. Four
  `react/*` rules are off, reasoning in `.oxlintrc.README.md` (their hits are `Animated.Value`/
  `SharedValue` refs read during render — the RN idiom). The control panel gained `--success`/
  `--warning` tokens in both themes so badge/toast variants stop naming Tailwind colours.

Not yet seen on a device.

---

## Backlog clearance — 13 of 14 (2026-09-10)

- **Security.** `StartupGuards` refuses to boot outside Development without `VerifyMn:ApiKey`.
  `POST /auth/phone/start` has a per-IP window (30 per 15 min) answering
  `phone.too_many_attempts_ip`; its tests drive the real pipeline via
  `WebApplicationFactory<Program>` with hosted services stripped.
- **Oath milestone is paid before the flag flips**, with a separate `alreadyPaid` gate per payment
  (score, honour, milestone) so a failure after `AchieveAsync` cannot silently drop the rest.
- **Venue localisation:** `BusinessPartners` carries nullable `NameMn`/`CategoryMn`/`DistrictMn`/
  `DescriptionMn` (all NULL); `LocalisedContent.Pick` overlays in either direction; the
  locale-switch cache drop includes venue and Mission Board queries.
- **App fixes:** empty-thread state; the quest tile's padlock is an unopened scroll; active photo
  dot is `ACCENT.bright`; the white Android navigation bar under modals is fixed by `AppModal`,
  which puts each modal's own Dialog window into edge-to-edge mode (`expo-navigation-bar` cannot
  reach that window); the squeezed discover card is fixed by collapsing the getting-started board to
  one line after the first step (a `minHeight` bounded by available space can never fire).
- **Two stale claims closed with tests:** the `AtlasOverlay` setState-during-render warning and
  admin-config → `ScoreService` coverage (boots the real DI container).
- **Not closed:** the Android chat composer that stays lifted after the keyboard dismisses.

---

## Authored cast reseed + device style sweep (2026-09-10)

- **The seed** (`reseed-dev-db.sql`) is an authored cast: 19 people across every tier/oath/
  membership/lifecycle state, nine matches each with an authored Mongolian conversation (2–34
  messages), reveal levels 1–4. `InitiatorMessageCount`/`ReceiverMessageCount` are seeded —
  `RevealService.MutualMessageCount` reads them, and at 0 every thread read as level 1.
- **Portraits are StyleGAN output** (`mingldingl_engine/scripts/gen-cast-photos.py`; no real person
  on a fabricated profile), square-framed (the discover card's box is landscape on a tall phone),
  served under `seed/c2/` — a cast version, because expo-image caches by URL.
- **Style fixes real photos exposed:** the incoming chat bubble takes the `LINE.edge` hairline (its
  fill was 1.03:1 against the world floor, which sits at nearly `COLORS.panel`); photo-progress
  dots are opaque over their own top scrim; `formatCountdown` gained a day rung.
- `GetNextSession_NoUpcomingSession_ReturnsNullSessionId` clears live sessions inside its own
  rolled-back transaction (it had only passed on an empty database).
- **API-level sweep of 13 mechanics against this cast, no defects.** Kept: `budget.cap.*` is not a
  hard ceiling — `Math.Min(base + bonus + tierBonus, cap + tierBonus)`, as its description says;
  codes seen: `match.daily_budget_spent`, `409 engagement.already_responded`,
  `400 quest.incomplete`; `IcebreakerDone` pays only once both sides answer; config guards are
  covered by `ConfigValueValidatorTests` / `ValidateTierThreshold_EnforcesStrictOrdering`;
  `ConfigService` caches on boot, so a key changed by direct SQL needs a restart.

---

## Second real-device sweep — 11 fixes (2026-09-06)

- **Layout:** Town Square's `RoundPrompt` clears the call controls off shared
  `VIDEO_CONTROLS_BOTTOM`/`VIDEO_CONTROLS_SIZE`. `AppCard` carries no padding of its own — the
  icebreaker and quiz cards supply theirs; the icebreaker screen uses `useScrollTail`. The
  candidate card measures its name plaque and scales the placeholder and scrim to it.
- **Chat never reached its own bottom:** `scrollToEndSoon` does a second pass on the next frame
  and sending re-arms `nearBottomRef`.
- **Venue categories are `Cafe/Restaurant/Bar/Entertainment/Outdoor/Culture`** in the app's
  Mission Board icon map and `mingldingl_control`'s BusinessForm alike.
- The character sheet's What's Next card masks a match's name until reveal level 2, like the quest
  log and chat header (the engine sends `DisplayName` from level 1).
- **`RsvpOpensAt` is enforced:** `RsvpAsync` refuses an early RSVP (`square.rsvp_not_open`) and
  `GET /townsquare/next-session` surfaces only an Open session whose window has opened.
- **Dev seed:** sessions are written `Open` (`Status = 'Scheduled'` is invisible to the engine);
  seeded `PhotoUrls` use `API_HOST` (default localhost) — a hardcoded `http://localhost:5150` is the
  phone itself on a device. Venue detail and the Encounter Log draw a glyph for a venue with no photo.

---

## The World Pass — Shipped (2026-09-06)

Every screen is a room in a hold; the room decides its light, floor, vfx and travel direction.
Nothing gates on it. CLAUDE.md carries the operating rules; the decisions behind them:

- **One table is the whole hold.** `lib/world/rooms.ts`: Gate, Long Road, Tavern, Hearth, Forge,
  Hall, Deep — each row carries route prefixes, light signature, floor texture, vfx, depth, atlas
  coordinate and i18n key, so the map and the light read one fact. `matchRoom` is strict (longest
  prefix, no fallback), `roomFor` adds `DEFAULT_ROOM`; the route-coverage test walks the real files
  under `app/` through the strict one. `video/*` is the one `UNLIT` route (Agora composites on black).
- **Light.** Six signatures in `lib/world/light.ts` (`cold`/`neutral`/`warm`/`soft`/`dark`/`hot`);
  a room's state moves it inside its range — Road by unspent daily budget, Hearth a lamp per live
  match to three, Tavern by session then RSVP, Deep a torch per campaign room, Forge by profile
  completeness, Hall a sconce per honour. Rules: no data is not darkness (null holds base), light
  never eases down for a refetch, one speed (600 ms), a room change is a cut.
- **`WorldFloor` behind the navigator, `WorldCanopy` above it** (`pointerEvents: none`); every
  `<TiledBackdrop>` was deleted, the Tavern's parchment survived as `RoomTexture`. `useWorldState`
  subscribes to the query cache via `useSyncExternalStore` and never fetches.
- **The atlas** opens from a ⟡ sigil drawn by `HeaderBar` itself (not its `right` slot) as a
  `Modal`, never a route; medallions reuse `knotDim`/`knotGold`/`knotEmber`.
- **Feedback:** `lib/world/feedback.ts` maps `enterDeep`, `ascend`, `tierUp`, `sealBreak`, `honour`,
  `pledgeKept` to a haptic and a sound; sound is opt-in, `playsInSilentMode: false`, muted during a
  call; `scripts/gen-sounds.js` synthesises the WAVs.
- **Travel encodes depth:** into a delve opens from below, back up rises, lateral says nothing;
  reduce-motion collapses everything to a fade (refined 2026-09-10, "Screens stand on their own
  ground").
- **The white-app bug:** React Navigation paints `theme.colors.background` (#F2F2F2) behind every
  navigator and `card` behind every screen. `HOLD_THEME` makes both transparent, plus `contentStyle`
  on the Stack and `sceneStyle` on the Tabs.
- `jest.setup.js` registers Skia's own `jestSetup` (closing the `transformIgnorePatterns` gap) and
  an `expo-audio` mock. `AWAITING_MN_TRANSLATION`
  in `lib/i18n/index.ts` lists English-only keys; the parity test enforces it in both directions.

---

## Membership Billing Cycles — Shipped

Duration-based pricing (1/3/6 months at 0/10/20 % off) computed from each tier's monthly price, no
separate pricing table. `User.MembershipExpiresAt` tracks expiry, the `Membership` table is the
append-only purchase log, and `DailyMaintenanceBackgroundService` downgrades lapsed memberships.
App: a duration `ChoiceRow` on the membership screen. No payment gateway — upgrades are mocked (see
the Payment Provider Research memory). Prices and discounts became admin config on 2026-09-04.

---

## RPG Atmosphere Consistency Pass — Shipped (2026-07-28)

Eleven screens moved onto the shared `ScreenHeader` / `GameHeader` pattern with eight i18n keys
rewritten into the game voice. Decisions kept: `mn` was not touched by the voice rewrite (no
guessed Mongolian); destructive actions use a plain trigger label and a flavourful confirm
("Block" → "Cast Them Out?"), moderation and account-security labels stay plain;
`app/_layout.tsx`'s `useFonts()` gate includes `MaterialCommunityIcons.font` (icons painted bare
numerals before it); avatar tap opens the shared choose-source sheet; every optimistic mutation
reverts and alerts on failure; `lib/api.ts`'s offline mock fallback fires only on a true network
failure (`!error.response`) — it used to swallow real HTTP errors on mocked endpoints.

---

## Admin Config Foundation — Shipped (2026-07-29)

The generic store the later config work plugs into: `AdminConfigs` table, `ConfigService` singleton
in-memory cache, `ConfigKeys` registry seeded on boot, `AdminConfigController` list/update/revert
with validation and audit logging, and the control panel's Config page. `Revert` filters to
`Action == "UpdateConfig"` rows so a second revert does not un-revert the first. The rest of the
roadmap landed 2026-09-04 (Admin Control Expansion).

---

## Recruit an Ally — Shipped (2026-08-14)

Referral codes: generated on `GET /users/me`, redeemed through the onboarding `ReferralCode` field
(`UsersController.Upsert`), inviter reward surfaced via `GET /scores/me/detail` and cleared
client-side when the header toast consumes it (otherwise it replayed on every `GameHeader` mount).
Anonymisation nulls `ReferralCode`; redemption is refused when the inviter `IsDeleted`.
`CreateUserRequest.ReferralCode` is shared with Fated Threads' invite codes — the server
disambiguates. The inviter's reward is the Ally-Caller honour, once, on the first recruit (a random
item until 2026-09-05).

---

## Fated Threads — Shipped (2026-08-14)

A double-blind mutual opt-in: a "Weaver" nominates two people by phone number; each nominee gets a
prompt without knowing whether the other has answered; only if both accept does an ordinary `Match`
tagged `ShipId` appear. Neither nominee sees a rejection and the Weaver never learns who passed.
Internal naming is `Ship`/`ShipService`; user copy is Fated Threads / Weaver / "the thread frayed".

**Shipped:** `ShipService`, `ShipsController`, `AdminShipsController`, `/public/ship` landing page +
`/public/ship-invite` check in `PublicController`, model `Ship`, `Match.ShipId`, migration
`AddShipsAndMatchShipId`, `InviteCode`. App: `app/ship/new.tsx`, `FatedThreadsSection` +
`usePendingShips` on the Missions tab, `lib/shipInvite.ts`, "Woven by" banners in chat and Matches.
Admin: `pages/Ships.tsx`.

**Mechanics** (`ShipService.cs` is authoritative):
- `POST /ships { slotAPhoneNumber, slotBPhoneNumber }` — 8-digit validation, rejects the same number
  twice and self-nomination, enforces `ships.daily.cap` (3, UTC day). Each slot resolves by
  `PhoneNumber` to a user or a fresh 6-char invite code; a code is returned for **both** branches so
  the response never reveals whether a number has an account. A nominee who blocked the Weaver, or
  a pair already matched, gets the same success shape with no row written.
- `GET /ships/pending` → `[{ shipId, weaverDisplayName }]`. `POST /ships/{id}/respond { accept }` →
  `{ sparked }`: any decline closes the thread `Declined`; both accepted re-checks
  `MatchPairing.PairAlreadyMatchedAsync`/`IsPairBlockedAsync` (either → quiet `Expired`), then
  `MatchPairing.NewMatch(a, b, shipId)` (reveal level 1, no `DailyMatchesUsed` increment) and claims
  the thread with `SET "Status" = 'Sparked' WHERE "Status" = 'Pending'` so the spark runs once.
- Spark payout: Weaver gets `ShipSparked` +40 and the Thread-Weaver / Fate-Seer / Bond-Keeper
  honours at 1 / 5 / 10 sparks (`pendingShipReward` on `GET /scores/me/detail`, acked by
  `POST /scores/me/notifications/ack { kind: "ship" }`); both nominees get `first_match`, a push and
  a `match_created` broadcast. `ships.enabled=false` makes `POST /ships` a 404.
- Invite codes resolve through the onboarding `ReferralCode` field; `CodeExistsAsync` checks
  `Users.ReferralCode` plus both `Ships` code columns. `/public/ship?code=` deep-links
  `mingldingl://`. `Pending` threads expire after `ships.expiry_days` (14).

**Deviations from spec:** no `BlockWeaver` on Pass (only the `POST /ships` check); three honours
only; opt-in prompt lives only on the Missions tab; reward surfacing via ack endpoint + two `Ship`
columns rather than a read-once field.

---

## No-Show Tracking — Shipped (2026-08-18)

`dating.attendance_check.delay_hours` (48) after both sides confirm a date, each is privately asked
whether they met; a single mismatch is inert, a pattern across distinct matches docks
`ReputationScore`. Deliberately not a conduct rating (retaliation vector); the standing decision is
"block + unmatch is sufficient" and reporting is admin-adjudicated (see 2026-09-08).

**Mechanics** (`ActivityService.cs`): `ConfirmAsync` stamps `CompletedAt`;
`GET /activities/{matchId}/attendance-check` → `{ due, activityTitle }`; `POST … { attended }` is
participant-only and idempotent. When both slots are set and differ, the `false` side's
`NoShowFlagCount` increments once per confirmation (`PenaltyApplied` guard); at
`>= dating.noshow.threshold` (3) `ApplyReputationPenaltyAsync` docks `reputation.penalty_dock`
(0.1, floor 0) and writes a `Delta = 0` `RepeatedNoShowPenalty` event — on every mismatch at or
above the threshold, not once. Neither answer is shown to the other party; the Date Log renders a
mismatch as "Unconfirmed". Both answering yes grants the True to Word honour. The prompt is a modal
on the chat screen. Admin: `noShowFlagCount` on `UserDetail`, `POST /admin/users/{id}/reset-noshow`,
an analytics tile.

---

## The Oath & The Flame Rite — Shipped (2026-08-19)

**The Oath** is a public, behaviour-backed statement of intent — *Sworn* on selection, *Proven*
after real encounters with no ghosting — that outranks proximity in matching. **The Flame Rite**
moves the video call to a required, mutually-consented five-minute call *before* the date pledge.

**Mechanics** (`OathService.cs`, `MatchesController.cs`, `VideoController.cs`, `ActivityService.cs`):
- Oath ∈ `Bond` / `Fate` / `Kinship`; null = never sworn, sorts last, never excluded. Switching oaths
  resets `OathSwornAt` and costs Proven (behind a confirmation; re-swearing the same oath is a no-op).
- Proven (`RefreshAsync`, event-driven, no sweep): `oath.proven.encounters` (2) distinct matches
  with a completed `DateConfirmation` since sworn and zero `GhostPenalty` events in that window. A
  ghost demotes Proven → Sworn. First Proven pays `OathProven` +40, milestone `oath_proven` (the
  once-per-user guard) and the Oath-Keeper honour.
- Matching: `Affinity` (same 2, adjacent 1, opposite 0, null → null) leads the candidate sort inside
  a 25 km band for every membership level, then both-Proven, then the prior chain.
- Rite: `propose` / `accept` / `decline` require `IcebreakerComplete`; `propose` 409s while one is
  open; `decline` clears with no penalty. `POST /video/token` requires `FlameRiteAcceptedAt`; TTL is
  `dating.flamerite.duration_minutes` (5) until `POST /video/complete` sets `FlameRiteCompletedAt`,
  then the long TTL. `ConfirmAsync` refuses a pledge with `FlameRiteIncomplete` while
  `dating.flamerite.required` is on — and `video.enabled=false` lifts it so pledges cannot deadlock.
  The completer earns Flamekeeper on the first rite; both participants are paid `VideoCallDone`.
- Realtime: `flame_rite_proposed|accepted|declined|completed` on `app-nudges`. The locked pledge
  CTA sits on the per-match activity screen.

**Deferred:** the second photo still unblurs at 5 messages (milestone-based reveal, un-paywalling
`HasKids`).

---

## Duplication & Round-Trip Audit — Shipped (2026-08-19)

- **Real defect:** only `RequestMatch` checked `BlockedUsers`. `Services/MatchPairing.cs` now owns
  `IsPairBlockedAsync` / `PairAlreadyMatchedAsync` / `PairLockKey` / `NewMatch`, and all three match
  creation paths (summon, Ships, Town Square) route through it, failing quietly so a block cannot
  be inferred.
- Extracted `MatchAccessExtensions.LoadParticipantMatchAsync`, `InviteCode`, and
  `components/ui/HeaderBar.tsx` (composed by both headers; `GameHeader` also owns the HUD/toasts).
- `TotalScore` / `GemTier` / `ReputationScore` left `UserResponse`; only `ScoreDetailResponse`
  carries them (only `scoreDetail` is refreshed by `applyScoreBump`). Discover candidates have their
  own `Candidate` type.
- The 15–30 s `refetchInterval` safety nets behind broadcasts are deliberate:
  `SupabaseBroadcastService` is best-effort and Town Square's `Open → Locked` is never broadcast.

---

## Town Square — Shipped (2026-08-14; recorded from the code 2026-08-31)

Scheduled speed-dating over video: RSVP, roster locked at the deadline into a round-robin of short
Agora calls seeded with an icebreaker question, private Yes/No after each round, mutual Yes creates
an ordinary `Match`.

**Mechanics** (`TownSquareService.cs`):
- `TownSquareSession.Status`: `Open → Locked → InProgress → Completed`, or `Cancelled`.
  `POST|DELETE /townsquare/rsvp` only while `Open`; `GET /townsquare/next-session`.
- `TownSquareSchedulerBackgroundService` sweeps every 10 s: locks past `RsvpClosesAt`, starts past
  `ScheduledStartAt`, advances rounds. While `townsquare.enabled` or `video.enabled` is false it only
  advances sessions already in progress; user routes 404 `square.disabled` via
  `TownSquareEnabledFilter`.
- Roster lock: RSVPs by `RsvpAt`, split `Male`/`Female`, each side capped at `townsquare.max_per_side`
  (5) and truncated to the smaller; zero pairs → `Cancelled`. `GenerateRoundRobin` yields n rounds of
  `townsquare.round_seconds` (240), the r-th active icebreaker as prompt; blocked pairs sit that
  round out (since 2026-09-08).
- `GET /townsquare/session/{id}/current-round` → pairing, Agora token on the pairing id, prompt,
  `roundEndsAt`. `POST /townsquare/pairing/{id}/respond { Yes|No }` writes the caller's slot
  atomically; both Yes → block check → `CreateOrReuseMatchAsync` under the shared advisory lock,
  pushing both and broadcasting `match_created`.
- Realtime topic `townsquare:{sessionId}`: `session-started`, `session-cancelled`, `round-advanced`.
  Admin: paged sessions with RSVP counts, per-round pairings, create + cancel; sessions are
  scheduled one at a time, no recurrence.

**Not built:** pairing is strictly `Male × Female` (other genders RSVP but are never rostered);
overflow RSVPs drop at lock with no notice; no score/quest/honour for attending; the icebreaker is
never answered (its response table was dropped 2026-09-04).

---

## Phone Verification via verify.mn — Shipped (2026-08-31; hardened 2026-09-06)

Replaced the stubbed OTP (any 6 digits) with real ownership proof through verify.mn's
Mobile-Originated SMS flow; CLAUDE.md describes the flow and the trust model. Shipped:
`VerifyMnClient`, `PhoneVerificationService`, `AuthController`
(`/auth/phone/start|status|callback|claim`), `PhoneVerification` + `AddPhoneVerifications`
migration; app `useAuth` rewritten around
start / poll / complete, `(auth)/otp.tsx` (shows `displayInstruction` verbatim, `sms:` button, TTL
countdown, 3 s poll), `PhoneChangeModal` for the settings phone change.

Beyond what CLAUDE.md records: a claim is single-use by conditional
`UPDATE … WHERE "ClaimedByUserId" IS NULL` with a 30-minute window; the callback only triggers a
re-read of `GET /sessions/{id}`; and since 2026-09-10 an unset `VerifyMn:ApiKey` refuses to boot
outside Development instead of silently disabling the gate.

---

## Security & Data-Hygiene Hardening — Shipped (2026-08-31)

- **Admin login lockout:** `LoginThrottleService` locks a username+IP pair for 15 min after 5
  failures in 15 min, 429 with `Retry-After`; in-memory, per-instance.
- **Deletion deletes:** anonymisation and `PUT /users/me` call `LocalFileStorageService.DeleteByPublicUrl`
  (matching on the path beneath the uploads root, since `Storage:PublicBaseUrl` differs per
  environment; refuses paths escaping the root); `PhoneVerifications` rows are purged for anonymised
  users and stale unclaimed rows after 24 h.
- **Input caps** in `DTOs/FieldLimits.cs`; the app composer caps at the same 2000 chars.
- **CORS allowlist** `Cors:AllowedOrigins` (see CLAUDE.md).
- **Sweep in SQL:** staleness via `GhostingService.StaleAfter`, budget reset and membership expiry
  as single `ExecuteUpdateAsync` statements.
- **Reveal floor:** stored `RevealLevel` is a floor (`Math.Max`) over the message-count level, so a
  fresh match shows name + photo + bio.

---

## Error-Handling Consolidation — Shipped (2026-08-31; codes 2026-09-01)

`DomainException` + `ExceptionHandlingMiddleware` (see CLAUDE.md). Every error response carries a
stable `code` beside its English `error` (`ErrorResponse(Error, Code)`); the app maps `code` →
`err_<code>` i18n keys (`lib/i18n/errors.{en,mn}.ts`), an unmapped code falls back to the caller's
localised copy, never the server's English. App: a global `QueryCache.onError` with a 10 s cooldown
for reads (opt out with `meta.silentError`), `notifyUser()` throttled. Control: `lib/apiError.ts`'s
`serverError` on every page's `onError`, keyed on the English `error` (`admin.*` codes are
English-only on purpose).

---

## Dev Database Reseed + Behavioural Pass — 2026-08-31

`mingldingl_engine/scripts/reseed-dev-db.sql` is the standard reseed; it exempts `AdminConfigs` and
`ContentPages` (the first run destroyed the authored guides copy). The old database had zero
icebreakers/quizzes, which hid a P0: `GET /engagement/icebreaker` drew a random question per request
while completion required both users to answer the same one (the quiz had the same bug). Both pick
deterministically from the match id (`StableIndex`, SHA-256 — not `GetHashCode`, which is
per-process randomised).

---

## The Campaign (Dungeon Crawl) — Shipped (2026-09-01)

A per-match "dungeon map" rendering the engagement ladder as seven rooms a pair clears together.
**Structurally a lens, never a gate:** room state is derived from match state — no progression
state machine, no new preconditions, no new pushes. The only interaction is optional chest claiming.

| RoomId | Name | Cleared when (derived) |
|---|---|---|
| `gate` | The Meeting Gate | always |
| `echoes` | Hall of Echoes | `Match.IcebreakerComplete` |
| `runes` | The Rune Chamber | both users have a `QuizResponse` for the match's quiz |
| `voices` | Gate of Voices | `Match.MessageCount >= campaign.voices.messages` (15) |
| `flame` | The Flame Altar | `FlameRiteCompletedAt != null \|\| VideoRewardClaimed` |
| `bridge` | The Pledge Bridge | a completed `DateConfirmation` |
| `threshold` | The Dragon's Threshold (boss) | both sides answered attended = true |

Rooms are independent; "current room" is the first uncleared. `CampaignRoomClaim` (unique
`(MatchId, UserId, RoomId)`) records chest claims; `CampaignService.ClaimAsync` 409s an uncleared or
claimed room and pays `campaign.room.bonus` (5) / `campaign.boss.bonus` (25) as `CampaignRoomBonus` /
`CampaignBossBonus` events; the boss grants Seal-Breaker. `campaign.enabled=false` 404s both
endpoints and hides the chat entry banner. Claims work on ghosted matches on purpose. App:
`app/campaign/[matchId].tsx`, `useCampaign`, invalidation in the five realtime handlers that clear
rooms. `bossCleared` means only the boss fell ("The seal is broken"), not that every room is cleared.

---

## Ulzii Design Language — Shipped (2026-09-01)

Mongolian ornament rendered from geometry — **өлзий** (endless knot) and **алхан хээ** (walking
fret) — replaces generic-fantasy corners and dividers. Doctrine: edges and thresholds only, never
behind text or over photos; three metals with three meanings (gold default, ember for stakes —
boss, Rite, Oath — brass for utility); a density ladder (2×2 corners, 3×4 sigils, 5×5 set pieces,
at most one grand knot per screen); static PNG by default. `mingldingl_app/scripts/gen-ornaments.js`
rasterises the nine assets in `assets/ornaments/` at 3×; `lib/ornaments.ts` is the registry.
Carriers: `AppCard` corners, `SectionDivider`, `XPBar` fret, `QuestBanner medallion="knot"`,
`CharacterCard`'s frame, `OathSigil`, campaign medallions. `Alegreya SC` is `FONTS.utility`.
Deferred: Skia shimmer on the Oath sigil / boss seal, unlit empty-state knots, festival-tinted
variants. Playwright on RN-web: `fill()` does not reach a controlled `TextInput` (focus +
`page.keyboard.type` does) and presses need `element.click()` in `evaluate`.

---

## Design Token Consolidation — Shipped (2026-09-01)

`lib/theme.ts` is the single source of every colour, size and space value; every raw size/spacing/
radius literal in `app/` and `components/` was snapped to the scales by codemod. `SPACE` is a strict
4 px grid, `RADIUS.pill` and `circle(size)` exist, raw `rgba()` routes through `tint()`/`overlay()`,
`BUTTON_METALS` holds GameButton's variant table. `components/ui/CardEyebrow.tsx` replaces ten
hand-copied eyebrow labels in `FONTS.utility` (`AlegreyaSC_700Bold` carries Cyrillic Ө/Ү).
`lib/tiers.ts` references `COLORS`; its twelve gem/shade hexes are a deliberate second palette.

---

## Admin Control Expansion — Shipped (2026-09-04)

`ConfigKeys.All` grew from 9 to 61 keys (Scoring 23, Budget 7, Membership 4, Quests 12, Safety 7,
Growth 8): every score delta (`score.event.<Type>`), the tier thresholds, the reputation dock,
daily-match base/cap/divisor per membership (`budget.*`), membership prices and discounts, quest XP
and targets (`quest.<id>.xp`), ghosting staleness, attendance-check delay, deletion grace, ship
expiry, Town Square sizing, `campaign.voices.messages`, and the kill switches `ships.enabled`,
`townsquare.enabled`, `video.enabled` (`campaign.enabled` was already there). `ConfigKeyDefinition`
carries optional `Min`/`Max` enforced on write and re-checked on boot (`AdminConfigSeeder` resets an
out-of-bounds value, or a non-increasing tier ladder, to defaults with a warning).
`ScoreService.GetDelta` / `DailyMatchBudget`, `GhostingService.IsStale`, `QuestService.QuestsForDate`
and the membership tier list read config; `MembershipCatalog` serves the app, admin pricing and
analytics from the same keys; `ScoreService.BaseBudgetFor` keeps advertised and enforced daily
matches identical. Config edits never rewrite `ScoreEvents` history (`Delta` is stored per event).

**Kill-switch semantics:** `townsquare.enabled=false` or `video.enabled=false` → 404 `square.disabled`
on every user route (`TownSquareEnabledFilter`), scheduler only advances in-progress sessions;
`video.enabled=false` also 404s token minting and the rite endpoints, `ConfigService.FlameRiteRequired`
folds it into the pledge gate, and chat hides `FlameRiteCard` via `MatchResponse.VideoEnabled`. The
app shows the localised code copy rather than hiding entry points. `score.event.GhostPenalty = 0`
still writes the event the Oath logic reads; `score.quest_chest` and `score.event.DailyLogin` have
Min 1 because a zero claimed award is refused.

**Deliberately hardcoded:** login throttle, password hashing, phone-verification windows, photo
compression/upload limits, page sizes, sweep intervals, the reputation floor, streak halving.
`ConfigField` in the control panel ignores bounds (the server error shows in the toast).

---

## Screens stand on their own ground — the transparent-transition glitch (2026-09-10)

With every screen transparent over one root floor, a native stack's push drew the incoming and
outgoing screens through each other for the whole transition (even `animation: 'none'` left a frame
of composite). Fix: the Stack's `screenLayout` (`ScreenGround` in `app/_layout.tsx`) wraps every
screen in an opaque `COLORS.bg` view carrying its own `WorldFloor`, so screens stay background-free
but cover each other; the root-level floor is gone. `animationFor` returns `'none'` for lateral
moves, `slide_from_bottom` into a delve, `fade` under reduce-motion; `lib/world/__tests__/travel.test.ts`
pins the table.

---

## The Answering Hold — creative effects wave — Shipped (2026-09-10)

Eleven feedback-and-rhythm pieces, verified on the Galaxy A51 except the Gate, festival tint and
time-of-day offsets. Left out on purpose: parallax, ambient soundscapes, continuous Skia shimmer,
lit windows on the atlas, "held by few". **Wave 2, not started:** the personal sigil, the knot of
two, the encounter scroll.

- **Every action answers back.** `GameButton` squashes to 0.97 and fires a `press` world event
  (soft haptic + `tick.wav`); `horn.wav`/`horn` added for the Gate (`gen-sounds.js` renders eight).
  `components/ui/CountText` ticks numbers from their previous value (`ScoreHUD`, `XPBar`,
  `DailyBudgetMeter`, profile total); `ScoreHUD` floats a `+N`/`−N`. `TierUpCeremony`; on dismiss
  `lib/world/session.ts` keeps the tier colour and `WorldFloor` paints it as a faint second tone
  (alpha 0.10). A chat whose only message is the other person's first renders as a sealed letter
  (`SealedLetter` + `useSealedLetter`, once per match per session).
- **The hold moves on its own.** `dayPhase()` (dawn/day/dusk/night) offsets every room's light
  (−0.10/0/+0.08/−0.15) and tints the canopy vignette, re-evaluated each minute in `WorldProvider`.
  In the Deep, `delveLight` is the warmer of campaign torches and `conversationWarmth` (1 within an
  hour of the last message, 0.1 at the 48 h ghosting window; `useWorldState(matchId)` reads the
  messages cache). Ember honours breathe, gold ones shimmer once. Festival days (`useActiveFestival`)
  tint card corners/dividers and give the Town Square card a festival eyebrow.
- **Progress with a gap to close.** The hall: `HONOUR_ICONS`, ignition on arrival (`useIgnition`),
  near-miss hints on dark slots (`useHonourProgress`: streak of 7, oath encounters, threads 1/5/10 —
  `ScoreDetailResponse` gained `ThreadsSparked`), long-press lore (`honour_lore_*`). The streak is a
  `Lantern`. Score history is a chronicle (`CHRONICLE_KEYS` → `chronicle_*`, EN+MN).
- **Reasons to return.** `NextGatheringPill` (horn + countdown) on Seek and the Hearth tab. The
  verify screen is the Gate (`GateScene`): horn when the SMS app opens, swings open with `ascend`
  on VERIFIED, barred on expiry.

---

## Honours as a Trophy Hall — Shipped (2026-09-10)

Tier frames ("Rings of the Tiers") are gone end to end: migration `RetireTierFrames` drops
`Users.EquippedFrameId`; `EquippedFrameId` left `UserResponse`, `CandidateResponse` and
`PartialUserProfile`; `HonourService` is titles-only (`Honours`, `Find`, `GrantAsync`);
`GET /users/me/items` returns held honours newest-first and `POST /users/me/items/{id}/equip`
toggles the title. The avatar ring takes the tier colour on the client (`ProfileAvatar` `tierColor`).
The card is a trophy hall: all nine honours in catalogue order (`HONOUR_IDS` in `lib/tiers.ts`), lit
in their Ulzii metal with the date earned, dark with the deed as hint (`HONOUR_DEED_KEYS` →
`honour_deed_*`, EN + MN), `n / 9` in the eyebrow, `honours_hint` under it; tapping a lit honour
wears it. Removed copy: `no_honours`, `frames_title`, `frame_locked_at`, `item_frame_*`.

---

## Honours Replace Loot — Shipped (2026-09-05)

Random loot drops (`LootService`, frames/emblems/titles catalogue, daily 3-drop cap, `DuplicateLoot`
+10) were retired for nine **named honours granted for a deed, once**
(`HonourService.GrantAsync(userId, itemId, deed)`; a second grant is a no-op). The wire field
`rarity` carries the Ulzii metal — `Ember` for honours with stakes, `Gold` for the rest.

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
`POST /users` no longer returns a referral item. Migration `RetireLootForHonours` is data-only and
hand-written (`Program.cs` does not auto-migrate). App: `METAL_COLORS` in `lib/tiers.ts` maps
`rarity` to its metal (still used by the honour toast). The derived tier frames this entry
introduced (`FramesUnlockedFor`, `frameIdForTier`) were removed again on 2026-09-10 (Trophy Hall). A traditional-Mongolian-script seal layer was built and
removed the same evening at the user's request; do not propose it again.

---

## Audit Fixes — 2026-08-31

`date_confirmed` broadcast carries `userId`; chat history pages via
`GET /matches/{id}/messages?before=&limit=` with a "load earlier" control; reveal fields and the
daily-match budget are rendered (Matches list gating, `DailyBudgetMeter` on Discover); admin
`UserDetail` shows Oath state, `noShowFlagCount`, ban and membership expiry with `reset-noshow`;
analytics tiles for Oath / No-show / Flame Rites / Ships / Town Square; `match_created` broadcast +
push on the Fated Threads spark and Town Square mutual-yes; the ship share text carries the
`/public/ship?code=` URL.

---

## Bug Sweep — 2026-09-05

- `/public/ship` never rendered — an unterminated string literal in its inline script;
  `LandingPageScript_HasNoUnterminatedStringLiteral` scans both public pages.
- Only one Flame Rite participant was ever paid: `VideoRewardClaimed` is now per participant
  (`Initiator|ReceiverVideoRewardClaimed`, migration `AddPerParticipantVideoRewardClaims`, backfilled).
- Ghosting clamps `RevealLevel` against the stored floor; `SendMessage`'s retry lambda detaches its
  stale `Added` message so a retried send cannot insert twice; message pages order by `(CreatedAt, Id)`.

---

## Drift & Gap Audit — 2026-09-05

- `GET /engagement/reveal-thresholds` serves the effective reveal ladder and `lib/reveal.ts`
  hydrates it (the app had pinned `[5, 15, 30]`); activity suggestions gate on
  `activity.suggestions.messages`.
- **Push notifications localised per recipient** (`User.PreferredLocale`, `PushCopy`, `PushKind` —
  see CLAUDE.md). Four kinds added: `flame_rite_accepted`, `date_confirmed`, `match_ghosted`,
  `townsquare_started`. Expo round-trip moved to `PushDispatchBackgroundService`, which deletes
  `DeviceNotRegistered` tokens; anonymisation purges `PushTokens`.
- `CorsOrigins.Parse` accepts a comma-separated list. Spec drift in the plan corrected.

---

## Untouched-Code Bug Hunt — 2026-09-06

Two serious findings in the phone-identity path, each fixed with a test that fails on the old code:
- **Anyone could become any user by typing their number.** `CurrentUserMiddleware` aliased an
  account-less `sub` onto whichever account owned the JWT's client-writable `user_metadata.phone`.
  The alias now goes only through a claimed verify.mn proof (`ResolveAliasAsync`); the metadata
  alias survives only while `VerifyMn:ApiKey` is unset.
- **A pending verification could be hijacked.** `StartAsync` returned the in-flight session for a
  number to whoever asked. Sessions resume only with `ResumeVerificationId`, five pending per
  number; the per-phone advisory lock went with the sharing.
- Anonymisation purges verification rows by number as well as claimant; the admin login throttle
  evicts stale entries instead of failing open when full; a malformed `Admin:PasswordHash` is a 401.

---

## QA pass — mechanics testing and fix wave (2026-09-06)

Drove the live engine with real JWTs (signup → match → icebreaker → chat → reveal → ghosting sweep)
and fixed what it found:
- **Reputation griefing.** `POST /matches` needs no consent and ghosting penalised whoever did not
  reply. A recipient who never sent a message into the match is no longer at fault
  (`GhostingService.GetPenalisableGhostAsync`); the batched copy of the rule in
  `DailyMaintenanceBackgroundService` — the path that runs in production — had to be fixed
  separately, since fixing only `GhostingService.CheckAsync` left the exploit open.
- **`MatchEligibility`** holds the one rule discovery and `POST /matches` share (SQL for
  `GetCandidates`, compiled for the single target): self-match, missing, paused, pending-deletion,
  out-of-age-range and same-gender targets are all refused.
- **The reveal ladder was climbable alone:** `RevealService.MutualMessageCount` allows a lead of one
  message (`2*min(a,b)+1`); `Match` carries per-side counters backfilled from `messages`.
- `awarded` reported the config delta on repeat icebreakers that paid nothing.
- **Profile validation** (`ProfileValidation`): `Gender`, `City`, photo URLs and the habit/religion/
  lifestyle enums against closed sets; `MongoliaGeo.AcceptedCityNames` includes "Ulaanbaatar"
  itself, which onboarding writes. Photos already on the row are grandfathered — only new entries
  must prove they came from this service (`profile.photo_not_owned`), or changing
  `Storage:PublicBaseUrl` locks every account out of editing.
- `PushKind.MatchGhostedByYou` tells the at-fault party what it cost. Icebreakers and quizzes are
  localised (`LocalisedContent` picks by `PreferredLocale`, Mongolian fallback), and
  `useSyncPreferredLocale` invalidates the icebreaker, quiz and Town Square round caches on a
  language switch. DataAnnotations failures get `request.invalid` (`ModelValidationResponse`).
  `PartialUserProfile.PhotoCount` lets the reveal strip render only slots that can fill.
  `i18nCoverage` asserts every offered profile option has a label.
- Message pagination's `before` cursor is `CreatedAt`-only; `SendMessage` has no happy-path
  integration test because it opens its own transaction inside `IntegrationTestBase`'s rollback.

---

## Moderation, image safety and notification delivery (2026-09-08)

Fourteen findings across image upload, banning, reporting and notifications, all fixed:
- **Reporting now exists.** Blocking was the only lever before, and `POST /matches/{id}/block`
  only reaches someone you are already matched with. Now: `UserReport` + `ReportService`,
  `POST /reports` (seven reasons, optional details, one open report per pair), a `ReportUserSheet`
  from the chat options and the Town Square round screen, and `/admin/reports` with a queue,
  per-user history and four outcomes. `Penalised`
  is the only thing that spends `ReportPenalty` and `Banned` suspends the account — both admin
  decisions, never automatic. Filing a report blocks the reported user and ends the conversation.
  The sheet's copy is English-only (`AWAITING_MN_TRANSLATION`).
- **Photo ownership.** `IsOwnedPublicUrl` is scoped to `photos/profiles/{ownerId}/` (it checked
  origin only, and `GET /matches/candidates` hands out every candidate's full photo list, so anyone
  could wear another's photo and then delete the victim's file by dropping it); both unlink paths
  refuse a file that is not the user's own.
- **Decompression bomb:** `Image.LoadAsync` ran on up to 15 MB of attacker-chosen bytes with no
  pixel cap; the header is read first now (`MaxPixels`, ~60 MP) and
  `POST /photos/upload` is rate-limited per user. **Orphaned uploads:** the daily sweep deletes
  unreferenced photo files older than 24 h, comparing relative paths.
- **Push:** copy is truncated to a byte budget on a rune boundary (2000 Cyrillic chars exceed
  Expo's 4 KiB; the `MessageTooBig` ticket had been discarded); Expo refusals are logged;
  registration keys on the user id, not mount; Android has a notification channel;
  `POST /push/unregister` is scoped to the caller (was an IDOR), tokens capped at 10 per user.
- **Bans:** banning ends the account's conversations, `NotifyUserAsync` skips suspended and
  pending-deletion recipients, the ban 403 carries a `code` and the app renders a suspension screen.
- **Town Square** drops blocked pairs from the rounds. Admins can remove a single photo
  (`POST /admin/users/{id}/photos/remove`). `image/heic`/`image/heif` left the upload allowlist
  (ImageSharp cannot decode them).

---

## The waiting vocabulary (2026-09-10)

~30 identical `ActivityIndicator`s replaced with a themed wait vocabulary — `Waiting` (the inline
turning knot), `Skeleton` (content-shaped placeholders), `LongWait` (narrated long waits with
8 s / 25 s "still going" / "long" lines) — plus a list-entrance stagger, an in-flight message state,
a tab ignite, and the header-wrapper collapse. Its nine narrated strings are English-only
(`wait_*_still`/`wait_*_long`, `quiz_answers_in` on `AWAITING_MN_TRANSLATION`).

---

## The world layer switched back on, and the reveal got its moment (2026-09-10)

- **Rank is visible again.** `GemTierBadge` gated ring/glow/shimmer on a hard `tierIndex >= 3`
  cliff while `TIER_PRESENCE` (ring weight + glow per tier) was read by nothing; `presenceForTier`
  now turns a row into the numbers a badge needs, and `TorchGlow` gained `strength`.
- **`VfxLevel`** is `full` / `plain` / `still` / `off` (precedence off > still > plain > full):
  `plain` gets RN `Animated` fallbacks at half density, `still` each effect's static form. The old
  `reduced` conflated "no Skia" (web) with "less motion", so `EmberField`, `FogDrift` and
  `ChestBurst` rendered nothing in the browser.
- **Six light signatures that rendered as one.** The room's `tone` moved to `WorldFloor` as a
  bottom-anchored gradient behind the navigator, where it cannot touch text; the canopy keeps only
  the vignette, with a per-room `edge`. A test guards that no two signatures render identically.
- **The Unsealing.** Crossing a reveal rung dims the room, breaks an Ulzii knot seal into the
  chest-burst particles with the `sealBreak` haptic and resolves the photo out of blur.
  `useUnsealing` reports only a level that climbs while watching (the first level seen for a match
  is recorded silently); it reuses the reveal strip's strings, so no new copy.
- Rising light springs with a small overshoot; falling light keeps the flat fade.

Device-verified on the Galaxy A51, including the ceremony across a real reveal threshold.

---

## Aesthetic pass over the web build (2026-09-11)

Every screen screenshotted at phone width in both locales via Playwright after the design-system
overhaul; the fixes are what the review turned up, nothing speculative.

- **Choices are chips, not buttons.** `ChoiceRow` drew each option as a forged `GameButton`, so
  The War Room read as eleven calls to action. It is now hairline chips in the body face with the
  chosen one in gold — one component, so settings, the profile editor and the billing cycle all
  changed together.
- **Daily quests carry their own rune** (`QUEST_ICONS`, keyed by the engine's `nameKey`) instead
  of three identical crossed swords.
- **Guild Ranks** no longer offers "Upgrade to Free": the button appears only once a paid rank is
  chosen, and the Free card's price column is gone (the name is the price; `price_free` deleted).
- **The Town Square card names its date** (`formatDateTime`) rather than repeating the screen
  title directly above it.
- **Plan an Encounter's empty state keeps the header**, so the screen no longer loses its back
  arrow and title when there is nothing to plan.

Seen and left alone: the three stacked strips above the Seek card (First Steps, summons budget,
Gathering pill) push the candidate below a third of the screen; "Seek Companions" wraps to two
lines on web (Android/iOS shrink it via `adjustsFontSizeToFit`); "Sound" in The War Room is still
English in Mongolian (on `AWAITING_MN_TRANSLATION`); leaderboard rows show gem and points only.
Not yet seen on hardware.

Also found while watching CI: the engine job had been red since the swagger-export commit, which
inserted its check step between `dotnet test` and that step's `env:` block, so the connection
string moved and `PhoneStartRateLimitTests` (the three that boot the real `Program`) died with
"Host can't be null". The env is back on the test step.

---

## Device pass on the Galaxy A51, and the chat composer bug (2026-09-11)

First run of the EAS development build on hardware (wireless debugging, Metro over LAN, signed in
as a seeded character through the Hermes inspector). Seek, Missions, Town Square, Character, The
War Room, Guild Ranks and chat all match the web pass; Skia embers and the tier glow render.

**The composer bug is fixed and verified on the phone.** `KeyboardAvoidingView` is wrong on Android
under Expo 54's edge-to-edge window in every mode: `height` never restores the frame, `padding`
leaves the composer lifted by the status bar plus the navigation bar after the keyboard hides
(the hide event and the view's frame are measured in different coordinate spaces), and no
behaviour at all hides the composer behind the keyboard because the window is not resized.
`hooks/useAndroidKeyboardHeight.ts` listens to the keyboard events, which are right, and the chat
screen pads by that height plus the bottom inset on Android while keeping the avoider for iOS.

Still unseen with the keyboard up on hardware: onboarding's `StepScaffold` and the phone screen,
which use no Android behaviour — their inputs may sit under the keyboard on short screens.
