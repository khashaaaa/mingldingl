using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Auth;

public sealed class PhoneVerificationService(AppDb db, IWeSend wesend, IClock clock, IConfig config)
{
    /// Wrong codes one verification takes, ours as well as WeSend's (the review number has no WeSend).
    public const int MaxWrongTries = 5;

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
        // Only a Mongolian mobile can take a text: a made-up landline or empty range costs 80₮ and reaches no one.
        if (wesend.Texts(phone) && !config.Str(ConfigKeys.MobilePrefixes).Split(',').Any(p => p.Trim() is { Length: > 0 } t && phone.StartsWith(t)))
            throw new DomainException(400, "auth.not_mobile", "Enter a Mongolian mobile number");
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
        // Start is anonymous: a stranger may not spend more than a few texts on one number, nor the
        // whole day's budget across many. The global count is not serialised; a burst may pass it by a few.
        if (wesend.Texts(phone))
        {
            var today = UbDays.Start(clock.TodayUb);
            if (await db.Set<PhoneVerification>().CountAsync(v => v.Phone == phone && v.CreatedAt >= today, ct)
                >= config.Int(ConfigKeys.CodesPerNumberPerDay))
                throw new DomainException(429, "auth.too_many_codes", "Too many codes went to this number — try again later");
            if (await db.Set<PhoneVerification>().CountAsync(v => v.CreatedAt >= today, ct) >= config.Int(ConfigKeys.CodesPerDay))
                throw new DomainException(429, "auth.too_many_codes", "Too many codes went out today — try again later");
        }

        // The provider call comes first, so a failed send supersedes nothing.
        var sent = await wesend.SendCodeAsync(phone, Locales.Contains(locale) ? locale! : "mn", ct);
        switch (sent.Outcome)
        {
            case CodeSent.TooMany:
                throw new DomainException(429, "auth.too_many_codes", "Too many codes went to this number — try again later");
            case CodeSent.BadNumber:
                throw new DomainException(400, "auth.bad_phone", "Enter an 8-digit Mongolian number");
            case CodeSent.Unavailable:
                throw new DomainException(503, "auth.provider_unavailable", "Verification is unavailable, try again shortly");
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
    /// again, five in all; after that, or once it expires, only a new code helps. The try is taken
    /// before asking, in one statement, so parallel checks cannot type more than five between them.
    public async Task<PhoneVerification> CheckAsync(Guid id, string code, CancellationToken ct = default)
    {
        var v = await LoadAsync(id, ct);
        if (v.State == VerificationState.Verified) return v;
        if (v.State != VerificationState.Pending)
            throw new DomainException(410, "auth.verification_expired", "This code is too old — send a new one");
        // The review number's code never changes, so its wrong tries are counted across the day too.
        if (!wesend.Texts(v.Phone))
        {
            var today = UbDays.Start(clock.TodayUb);
            if (await db.Set<PhoneVerification>().Where(x => x.Phone == v.Phone && x.CreatedAt >= today).SumAsync(x => x.WrongTries, ct)
                >= config.Int(ConfigKeys.ReviewWrongPerDay))
                throw new DomainException(429, "auth.too_many_attempts", "Too many wrong codes today — try again tomorrow");
        }
        var taken = await db.Set<PhoneVerification>()
            .Where(x => x.Id == id && x.State == VerificationState.Pending && x.WrongTries < MaxWrongTries)
            .ExecuteUpdateAsync(u => u.SetProperty(x => x.WrongTries, x => x.WrongTries + 1), ct);
        await db.Entry(v).ReloadAsync(ct);
        if (taken == 0)
        {
            if (v.State == VerificationState.Verified) return v;
            if (v.State != VerificationState.Pending)
                throw new DomainException(410, "auth.verification_expired", "This code is too old — send a new one");
            v.State = VerificationState.Expired;
            await db.SaveChangesAsync(ct);
            throw new DomainException(429, "auth.too_many_attempts", "Too many wrong codes — ask for a new one");
        }

        var result = await wesend.CheckAsync(v.ProviderId, code.Trim(), ct);
        switch (result)
        {
            case CodeChecked.Approved:
                v.State = VerificationState.Verified;
                v.VerifiedAt = clock.UtcNow;
                break;
            case CodeChecked.Wrong when v.WrongTries >= MaxWrongTries:
                result = CodeChecked.TooManyAttempts;
                v.State = VerificationState.Expired;
                break;
            case CodeChecked.Expired or CodeChecked.TooManyAttempts:
                v.State = VerificationState.Expired;
                break;
        }
        await db.SaveChangesAsync(ct);
        // Only a wrong code keeps its try; a right one or an unreachable WeSend gives it back.
        if (result is CodeChecked.Approved or CodeChecked.Unavailable)
            await db.Set<PhoneVerification>().Where(x => x.Id == id)
                .ExecuteUpdateAsync(u => u.SetProperty(x => x.WrongTries, x => x.WrongTries - 1), ct);
        return result switch
        {
            CodeChecked.Approved => v,
            CodeChecked.Wrong => throw new DomainException(422, "auth.wrong_code", "That is not the code we sent"),
            CodeChecked.TooManyAttempts => throw new DomainException(429, "auth.too_many_attempts", "Too many wrong codes — ask for a new one"),
            CodeChecked.Expired => throw new DomainException(410, "auth.verification_expired", "This code is too old — send a new one"),
            _ => throw new DomainException(503, "auth.provider_unavailable", "Verification is unavailable, try again shortly"),
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
