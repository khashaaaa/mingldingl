public class DateConfirmation
{
    public Guid Id { get; set; }
    public Guid MatchId { get; set; }
    public Guid ActivitySuggestionId { get; set; }
    public bool InitiatorConfirmed { get; set; }
    public bool ReceiverConfirmed { get; set; }
    public bool IsComplete => InitiatorConfirmed && ReceiverConfirmed;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? CompletedAt { get; set; }

    public bool? InitiatorAttended { get; set; }
    public bool? ReceiverAttended { get; set; }

    public bool PenaltyApplied { get; set; }
}
