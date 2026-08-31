public class QuizResponse
{
    public Guid Id { get; set; }
    public Guid QuizId { get; set; }
    public Guid UserId { get; set; }
    public Guid? MatchId { get; set; }
    public Dictionary<Guid, string> Answers { get; set; } = [];
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
