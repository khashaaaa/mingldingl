using Microsoft.EntityFrameworkCore;

public class ReferralService
{
    private readonly AppDbContext _db;
    private readonly LootService _loot;
    private readonly ILogger<ReferralService> _logger;

    public ReferralService(AppDbContext db, LootService loot, ILogger<ReferralService> logger)
    {
        _db = db;
        _loot = loot;
        _logger = logger;
    }

    public async Task<string> GetOrCreateCodeAsync(Guid userId)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return "";
        if (!string.IsNullOrEmpty(user.ReferralCode)) return user.ReferralCode;

        string code;
        do
        {
            code = GenerateCode();
        } while (await _db.Users.AnyAsync(u => u.ReferralCode == code) ||
                 await _db.Ships.AnyAsync(s => s.SlotAInviteCode == code || s.SlotBInviteCode == code));

        user.ReferralCode = code;
        await _db.SaveChangesAsync();
        return code;
    }

    private static string GenerateCode()
    {
        var chars = new char[6];
        for (int i = 0; i < 6; i++)
            chars[i] = InviteCode.Alphabet[Random.Shared.Next(InviteCode.Alphabet.Length)];
        return new string(chars);
    }

    public async Task<DroppedItem?> TryCompleteReferralAsync(Guid inviteeId, string? code)
    {
        if (string.IsNullOrWhiteSpace(code)) return null;
        Referral? added = null;
        try
        {
            var normalized = code.ToUpperInvariant();
            var inviter = await _db.Users.FirstOrDefaultAsync(u => u.ReferralCode == normalized);
            if (inviter is null) return null;
            if (inviter.IsDeleted) return null;
            if (inviter.Id == inviteeId) return null;

            bool alreadyReferred = await _db.Referrals.AnyAsync(r => r.InviteeUserId == inviteeId);
            if (alreadyReferred) return null;

            var inviterReward = await _loot.GrantGuaranteedAsync(inviter.Id, "ReferralReward");
            var inviteeReward = await _loot.GrantGuaranteedAsync(inviteeId, "ReferralReward");

            added = new Referral
            {
                InviterUserId = inviter.Id,
                InviteeUserId = inviteeId,
                InviterRewardItemId = inviterReward?.Id,
                InviteeRewardItemId = inviteeReward?.Id,
            };
            _db.Referrals.Add(added);
            await _db.SaveChangesAsync();

            return inviteeReward;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Referral completion swallowed a failure for invitee {InviteeId} (code {Code})", inviteeId, code);

            // Detach only what this method added. Clearing the whole tracker would silently throw
            // away unsaved work belonging to whoever else is sharing this scoped context.
            if (added is not null) _db.Entry(added).State = EntityState.Detached;
            return null;
        }
    }
}
