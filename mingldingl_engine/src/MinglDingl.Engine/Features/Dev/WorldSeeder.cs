using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Campaign;
using MinglDingl.Engine.Features.Encounters;
using MinglDingl.Engine.Features.Honours;
using MinglDingl.Engine.Features.Quests;
using MinglDingl.Engine.Features.Safety;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Features.Threads;
using ThreadState = MinglDingl.Engine.Features.Threads.ThreadState;
using MinglDingl.Engine.Features.Venues;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Dev;

public sealed record SeedVenue(string Id, string Name, string NameMn, string Kind, string District, string Address,
    string Hours, string Description);

/// Development only. What the crowd does together: venues with photos, bonds at every stage (letters,
/// seals, icebreaker, Trial, Flame Rite, meetings sworn, waiting to be answered, kept, missed), the
/// closed ones (cold, severed, faded, retired), Fated Threads, allies, reports and blocks, and the
/// points, honours and Campaign chambers that history earns. With a hero (`seed crowd --phone`), that
/// account gets one bond at each stage with the opposite sex of the crowd, so a tester's own screens
/// are full. Absolute like the crowd: rerunning wipes everything these accounts did and writes it again.
public sealed class WorldSeeder(AppDb db, IClock clock, IConfig config, VenueService venues, HonourService honours)
{
    private static readonly string Dir = Path.Combine(AppContext.BaseDirectory, "Seed", "crowd");
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly Random rng = new(20261020);
    private readonly HashSet<(Guid, Guid)> pairs = [];
    private Guid? heroId;
    private readonly List<ScoreEvent> deeds = [];
    private readonly Dictionary<Guid, string> locales = [];
    private Dictionary<string, Guid> venueIds = [];
    private int[] icebreakers = [];
    private int[] trials = [];
    private DateTimeOffset now;

    public async Task<string> ApplyAsync(IReadOnlyList<CrowdPerson> crowd, Guid? hero, CancellationToken ct = default)
    {
        now = clock.UtcNow;
        (heroId, pendingAlly, heroThreadFor, retired) = (null, null, null, null);
        pairs.Clear();
        deeds.Clear();
        threadsToWrite.Clear();
        venueIds = [];
        var phones = crowd.Select(c => c.Phone).ToList();
        var ids = await db.Set<Account>().Where(a => phones.Contains(a.Phone)).ToDictionaryAsync(a => a.Phone, a => a.Id, ct);
        var everyone = ids.Values.Concat(hero is { } h ? [h] : Array.Empty<Guid>()).ToList();
        await ResetAsync(everyone, ct);

        var profiles = await db.Set<Profile.Profile>().Where(p => everyone.Contains(p.AccountId)).ToDictionaryAsync(p => p.AccountId, ct);
        foreach (var p in profiles.Values) locales[p.AccountId] = p.Locale;
        icebreakers = await db.Set<IcebreakerQuestion>().OrderBy(q => q.Id).Select(q => q.Id).ToArrayAsync(ct);
        trials = await db.Set<TrialQuestion>().OrderBy(q => q.Id).Select(q => q.Id).ToArrayAsync(ct);
        await VenuesAsync(ct);

        Guid P(string id) => ids[crowd.Single(c => c.Id == id).Phone];
        var finished = crowd.Where(c => c.State == "Finished" && c.Edge is null).ToList();
        var women = finished.Where(c => c.Gender == "Female").Select(c => ids[c.Phone]).ToList();
        var men = finished.Where(c => c.Gender == "Male").Select(c => ids[c.Phone]).ToList();

        var summary = new List<string>();
        if (hero is { } me && profiles.TryGetValue(me, out var heroProfile) && heroProfile.WelcomedAt is not null)
        {
            heroId = me;
            var others = (heroProfile.Gender == "Male" ? women : men).ToList();
            Hero(me, others);
            HeroExtras(me, crowd, ids, others);
            summary.Add($"hero {heroProfile.Name}: {others.Count.ToString()} crowd of the other sex, 13 bonds at every stage");
        }
        Threads(P, hero);
        Crowd(women.Where(w => w != P("p46")).ToList(), men.Where(m => m != P("p47")).ToList());
        Retired(P("p46"), P("p47"));
        Safety(P);

        await db.SaveChangesAsync(ct);
        await FinishAsync(everyone, profiles, ct);
        summary.Add($"{await db.Set<Bond>().CountAsync(b => everyone.Contains(b.AId), ct)} bonds, " +
            $"{await db.Set<Letter>().CountAsync(ct)} letters, {await db.Set<Meeting>().CountAsync(ct)} meetings, " +
            $"{venueIds.Count} venues");
        return string.Join("; ", summary);
    }

    // ── Reset ─────────────────────────────────────────────────────────────────────────────────────

    private async Task ResetAsync(List<Guid> everyone, CancellationToken ct)
    {
        await db.Set<Bond>().Where(b => everyone.Contains(b.AId) || everyone.Contains(b.BId)).ExecuteDeleteAsync(ct);
        await db.Set<ScoreEvent>().Where(e => everyone.Contains(e.AccountId) && e.Kind != DeedKinds.Finished).ExecuteDeleteAsync(ct);
        await db.Set<HonourEarned>().Where(h => everyone.Contains(h.AccountId)).ExecuteDeleteAsync(ct);
        await db.Set<QuestClaim>().Where(q => everyone.Contains(q.AccountId)).ExecuteDeleteAsync(ct);
        await db.Set<Chest>().Where(c => everyone.Contains(c.AccountId)).ExecuteDeleteAsync(ct);
        await db.Set<VenueRating>().Where(r => everyone.Contains(r.AccountId)).ExecuteDeleteAsync(ct);
        await db.Set<Block>().Where(b => everyone.Contains(b.BlockerId) || everyone.Contains(b.BlockedId)).ExecuteDeleteAsync(ct);
        await db.Set<Report>().Where(r => everyone.Contains(r.ReporterId) || everyone.Contains(r.TargetId)).ExecuteDeleteAsync(ct);
        await db.Set<FatedThread>().Where(t => everyone.Contains(t.WeaverId)).ExecuteDeleteAsync(ct);
        await db.Set<Account>().Where(a => everyone.Contains(a.Id)).ExecuteUpdateAsync(u => u.SetProperty(a => a.CalledBy, (Guid?)null), ct);
        await db.Set<Profile.Profile>().Where(p => everyone.Contains(p.AccountId)).ExecuteUpdateAsync(u => u
            .SetProperty(p => p.Reputation, 100).SetProperty(p => p.Streak, 0).SetProperty(p => p.LastDawn, (DateOnly?)null)
            .SetProperty(p => p.OathProvenAt, (DateTimeOffset?)null).SetProperty(p => p.RetiredAt, (DateTimeOffset?)null)
            .SetProperty(p => p.PausedAt, (DateTimeOffset?)null).SetProperty(p => p.TierUpPending, (string?)null), ct);
    }

    // ── Venues ────────────────────────────────────────────────────────────────────────────────────

    /// The partner places, by name; a venue with no photos gets its two (Seed/crowd/venue-<id>_<n>.jpg).
    private async Task VenuesAsync(CancellationToken ct)
    {
        var list = JsonSerializer.Deserialize<List<SeedVenue>>(File.ReadAllText(Path.Combine(Dir, "venues.json")), Json)!;
        foreach (var s in list)
        {
            var v = await db.Set<Venue>().SingleOrDefaultAsync(x => x.Name == s.Name, ct);
            if (v is null)
            {
                v = new Venue { Id = Guid.CreateVersion7(), Name = s.Name, CreatedAt = now.AddDays(-60) };
                db.Add(v);
            }
            (v.NameMn, v.Kind, v.District, v.Address, v.Hours, v.Description) = (s.NameMn, s.Kind, s.District, s.Address, s.Hours, s.Description);
            v.Verified = true;
            v.RemovedAt = null;
            await db.SaveChangesAsync(ct);
            venueIds[s.Id] = v.Id;
            if (await db.Set<VenuePhoto>().AnyAsync(p => p.VenueId == v.Id, ct)) continue;
            foreach (var n in new[] { 0, 1 })
            {
                var file = Path.Combine(Dir, $"venue-{s.Id}_{n}.jpg");
                if (File.Exists(file)) await venues.AddPhotoAsync(v.Id, await File.ReadAllBytesAsync(file, ct), ct);
            }
        }
    }

    private Guid V(string id) => venueIds[id];

    // ── The hero: one bond at each stage ──────────────────────────────────────────────────────────

    private void Hero(Guid me, List<Guid> o)
    {
        // Live (seven seats; the hero's history lifts them past Sapphire).
        Summon(me, o[0], H(3));                                                           // new, no word yet
        Talk(Summon(me, o[1], D(2)), me, 3, o[1], 2, lastBy: me, H(5));                   // waiting on them
        var embers = Talk(Summon(o[2], me, D(4)), me, 4, o[2], 4, lastBy: o[2], H(40));   // your turn, the fire dying
        embers.EmbersAt = H(4);
        var ice = Talk(Summon(me, o[3], D(6)), me, 6, o[3], 6, lastBy: o[3], H(2));      // first seal, icebreaker half
        Icebreaker(ice, (me, Answer(me)));
        var trial = Talk(Summon(o[4], me, D(9)), me, 11, o[4], 11, lastBy: me, H(6));    // Trial half, Rite asked of you
        Icebreaker(trial, (me, Answer(me)), (o[4], Answer(o[4])));
        Trial(trial, me, 5, 2);
        Rite(trial, o[4], H(1));
        var sworn = Talk(Summon(me, o[5], D(14)), me, 16, o[5], 16, lastBy: o[5], H(3)); // meeting sworn
        FullRoad(sworn, me, o[5], D(4));
        Meeting(sworn, "v07", Evening(2), proposer: o[5], MeetingState.Sworn);
        Weekly(sworn, o[5]);
        var asked = Talk(Summon(o[6], me, D(18)), me, 17, o[6], 16, lastBy: me, H(4));   // "Did they come?"
        FullRoad(asked, me, o[6], D(6));
        Meeting(asked, "v01", H(5), proposer: me, MeetingState.Checking, answer: (o[6], AttendanceAnswer.Met));

        // Closed, oldest history first: a scar, then two kept meetings that close it and prove the oath.
        var cold = Talk(Summon(o[9], me, D(30)), me, 3, o[9], 4, lastBy: o[9], D(27));
        Close(cold, BondState.Cold, me, D(25));
        Deed(me, DeedKinds.GoneCold, -config.Int(ConfigKeys.ScoreGoneCold), cold.Id, D(25));
        var noShow = Talk(Summon(me, o[12], D(40)), me, 17, o[12], 16, lastBy: me, D(31));
        FullRoad(noShow, me, o[12], D(35));
        Meeting(noShow, "v05", D(30), proposer: me, MeetingState.Closed, outcome: MeetingOutcome.NoShow, noShowOf: o[12],
            answer: (me, AttendanceAnswer.NoShow));
        Close(noShow, BondState.Severed, me, D(29));
        var kept1 = Talk(Summon(o[7], me, D(32)), me, 18, o[7], 18, lastBy: o[7], D(16));
        FullRoad(kept1, me, o[7], D(24));
        Meeting(kept1, "v02", D(20), proposer: o[7], MeetingState.Closed, outcome: MeetingOutcome.Kept);
        Close(kept1, BondState.Severed, o[7], D(15));
        var kept2 = Talk(Summon(me, o[8], D(22)), me, 17, o[8], 17, lastBy: me, D(10));
        FullRoad(kept2, me, o[8], D(15));
        Meeting(kept2, "v03", D(12), proposer: me, MeetingState.Closed, outcome: MeetingOutcome.Kept);
        Close(kept2, BondState.Cold, o[8], D(8));
        Deed(o[8], DeedKinds.GoneCold, -config.Int(ConfigKeys.ScoreGoneCold), kept2.Id, D(8));
        var faded = Summon(me, o[10], D(10));
        Close(faded, BondState.Faded, null, D(3));
        var castOut = Talk(Summon(o[11], me, D(5)), me, 2, o[11], 3, lastBy: o[11], D(1));
        Close(castOut, BondState.Severed, me, H(20));
        db.Add(new Block { BlockerId = me, BlockedId = o[11], CreatedAt = H(20) });
        db.Add(new Report
        {
            Id = Guid.CreateVersion7(), ReporterId = me, TargetId = o[11], BondId = castOut.Id, Reason = "rude",
            Note = "Kept pushing for my address after I said no.", Status = ReportStatus.Open, CreatedAt = H(20),
        });
    }

    /// The hero's dawns, yesterday's quests and the chest they filled, an ally who came through their call,
    /// a thread they wove that sparked, and one woven for them still waiting on their answer.
    private void HeroExtras(Guid me, IReadOnlyList<CrowdPerson> crowd, Dictionary<string, Guid> ids, List<Guid> others)
    {
        var today = clock.TodayUb;
        for (var i = 5; i >= 1; i--)
            Deed(me, DeedKinds.Dawn, config.Int(ConfigKeys.ScoreDawn) * (6 - i), null, UbDays.Start(today.AddDays(-i)).AddHours(1));
        var yesterday = UbDays.Start(today.AddDays(-1)).AddHours(13);
        foreach (var (kind, key) in new[] { (QuestKinds.LightHearth, ConfigKeys.QuestLightHearth),
                     (QuestKinds.AnswerLetters, ConfigKeys.QuestAnswerLetters), (QuestKinds.Summon, ConfigKeys.QuestSummon) })
        {
            db.Add(new QuestClaim { AccountId = me, Kind = kind, Period = today.AddDays(-1), Points = config.Int(key), ClaimedAt = yesterday });
            Deed(me, DeedKinds.Quest, config.Int(key), null, yesterday);
        }
        db.Add(new Chest { Id = Guid.CreateVersion7(), AccountId = me, FromQuest = QuestKinds.Summon, Day = today.AddDays(-1), CreatedAt = yesterday });

        var ally = ids[crowd.Single(c => c.Id == "p34").Phone];
        pendingAlly = (me, ally);
        Deed(me, DeedKinds.AllyCalled, config.Int(ConfigKeys.AllyBounty), null, D(21));
        Deed(ally, DeedKinds.Ally, config.Int(ConfigKeys.AllyBounty), null, D(21));

        heroThreadFor = others.Count > 13 ? others[13] : null;
    }

    private (Guid Me, Guid Ally)? pendingAlly;
    private Guid? heroThreadFor;

    // ── The crowd among themselves ────────────────────────────────────────────────────────────────

    private void Crowd(List<Guid> women, List<Guid> men)
    {
        for (var i = 0; i < women.Count; i++)
        {
            var w = women[i];
            var m = men[(i * 5 + 3) % men.Count];
            if (pairs.Contains(Bond.Pair(w, m))) continue;
            var (first, second) = i % 2 == 0 ? (w, m) : (m, w);
            switch (i % 11)
            {
                case 0: Summon(first, second, H(8)); break;
                case 1: Talk(Summon(first, second, D(3)), first, 3, second, 3, lastBy: second, H(7)); break;
                case 2:
                    Talk(Summon(first, second, D(4)), first, 4, second, 3, lastBy: first, H(39)).EmbersAt = H(3);
                    break;
                case 3:
                    var ice = Talk(Summon(first, second, D(7)), first, 7, second, 7, lastBy: first, H(9));
                    Icebreaker(ice, (first, Answer(first)), (second, Answer(second)));
                    break;
                case 4:
                    var tr = Talk(Summon(first, second, D(10)), first, 12, second, 12, lastBy: second, H(12));
                    Icebreaker(tr, (first, Answer(first)), (second, Answer(second)));
                    Trial(tr, first, 5, 5);
                    break;
                case 5:
                    var rite = Talk(Summon(first, second, D(12)), first, 16, second, 16, lastBy: first, H(20));
                    FullRoad(rite, first, second, D(2));
                    Meeting(rite, "v08", Evening(4), proposer: first, MeetingState.Proposed);
                    break;
                case 6:
                    var sworn = Talk(Summon(first, second, D(15)), first, 17, second, 17, lastBy: second, H(5));
                    FullRoad(sworn, first, second, D(5));
                    Meeting(sworn, Pick("v04", "v09", "v12"), Evening(1), proposer: second, MeetingState.Sworn);
                    break;
                case 7:
                    var kept = Talk(Summon(first, second, D(26)), first, 31, second, 30, lastBy: first, H(30));
                    FullRoad(kept, first, second, D(18));
                    Meeting(kept, Pick("v06", "v10", "v13"), D(14), proposer: first, MeetingState.Closed, outcome: MeetingOutcome.Kept);
                    break;
                case 8:
                    var cold = Talk(Summon(first, second, D(9)), first, 5, second, 6, lastBy: second, D(6));
                    Close(cold, BondState.Cold, first, D(4));
                    Deed(first, DeedKinds.GoneCold, -config.Int(ConfigKeys.ScoreGoneCold), cold.Id, D(4));
                    break;
                case 9:
                    Close(Talk(Summon(first, second, D(11)), first, 8, second, 8, lastBy: first, D(8)), BondState.Severed, second, D(7));
                    break;
                default:
                    Close(Summon(first, second, D(13)), BondState.Faded, null, D(6));
                    break;
            }
        }
    }

    /// Two who kept their word and left the hall together (Hall of Names, Hearthbound).
    private void Retired(Guid a, Guid b)
    {
        var bond = Talk(Summon(a, b, D(60)), a, 34, b, 33, lastBy: a, D(20));
        FullRoad(bond, a, b, D(50));
        Meeting(bond, "v14", D(45), proposer: a, MeetingState.Closed, outcome: MeetingOutcome.Kept);
        Meeting(bond, "v15", D(30), proposer: b, MeetingState.Closed, outcome: MeetingOutcome.Kept);
        bond.RetireBy = a;
        bond.RetireAt = D(21);
        Close(bond, BondState.Retired, b, D(20));
        retired = (a, b, D(20));
    }

    private (Guid A, Guid B, DateTimeOffset At)? retired;

    /// Threads woven by the hero (or Номин without one): one waiting, one sparked into a bond, one cut;
    /// and one woven for the hero, waiting on their answer.
    private void Threads(Func<string, Guid> p, Guid? hero)
    {
        var weaver = hero ?? p("p14");
        threadsToWrite.Add((weaver, p("p00"), p("p01"), true, null, ThreadState.Waiting, D(2), null));
        var sparked = Talk(Summon(p("p02"), p("p05"), D(14), weaver), p("p02"), 6, p("p05"), 6, lastBy: p("p05"), H(14));
        Deed(weaver, DeedKinds.ThreadSparked, config.Int(ConfigKeys.ScoreThreadSparked), null, D(14));
        threadsToWrite.Add((weaver, p("p02"), p("p05"), true, true, ThreadState.Sparked, D(16), sparked.Id));
        threadsToWrite.Add((weaver, p("p04"), p("p07"), false, null, ThreadState.Cut, D(9), null));
        if (hero is { } h && heroThreadFor is { } other)
            threadsToWrite.Add((p("p14"), h, other, null, null, ThreadState.Waiting, H(10), null));
    }

    private readonly List<(Guid Weaver, Guid A, Guid B, bool? AnsA, bool? AnsB, ThreadState State, DateTimeOffset At, Guid? BondId)>
        threadsToWrite = [];

    private void Safety(Func<string, Guid> p)
    {
        db.AddRange(
            new Block { BlockerId = p("p06"), BlockedId = p("p43"), CreatedAt = D(12) },
            new Block { BlockerId = p("p10"), BlockedId = p("p13"), CreatedAt = D(6) },
            new Block { BlockerId = p("p26"), BlockedId = p("p31"), CreatedAt = D(3) });
        Report(p("p00"), p("p27"), "money", "Asked me to send him money for a bus ticket.", ReportStatus.Open, H(9));
        Report(p("p16"), p("p11"), "notWhoTheyClaim", "His photos look like someone else, maybe from the internet.", ReportStatus.Open, D(1));
        Report(p("p20"), p("p33"), "other", null, ReportStatus.Open, D(2));
        Report(p("p06"), p("p43"), "rude", "Threatening messages after I stopped replying.", ReportStatus.CastOut, D(12));
        Report(p("p04"), p("p21"), "under18", "Looks very young.", ReportStatus.Dismissed, D(1));
        Report(p("p22"), p("p19"), "rude", "Rude joke.", ReportStatus.Penalised, D(5));
        Deed(p("p19"), DeedKinds.Penalised, -config.Int(ConfigKeys.ScorePenalised), null, D(4));
    }

    private void Report(Guid by, Guid against, string reason, string? note, ReportStatus status, DateTimeOffset at) =>
        db.Add(new Report
        {
            Id = Guid.CreateVersion7(), ReporterId = by, TargetId = against, Reason = reason, Note = note, Status = status,
            Resolution = status == ReportStatus.Open ? null : "Seeded decision", CreatedAt = at,
            ResolvedAt = status == ReportStatus.Open ? null : at.AddHours(6),
        });

    // ── Finishing: what the history above has earned ─────────────────────────────────────────────

    private async Task FinishAsync(List<Guid> everyone, Dictionary<Guid, Profile.Profile> profiles, CancellationToken ct)
    {
        var phones = await db.Set<Account>().Where(a => everyone.Contains(a.Id)).ToDictionaryAsync(a => a.Id, a => a.Phone, ct);
        foreach (var t in threadsToWrite)
            db.Add(new FatedThread
            {
                Id = Guid.CreateVersion7(), WeaverId = t.Weaver, PhoneA = phones[t.A], PhoneB = phones[t.B],
                CodeA = Code(), CodeB = Code(), AnswerA = t.AnsA, AnswerB = t.AnsB, State = t.State, BondId = t.BondId,
                WovenAt = t.At, ClosedAt = t.State == ThreadState.Waiting ? null : t.At.AddDays(2),
            });
        if (pendingAlly is { } al)
        {
            var heroAccount = await db.Set<Account>().SingleAsync(a => a.Id == al.Me, ct);
            heroAccount.AllyCode ??= "SARU-" + (4000 + rng.Next(5000));
            await db.Set<Account>().Where(a => a.Id == al.Ally).ExecuteUpdateAsync(u => u.SetProperty(a => a.CalledBy, al.Me), ct);
        }
        await db.SaveChangesAsync(ct);

        // Campaign chambers, and their points, for every bond the two of them wrote in.
        var bonds = await db.Set<Bond>().Where(b => everyone.Contains(b.AId) || everyone.Contains(b.BId)).ToListAsync(ct);
        var bondIds = bonds.Select(b => b.Id).ToList();
        var encounters = await db.Set<Encounter>().Where(e => bondIds.Contains(e.BondId)).ToDictionaryAsync(e => e.BondId, ct);
        var meetings = await db.Set<Meeting>().Where(m => bondIds.Contains(m.BondId)).ToListAsync(ct);
        foreach (var b in bonds.Where(b => b.LettersA > 0 && b.LettersB > 0))
        {
            var kept = meetings.Any(m => m.BondId == b.Id && m.Outcome == MeetingOutcome.Kept);
            var at = b.LastLetterAt ?? b.CreatedAt;
            foreach (var c in CampaignService.Reached(b, encounters.GetValueOrDefault(b.Id), kept))
            {
                db.Add(new ChamberCleared { BondId = b.Id, Chamber = c, ClearedAt = at });
                var (kind, key) = c == Chambers.Boss
                    ? (DeedKinds.CampaignBoss, ConfigKeys.ScoreCampaignBoss)
                    : (DeedKinds.CampaignRoom, ConfigKeys.ScoreCampaignRoom);
                Deed(b.AId, kind, config.Int(key), b.Id, at);
                Deed(b.BId, kind, config.Int(key), b.Id, at);
            }
        }

        // Kept meetings: both rate the place; the second kept meeting proves the oath.
        var keptBy = new Dictionary<Guid, List<DateTimeOffset>>();
        foreach (var m in meetings.Where(m => m.Outcome == MeetingOutcome.Kept))
        {
            var b = bonds.Single(x => x.Id == m.BondId);
            foreach (var who in new[] { b.AId, b.BId })
            {
                db.Add(new VenueRating
                {
                    Id = Guid.CreateVersion7(), VenueId = m.VenueId, MeetingId = m.Id, AccountId = who,
                    Stars = 4 + rng.Next(2), CreatedAt = m.ClosedAt!.Value.AddHours(1),
                });
                (keptBy.TryGetValue(who, out var l) ? l : keptBy[who] = []).Add(m.ClosedAt!.Value);
            }
        }
        foreach (var (who, times) in keptBy)
        {
            if (times.Count < config.Int(ConfigKeys.OathProvenEncounters) || !profiles.TryGetValue(who, out var p) || p.Oath is null) continue;
            var at = times.Order().ElementAt(config.Int(ConfigKeys.OathProvenEncounters) - 1);
            p.OathProvenAt = at;
            Deed(who, DeedKinds.OathProven, config.Int(ConfigKeys.ScoreOathProven), null, at);
        }

        if (retired is { } r)
            foreach (var who in new[] { r.A, r.B })
                if (profiles.TryGetValue(who, out var p)) (p.RetiredAt, p.PausedAt) = (r.At, r.At);
        if (heroId is { } h && profiles.TryGetValue(h, out var hp))
        {
            hp.Streak = 5;
            hp.LastDawn = clock.TodayUb.AddDays(-1);
        }

        db.AddRange(deeds);
        await db.SaveChangesAsync(ct);

        // Points and tiers from the deeds; reputation from the scars and penalties.
        var sums = await db.Set<ScoreEvent>().Where(e => everyone.Contains(e.AccountId))
            .GroupBy(e => e.AccountId).Select(g => new { g.Key, Sum = g.Sum(e => e.Amount) }).ToDictionaryAsync(x => x.Key, x => x.Sum, ct);
        var colds = deeds.Where(d => d.Kind == DeedKinds.GoneCold).GroupBy(d => d.AccountId).ToDictionary(g => g.Key, g => g.Count());
        var penalties = deeds.Where(d => d.Kind == DeedKinds.Penalised).GroupBy(d => d.AccountId).ToDictionary(g => g.Key, g => g.Count());
        foreach (var p in profiles.Values)
        {
            p.Points = Math.Max(0, sums.GetValueOrDefault(p.AccountId));
            p.Tier = Tiers.For(p.Points, config);
            p.Reputation = 100 - colds.GetValueOrDefault(p.AccountId) * config.Int(ConfigKeys.ReputationGoneCold)
                - penalties.GetValueOrDefault(p.AccountId) * config.Int(ConfigKeys.ReputationPenalised);
        }
        await db.SaveChangesAsync(ct);
        db.ChangeTracker.Clear();

        foreach (var p in profiles.Values.Where(p => p.WelcomedAt is not null))
            await honours.CheckAsync(p.AccountId, quietly: true, ct);
    }

    // ── Building blocks ───────────────────────────────────────────────────────────────────────────

    private DateTimeOffset H(double hours) => now.AddHours(-hours);
    private DateTimeOffset D(double days) => now.AddDays(-days);

    /// 19:00 in Ulaanbaatar, `days` from today.
    private DateTimeOffset Evening(int days) => UbDays.Start(clock.TodayUb.AddDays(days)).AddHours(19);

    private string Pick(params string[] ids) => ids[rng.Next(ids.Length)];

    /// A bond made `at`: summoned in Seek by `summoner`, or woven by `weaver` (a Fated Thread).
    private Bond Summon(Guid summoner, Guid other, DateTimeOffset at, Guid? weaver = null)
    {
        var (a, b) = Bond.Pair(summoner, other);
        if (!pairs.Add((a, b))) throw new InvalidOperationException("A pair bonds once");
        var bond = new Bond
        {
            Id = Guid.CreateVersion7(), AId = a, BId = b, SummonerId = weaver ?? summoner,
            Origin = weaver is null ? BondOrigins.Seek : BondOrigins.Thread,
            SummonDay = UbDays.DayOf(at), State = BondState.Live, CreatedAt = at,
        };
        db.Add(bond);
        return bond;
    }

    /// Letters between the two, spread from the bond's start to `lastAt`, ending with `lastBy`. Seals
    /// break where the shorter side reaches each threshold; each letter pays its deed.
    private Bond Talk(Bond b, Guid x, int fromX, Guid y, int fromY, Guid lastBy, DateTimeOffset lastAt)
    {
        var other = lastBy == x ? y : x;
        var (nLast, nOther) = lastBy == x ? (fromX, fromY) : (fromY, fromX);
        var order = new List<Guid>();
        var turn = nOther >= nLast ? other : lastBy;
        while (nLast + nOther > 0)
        {
            if (turn == lastBy && nLast > 0) { order.Add(lastBy); nLast--; }
            else if (turn == other && nOther > 0) { order.Add(other); nOther--; }
            else if (nLast > 0) { order.Add(lastBy); nLast--; }
            else { order.Add(other); nOther--; }
            turn = turn == lastBy ? other : lastBy;
        }
        if (order[^1] != lastBy) { order.Remove(lastBy); order.Add(lastBy); }

        var thresholds = new[] { ConfigKeys.Seal1, ConfigKeys.Seal2, ConfigKeys.Seal3, ConfigKeys.Seal4 }.Select(config.Int).ToArray();
        var start = b.CreatedAt.AddMinutes(30);
        var step = (lastAt - start) / Math.Max(1, order.Count - 1);
        Letter? last = null;
        // The lines are one conversation, the same in both languages: each letter answers the one before.
        // A bond starts at one of its openers and, when it runs long, picks up again at a new topic.
        var offset = Openers[rng.Next(Openers.Length)];
        for (var i = 0; i < order.Count; i++)
        {
            var who = order[i];
            var at = start + step * i;
            if (who == b.AId) b.LettersA++; else b.LettersB++;
            var letter = new Letter { Id = Guid.CreateVersion7(), BondId = b.Id, AuthorId = who, Text = Line(who, offset + i), CreatedAt = at };
            var seals = thresholds.Count(t => b.Mutual >= t);
            if (seals > b.Seals) { letter.SealBroken = seals; b.Seals = seals; }
            db.Add(letter);
            if (i == 0) Deed(who, DeedKinds.FirstLetter, config.Int(ConfigKeys.ScoreFirstLetter), b.Id, at);
            else Deed(who, DeedKinds.Reply, config.Int(ConfigKeys.ScoreReply), b.Id, at);
            last = letter;
        }
        b.LastLetterAt = last!.CreatedAt;
        b.LastLetterBy = last.AuthorId;
        b.LastLetterText = last.Text.Length > 140 ? last.Text[..140] : last.Text;
        // Whoever wrote last has read everything; the other read up to the letter before.
        var before = order.Count > 1 ? start + step * (order.Count - 2) : b.CreatedAt;
        (b.ReadA, b.ReadB) = b.LastLetterBy == b.AId ? (lastAt, before) : (before, lastAt);
        return b;
    }

    private void Close(Bond b, BondState state, Guid? by, DateTimeOffset at)
    {
        b.State = state;
        b.ClosedAt = at;
        b.ClosedBy = by;
        b.EmbersAt = null;
    }

    private Encounter E(Bond b)
    {
        var e = db.ChangeTracker.Entries<Encounter>().Select(x => x.Entity).SingleOrDefault(x => x.BondId == b.Id);
        if (e is not null) return e;
        e = new Encounter { BondId = b.Id };
        db.Add(e);
        // The steps the bond's seals have opened.
        e.IcebreakerId = icebreakers[rng.Next(icebreakers.Length)];
        e.IcebreakerOpenAt = b.CreatedAt.AddMinutes(30);
        if (b.Seals >= config.Int(ConfigKeys.TrialSeal))
        {
            e.TrialIds = trials.OrderBy(_ => rng.Next()).Take(EncounterService.TrialLength).ToArray();
            e.TrialOpenAt = b.CreatedAt.AddDays(2);
        }
        if (b.Seals >= config.Int(ConfigKeys.MeetingSeal)) e.MeetingOpenAt = b.CreatedAt.AddDays(3);
        return e;
    }

    private void Icebreaker(Bond b, params (Guid Who, string Text)[] answers)
    {
        var e = E(b);
        foreach (var (who, text) in answers)
            if (who == b.AId) e.IcebreakerA = text; else e.IcebreakerB = text;
        if (e.IcebreakerA is null || e.IcebreakerB is null) return;
        e.IcebreakerRevealedAt = b.CreatedAt.AddDays(1);
        Both(b, DeedKinds.Icebreaker, ConfigKeys.ScoreIcebreaker, e.IcebreakerRevealedAt.Value);
    }

    private void Trial(Bond b, Guid x, int fromX, int fromY)
    {
        var e = E(b);
        int[] Picks(int n) => Enumerable.Range(0, n).Select(_ => rng.Next(4)).ToArray();
        if (x == b.AId) (e.TrialA, e.TrialB) = (Picks(fromX), Picks(fromY));
        else (e.TrialA, e.TrialB) = (Picks(fromY), Picks(fromX));
        if (e.TrialA.Length < EncounterService.TrialLength || e.TrialB.Length < EncounterService.TrialLength) return;
        e.TrialDoneAt = (e.TrialOpenAt ?? b.CreatedAt).AddDays(1);
        Both(b, DeedKinds.Trial, ConfigKeys.ScoreTrial, e.TrialDoneAt.Value);
    }

    private void Rite(Bond b, Guid by, DateTimeOffset at, bool done = false)
    {
        var e = E(b);
        (e.RiteBy, e.RiteAt) = (by, at);
        if (!done) return;
        e.RiteAcceptedAt = at.AddHours(1);
        e.RiteDoneAt = at.AddHours(2);
        Both(b, DeedKinds.Rite, ConfigKeys.ScoreRite, e.RiteDoneAt.Value);
    }

    /// Icebreaker, Trial and Flame Rite all done by `at` — the road to a meeting is open.
    private void FullRoad(Bond b, Guid x, Guid y, DateTimeOffset at)
    {
        Icebreaker(b, (x, Answer(x)), (y, Answer(y)));
        Trial(b, x, 5, 5);
        Rite(b, y, at, done: true);
    }

    private void Meeting(Bond b, string venue, DateTimeOffset at, Guid proposer, MeetingState state,
        MeetingOutcome? outcome = null, Guid? noShowOf = null, (Guid Who, AttendanceAnswer Answer)? answer = null)
    {
        var after = config.Int(ConfigKeys.AttendanceAfterHours);
        var m = new Meeting
        {
            Id = Guid.CreateVersion7(), BondId = b.Id, VenueId = V(venue), At = at, ProposedBy = proposer,
            // A proposal is the proposer's pledge; any later state has both.
            PledgeA = state != MeetingState.Proposed || proposer == b.AId,
            PledgeB = state != MeetingState.Proposed || proposer == b.BId,
            State = state, CreatedAt = at.AddDays(-3) < now ? at.AddDays(-3) : now.AddHours(-2),
        };
        if (state != MeetingState.Proposed)
        {
            m.SwornAt = m.CreatedAt.AddHours(2);
            Both(b, DeedKinds.Meeting, ConfigKeys.ScoreMeeting, m.SwornAt.Value);
        }
        if (state is MeetingState.Checking or MeetingState.Closed)
            m.CheckUntil = at.AddHours(after + config.Int(ConfigKeys.AttendanceWindowHours));
        if (answer is { } an)
            if (an.Who == b.AId) m.AnswerA = an.Answer; else m.AnswerB = an.Answer;
        if (state == MeetingState.Closed)
        {
            m.Outcome = outcome;
            m.NoShowOf = noShowOf;
            m.ClosedAt = at.AddHours(after + 8);
            if (outcome == MeetingOutcome.Kept) (m.AnswerA, m.AnswerB) = (AttendanceAnswer.Met, AttendanceAnswer.Met);
            if (outcome == MeetingOutcome.NoShow && noShowOf is { } gone)
                if (gone == b.AId) m.AnswerB = AttendanceAnswer.NoShow; else m.AnswerA = AttendanceAnswer.NoShow;
        }
        db.Add(m);
    }

    /// This week's Exchange, answered by `answered` and waiting on the other.
    private void Weekly(Bond b, Guid answered)
    {
        var t = new WeeklyTrial
        {
            Id = Guid.CreateVersion7(), BondId = b.Id, Week = UbDays.WeekStart(clock.TodayUb), Kind = TrialKind.Exchange,
            Prompts = [icebreakers[rng.Next(icebreakers.Length)]], CreatedAt = H(30),
        };
        db.Add(t);
        db.Add(new WeeklyAnswer { TrialId = t.Id, Game = 0, AccountId = answered, Text = Answer(answered), AnsweredAt = H(20) });
    }

    private void Both(Bond b, string kind, string key, DateTimeOffset at)
    {
        Deed(b.AId, kind, config.Int(key), b.Id, at);
        Deed(b.BId, kind, config.Int(key), b.Id, at);
    }

    private void Deed(Guid who, string kind, int amount, Guid? bondId, DateTimeOffset at) =>
        deeds.Add(new ScoreEvent
        {
            Id = Guid.CreateVersion7(), AccountId = who, Kind = kind, Amount = amount, BondId = bondId,
            Day = UbDays.DayOf(at), CreatedAt = at,
        });

    private string Code() => new(Enumerable.Range(0, 6).Select(_ => "ABCDEFGHJKLMNPQRSTUVWXYZ"[rng.Next(24)]).ToArray());

    private bool Mn(Guid who) => locales.GetValueOrDefault(who) == "mn";

    private string Line(Guid who, int n)
    {
        var len = LettersEn.Length;
        var k = n < len ? n : Openers[1] + (n - len) % (len - Openers[1]);
        return (Mn(who) ? LettersMn : LettersEn)[k];
    }

    /// Lines of LettersEn/LettersMn that can begin a conversation.
    private static readonly int[] Openers = [0, 7, 10, 15, 19, 21];

    private string Answer(Guid who) => Mn(who) ? AnswersMn[rng.Next(AnswersMn.Length)] : AnswersEn[rng.Next(AnswersEn.Length)];

    private static readonly string[] LettersEn =
    [
        "Hi! Your tale made me smile. Do you really ride out at dawn?",
        "Guilty. Are you a tea person or a coffee person?",
        "Tea, always. Salty milk tea, the way my grandmother made it.",
        "Same! Where did you grow up?",
        "In the countryside near Kharkhorin. I moved to the city for university.",
        "I've never been. Is it as beautiful as people say?",
        "More. The sky goes on forever. You should see it in August.",
        "What does a free Saturday look like for you?",
        "A long walk, then a book and something warm.",
        "Honestly, that sounds like a perfect day.",
        "How was your week?",
        "Busy, but better since you wrote.",
        "Have you been to the jazz place on Peace Avenue?",
        "Not yet. Is it good?",
        "Very. Small, candles on the tables, live music that isn't too loud.",
        "What's the best trip you ever took?",
        "Khövsgöl in winter. The lake was frozen so clear you could see the stones.",
        "I'm a little nervous writing this, but I like talking to you.",
        "Me too. It feels easy.",
        "Tell me something nobody would guess about you.",
        "I can sing long song. Badly, but I can.",
        "Good morning! The snow finally came.",
        "Did you see the sunset tonight? The whole sky went orange.",
        "Sorry for the slow reply, long day at work.",
        "What are you reading at the moment?",
        "A book about the old caravan roads. You'd like it.",
    ];

    private static readonly string[] LettersMn =
    [
        "Сайн уу! Домог чинь намайг инээлгэлээ. Үнэхээр үүрээр мордодог уу?",
        "Тийм ээ, үнэн. Чи цайнд дуртай юу, кофенд үү?",
        "Цай л даа. Эмээгийнх шиг давстай сүүтэй цай.",
        "Би ч бас! Чи хаана өссөн бэ?",
        "Хархорины ойролцоо хөдөө. Их сургуульд ороод хот руу нүүсэн.",
        "Би тэнд очиж үзээгүй. Ярьдаг шигээ үзэсгэлэнтэй юу?",
        "Түүнээс ч илүү. Тэнгэр нь хязгааргүй. Наймдугаар сард очоод үз.",
        "Амралтын өдрөө юу хийдэг вэ?",
        "Удаан алхаад, дараа нь ном уншиж, халуун юм уудаг.",
        "Яг л төгс өдөр шиг сонсогдож байна.",
        "Энэ долоо хоног чинь ямар байв?",
        "Завгүй байсан, гэхдээ чи бичсэнээс хойш дээрдлээ.",
        "Энхтайвны өргөн чөлөөн дээрх жазз бааранд очиж байсан уу?",
        "Үгүй ээ. Сайхан газар уу?",
        "Маш сайхан. Жижигхэн, ширээн дээр лаа асаасан, хөгжим нь хэт чанга биш.",
        "Хамгийн сайхан аялал чинь аль нь байсан бэ?",
        "Өвлийн Хөвсгөл. Нуур нь ёроолын чулуу харагдтал тунгалаг хөлдсөн байсан.",
        "Бичихдээ жаахан сандарч байна, гэхдээ чамтай ярих таалагдаж байна.",
        "Надад ч бас. Их амар санагдаж байна.",
        "Хэн ч таамаглахгүй нэг зүйлээ хэлээч.",
        "Би уртын дуу дуулж чадна. Муухан ч гэсэн чадна.",
        "Өглөөний мэнд! Эцэст нь цас орлоо.",
        "Өнөө орой нар жаргахыг харсан уу? Тэнгэр тэр чигтээ улбар шар болсон.",
        "Хариу удсанд уучлаарай, ажил дээр урт өдөр байлаа.",
        "Одоо ямар ном уншиж байна?",
        "Эртний жингийн замын тухай ном. Чамд таалагдах байх.",
    ];

    private static readonly string[] AnswersEn =
    [
        "A quiet morning by the river, before the city wakes up.",
        "My grandfather's stories about the winter of 1999.",
        "Honest people who laugh easily.",
        "I would learn to play the morin khuur properly.",
        "Somewhere with no signal and a lot of stars.",
    ];

    private static readonly string[] AnswersMn =
    [
        "Хот сэрэхээс өмнөх голын эрэг дээрх нам гүм өглөө.",
        "Өвөөгийн маань ярьдаг хүйтэн өвлийн түүхүүд.",
        "Шударга, амархан инээдэг хүмүүс.",
        "Морин хуур зөв тоглож сурмаар байна.",
        "Сүлжээ байхгүй, од ихтэй хаа нэг газар.",
    ];
}
