using Microsoft.EntityFrameworkCore;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Match> Matches => Set<Match>();
    public DbSet<ScoreEvent> ScoreEvents => Set<ScoreEvent>();
    public DbSet<Icebreaker> Icebreakers => Set<Icebreaker>();
    public DbSet<IcebreakerResponse> IcebreakerResponses => Set<IcebreakerResponse>();
    public DbSet<Quiz> Quizzes => Set<Quiz>();
    public DbSet<QuizQuestion> QuizQuestions => Set<QuizQuestion>();
    public DbSet<QuizResponse> QuizResponses => Set<QuizResponse>();
    public DbSet<BusinessPartner> BusinessPartners => Set<BusinessPartner>();
    public DbSet<BusinessRating> BusinessRatings => Set<BusinessRating>();
    public DbSet<ActivitySuggestion> ActivitySuggestions => Set<ActivitySuggestion>();
    public DbSet<DateConfirmation> DateConfirmations => Set<DateConfirmation>();
    public DbSet<Membership> Memberships => Set<Membership>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<UserDailyQuest> UserDailyQuests => Set<UserDailyQuest>();
    public DbSet<UserItem> UserItems => Set<UserItem>();
    public DbSet<Referral> Referrals => Set<Referral>();
    public DbSet<UserMilestone> UserMilestones => Set<UserMilestone>();
    public DbSet<PushToken> PushTokens => Set<PushToken>();
    public DbSet<BlockedUser> BlockedUsers => Set<BlockedUser>();
    public DbSet<ContentPage> ContentPages => Set<ContentPage>();
    public DbSet<AdminAuditLog> AdminAuditLogs => Set<AdminAuditLog>();
    public DbSet<AdminConfig> AdminConfigs => Set<AdminConfig>();
    public DbSet<TownSquareSession> TownSquareSessions => Set<TownSquareSession>();
    public DbSet<TownSquareRsvp> TownSquareRsvps => Set<TownSquareRsvp>();
    public DbSet<TownSquareRound> TownSquareRounds => Set<TownSquareRound>();
    public DbSet<TownSquarePairing> TownSquarePairings => Set<TownSquarePairing>();
    public DbSet<TownSquareIcebreakerResponse> TownSquareIcebreakerResponses => Set<TownSquareIcebreakerResponse>();
    public DbSet<Ship> Ships => Set<Ship>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Message>(m =>
        {
            m.ToTable("messages");
            m.Property(x => x.Id).HasColumnName("id");
            m.Property(x => x.MatchId).HasColumnName("match_id");
            m.Property(x => x.SenderId).HasColumnName("sender_id");
            m.Property(x => x.Content).HasColumnName("content");
            m.Property(x => x.CreatedAt).HasColumnName("created_at");
            // Message has no navigation property to Match, so EF's FK-convention
            // auto-indexing never covered MatchId — every GetMessages call and
            // every SendMessage's lastMessage lookup was doing an unindexed scan
            // over the entire table (not just this match's rows), on the single
            // highest-frequency action in the app. CreatedAt trails in the same
            // index since both hot queries filter on MatchId then order by it.
            m.HasIndex(x => new { x.MatchId, x.CreatedAt });
        });
        b.Entity<User>().Property(u => u.PhotoUrls).HasColumnType("jsonb");
        b.Entity<User>().Property(u => u.ReputationScore).HasPrecision(4, 2);
        b.Entity<User>().HasIndex(u => u.PhoneNumber).IsUnique();
        b.Entity<User>().HasIndex(u => u.ReferralCode).IsUnique();
        // Covers MatchesController.GetCandidates' hot filter combo (opposite-sex
        // discovery: exclude paused/deleted, then narrow by gender) in one index
        // rather than one single-column index per field — Age is deliberately
        // left out since it's a range predicate (>=/<=), which can't use a later
        // composite column as an equality seek anyway once an inequality on an
        // earlier column is hit.
        b.Entity<User>().HasIndex(u => new { u.Gender, u.IsPaused, u.DeletionRequestedAt });
        // ScoresController.GetLeaderboard filters WHERE City = ... ORDER BY
        // TotalScore DESC — a composite in that order serves both the equality
        // filter and the sort in one index.
        b.Entity<User>().HasIndex(u => new { u.City, u.TotalScore });
        b.Entity<Match>().HasOne(m => m.Initiator).WithMany(u => u.InitiatedMatches).HasForeignKey(m => m.InitiatorId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Match>().HasOne(m => m.Receiver).WithMany(u => u.ReceivedMatches).HasForeignKey(m => m.ReceiverId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<BusinessPartner>().Property(p => p.PhotoUrls).HasColumnType("jsonb");
        b.Entity<BusinessPartner>().Property(p => p.AverageRating).HasPrecision(3, 2);
        b.Entity<Quiz>().Ignore(q => q.Questions);
        b.Entity<QuizResponse>().Property(r => r.Answers).HasColumnType("jsonb");
        b.Entity<Icebreaker>().Property(i => i.Options).HasColumnType("jsonb");
        b.Entity<UserDailyQuest>().HasIndex(q => new { q.UserId, q.QuestDate, q.QuestId }).IsUnique();
        b.Entity<UserItem>().HasIndex(i => new { i.UserId, i.ItemId }).IsUnique();
        b.Entity<Referral>().HasIndex(r => r.InviteeUserId).IsUnique();
        b.Entity<UserMilestone>().HasIndex(m => new { m.UserId, m.MilestoneId }).IsUnique();
        b.Entity<PushToken>().HasIndex(t => t.Token).IsUnique();
        // Both controllers do a check-then-insert (existing-response? then Add) with no
        // DB-level guard — the same TOCTOU shape as the RequestMatch/SendMessage races
        // found via stress test. These indexes are the real guard; call sites catch the
        // violation instead of relying on the check alone.
        b.Entity<IcebreakerResponse>().HasIndex(r => new { r.MatchId, r.IcebreakerId, r.UserId }).IsUnique();
        b.Entity<QuizResponse>().HasIndex(r => new { r.QuizId, r.UserId, r.MatchId }).IsUnique();
        b.Entity<BlockedUser>().HasIndex(r => new { r.BlockerId, r.BlockedId }).IsUnique();
        // Same check-then-insert TOCTOU shape as IcebreakerResponse/QuizResponse above:
        // BusinessController.Rate had no DB guard, so the same user could spam ratings
        // for the same business/match. This index is the real guard; Rate catches the
        // violation and returns 409 instead of a 500.
        b.Entity<BusinessRating>().HasIndex(r => new { r.BusinessPartnerId, r.UserId, r.MatchId }).IsUnique();
        b.Entity<ContentPage>().HasIndex(c => c.Slug).IsUnique();
        b.Entity<AdminConfig>().HasKey(c => c.Key);
        b.Entity<TownSquareRsvp>().HasIndex(r => new { r.SessionId, r.UserId }).IsUnique();
        b.Entity<TownSquareRound>().HasIndex(r => new { r.SessionId, r.RoundNumber }).IsUnique();
        b.Entity<TownSquarePairing>().HasOne(p => p.UserA).WithMany().HasForeignKey(p => p.UserAId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<TownSquarePairing>().HasOne(p => p.UserB).WithMany().HasForeignKey(p => p.UserBId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<TownSquareIcebreakerResponse>().HasIndex(r => new { r.PairingId, r.UserId }).IsUnique();
        b.Entity<Ship>().HasIndex(s => s.ShipperUserId);
        b.Entity<Ship>().HasIndex(s => s.SlotAUserId);
        b.Entity<Ship>().HasIndex(s => s.SlotBUserId);
    }
}
