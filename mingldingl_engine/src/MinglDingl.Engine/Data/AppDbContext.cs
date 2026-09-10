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
    public DbSet<UserReport> UserReports => Set<UserReport>();
    public DbSet<ContentPage> ContentPages => Set<ContentPage>();
    public DbSet<AdminAuditLog> AdminAuditLogs => Set<AdminAuditLog>();
    public DbSet<AdminConfig> AdminConfigs => Set<AdminConfig>();
    public DbSet<TownSquareSession> TownSquareSessions => Set<TownSquareSession>();
    public DbSet<TownSquareRsvp> TownSquareRsvps => Set<TownSquareRsvp>();
    public DbSet<TownSquareRound> TownSquareRounds => Set<TownSquareRound>();
    public DbSet<TownSquarePairing> TownSquarePairings => Set<TownSquarePairing>();
    public DbSet<Ship> Ships => Set<Ship>();
    public DbSet<PhoneVerification> PhoneVerifications => Set<PhoneVerification>();
    public DbSet<CampaignRoomClaim> CampaignRoomClaims => Set<CampaignRoomClaim>();

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

            m.HasIndex(x => new { x.MatchId, x.CreatedAt });
        });
        b.Entity<User>().Property(u => u.PhotoUrls).HasColumnType("jsonb");
        b.Entity<User>().Property(u => u.ReputationScore).HasPrecision(4, 2);
        b.Entity<User>().HasIndex(u => u.PhoneNumber).IsUnique();
        b.Entity<User>().HasIndex(u => u.ReferralCode).IsUnique();

        b.Entity<User>().HasIndex(u => new { u.Gender, u.IsPaused, u.DeletionRequestedAt });

        b.Entity<User>().HasIndex(u => new { u.City, u.TotalScore });

        b.Entity<User>().HasIndex(u => u.CreatedAt);

        b.Entity<ScoreEvent>().HasIndex(e => new { e.CreatedAt, e.EventType });
        b.Entity<AdminAuditLog>().HasIndex(l => l.CreatedAt);
        b.Entity<Match>().HasOne(m => m.Initiator).WithMany(u => u.InitiatedMatches).HasForeignKey(m => m.InitiatorId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Match>().HasOne(m => m.Receiver).WithMany(u => u.ReceivedMatches).HasForeignKey(m => m.ReceiverId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<BusinessPartner>().Property(p => p.PhotoUrls).HasColumnType("jsonb");
        b.Entity<BusinessPartner>().Property(p => p.AverageRating).HasPrecision(3, 2);
        b.Entity<Quiz>().Ignore(q => q.Questions);
        b.Entity<QuizResponse>().Property(r => r.Answers).HasColumnType("jsonb");
        b.Entity<Icebreaker>().Property(i => i.Options).HasColumnType("jsonb");
        b.Entity<Icebreaker>().Property(i => i.OptionsEn).HasColumnType("jsonb");
        b.Entity<UserDailyQuest>().HasIndex(q => new { q.UserId, q.QuestDate, q.QuestId }).IsUnique();
        b.Entity<UserItem>().HasIndex(i => new { i.UserId, i.ItemId }).IsUnique();
        b.Entity<Referral>().HasIndex(r => r.InviteeUserId).IsUnique();
        b.Entity<UserMilestone>().HasIndex(m => new { m.UserId, m.MilestoneId }).IsUnique();
        b.Entity<PushToken>().HasIndex(t => t.Token).IsUnique();

        b.Entity<IcebreakerResponse>().HasIndex(r => new { r.MatchId, r.IcebreakerId, r.UserId }).IsUnique();
        b.Entity<QuizResponse>().HasIndex(r => new { r.QuizId, r.UserId, r.MatchId }).IsUnique();
        b.Entity<BlockedUser>().HasIndex(r => new { r.BlockerId, r.BlockedId }).IsUnique();

        // Restrict, like every other user reference: a report is the record of why an account was
        // acted on, so it must not be quietly cascaded away with either party.
        b.Entity<UserReport>().HasOne(r => r.Reporter).WithMany().HasForeignKey(r => r.ReporterId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<UserReport>().HasOne(r => r.ReportedUser).WithMany().HasForeignKey(r => r.ReportedUserId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<UserReport>().Property(r => r.Reason).HasMaxLength(FieldLimits.ShortLabel);
        b.Entity<UserReport>().Property(r => r.Status).HasMaxLength(FieldLimits.ShortLabel);
        b.Entity<UserReport>().Property(r => r.Details).HasMaxLength(FieldLimits.Reason);
        b.Entity<UserReport>().Property(r => r.ReviewNotes).HasMaxLength(FieldLimits.Reason);
        b.Entity<UserReport>().Property(r => r.ReviewedBy).HasMaxLength(FieldLimits.DisplayName);
        // The admin queue reads pending-first, and the report sheet refuses a second open report
        // against the same person — both are this index.
        b.Entity<UserReport>().HasIndex(r => new { r.Status, r.CreatedAt });
        b.Entity<UserReport>().HasIndex(r => new { r.ReporterId, r.ReportedUserId, r.Status });
        b.Entity<UserReport>().HasIndex(r => r.ReportedUserId);

        b.Entity<BusinessRating>().HasIndex(r => new { r.BusinessPartnerId, r.UserId, r.MatchId }).IsUnique();
        b.Entity<ContentPage>().HasIndex(c => c.Slug).IsUnique();
        b.Entity<AdminConfig>().HasKey(c => c.Key);
        b.Entity<TownSquareRsvp>().HasIndex(r => new { r.SessionId, r.UserId }).IsUnique();
        b.Entity<TownSquareRound>().HasIndex(r => new { r.SessionId, r.RoundNumber }).IsUnique();
        b.Entity<TownSquarePairing>().HasOne(p => p.UserA).WithMany().HasForeignKey(p => p.UserAId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<TownSquarePairing>().HasOne(p => p.UserB).WithMany().HasForeignKey(p => p.UserBId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Ship>().HasIndex(s => s.ShipperUserId);
        b.Entity<Ship>().HasIndex(s => s.SlotAUserId);
        b.Entity<Ship>().HasIndex(s => s.SlotBUserId);
        b.Entity<CampaignRoomClaim>().HasIndex(c => new { c.MatchId, c.UserId, c.RoomId }).IsUnique();
        b.Entity<CampaignRoomClaim>().Property(c => c.RoomId).HasMaxLength(32);
        b.Entity<Membership>().HasIndex(m => m.UserId);
        b.Entity<PhoneVerification>().HasIndex(v => new { v.Phone, v.Status });
        b.Entity<PhoneVerification>().HasIndex(v => v.ClaimedByUserId);
        b.Entity<PhoneVerification>().Property(v => v.Status).HasConversion<int>();
    }
}
