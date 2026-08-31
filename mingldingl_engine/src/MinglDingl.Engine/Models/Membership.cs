public class Membership
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Level { get; set; } = "Free";
    public int DurationMonths { get; set; }
    public int PriceMnt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
