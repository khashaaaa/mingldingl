public class TownSquarePairing
{
    public Guid Id { get; set; }
    public Guid RoundId { get; set; }
    public TownSquareRound Round { get; set; } = null!;
    public Guid UserAId { get; set; }
    public User UserA { get; set; } = null!;
    public Guid UserBId { get; set; }
    public User UserB { get; set; } = null!;
    // No stored channel name: like VideoController/VideoTokenService, the Agora
    // channel is derived on demand as Id.ToString("N") rather than persisted.
    public string UserAResponse { get; set; } = "Pending"; // Pending|Yes|No
    public string UserBResponse { get; set; } = "Pending";
    public DateTime? UserAJoinedAt { get; set; }
    public DateTime? UserBJoinedAt { get; set; }
    public Guid? ResultingMatchId { get; set; }

    public bool IsParticipant(Guid userId) => UserAId == userId || UserBId == userId;

    public Guid OtherParticipant(Guid userId) => UserAId == userId ? UserBId : UserAId;
}
