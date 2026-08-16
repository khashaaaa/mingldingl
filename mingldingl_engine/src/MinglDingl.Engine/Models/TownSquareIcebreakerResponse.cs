public class TownSquareIcebreakerResponse
{
    public Guid Id { get; set; }
    public Guid PairingId { get; set; }
    public TownSquarePairing Pairing { get; set; } = null!;
    public Guid UserId { get; set; }
    public string Answer { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
