namespace MinglDingl.Engine.Kernel.Live;

/// Events a request wants pushed. Held until its database work commits, then sent.
public interface ILiveOutbox
{
    void ToAccount(Guid accountId, string kind, params Guid[] ids);

    /// Only the one signed-in device (e.g. session.revoked must not sign out its siblings).
    void ToSession(Guid deviceSessionId, string kind, params Guid[] ids);
    void ToAdmins(string kind, params Guid[] ids);
    void ToAll(string kind);
}

/// What a client receives: which kind of thing changed and the ids it concerns — never the data.
/// Equal by value (the ids too), so one request's repeats go out once.
public sealed record LiveEvent(string Kind, IReadOnlyList<Guid> Ids)
{
    public bool Equals(LiveEvent? other) =>
        other is not null && Kind == other.Kind && Ids.SequenceEqual(other.Ids);

    public override int GetHashCode()
    {
        var h = new HashCode();
        h.Add(Kind);
        foreach (var id in Ids) h.Add(id);
        return h.ToHashCode();
    }
}

/// One group's events from one write, sent as one message ("events"). origin: the app's
/// X-Live-Origin of the request that caused them (its own echo), null from sweeps and the keepers.
/// all: sent to everyone (the app spreads its refetch so a broadcast is not a thundering herd).
public sealed record LiveBatch(IReadOnlyList<LiveEvent> Events, string? Origin, bool All);

public static class LiveGroups
{
    public static string Account(Guid id) => "a:" + id;
    public static string Session(Guid id) => "s:" + id;
    public const string All = "all";
    public const string Admins = "admins";
}

public static class LiveKinds
{
    public const string ProfileUpdated = "profile.updated";
    public const string PhotosUpdated = "photos.updated";
    public const string SessionRevoked = "session.revoked";
    public const string ConfigUpdated = "config.updated";
    public const string UserCreated = "user.created";
    public const string UserUpdated = "user.updated";
    public const string ScoreChanged = "score.changed";
    public const string BondCreated = "bond.created";
    public const string BondUpdated = "bond.updated";
    /// Only the reader's own list changes (the unread dot); nothing else about the bond did.
    public const string BondRead = "bond.read";
    public const string LetterCreated = "letter.created";
    public const string SeekChanged = "seek.changed";
    public const string BlockChanged = "block.changed";
    public const string ReportCreated = "report.created";
    public const string EncounterUpdated = "encounter.updated";
    public const string VideoCall = "video.call";
    public const string VenueUpdated = "venue.updated";
    public const string HonourEarned = "honour.earned";
    public const string QuestsUpdated = "quests.updated";
    public const string CampaignUpdated = "campaign.updated";
    public const string TrialUpdated = "trial.updated";
    public const string WanderingUpdated = "wandering.updated";
    public const string ThreadUpdated = "thread.updated";
    public const string SquareUpdated = "square.updated";
    public const string CodexUpdated = "codex.updated";
    public const string FestivalUpdated = "festival.updated";
    public const string AuditCreated = "audit.created";
    public const string MembershipUpdated = "membership.updated";
    public const string PaymentUpdated = "payment.updated";
    public const string BarredChanged = "barred.changed";
}
