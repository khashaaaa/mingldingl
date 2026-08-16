public class BusinessRating
{
    public Guid Id { get; set; }
    public Guid BusinessPartnerId { get; set; }
    public BusinessPartner BusinessPartner { get; set; } = null!;
    public Guid UserId { get; set; }
    public Guid MatchId { get; set; }
    public int Stars { get; set; }         // 1-5
    public string? Review { get; set; }
    public string? PhotoUrl { get; set; }  // the "memorable moment" — a photo from the date, shown publicly
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
