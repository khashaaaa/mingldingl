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
public sealed record LiveEvent(string Kind, IReadOnlyList<Guid> Ids);

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
