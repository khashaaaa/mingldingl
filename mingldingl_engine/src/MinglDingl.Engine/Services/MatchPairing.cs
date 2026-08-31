using Microsoft.EntityFrameworkCore;

public static class MatchPairing
{
    public static Task<bool> IsPairBlockedAsync(AppDbContext db, Guid a, Guid b) =>
        db.BlockedUsers.AnyAsync(bl =>
            (bl.BlockerId == a && bl.BlockedId == b) ||
            (bl.BlockerId == b && bl.BlockedId == a));

    public static Task<bool> PairAlreadyMatchedAsync(AppDbContext db, Guid a, Guid b) =>
        db.Matches.AnyAsync(m =>
            (m.InitiatorId == a && m.ReceiverId == b) ||
            (m.InitiatorId == b && m.ReceiverId == a));

    public static long PairLockKey(Guid a, Guid b)
    {
        var (lo, hi) = string.CompareOrdinal(a.ToString(), b.ToString()) <= 0 ? (a, b) : (b, a);
        var hash = System.Security.Cryptography.SHA256.HashData([.. lo.ToByteArray(), .. hi.ToByteArray()]);
        return BitConverter.ToInt64(hash, 0);
    }

    public static Match NewMatch(Guid initiatorId, Guid receiverId, Guid? shipId = null) => new()
    {
        InitiatorId = initiatorId,
        ReceiverId = receiverId,
        Status = "Active",
        RevealLevel = 1,
        ShipId = shipId,
    };
}
