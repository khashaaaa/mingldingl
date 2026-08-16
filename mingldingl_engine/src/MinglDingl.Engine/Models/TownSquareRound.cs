public class TownSquareRound
{
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    public TownSquareSession Session { get; set; } = null!;
    public int RoundNumber { get; set; }
    public Guid IcebreakerId { get; set; }
    public Icebreaker Icebreaker { get; set; } = null!;
    public DateTime StartsAt { get; set; }
    public int DurationSeconds { get; set; } = 240;
}
