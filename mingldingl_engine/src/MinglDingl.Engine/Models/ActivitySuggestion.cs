public class ActivitySuggestion
{
    public Guid Id { get; set; }
    public Guid MatchId { get; set; }
    public Guid? BusinessPartnerId { get; set; }
    public BusinessPartner? BusinessPartner { get; set; }
    public string ActivityType { get; set; } = ""; // Coffee|Hiking|Cinema|BoardGame
    public string Title { get; set; } = "";
    public DateTime SuggestedAt { get; set; } = DateTime.UtcNow;
}
