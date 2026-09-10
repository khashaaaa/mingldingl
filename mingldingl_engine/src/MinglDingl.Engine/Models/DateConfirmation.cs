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

    /// <summary>
    /// Each side's answer to "did the other person show up?", so these are accusations about the
    /// <em>opposite</em> participant, not self-reports: <see cref="InitiatorAttended"/> is the
    /// initiator's verdict on the receiver. Read the other way round, a no-show penalty lands on
    /// whoever reported being stood up.
    /// </summary>
    public bool? InitiatorAttended { get; set; }
    public bool? ReceiverAttended { get; set; }

    public bool PenaltyApplied { get; set; }
}
