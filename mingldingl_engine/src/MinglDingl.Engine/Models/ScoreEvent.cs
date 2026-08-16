public class ScoreEvent
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string EventType { get; set; } = ""; // ProfileComplete|DailyLogin|FirstMessage|IcebreakerDone|QuizDone|MatchReply|DateConfirmed|VideoCallDone|ShipSparked|GhostPenalty|ReportPenalty
    public int Delta { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
