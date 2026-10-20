using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Encounters;
using MinglDingl.Engine.Features.Festivals;
using MinglDingl.Engine.Features.Membership;
using MinglDingl.Engine.Features.Payments;
using MinglDingl.Engine.Features.Safety;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Features.Square;
using MinglDingl.Engine.Features.Wanderings;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;

namespace MinglDingl.Engine.Features.Dev;

/// The world's occasions: the Town Square on festival nights and ordinary ones (closed with its
/// rounds and a match, tonight's open bell, one only the High Table may sit at yet, the coming Last
/// Bell and Day of the Bond, a masked night, a cancelled one); a meeting kept on Naadam (its honour)
/// with the Wanderings that followed; the Guild House floors (store, QPay, a lapse, an end in two
/// days, a keeper's gift, money waiting on the keepers); someone away by the fire, one leaving, one
/// paused; deep profiles; and the troll cases (hidden after three reports, a barred number, a phone
/// shared with a removed and with a suspended character).
public sealed partial class WorldSeeder
{
    /// Fixed ids, so a rerun finds and replaces exactly the gatherings it made.
    private static readonly Guid[] GatheringIds = Enumerable.Range(1, 8)
        .Select(i => Guid.Parse($"5eed0000-0000-7000-8000-0000000000{i:D2}")).ToArray();

    private const string BarredPhone = "99108801";
    private static readonly string RemovedPhone = DeviceKeys.Hash("seed-removed-troll-phone")!;
    private static readonly string SharedPhone = DeviceKeys.Hash("seed-shared-phone")!;

    private async Task ResetOccasionsAsync(List<Guid> everyone, CancellationToken ct)
    {
        await db.Set<Gathering>().Where(g => GatheringIds.Contains(g.Id)).ExecuteDeleteAsync(ct);
        await db.Set<MembershipGrant>().Where(g => everyone.Contains(g.AccountId)).ExecuteDeleteAsync(ct);
        var invoices = db.Set<Invoice>().Where(i => i.AccountId != null && everyone.Contains(i.AccountId.Value)).Select(i => i.Id);
        await db.Set<PaymentEvent>().Where(e => invoices.Contains(e.InvoiceId)).ExecuteDeleteAsync(ct);
        await db.Set<Payment>().Where(p => invoices.Contains(p.InvoiceId)).ExecuteDeleteAsync(ct);
        await db.Set<Invoice>().Where(i => i.AccountId != null && everyone.Contains(i.AccountId.Value)).ExecuteDeleteAsync(ct);
        await db.Set<BarredNumber>().Where(b => b.Phone == BarredPhone).ExecuteDeleteAsync(ct);
        await db.Set<BarredDevice>().Where(b => b.Key == RemovedPhone).ExecuteDeleteAsync(ct);
        await db.Set<Account>().Where(a => everyone.Contains(a.Id)).ExecuteUpdateAsync(u => u
            .SetProperty(a => a.DeleteAt, (DateTimeOffset?)null)
            .SetProperty(a => a.FlaggedAt, (DateTimeOffset?)null).SetProperty(a => a.FlaggedWhy, (string?)null), ct);
        await db.Set<Profile.Profile>().Where(p => everyone.Contains(p.AccountId)).ExecuteUpdateAsync(u => u
            .SetProperty(p => p.AwayFrom, (DateTimeOffset?)null).SetProperty(p => p.AwayUntil, (DateTimeOffset?)null)
            .SetProperty(p => p.HasChildren, (string?)null).SetProperty(p => p.ShowChildren, false)
            .SetProperty(p => p.WantsChildren, (string?)null).SetProperty(p => p.PartnerChildren, (string?)null)
            .SetProperty(p => p.Smoking, (string?)null).SetProperty(p => p.Drinking, (string?)null)
            .SetProperty(p => p.Faith, (string?)null).SetProperty(p => p.Lifestyle, (string?)null), ct);
    }

    private async Task OccasionsAsync(Func<string, Guid> p, Guid? hero, Dictionary<Guid, Profile.Profile> profiles, CancellationToken ct)
    {
        var questions = await db.Set<IcebreakerQuestion>().OrderBy(q => q.Id).Select(q => q.Text).Take(40).ToListAsync(ct);
        var naadam = await LastFestivalAsync(FestivalKeys.Naadam, ct);
        Square(p, hero, profiles, questions, naadam);
        if (naadam is { } n) NaadamMeeting(p, n);
        Floors(p);
        Lives(p, profiles);
        Deep(p, profiles);
        await TrollsAsync(p, ct);
    }

    private async Task<Festival?> LastFestivalAsync(string key, CancellationToken ct)
    {
        var today = clock.TodayUb;
        return await db.Set<Festival>().AsNoTracking().Where(f => f.Key == key && f.Ends < today)
            .OrderByDescending(f => f.Starts).FirstOrDefaultAsync(ct);
    }

    private async Task<DateOnly> NextFestivalDayAsync(string key, DateOnly fallback, CancellationToken ct)
    {
        var today = clock.TodayUb;
        return await db.Set<Festival>().AsNoTracking().Where(f => f.Key == key && f.Starts > today)
            .OrderBy(f => f.Starts).Select(f => (DateOnly?)f.Starts).FirstOrDefaultAsync(ct) ?? fallback;
    }

    /// At `hour` o'clock in Ulaanbaatar on `day`.
    private static DateTimeOffset At(DateOnly day, int hour) => UbDays.Start(day).AddHours(hour);

    // ── The Town Square ───────────────────────────────────────────────────────────────────────────

    private void Square(Func<string, Guid> p, Guid? hero, Dictionary<Guid, Profile.Profile> profiles, List<string> questions,
        Festival? naadam)
    {
        var today = clock.TodayUb;
        string Q(int i) => questions.Count == 0 ? "" : questions[i % questions.Count];

        // Last Naadam: three rounds, three tables; the third round's last table both said yes.
        if (naadam is { } n)
        {
            var g = Gathering(0, "Наадмын талбай", FestivalKeys.Naadam, masked: false, At(n.Starts.AddDays(1), 20), rounds: 3, seats: 12);
            Closed(g, [p("p08"), p("p12"), p("p20")], [p("p03"), p("p07"), p("p15")], Q, matchLast: true);
        }

        // An ordinary night six days ago, voices only until the bell.
        var masked = Gathering(1, "Багтай орой", null, masked: true, At(today.AddDays(-6), 20), rounds: 2, seats: 8);
        Closed(masked, [p("p24"), p("p32")], [p("p11"), p("p23")], Q, matchLast: false);

        // Rung, then called off for the wind.
        var windy = Gathering(2, "Салхитай орой", null, masked: false, At(today.AddDays(-2), 20), rounds: 3, seats: 12);
        windy.CancelledAt = D(2.5);

        // Tonight: open, six sat down (and the hero, if there is one).
        var tonightDay = now < At(today, 20) ? today : today.AddDays(1);
        var tonight = Gathering(3, "Өнөө оройн гал", null, masked: false, At(tonightDay, 21), rounds: 4, seats: 16);
        tonight.CreatedAt = H(30);
        var sit = new List<Guid> { p("p00"), p("p06"), p("p14"), p("p01"), p("p09"), p("p17") };
        if (hero is { } h && profiles.TryGetValue(h, out var hp) && hp.WelcomedAt is not null) sit.Add(h);
        foreach (var who in sit) Sit(tonight, who, profiles, H(20));

        // Rung minutes ago: only the High Table may sit yet, and one of them already has.
        var fresh = Gathering(4, "Шинэ хонх", null, masked: false, At(today.AddDays(3), 20), rounds: 3, seats: 12);
        fresh.CreatedAt = now.AddMinutes(-2);
        Sit(fresh, p("p05"), profiles, now.AddMinutes(-1));

        // The year's last bell and the Day of the Bond: rung early, seats filling.
        var lastBell = Gathering(5, "Оны сүүлчийн хонх", FestivalKeys.LastBell, masked: true,
            At(NextOr(FestivalKeys.LastBell, new DateOnly(today.Year, 12, 30)), 20), rounds: 5, seats: 20);
        foreach (var who in new[] { "p02", "p10", "p13", "p21" }) Sit(lastBell, p(who), profiles, D(1));
        Gathering(6, "Холбооны өдрийн талбай", FestivalKeys.DayOfBond, masked: false,
            At(NextOr(FestivalKeys.DayOfBond, new DateOnly(today.Year + 1, 2, 14)), 20), rounds: 4, seats: 16);
    }

    private readonly Dictionary<string, DateOnly> nextFestivals = [];
    private DateOnly NextOr(string key, DateOnly fallback) => nextFestivals.GetValueOrDefault(key, fallback);

    private Gathering Gathering(int n, string name, string? festival, bool masked, DateTimeOffset startsAt, int rounds, int seats)
    {
        var g = new Gathering
        {
            Id = GatheringIds[n], Name = name, Festival = festival, Masked = masked, StartsAt = startsAt, Rounds = rounds,
            RoundMinutes = 5, Seats = seats, CreatedAt = startsAt.AddDays(-4) < now ? startsAt.AddDays(-4) : now.AddDays(-1),
        };
        db.Add(g);
        return g;
    }

    private void Sit(Gathering g, Guid who, Dictionary<Guid, Profile.Profile> profiles, DateTimeOffset at) =>
        db.Add(new Seat { GatheringId = g.Id, AccountId = who, Gender = profiles[who].Gender ?? "", TakenAt = at });

    /// A night that ran: everyone came and stayed, each round seats each man with the next woman,
    /// and (if asked) the last table of the last round both said yes — a bond the square made.
    private void Closed(Gathering g, List<Guid> women, List<Guid> men, Func<int, string> question, bool matchLast)
    {
        var slot = TimeSpan.FromMinutes(g.RoundMinutes) + TimeSpan.FromSeconds(config.Int(ConfigKeys.SquareDecideSeconds))
            + TimeSpan.FromSeconds(config.Int(ConfigKeys.SquareBreakSeconds));
        foreach (var (who, gender) in women.Select(w => (w, "Female")).Concat(men.Select(m => (m, "Male"))))
        {
            db.Add(new Seat
            {
                GatheringId = g.Id, AccountId = who, Gender = gender, TakenAt = g.StartsAt.AddDays(-2),
                JoinedAt = g.StartsAt.AddMinutes(-5), AttendPaid = true,
            });
            Deed(who, DeedKinds.Square, config.Int(ConfigKeys.ScoreSquare), null, g.StartsAt.AddMinutes(10));
        }
        var tables = Math.Min(women.Count, men.Count);
        for (var r = 0; r < g.Rounds; r++)
        {
            var start = g.StartsAt + slot * r;
            db.Add(new SquareRound { GatheringId = g.Id, Index = r, PairedAt = start, SettledAt = start + slot });
            for (var t = 0; t < tables; t++)
            {
                var (man, woman) = (men[t], women[(t + r) % tables]);
                var match = matchLast && r == g.Rounds - 1 && t == tables - 1 && !pairs.Contains(Bond.Pair(man, woman));
                var pair = new SquarePair
                {
                    Id = Guid.CreateVersion7(), GatheringId = g.Id, Round = r, ManId = man, WomanId = woman,
                    Question = question(r * tables + t), ManYes = match || (r + t) % 3 == 0, WomanYes = match,
                    Outcome = match ? "match" : "apart",
                };
                if (match)
                {
                    var bond = SquareBond(man, woman, g, start + slot);
                    pair.BondId = bond.Id;
                    Talk(bond, woman, 5, man, 5, lastBy: man, D(20));
                }
                db.Add(pair);
            }
        }
    }

    /// A bond the square made: neither summoned, no candle spent.
    private Bond SquareBond(Guid man, Guid woman, Gathering g, DateTimeOffset at)
    {
        var (a, b) = Bond.Pair(man, woman);
        pairs.Add((a, b));
        var bond = new Bond
        {
            Id = Guid.CreateVersion7(), AId = a, BId = b, SummonerId = g.Id, Origin = BondOrigins.Square,
            SummonDay = UbDays.DayOf(at), State = BondState.Live, CreatedAt = at,
        };
        db.Add(bond);
        return bond;
    }

    // ── A meeting kept on Naadam, and the Wanderings after it ─────────────────────────────────────

    private void NaadamMeeting(Func<string, Guid> p, Festival naadam)
    {
        var (her, him) = (p("p28"), p("p07"));
        if (pairs.Contains(Bond.Pair(her, him))) return;
        var day = At(naadam.Starts.AddDays(2), 17);
        var bond = Talk(Summon(him, her, day.AddDays(-12)), him, 26, her, 27, lastBy: her, H(16));
        FullRoad(bond, him, her, day.AddDays(-4));
        Meeting(bond, Pick("v02", "v05", "v11"), day, proposer: her, MeetingState.Closed, outcome: MeetingOutcome.Kept);

        string? Line(Guid who, string en, string mn) => Mn(who) ? mn : en;
        var kept = day.AddDays(9);
        db.AddRange(
            new WanderingTaken
            {
                Id = Guid.CreateVersion7(), BondId = bond.Id, Key = "songs-of-steppe", AskedBy = her, AskedAt = day.AddDays(3),
                AgreedAt = day.AddDays(3).AddHours(5),
                LineA = Line(bond.AId, "The long song made me cry, and I did not hide it.", "Уртын дуу намайг уйлуулсан, би нуугаагүй."),
                LineB = Line(bond.BId, "You sang along without knowing the words.", "Чи үгийг нь мэдэхгүй атлаа дагаж дуулсан."),
                KeptAt = kept,
            },
            new WanderingTaken
            {
                Id = Guid.CreateVersion7(), BondId = bond.Id, Key = "stranger-dish", AskedBy = him, AskedAt = D(6), AgreedAt = D(5),
                LineA = bond.AId == him ? Line(him, "Sour, then sweet — I would order it again.", "Эхлээд исгэлэн, дараа нь чихэрлэг — дахиад захиална.") : null,
                LineB = bond.BId == him ? Line(him, "Sour, then sweet — I would order it again.", "Эхлээд исгэлэн, дараа нь чихэрлэг — дахиад захиална.") : null,
            },
            new WanderingTaken { Id = Guid.CreateVersion7(), BondId = bond.Id, Key = "small-things", AskedBy = her, AskedAt = H(10) });
    }

    // ── The Guild House floors ────────────────────────────────────────────────────────────────────

    private void Floors(Func<string, Guid> p)
    {
        void Grant(Guid who, Floor f, GrantSource source, string reference, DateTimeOffset from, DateTimeOffset until,
            bool renews = false, DateTimeOffset? notice = null) =>
            db.Add(new MembershipGrant
            {
                Id = Guid.CreateVersion7(), AccountId = who, Floor = f, Source = source, Ref = reference, StartsAt = from,
                EndsAt = until, Renews = renews, EndingNoticeAt = notice,
            });

        Grant(p("p02"), Floor.Hall, GrantSource.Store, "hall_monthly", D(12), now.AddDays(18), renews: true);
        Grant(p("p08"), Floor.Hall, GrantSource.Store, "hall_monthly", D(40), D(3));                       // lapsed
        Grant(p("p12"), Floor.Hall, GrantSource.Store, "hall_monthly", D(28), now.AddDays(2), notice: H(20)); // ends soon
        Grant(p("p13"), Floor.Hall, GrantSource.Keeper, $"keeper:{D(2):yyyyMMddHHmmss}", D(2), now.AddDays(12));

        // The High Table paid by QPay on the web page, credited.
        var paid = Invoice(p("p05"), "Тэмүүлэн", Floor.HighTable, 1, config.Int(ConfigKeys.PriceHighTable), D(5));
        var payment = Pay(paid, PaymentState.Credited, null, D(5).AddMinutes(3));
        Grant(p("p05"), Floor.HighTable, GrantSource.QPay, payment.Id.ToString(), D(5).AddMinutes(3), D(5).AddMinutes(3).AddDays(30));
        Event(paid, D(5), "Invoice made", "web page");
        Event(paid, D(5).AddMinutes(3), "Paid and credited: the High Table for 1 moon", "QPay");

        // Money that came after the invoice went cold: waits on the keepers' Payments page to be refunded.
        var cold = Invoice(p("p10"), "Уянга", Floor.Hall, 3,
            config.Int(ConfigKeys.PriceHall) * 3 * (100 - config.Int(ConfigKeys.Discount3)) / 100, D(1));
        Pay(cold, PaymentState.NeedsAttention, "Paid after the invoice went cold", D(1).AddMinutes(40));
        Event(cold, D(1), "Invoice made", "web page");
        Event(cold, D(1).AddMinutes(config.Int(ConfigKeys.InvoiceMinutes)), "Went cold unpaid", "sweep");
        Event(cold, D(1).AddMinutes(40), "Late money found; waits on the keepers", "sweep");
    }

    private Invoice Invoice(Guid who, string name, Floor f, int months, int amount, DateTimeOffset at)
    {
        var i = new Invoice
        {
            Id = Guid.CreateVersion7(), AccountId = who, Name = name, IdempotencyKey = $"seed-{Guid.NewGuid():N}", Floor = f,
            Months = months, Amount = amount, QPayInvoiceId = $"seed-{rng.Next(100000, 999999)}", State = InvoiceState.Closed,
            CreatedAt = at, ExpiresAt = at.AddMinutes(config.Int(ConfigKeys.InvoiceMinutes)), WatchUntil = at.AddDays(1),
        };
        db.Add(i);
        return i;
    }

    private Payment Pay(Invoice i, PaymentState state, string? note, DateTimeOffset at)
    {
        var pay = new Payment
        {
            Id = Guid.CreateVersion7(), InvoiceId = i.Id, QPayPaymentId = $"seed-{rng.Next(100000, 999999)}", Amount = i.Amount,
            State = state, Note = note, PaidAt = at, SettledAt = state == PaymentState.Credited ? at : null,
        };
        db.Add(pay);
        return pay;
    }

    private void Event(Invoice i, DateTimeOffset at, string what, string by) =>
        db.Add(new PaymentEvent { Id = Guid.CreateVersion7(), InvoiceId = i.Id, At = at, What = what, By = by });

    // ── Away, leaving, paused ─────────────────────────────────────────────────────────────────────

    private void Lives(Func<string, Guid> p, Dictionary<Guid, Profile.Profile> profiles)
    {
        if (profiles.TryGetValue(p("p18"), out var away)) (away.AwayFrom, away.AwayUntil) = (D(1), now.AddDays(6));
        if (profiles.TryGetValue(p("p34"), out var paused)) paused.PausedAt = D(4);
        leaving = (p("p30"), now.AddDays(12));
    }

    private (Guid Who, DateTimeOffset At)? leaving;

    // ── Deep profiles (filled by members, and a few who filled them before a floor lapsed) ────────

    private void Deep(Func<string, Guid> p, Dictionary<Guid, Profile.Profile> profiles)
    {
        var rows = new (string Id, string? Has, bool Show, string? Wants, string? Partner, string? Smoke, string? Drink, string? Faith, string? Life)[]
        {
            ("p02", "no", false, "yes", "welcome", "never", "withFriends", "buddhist", "outdoors"),
            ("p05", "yes", true, "notSure", "welcome", "sometimes", "withFriends", "shamanic", "traveller"),
            ("p08", "no", false, "yes", "open", "never", "never", "none", "city"),
            ("p12", "yes", false, "no", "welcome", "never", "withFriends", "buddhist", "homebody"),
            ("p13", "no", false, "yes", "preferNot", "daily", "often", "ratherNot", "outdoors"),
            ("p00", "yes", true, "ratherNot", "open", "never", "never", "buddhist", "outdoors"),
            ("p14", null, false, "yes", null, "never", "withFriends", "christian", null),
        };
        foreach (var r in rows)
        {
            if (!profiles.TryGetValue(p(r.Id), out var pr)) continue;
            (pr.HasChildren, pr.ShowChildren, pr.WantsChildren, pr.PartnerChildren) = (r.Has, r.Show, r.Wants, r.Partner);
            (pr.Smoking, pr.Drinking, pr.Faith, pr.Lifestyle) = (r.Smoke, r.Drink, r.Faith, r.Life);
        }
    }

    // ── Trolls ────────────────────────────────────────────────────────────────────────────────────

    private async Task TrollsAsync(Func<string, Guid> p, CancellationToken ct)
    {
        // Open reports from three different women: Мөнхбат is out of Seek until a keeper decides.
        Report(p("p26"), p("p31"), "rude", "Wrote something ugly when I did not answer fast.", ReportStatus.Open, H(30));
        Report(p("p28"), p("p31"), "money", "Asked me to top up his phone.", ReportStatus.Open, H(14));
        Report(p("p32"), p("p31"), "notWhoTheyClaim", null, ReportStatus.Open, H(3));

        // A troll the keepers removed: the number stays barred, and the phone it used came back as Temuujin.
        db.Add(new BarredNumber { Phone = BarredPhone, Why = "Threatened three women in letters", CreatedAt = D(9) });
        db.Add(new BarredDevice { Key = RemovedPhone, Why = "Threatened three women in letters", CreatedAt = D(9) });
        await KeyAsync(p("p29"), RemovedPhone, "Signed in on a device a removed character used", D(8), ct);

        // A phone a suspended character uses, signed in on by another.
        await KeyAsync(p("p43"), SharedPhone, null, null, ct);
        await KeyAsync(p("p35"), SharedPhone, "Signed in on a device a suspended character uses", D(2), ct);
    }

    /// Gives the person's newest device the key (adding one if they have none), and the flag.
    private async Task KeyAsync(Guid who, string key, string? why, DateTimeOffset? at, CancellationToken ct)
    {
        var device = await db.Set<DeviceSession>().Where(d => d.AccountId == who).OrderByDescending(d => d.CreatedAt).FirstOrDefaultAsync(ct);
        if (device is null)
        {
            device = new DeviceSession { AccountId = who, DeviceName = "Galaxy A14", CreatedAt = at ?? D(3), LastSeenAt = H(2) };
            db.Add(device);
        }
        device.DeviceKey = key;
        if (why is null) return;
        var account = await db.Set<Account>().SingleAsync(a => a.Id == who, ct);
        (account.FlaggedAt, account.FlaggedWhy) = (at, why);
    }

    /// Before: the festival days the square needs. After the rest is saved: the leaving one's day.
    private async Task OccasionsBeforeAsync(CancellationToken ct)
    {
        var today = clock.TodayUb;
        nextFestivals[FestivalKeys.LastBell] = await NextFestivalDayAsync(FestivalKeys.LastBell, new DateOnly(today.Year, 12, 30), ct);
        nextFestivals[FestivalKeys.DayOfBond] = await NextFestivalDayAsync(FestivalKeys.DayOfBond, new DateOnly(today.Year + 1, 2, 14), ct);
    }

    private async Task OccasionsAfterAsync(CancellationToken ct)
    {
        if (leaving is { } l)
            await db.Set<Account>().Where(a => a.Id == l.Who).ExecuteUpdateAsync(u => u.SetProperty(a => a.DeleteAt, l.At), ct);
    }
}
