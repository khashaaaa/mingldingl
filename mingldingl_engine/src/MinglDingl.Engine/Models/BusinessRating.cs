public class BusinessRating
{
    public Guid Id { get; set; }
    public Guid BusinessPartnerId { get; set; }
    public BusinessPartner BusinessPartner { get; set; } = null!;
    public Guid UserId { get; set; }
    public Guid MatchId { get; set; }
    public int Stars { get; set; }
    public string? Review { get; set; }
    public string? PhotoUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
