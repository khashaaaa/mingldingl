public class DateConfirmation
{
    public Guid Id { get; set; }
    public Guid MatchId { get; set; }
    public Guid ActivitySuggestionId { get; set; }
    public bool InitiatorConfirmed { get; set; }
    public bool ReceiverConfirmed { get; set; }
    public bool IsComplete => InitiatorConfirmed && ReceiverConfirmed;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
