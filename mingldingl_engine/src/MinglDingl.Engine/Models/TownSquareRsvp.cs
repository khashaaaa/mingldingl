public class TownSquareRsvp
{
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    public TownSquareSession Session { get; set; } = null!;
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public DateTime RsvpAt { get; set; } = DateTime.UtcNow;
}
