public class UserDailyQuest
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public DateTime QuestDate { get; set; }     // UTC date (midnight)
    public string QuestId { get; set; } = "";
    public int Progress { get; set; }
    public DateTime? CompletedAt { get; set; }
}
