using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Auth;

public sealed class PhoneVerificationService(AppDb db, IWeSend wesend, IClock clock)
{
    /// How soon one number may be sent another code. Start is anonymous and every text costs us 80₮,
    /// so a stranger can neither drain the credits nor keep cancelling the owner's code.
    public static readonly TimeSpan ResendAfter = TimeSpan.FromSeconds(60);

    public static readonly string[] Locales = ["mn", "en"];

    public static bool IsPhoneValid(string? phone) =>
        phone is { Length: 8 } && phone.All(char.IsAsciiDigit);

    public static DateTimeOffset ResendAt(PhoneVerification v) => v.CreatedAt + ResendAfter;

    /// A new code, or the caller's own pending one when they can name it (no second text). A pending
    /// session is never handed to a caller who cannot name it.
    public async Task<PhoneVerification> StartAsync(string phone, Guid? resumeId, string? locale = null, CancellationToken ct = default)
    {
        if (!IsPhoneValid(phone)) throw new DomainException(400, "auth.bad_phone", "Enter an 8-digit Mongolian number");
        // Before any text goes: a removed character's number never gets a code (each costs us 80₮).
        if (await db.Set<BarredNumber>().AnyAsync(b => b.Phone == phone, ct))
            throw new DomainException(403, "auth.barred", "This number cannot make a character");
        var now = clock.UtcNow;

        if (resumeId is Guid id)
        {
            var own = await db.Set<PhoneVerification>().FirstOrDefaultAsync(v => v.Id == id && v.Phone == phone
                && v.State == VerificationState.Pending && v.ExpiresAt > now, ct);
            if (own is not null) return own;
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({LockKey(phone)})", ct);

        var live = await db.Set<PhoneVerification>()
            .Where(v => v.Phone == phone && v.State == VerificationState.Pending && v.ExpiresAt > now)
            .ToListAsync(ct);
        if (live.Any(v => ResendAt(v) > now))
            throw new DomainException(429, "auth.code_cooldown", "A code is on its way — wait a minute before asking for another");

        // The provider call comes first, so a failed send supersedes nothing.
        var sent = await wesend.SendCodeAsync(phone, Locales.Contains(locale) ? locale! : "mn", ct);
        switch (sent.Outcome)
        {
            case CodeSent.TooMany:
                throw new DomainException(429, "auth.too_many_codes", "Too many codes went to this number — try again later");
            case CodeSent.BadNumber:
                throw new DomainException(400, "auth.bad_phone", "Enter an 8-digit Mongolian number");
            case CodeSent.Unavailable:
                throw new DomainException(502, "auth.provider_unavailable", "Verification is unavailable, try again shortly");
        }

        // WeSend cancels a number's last code when it sends a new one.
        foreach (var old in live) old.State = VerificationState.Superseded;

        var v = new PhoneVerification
        {
            Phone = phone,
            ProviderId = sent.Id!,
            State = VerificationState.Pending,
            CreatedAt = now,
            ExpiresAt = sent.ExpiresAt!.Value,
        };
        db.Add(v);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return v;
    }

    /// The person typed the code: WeSend says whether it is the one it sent. A wrong code may be typed
    /// again (WeSend allows five); after that, or once it expires, only a new code helps.
    public async Task<PhoneVerification> CheckAsync(Guid id, string code, CancellationToken ct = default)
    {
        var v = await LoadAsync(id, ct);
        if (v.State == VerificationState.Verified) return v;
        if (v.State != VerificationState.Pending)
            throw new DomainException(410, "auth.verification_expired", "This code is too old — send a new one");

        var result = await wesend.CheckAsync(v.ProviderId, code.Trim(), ct);
        switch (result)
        {
            case CodeChecked.Approved:
                v.State = VerificationState.Verified;
                v.VerifiedAt = clock.UtcNow;
                break;
            case CodeChecked.Expired or CodeChecked.TooManyAttempts:
                v.State = VerificationState.Expired;
                break;
        }
        await db.SaveChangesAsync(ct);
        return result switch
        {
            CodeChecked.Approved => v,
            CodeChecked.Wrong => throw new DomainException(422, "auth.wrong_code", "That is not the code we sent"),
            CodeChecked.TooManyAttempts => throw new DomainException(429, "auth.too_many_attempts", "Too many wrong codes — ask for a new one"),
            CodeChecked.Expired => throw new DomainException(410, "auth.verification_expired", "This code is too old — send a new one"),
            _ => throw new DomainException(502, "auth.provider_unavailable", "Verification is unavailable, try again shortly"),
        };
    }

    /// The stored state, an outlived pending one marked expired. Completing reads this, never WeSend.
    public async Task<PhoneVerification> LoadAsync(Guid id, CancellationToken ct = default)
    {
        var v = await db.Set<PhoneVerification>().FindAsync([id], ct)
            ?? throw new DomainException(404, "auth.verification_not_found", "That verification does not exist");
        if (v.State == VerificationState.Pending && v.ExpiresAt <= clock.UtcNow)
        {
            v.State = VerificationState.Expired;
            await db.SaveChangesAsync(ct);
        }
        return v;
    }

    private static long LockKey(string phone) =>
        BitConverter.ToInt64(SHA256.HashData(Encoding.UTF8.GetBytes("phone-verification:" + phone)), 0);
}
