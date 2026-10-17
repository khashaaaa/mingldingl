using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Auth;

public sealed class PhoneVerificationService(AppDb db, IVerifyMnClient verify, IClock clock)
{
    /// Live pending sessions one number may hold. Start is anonymous, so the sixth supersedes the
    /// oldest rather than refusing: refusing let anyone lock the owner out by keeping five open.
    public const int MaxPendingPerPhone = 5;

    public static bool IsPhoneValid(string? phone) =>
        phone is { Length: 8 } && phone.All(char.IsAsciiDigit);

    /// A new session, or the caller's own one when they can name it. A pending session is never
    /// handed to a caller who cannot name it: "the session for this number" leaked the owner's code.
    public async Task<PhoneVerification> StartAsync(string phone, Guid? resumeId, CancellationToken ct = default)
    {
        if (!IsPhoneValid(phone)) throw new DomainException(400, "auth.bad_phone", "Enter an 8-digit Mongolian number");
        var now = clock.UtcNow;

        if (resumeId is Guid id)
        {
            var own = await db.Set<PhoneVerification>().FirstOrDefaultAsync(v => v.Id == id && v.Phone == phone
                && (v.State == VerificationState.Pending || v.State == VerificationState.Superseded)
                && v.ExpiresAt > now, ct);
            if (own is not null) return own;
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({LockKey(phone)})", ct);

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        // The provider call comes first, so a failed start supersedes nothing.
        var session = await verify.OpenAsync(phone, code, ct)
            ?? throw new DomainException(502, "auth.provider_unavailable", "Verification is unavailable, try again shortly");

        var live = await db.Set<PhoneVerification>()
            .Where(v => v.Phone == phone && v.State == VerificationState.Pending && v.ExpiresAt > now)
            .OrderBy(v => v.CreatedAt).ThenBy(v => v.Id)
            .ToListAsync(ct);
        foreach (var oldest in live.Take(Math.Max(0, live.Count - (MaxPendingPerPhone - 1))))
            oldest.State = VerificationState.Superseded;

        var v = new PhoneVerification
        {
            Phone = phone,
            Code = code,
            ProviderId = session.SessionId,
            DisplayInstruction = session.DisplayInstruction,
            SmsUri = session.SmsUri,
            State = VerificationState.Pending,
            CreatedAt = now,
            ExpiresAt = new DateTimeOffset(DateTime.SpecifyKind(session.ExpiresAt, DateTimeKind.Utc)),
        };
        db.Add(v);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return v;
    }

    /// Re-reads verify.mn and stores any transition. A superseded session is still read, so a
    /// code the owner already texted still verifies. The callback (if any) is never trusted.
    public async Task<PhoneVerification> RefreshAsync(Guid id, CancellationToken ct = default)
    {
        var v = await db.Set<PhoneVerification>().FindAsync([id], ct)
            ?? throw new DomainException(404, "auth.verification_not_found", "That verification does not exist");
        if (v.State is not (VerificationState.Pending or VerificationState.Superseded)) return v;

        var status = await verify.ReadAsync(v.ProviderId, ct);
        switch (status?.SessionStatus)
        {
            case "VERIFIED":
                v.State = VerificationState.Verified;
                v.VerifiedAt = clock.UtcNow;
                break;
            case "EXPIRED":
                v.State = VerificationState.Expired;
                break;
            default:
                if (v.ExpiresAt <= clock.UtcNow) v.State = VerificationState.Expired;
                break;
        }
        await db.SaveChangesAsync(ct);
        return v;
    }

    private static long LockKey(string phone) =>
        BitConverter.ToInt64(SHA256.HashData(Encoding.UTF8.GetBytes("phone-verification:" + phone)), 0);
}
