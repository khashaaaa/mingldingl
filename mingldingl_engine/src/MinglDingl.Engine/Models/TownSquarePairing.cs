public class TownSquarePairing
{
    public Guid Id { get; set; }
    public Guid RoundId { get; set; }
    public TownSquareRound Round { get; set; } = null!;
    public Guid UserAId { get; set; }
    public User UserA { get; set; } = null!;
    public Guid UserBId { get; set; }
    public User UserB { get; set; } = null!;

    public string UserAResponse { get; set; } = "Pending";
    public string UserBResponse { get; set; } = "Pending";
    public DateTime? UserAJoinedAt { get; set; }
    public DateTime? UserBJoinedAt { get; set; }
    public Guid? ResultingMatchId { get; set; }

    public bool IsParticipant(Guid userId) => UserAId == userId || UserBId == userId;

    public Guid OtherParticipant(Guid userId) => UserAId == userId ? UserBId : UserAId;
}
