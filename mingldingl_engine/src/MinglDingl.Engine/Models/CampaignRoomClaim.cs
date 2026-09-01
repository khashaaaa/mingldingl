public class CampaignRoomClaim
{
    public Guid Id { get; set; }
    public Guid MatchId { get; set; }
    public Guid UserId { get; set; }
    public string RoomId { get; set; } = "";
    public DateTime ClaimedAt { get; set; } = DateTime.UtcNow;
}
