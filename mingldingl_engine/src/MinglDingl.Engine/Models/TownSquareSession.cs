public class TownSquareSession
{
    public Guid Id { get; set; }
    public DateTime RsvpOpensAt { get; set; }
    public DateTime RsvpClosesAt { get; set; }
    public DateTime ScheduledStartAt { get; set; }
    public string Status { get; set; } = "Open"; // Open|Locked|InProgress|Completed|Cancelled
    public int CurrentRoundNumber { get; set; } // 0 = not started
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
