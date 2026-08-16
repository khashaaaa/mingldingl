using Microsoft.EntityFrameworkCore;

public class ReferralService
{
    // Excludes 0/O, 1/I/L — ambiguous when read off a phone screen.
    private const string CodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    private readonly AppDbContext _db;
    private readonly LootService _loot;

    public ReferralService(AppDbContext db, LootService loot)
    {
        _db = db;
        _loot = loot;
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
            chars[i] = CodeAlphabet[Random.Shared.Next(CodeAlphabet.Length)];
        return new string(chars);
    }

    // Best-effort by design, mirrors LootService.GrantAsync's own
    // try/catch — a referral failure must never fail the onboarding
    // submission this is called from (UsersController.Upsert).
    public async Task<DroppedItem?> TryCompleteReferralAsync(Guid inviteeId, string? code)
    {
        if (string.IsNullOrWhiteSpace(code)) return null;
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

            _db.Referrals.Add(new Referral
            {
                InviterUserId = inviter.Id,
                InviteeUserId = inviteeId,
                InviterRewardItemId = inviterReward?.Id,
                InviteeRewardItemId = inviteeReward?.Id,
            });
            await _db.SaveChangesAsync();

            return inviteeReward;
        }
        catch
        {
            _db.ChangeTracker.Clear();
            return null;
        }
    }
}
