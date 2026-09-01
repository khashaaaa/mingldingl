using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;

public class PhoneVerificationService
{
    private readonly AppDbContext _db;
    private readonly VerifyMnClient _verify;
    private readonly IConfiguration _config;
    private readonly ILogger<PhoneVerificationService> _logger;

    /// <summary>A verification must be bound to an auth identity within this window of being verified.</summary>
    public static readonly TimeSpan ClaimWindow = TimeSpan.FromMinutes(30);

    public PhoneVerificationService(
        AppDbContext db, VerifyMnClient verify, IConfiguration config, ILogger<PhoneVerificationService> logger)
    {
        _db = db;
        _verify = verify;
        _config = config;
        _logger = logger;
    }

    public bool IsConfigured => _verify.IsConfigured;

    public static bool IsPhoneValid(string? phone) =>
        !string.IsNullOrEmpty(phone) && phone.Length == 8 && phone.All(char.IsAsciiDigit);

    private static string NewCode()
    {
        // Fresh random code per session — codes are never reused.
        return RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
    }

    /// <summary>
    /// Starts (or resumes) a verification. An in-flight session for the same phone is reused so a
    /// user who backgrounds the app isn't charged twice — every SMS to the shortcode costs them 150₮.
    /// </summary>
    public async Task<PhoneVerification?> StartAsync(string phone, CancellationToken ct = default)
    {
        var existing = await FindActiveAsync(phone, ct);
        if (existing is not null) return existing;

        var code = NewCode();
        var id = Guid.NewGuid();

        var session = await _verify.CreateSessionAsync(phone, code, BuildCallbackUrl(id), ct);
        if (session is null) return null;

        // Serialise on the phone number so two racing starts cannot both open a provider session.
        // Whoever loses the race discards its session and returns the winner's, so the user is
        // never left holding two codes (only one of which the app is polling for).
        async Task<PhoneVerification?> InsertGuarded()
        {
            await _db.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT pg_advisory_xact_lock({PhoneLockKey(phone)})", ct);

            var raced = await FindActiveAsync(phone, ct);
            if (raced is not null) return raced;

            var verification = new PhoneVerification
            {
                Id = id,
                Phone = phone,
                Code = code,
                ProviderSessionId = session.SessionId,
                DisplayInstruction = session.DisplayInstruction,
                SmsUri = session.SmsUri,
                Status = PhoneVerificationStatus.Pending,
                ExpiresAt = session.ExpiresAt.ToUniversalTime(),
            };
            _db.PhoneVerifications.Add(verification);
            await _db.SaveChangesAsync(ct);
            return verification;
        }

        // The lock is transaction-scoped, so join an ambient transaction rather than nesting one.
        if (_db.Database.CurrentTransaction is not null) return await InsertGuarded();

        return await _db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            await using var tx = await _db.Database.BeginTransactionAsync(ct);
            var result = await InsertGuarded();
            await tx.CommitAsync(ct);
            return result;
        });
    }

    private Task<PhoneVerification?> FindActiveAsync(string phone, CancellationToken ct) =>
        _db.PhoneVerifications
            .Where(v => v.Phone == phone && v.Status == PhoneVerificationStatus.Pending && v.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(v => v.CreatedAt)
            .FirstOrDefaultAsync(ct);

    /// <summary>Stable advisory-lock key for a phone number, mirroring MatchPairing.PairLockKey.</summary>
    private static long PhoneLockKey(string phone)
    {
        var hash = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes($"phone:{phone}"));
        return BitConverter.ToInt64(hash, 0);
    }

    private string? BuildCallbackUrl(Guid verificationId)
    {
        // Only register a callback we can actually serve — verify.mn retries failures,
        // and the docs are explicit that a fake URL must not be registered.
        var baseUrl = _config["VerifyMn:CallbackBaseUrl"]?.TrimEnd('/');
        if (string.IsNullOrWhiteSpace(baseUrl)) return null;
        return $"{baseUrl}/auth/phone/callback/{verificationId}";
    }

    /// <summary>
    /// Re-reads authoritative status from verify.mn and persists any transition.
    /// Safe to call on a polling loop; returns immediately once terminal.
    /// </summary>
    public async Task<PhoneVerification?> RefreshAsync(Guid verificationId, CancellationToken ct = default)
    {
        var verification = await _db.PhoneVerifications.FindAsync([verificationId], ct);
        if (verification is null) return null;
        if (verification.Status != PhoneVerificationStatus.Pending) return verification;

        var status = await _verify.GetSessionAsync(verification.ProviderSessionId, ct);
        if (status is null)
        {
            if (verification.ExpiresAt <= DateTime.UtcNow)
            {
                verification.Status = PhoneVerificationStatus.Expired;
                await _db.SaveChangesAsync(ct);
            }
            return verification;
        }

        switch (status.SessionStatus)
        {
            case "VERIFIED":
                verification.Status = PhoneVerificationStatus.Verified;
                verification.VerifiedAt = (status.VerifiedAt ?? DateTime.UtcNow).ToUniversalTime();
                await _db.SaveChangesAsync(ct);
                break;
            case "EXPIRED":
                verification.Status = PhoneVerificationStatus.Expired;
                await _db.SaveChangesAsync(ct);
                break;
        }

        return verification;
    }

    /// <summary>
    /// Binds a verified phone to the caller's auth identity. Single use: a verification that has
    /// already been claimed cannot be replayed onto another account.
    /// </summary>
    public async Task<PhoneClaimResult> ClaimAsync(Guid verificationId, Guid userId, CancellationToken ct = default)
    {
        var verification = await RefreshAsync(verificationId, ct);
        if (verification is null) return PhoneClaimResult.NotFound;
        if (verification.Status != PhoneVerificationStatus.Verified) return PhoneClaimResult.NotVerified;

        if (verification.ClaimedByUserId is Guid already)
            return already == userId ? PhoneClaimResult.Ok : PhoneClaimResult.AlreadyClaimed;

        if (verification.VerifiedAt is DateTime at && DateTime.UtcNow - at > ClaimWindow)
            return PhoneClaimResult.Expired;

        // The same phone must not end up on two accounts.
        var takenByOther = await _db.Users
            .AnyAsync(u => u.PhoneNumber == verification.Phone && u.Id != userId, ct);
        if (takenByOther) return PhoneClaimResult.PhoneInUse;

        // Single writer wins: the WHERE clause is the guard, so a concurrent claim from another
        // identity affects zero rows rather than silently overwriting the first one.
        var claimed = await _db.Database.ExecuteSqlInterpolatedAsync(
            $"""
            UPDATE "PhoneVerifications"
            SET "ClaimedByUserId" = {userId}, "ClaimedAt" = {DateTime.UtcNow}
            WHERE "Id" = {verificationId} AND "ClaimedByUserId" IS NULL
            """, ct);

        if (claimed == 0)
        {
            var winner = await _db.PhoneVerifications.AsNoTracking()
                .Where(v => v.Id == verificationId)
                .Select(v => v.ClaimedByUserId)
                .FirstOrDefaultAsync(ct);
            return winner == userId ? PhoneClaimResult.Ok : PhoneClaimResult.AlreadyClaimed;
        }

        _db.Entry(verification).State = EntityState.Detached;
        return PhoneClaimResult.Ok;
    }

    /// <summary>The verified phone bound to this identity, or null if it never completed verification.</summary>
    public async Task<string?> GetVerifiedPhoneAsync(Guid userId, CancellationToken ct = default) =>
        await _db.PhoneVerifications
            .Where(v => v.ClaimedByUserId == userId && v.Status == PhoneVerificationStatus.Verified)
            .OrderByDescending(v => v.ClaimedAt)
            .Select(v => v.Phone)
            .FirstOrDefaultAsync(ct);
}

public enum PhoneClaimResult
{
    Ok,
    NotFound,
    NotVerified,
    AlreadyClaimed,
    Expired,
    PhoneInUse,
}
