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

    /// <summary>
    /// Both people still exist and may still be matched to each other, in both directions. Every
    /// path that turns two known profiles into a Match goes through this: discovery and
    /// <c>POST /matches</c> read <see cref="MatchEligibility.IsEligibleFor"/> up front, while a
    /// woven thread and a Town Square pairing are answered long after they were created, so they
    /// have to re-ask at the moment the match would be made.
    /// </summary>
    public static async Task<bool> AreBothEligibleAsync(AppDbContext db, Guid a, Guid b)
    {
        var users = await db.Users.AsNoTracking().Where(u => u.Id == a || u.Id == b).ToListAsync();
        var first = users.FirstOrDefault(u => u.Id == a);
        var second = users.FirstOrDefault(u => u.Id == b);
        return first is not null && second is not null && MatchEligibility.AreMutuallyEligible(first, second);
    }

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
