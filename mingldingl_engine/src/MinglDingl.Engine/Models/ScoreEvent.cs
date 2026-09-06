public class ScoreEvent
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string EventType { get; set; } = "";
    public int Delta { get; set; }

    /// <summary>
    /// The conversation this event came out of, when it came out of one. Carried so a per-match
    /// award cap can be counted precisely — <c>MatchReply</c> was unbounded, and two accounts
    /// alternating one-character messages could reach Emerald in a couple of minutes.
    /// </summary>
    public Guid? MatchId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
