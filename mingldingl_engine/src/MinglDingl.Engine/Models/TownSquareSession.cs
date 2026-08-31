public class TownSquareSession
{
    public Guid Id { get; set; }
    public DateTime RsvpOpensAt { get; set; }
    public DateTime RsvpClosesAt { get; set; }
    public DateTime ScheduledStartAt { get; set; }
    public string Status { get; set; } = "Open";
    public int CurrentRoundNumber { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
