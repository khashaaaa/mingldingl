public class UserMilestone
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string MilestoneId { get; set; } = "";
    public DateTime AchievedAt { get; set; } = DateTime.UtcNow;
    public DateTime? OpenedAt { get; set; }
}
