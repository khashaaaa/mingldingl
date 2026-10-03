/// <summary>
/// One row per match per week whose shared trial has been paid. The composite key is the claim:
/// two people tapping Claim at once race to insert it, and only one insert pays both of them.
/// </summary>
public class BondTrialClaim
{
    public Guid MatchId { get; set; }
    public DateTime WeekStart { get; set; }
    public string Kind { get; set; } = "";
    public DateTime ClaimedAt { get; set; } = DateTime.UtcNow;
}
