public class ScoreEvent
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string EventType { get; set; } = "";
    public int Delta { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
