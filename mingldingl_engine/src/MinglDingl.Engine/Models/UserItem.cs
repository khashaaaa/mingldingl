public class UserItem
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string ItemId { get; set; } = "";
    public string Source { get; set; } = "";
    public DateTime AcquiredAt { get; set; } = DateTime.UtcNow;
}
