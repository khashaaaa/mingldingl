public class DateConfirmation
{
    public Guid Id { get; set; }
    public Guid MatchId { get; set; }
    public Guid ActivitySuggestionId { get; set; }
    public bool InitiatorConfirmed { get; set; }
    public bool ReceiverConfirmed { get; set; }
    public bool IsComplete => InitiatorConfirmed && ReceiverConfirmed;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Set once, the moment IsComplete first flips true (ActivityService.ConfirmAsync's
    // justCompleted branch) — CreatedAt is set at *first*-side-confirm, not
    // both-sides-confirm, so it can't anchor "48h after we both agreed to meet."
    public DateTime? CompletedAt { get; set; }

    // Attendance-check answers. Null = not yet asked/answered. Never revealed
    // to the other participant — see ActivityService.SubmitAttendanceAsync.
    public bool? InitiatorAttended { get; set; }
    public bool? ReceiverAttended { get; set; }

    // Set true the moment a mismatch on THIS row increments the denying
    // user's NoShowFlagCount. A single match can accumulate more than one
    // completed DateConfirmation (a user could confirm a second suggestion
    // after the first already completed — nothing in ActivityService.ConfirmAsync
    // blocks it server-side, even though the app's own UI never surfaces
    // that path). Without this guard, two mismatches on two different
    // suggestions for the *same* match pair could double-count toward the
    // NoShowThreshold, violating the "must be distinct matches" anti-abuse
    // guarantee. Checked in SubmitAttendanceAsync before incrementing.
    public bool PenaltyApplied { get; set; }
}
