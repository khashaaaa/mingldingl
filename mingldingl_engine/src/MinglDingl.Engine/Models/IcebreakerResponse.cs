public class IcebreakerResponse
{
    public Guid Id { get; set; }
    public Guid MatchId { get; set; }
    public Guid IcebreakerId { get; set; }
    public Guid UserId { get; set; }
    public string Answer { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
