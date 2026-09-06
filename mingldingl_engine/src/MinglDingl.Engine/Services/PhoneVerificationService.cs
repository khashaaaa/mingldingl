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

    /// <summary>
    /// Pending sessions one number may hold at once. Start is anonymous and every call opens a
    /// provider session, so without a ceiling a script could open them without limit against a
    /// number it does not own.
    /// </summary>
    public const int MaxPendingPerPhone = 5;

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
    /// Starts a verification, or resumes the caller's own in-flight one. A pending session is only
    /// ever handed back to a caller who can name its id. Start is anonymous, so returning "the
    /// pending session for this number" to whoever asked handed an attacker the very session the
    /// real owner was about to prove — both saw VERIFIED at the same moment and the claim went to
    /// whichever polled faster. The app passes back the id it was last given for the number, so
    /// backgrounding or re-entering the number still resumes instead of issuing a second code
    /// (each SMS to the shortcode costs the user 150₮).
    /// </summary>
    public async Task<PhoneVerification?> StartAsync(string phone, Guid? resumeVerificationId = null, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        if (resumeVerificationId is Guid resumeId)
        {
            var own = await _db.PhoneVerifications.FirstOrDefaultAsync(
                v => v.Id == resumeId && v.Phone == phone
                    && v.Status == PhoneVerificationStatus.Pending && v.ExpiresAt > now, ct);
            if (own is not null) return own;
        }

        int pending = await _db.PhoneVerifications.CountAsync(
            v => v.Phone == phone && v.Status == PhoneVerificationStatus.Pending && v.ExpiresAt > now, ct);
        if (pending >= MaxPendingPerPhone)
            throw new DomainException(
                "Too many verification sessions are open for this number; wait for one to expire",
                "phone.too_many_attempts", StatusCodes.Status429TooManyRequests);

        var code = NewCode();
        var id = Guid.NewGuid();

        var session = await _verify.CreateSessionAsync(phone, code, BuildCallbackUrl(id), ct);
        if (session is null) return null;

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

        // The same phone must not end up on two accounts. A caller who already has an account is
        // moving a number that belongs to someone else, which is refused. A caller with no account
        // is the number's owner signing in again through a fresh anonymous identity — proving the
        // number is exactly what entitles them to it, and CurrentUserMiddleware then aliases the
        // new identity onto the existing account (see ResolveAliasAsync).
        bool claimantHasAccount = await _db.Users.AnyAsync(u => u.Id == userId, ct);
        if (claimantHasAccount)
        {
            var takenByOther = await _db.Users
                .AnyAsync(u => u.PhoneNumber == verification.Phone && u.Id != userId, ct);
            if (takenByOther) return PhoneClaimResult.PhoneInUse;
        }

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

    /// <summary>
    /// The account an auth identity with no user row of its own stands for: the user whose number
    /// this identity has proven through a claimed verification. Null when it has proven nothing, or
    /// when the number has no account yet (a genuinely new user mid-onboarding). Static so the
    /// middleware can call it with only a <see cref="AppDbContext"/> in hand.
    /// </summary>
    public static async Task<Guid?> ResolveAliasAsync(AppDbContext db, Guid authId, CancellationToken ct = default)
    {
        var phone = await db.PhoneVerifications.AsNoTracking()
            .Where(v => v.ClaimedByUserId == authId && v.Status == PhoneVerificationStatus.Verified)
            .OrderByDescending(v => v.ClaimedAt)
            .Select(v => v.Phone)
            .FirstOrDefaultAsync(ct);
        if (phone is null) return null;

        return await db.Users.AsNoTracking()
            .Where(u => u.PhoneNumber == phone)
            .Select(u => (Guid?)u.Id)
            .FirstOrDefaultAsync(ct);
    }
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
