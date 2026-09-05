using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class TownSquareServiceIntegrationTests : IntegrationTestBase
{
    private static TownSquareSession NewSession(string status = "Open")
    {
        var now = DateTime.UtcNow;
        return new TownSquareSession
        {
            RsvpOpensAt = now.AddDays(-1),
            RsvpClosesAt = now.AddHours(1),
            ScheduledStartAt = now.AddHours(2),
            Status = status,
        };
    }

    [Fact]
    public async Task RsvpAsync_OpenSession_AddsRsvp()
    {
        var user = NewCompleteUser();
        var session = NewSession();
        Db.Users.Add(user);
        Db.TownSquareSessions.Add(session);
        await Db.SaveChangesAsync();

        var service = new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush(), NullLogger<TownSquareService>.Instance, new ConfigService());
        await service.RsvpAsync(session.Id, user.Id);

        Db.ChangeTracker.Clear();
        Assert.True(await Db.TownSquareRsvps.AnyAsync(r => r.SessionId == session.Id && r.UserId == user.Id));
    }

    [Fact]
    public async Task RsvpAsync_AlreadyRsvpd_DoesNotDuplicate()
    {
        var user = NewCompleteUser();
        var session = NewSession();
        Db.Users.Add(user);
        Db.TownSquareSessions.Add(session);
        await Db.SaveChangesAsync();

        var service = new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush(), NullLogger<TownSquareService>.Instance, new ConfigService());
        await service.RsvpAsync(session.Id, user.Id);
        await service.RsvpAsync(session.Id, user.Id);

        Db.ChangeTracker.Clear();
        int count = await Db.TownSquareRsvps.CountAsync(r => r.SessionId == session.Id && r.UserId == user.Id);
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task RsvpAsync_SessionNotOpen_Throws()
    {
        var user = NewCompleteUser();
        var session = NewSession(status: "Locked");
        Db.Users.Add(user);
        Db.TownSquareSessions.Add(session);
        await Db.SaveChangesAsync();

        var service = new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush(), NullLogger<TownSquareService>.Instance, new ConfigService());
        var ex = await Assert.ThrowsAsync<DomainException>(() => service.RsvpAsync(session.Id, user.Id));
        Assert.Equal(StatusCodes.Status400BadRequest, ex.StatusCode);
    }

    [Fact]
    public async Task CancelRsvpAsync_ExistingRsvp_RemovesIt()
    {
        var user = NewCompleteUser();
        var session = NewSession();
        Db.Users.Add(user);
        Db.TownSquareSessions.Add(session);
        Db.TownSquareRsvps.Add(new TownSquareRsvp { SessionId = session.Id, UserId = user.Id });
        await Db.SaveChangesAsync();

        var service = new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush(), NullLogger<TownSquareService>.Instance, new ConfigService());
        await service.CancelRsvpAsync(session.Id, user.Id);

        Db.ChangeTracker.Clear();
        Assert.False(await Db.TownSquareRsvps.AnyAsync(r => r.SessionId == session.Id && r.UserId == user.Id));
    }

    [Fact]
    public async Task CancelRsvpAsync_NoExistingRsvp_NoOp()
    {
        var user = NewCompleteUser();
        var session = NewSession();
        Db.Users.Add(user);
        Db.TownSquareSessions.Add(session);
        await Db.SaveChangesAsync();

        var service = new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush(), NullLogger<TownSquareService>.Instance, new ConfigService());
        await service.CancelRsvpAsync(session.Id, user.Id);
    }

    private static User NewGenderedUser(string gender)
    {
        var user = NewCompleteUser();
        user.Gender = gender;
        return user;
    }

    private async Task<TownSquareSession> SeedOpenSessionWithRsvps(int menCount, int womenCount)
    {
        Db.Icebreakers.Add(new Icebreaker { QuestionText = "Favorite trip?", Type = "OpenText", IsActive = true });
        var session = NewSession();
        Db.TownSquareSessions.Add(session);

        for (int i = 0; i < menCount; i++)
        {
            var man = NewGenderedUser("Male");
            Db.Users.Add(man);
            Db.TownSquareRsvps.Add(new TownSquareRsvp { SessionId = session.Id, UserId = man.Id, RsvpAt = DateTime.UtcNow.AddMinutes(i) });
        }
        for (int i = 0; i < womenCount; i++)
        {
            var woman = NewGenderedUser("Female");
            Db.Users.Add(woman);
            Db.TownSquareRsvps.Add(new TownSquareRsvp { SessionId = session.Id, UserId = woman.Id, RsvpAt = DateTime.UtcNow.AddMinutes(i) });
        }

        await Db.SaveChangesAsync();
        return session;
    }

    [Fact]
    public async Task LockRosterAsync_BalancedRosterAtCap_LocksAndGeneratesFullRoundRobin()
    {
        var session = await SeedOpenSessionWithRsvps(menCount: 5, womenCount: 5);

        var service = new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush(), NullLogger<TownSquareService>.Instance, new ConfigService());
        await service.LockRosterAsync(session.Id);

        Db.ChangeTracker.Clear();
        var locked = await Db.TownSquareSessions.FindAsync(session.Id);
        Assert.Equal("Locked", locked!.Status);

        var rounds = await Db.TownSquareRounds.Where(r => r.SessionId == session.Id).ToListAsync();
        Assert.Equal(5, rounds.Count);

        var pairings = await Db.TownSquarePairings.Where(p => rounds.Select(r => r.Id).Contains(p.RoundId)).ToListAsync();
        Assert.Equal(25, pairings.Count);
        foreach (var group in pairings.GroupBy(p => p.UserAId))
            Assert.Equal(5, group.Select(p => p.UserBId).Distinct().Count());
    }

    [Fact]
    public async Task LockRosterAsync_UnbalancedRoster_CapsAtSmallerSide()
    {
        var session = await SeedOpenSessionWithRsvps(menCount: 3, womenCount: 5);

        var service = new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush(), NullLogger<TownSquareService>.Instance, new ConfigService());
        await service.LockRosterAsync(session.Id);

        Db.ChangeTracker.Clear();
        var rounds = await Db.TownSquareRounds.Where(r => r.SessionId == session.Id).ToListAsync();
        Assert.Equal(3, rounds.Count);
    }

    [Fact]
    public async Task LockRosterAsync_MaxPerSideAndRoundSecondsOverridden_UseConfigValues()
    {
        var session = await SeedOpenSessionWithRsvps(menCount: 5, womenCount: 5);
        var config = new ConfigService();
        config.Set("townsquare.max_per_side", "3");
        config.Set("townsquare.round_seconds", "90");

        var service = new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush(), NullLogger<TownSquareService>.Instance, config);
        await service.LockRosterAsync(session.Id);

        Db.ChangeTracker.Clear();
        var rounds = await Db.TownSquareRounds.Where(r => r.SessionId == session.Id).OrderBy(r => r.RoundNumber).ToListAsync();
        Assert.Equal(3, rounds.Count);
        Assert.All(rounds, r => Assert.Equal(90, r.DurationSeconds));
        Assert.Equal(rounds[0].StartsAt.AddSeconds(90), rounds[1].StartsAt);
    }

    [Fact]
    public async Task LockRosterAsync_MoreThanCapOnBothSides_CapsAtFive()
    {
        var session = await SeedOpenSessionWithRsvps(menCount: 7, womenCount: 7);

        var service = new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush(), NullLogger<TownSquareService>.Instance, new ConfigService());
        await service.LockRosterAsync(session.Id);

        Db.ChangeTracker.Clear();
        var rounds = await Db.TownSquareRounds.Where(r => r.SessionId == session.Id).ToListAsync();
        Assert.Equal(5, rounds.Count);
    }

    [Fact]
    public async Task LockRosterAsync_NoMenRsvpd_CancelsSession()
    {
        var session = await SeedOpenSessionWithRsvps(menCount: 0, womenCount: 3);

        var service = new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush(), NullLogger<TownSquareService>.Instance, new ConfigService());
        await service.LockRosterAsync(session.Id);

        Db.ChangeTracker.Clear();
        var cancelled = await Db.TownSquareSessions.FindAsync(session.Id);
        Assert.Equal("Cancelled", cancelled!.Status);
        Assert.Empty(await Db.TownSquareRounds.Where(r => r.SessionId == session.Id).ToListAsync());
    }

    [Fact]
    public async Task StartSessionAsync_LockedSession_MovesToInProgressAtRoundOne()
    {
        var session = await SeedOpenSessionWithRsvps(menCount: 2, womenCount: 2);
        var service = new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush(), NullLogger<TownSquareService>.Instance, new ConfigService());
        await service.LockRosterAsync(session.Id);

        await service.StartSessionAsync(session.Id);

        Db.ChangeTracker.Clear();
        var started = await Db.TownSquareSessions.FindAsync(session.Id);
        Assert.Equal("InProgress", started!.Status);
        Assert.Equal(1, started.CurrentRoundNumber);
    }

    [Fact]
    public async Task StartSessionAsync_PushesTownSquareStartingToEveryRosteredUser()
    {
        var session = await SeedOpenSessionWithRsvps(menCount: 2, womenCount: 2);
        var rostered = await Db.TownSquareRsvps.Where(r => r.SessionId == session.Id).Select(r => r.UserId).ToListAsync();
        var tokens = new List<string>();
        foreach (var id in rostered) tokens.Add(await RegisterPushTokenAsync(id));
        var (push, handler) = BuildCapturingPush();
        var service = new TownSquareService(Db, BuildTestBroadcast(), push, NullLogger<TownSquareService>.Instance, new ConfigService());
        await service.LockRosterAsync(session.Id);
        handler.RequestBodies.Clear();

        await service.StartSessionAsync(session.Id);

        var all = string.Join("\n", handler.RequestBodies);
        Assert.Equal(4, handler.RequestBodies.Count);
        foreach (var token in tokens) Assert.Contains(token, all);
        Assert.Contains("\"type\":\"townsquare_started\"", all);
        Assert.Contains($"\"sessionId\":\"{session.Id}\"", all);
    }

    [Fact]
    public async Task AdvanceRoundAsync_BeforeLastRound_IncrementsRoundNumber()
    {
        var session = await SeedOpenSessionWithRsvps(menCount: 2, womenCount: 2);
        var service = new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush(), NullLogger<TownSquareService>.Instance, new ConfigService());
        await service.LockRosterAsync(session.Id);
        await service.StartSessionAsync(session.Id);

        await service.AdvanceRoundAsync(session.Id);

        Db.ChangeTracker.Clear();
        var advanced = await Db.TownSquareSessions.FindAsync(session.Id);
        Assert.Equal("InProgress", advanced!.Status);
        Assert.Equal(2, advanced.CurrentRoundNumber);
    }

    [Fact]
    public async Task AdvanceRoundAsync_AtLastRound_CompletesSession()
    {
        var session = await SeedOpenSessionWithRsvps(menCount: 2, womenCount: 2);
        var service = new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush(), NullLogger<TownSquareService>.Instance, new ConfigService());
        await service.LockRosterAsync(session.Id);
        await service.StartSessionAsync(session.Id);
        await service.AdvanceRoundAsync(session.Id);

        await service.AdvanceRoundAsync(session.Id);

        Db.ChangeTracker.Clear();
        var completed = await Db.TownSquareSessions.FindAsync(session.Id);
        Assert.Equal("Completed", completed!.Status);
    }

    [Fact]
    public async Task AdvanceRoundAsync_BeforeLastRound_BroadcastsRoundAdvancedToSessionTopic()
    {
        var session = await SeedOpenSessionWithRsvps(menCount: 2, womenCount: 2);
        var (broadcast, handler) = BuildCapturingBroadcast();
        var service = new TownSquareService(Db, broadcast, BuildTestPush(), NullLogger<TownSquareService>.Instance, new ConfigService());
        await service.LockRosterAsync(session.Id);
        await service.StartSessionAsync(session.Id);

        await service.AdvanceRoundAsync(session.Id);

        Assert.NotNull(handler.LastRequestBody);
        Assert.Contains($"\"townsquare:{session.Id}\"", handler.LastRequestBody);
        Assert.Contains("\"round-advanced\"", handler.LastRequestBody);
        Assert.Contains("\"roundNumber\":2", handler.LastRequestBody);
        Assert.Contains("\"status\":\"InProgress\"", handler.LastRequestBody);
    }

    [Fact]
    public async Task StartSessionAsync_BroadcastsSessionStartedToSessionTopic()
    {
        var session = await SeedOpenSessionWithRsvps(menCount: 2, womenCount: 2);
        var (broadcast, handler) = BuildCapturingBroadcast();
        var service = new TownSquareService(Db, broadcast, BuildTestPush(), NullLogger<TownSquareService>.Instance, new ConfigService());
        await service.LockRosterAsync(session.Id);

        await service.StartSessionAsync(session.Id);

        Assert.NotNull(handler.LastRequestBody);
        Assert.Contains($"\"townsquare:{session.Id}\"", handler.LastRequestBody);
        Assert.Contains("\"session-started\"", handler.LastRequestBody);
        Assert.Contains("\"roundNumber\":1", handler.LastRequestBody);
        Assert.Contains("\"status\":\"InProgress\"", handler.LastRequestBody);
    }

    [Fact]
    public async Task LockRosterAsync_OneSideEmpty_CancelsAndBroadcastsSessionCancelled()
    {
        var session = await SeedOpenSessionWithRsvps(menCount: 2, womenCount: 0);
        var (broadcast, handler) = BuildCapturingBroadcast();
        var service = new TownSquareService(Db, broadcast, BuildTestPush(), NullLogger<TownSquareService>.Instance, new ConfigService());

        await service.LockRosterAsync(session.Id);

        Db.ChangeTracker.Clear();
        var reloaded = await Db.TownSquareSessions.FindAsync(session.Id);
        Assert.Equal("Cancelled", reloaded!.Status);
        Assert.NotNull(handler.LastRequestBody);
        Assert.Contains($"\"townsquare:{session.Id}\"", handler.LastRequestBody);
        Assert.Contains("\"session-cancelled\"", handler.LastRequestBody);
        Assert.Contains("\"status\":\"Cancelled\"", handler.LastRequestBody);
    }

    private async Task<TownSquarePairing> SeedSinglePairing()
    {
        var session = await SeedOpenSessionWithRsvps(menCount: 1, womenCount: 1);
        var service = new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush(), NullLogger<TownSquareService>.Instance, new ConfigService());
        await service.LockRosterAsync(session.Id);

        Db.ChangeTracker.Clear();
        return await Db.TownSquarePairings.FirstAsync(p => Db.TownSquareRounds.Any(r => r.Id == p.RoundId && r.SessionId == session.Id));
    }

    [Fact]
    public async Task MarkJoinedAsync_ParticipantA_SetsUserAJoinedAt()
    {
        var pairing = await SeedSinglePairing();
        var service = new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush(), NullLogger<TownSquareService>.Instance, new ConfigService());

        await service.MarkJoinedAsync(pairing.Id, pairing.UserAId);

        Db.ChangeTracker.Clear();
        var updated = await Db.TownSquarePairings.FindAsync(pairing.Id);
        Assert.NotNull(updated!.UserAJoinedAt);
        Assert.Null(updated.UserBJoinedAt);
    }

    [Fact]
    public async Task RespondToPairingAsync_OneYesOneNo_DoesNotCreateMatch()
    {
        var pairing = await SeedSinglePairing();
        var service = new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush(), NullLogger<TownSquareService>.Instance, new ConfigService());

        await service.RespondToPairingAsync(pairing.Id, pairing.UserAId, "Yes");
        var resultId = await service.RespondToPairingAsync(pairing.Id, pairing.UserBId, "No");

        Assert.Null(resultId);
        Db.ChangeTracker.Clear();
        Assert.False(await Db.Matches.AnyAsync(m =>
            (m.InitiatorId == pairing.UserAId && m.ReceiverId == pairing.UserBId) ||
            (m.InitiatorId == pairing.UserBId && m.ReceiverId == pairing.UserAId)));
    }

    [Fact]
    public async Task RespondToPairingAsync_MutualYesWhenMatchAlreadyExists_ReusesExistingMatch()
    {
        var pairing = await SeedSinglePairing();
        var existingMatch = new Match { InitiatorId = pairing.UserAId, ReceiverId = pairing.UserBId, Status = "Active", RevealLevel = 1 };
        Db.Matches.Add(existingMatch);
        await Db.SaveChangesAsync();

        var service = new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush(), NullLogger<TownSquareService>.Instance, new ConfigService());
        await service.RespondToPairingAsync(pairing.Id, pairing.UserAId, "Yes");
        var resultId = await service.RespondToPairingAsync(pairing.Id, pairing.UserBId, "Yes");

        Assert.Equal(existingMatch.Id, resultId);
        Db.ChangeTracker.Clear();
        int matchCount = await Db.Matches.CountAsync(m =>
            (m.InitiatorId == pairing.UserAId && m.ReceiverId == pairing.UserBId) ||
            (m.InitiatorId == pairing.UserBId && m.ReceiverId == pairing.UserAId));
        Assert.Equal(1, matchCount);
    }

    [Fact]
    public async Task RespondToPairingAsync_NonParticipant_Throws()
    {
        var pairing = await SeedSinglePairing();
        var service = new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush(), NullLogger<TownSquareService>.Instance, new ConfigService());
        var stranger = NewGenderedUser("Male");
        Db.Users.Add(stranger);
        await Db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<DomainException>(() => service.RespondToPairingAsync(pairing.Id, stranger.Id, "Yes"));
        Assert.Equal(StatusCodes.Status403Forbidden, ex.StatusCode);
    }
    [Fact]
    public async Task RespondToPairingAsync_MutualYesButPairIsBlocked_DoesNotCreateMatch()
    {
        var pairing = await SeedSinglePairing();
        Db.BlockedUsers.Add(new BlockedUser { BlockerId = pairing.UserAId, BlockedId = pairing.UserBId });
        await Db.SaveChangesAsync();
        var service = new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush(), NullLogger<TownSquareService>.Instance, new ConfigService());

        await service.RespondToPairingAsync(pairing.Id, pairing.UserAId, "Yes");
        var resultId = await service.RespondToPairingAsync(pairing.Id, pairing.UserBId, "Yes");

        Assert.Null(resultId);
        Db.ChangeTracker.Clear();
        Assert.False(await Db.Matches.AnyAsync(m =>
            (m.InitiatorId == pairing.UserAId && m.ReceiverId == pairing.UserBId) ||
            (m.InitiatorId == pairing.UserBId && m.ReceiverId == pairing.UserAId)));
    }

    [Fact]
    public async Task RespondToPairingAsync_MutualYesButBlockedInReverseDirection_DoesNotCreateMatch()
    {
        var pairing = await SeedSinglePairing();
        Db.BlockedUsers.Add(new BlockedUser { BlockerId = pairing.UserBId, BlockedId = pairing.UserAId });
        await Db.SaveChangesAsync();
        var service = new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush(), NullLogger<TownSquareService>.Instance, new ConfigService());

        await service.RespondToPairingAsync(pairing.Id, pairing.UserAId, "Yes");
        var resultId = await service.RespondToPairingAsync(pairing.Id, pairing.UserBId, "Yes");

        Assert.Null(resultId);
        Db.ChangeTracker.Clear();
        Assert.False(await Db.Matches.AnyAsync(m =>
            (m.InitiatorId == pairing.UserAId && m.ReceiverId == pairing.UserBId) ||
            (m.InitiatorId == pairing.UserBId && m.ReceiverId == pairing.UserAId)));
    }

    [Fact]
    public async Task RespondToPairingAsync_MutualYesWhenMatchAlreadyExists_DoesNotBroadcastMatchCreated()
    {
        var pairing = await SeedSinglePairing();
        Db.Matches.Add(new Match { InitiatorId = pairing.UserAId, ReceiverId = pairing.UserBId, Status = "Active", RevealLevel = 1 });
        await Db.SaveChangesAsync();
        var (broadcast, handler) = BuildCapturingBroadcast();
        var service = new TownSquareService(Db, broadcast, BuildTestPush(), NullLogger<TownSquareService>.Instance, new ConfigService());

        await service.RespondToPairingAsync(pairing.Id, pairing.UserAId, "Yes");
        await service.RespondToPairingAsync(pairing.Id, pairing.UserBId, "Yes");

        Assert.Null(handler.LastRequestBody);
    }

    [Fact]
    public async Task LockRosterAsync_NoActiveIcebreakers_CancelsInsteadOfThrowing()
    {
        var session = await SeedOpenSessionWithRsvps(menCount: 2, womenCount: 2);
        foreach (var icebreaker in await Db.Icebreakers.ToListAsync()) icebreaker.IsActive = false;
        await Db.SaveChangesAsync();

        var service = new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush(), NullLogger<TownSquareService>.Instance, new ConfigService());
        await service.LockRosterAsync(session.Id);

        Db.ChangeTracker.Clear();
        // Leaving it Open would hand the 10s scheduler a session it re-crashes on forever.
        Assert.Equal("Cancelled", (await Db.TownSquareSessions.FindAsync(session.Id))!.Status);
        Assert.Empty(await Db.TownSquareRounds.Where(r => r.SessionId == session.Id).ToListAsync());
    }
}
