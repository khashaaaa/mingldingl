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
    /// Live pending sessions one number may hold at once. Start is anonymous, so reaching the cap
    /// supersedes the oldest rather than refusing the newest: refusing let anyone who filled the
    /// five slots lock the real owner out of their own number for as long as they kept refilling
    /// them. A superseded session is no longer counted or resumable by default, but a code already
    /// texted for it still verifies (see <see cref="RefreshAsync"/>), so eviction cannot undo an
    /// SMS the owner has already paid for. Provider-session volume is bounded per source address by
    /// <see cref="PhoneStartRateLimit"/> instead.
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
            // A superseded session is still the caller's own if they can name it — resuming it
            // spares them a second 150₮ SMS for a code they may already have sent.
            var own = await _db.PhoneVerifications.FirstOrDefaultAsync(
                v => v.Id == resumeId && v.Phone == phone
                    && (v.Status == PhoneVerificationStatus.Pending || v.Status == PhoneVerificationStatus.Superseded)
                    && v.ExpiresAt > now, ct);
            if (own is not null) return own;
        }

        // Serialised per number, so two concurrent starts cannot both count the same free slot.
        return await _db.InTransactionAsync(async () =>
        {
            await _db.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT pg_advisory_xact_lock({PhoneLockKey(phone)})", ct);

            var code = NewCode();
            var id = Guid.NewGuid();

            // The provider call comes before eviction so a failed start supersedes nothing.
            var session = await _verify.CreateSessionAsync(phone, code, BuildCallbackUrl(id), ct);
            if (session is null) return null;

            var livePending = await _db.PhoneVerifications
                .Where(v => v.Phone == phone && v.Status == PhoneVerificationStatus.Pending && v.ExpiresAt > now)
                .OrderBy(v => v.CreatedAt)
                .ToListAsync(ct);
            foreach (var oldest in livePending.Take(Math.Max(0, livePending.Count - (MaxPendingPerPhone - 1))))
                oldest.Status = PhoneVerificationStatus.Superseded;

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
        }, ct);
    }

    /// <summary>Advisory-lock key for one number's start path.</summary>
    private static long PhoneLockKey(string phone) =>
        BitConverter.ToInt64(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes("phone-verification:" + phone)), 0);

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
        if (verification.Status is not (PhoneVerificationStatus.Pending or PhoneVerificationStatus.Superseded))
            return verification;

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
    public Task<PhoneClaimResult> ClaimAsync(Guid verificationId, Guid userId, CancellationToken ct = default) =>
        ClaimForAccountAsync(verificationId, userId, userId, ct);

    /// <summary>
    /// <see cref="ClaimAsync"/> for an auth identity that already stands for an account under a
    /// different id — a returning user's aliased session changing their number. The proof is bound
    /// to the identity that holds the session (<paramref name="userId"/>), so alias resolution keeps
    /// working for it; the "number belongs to someone else" check runs against the account
    /// (<paramref name="accountId"/>), which is who actually ends up holding the number.
    /// </summary>
    public async Task<PhoneClaimResult> ClaimForAccountAsync(
        Guid verificationId, Guid userId, Guid accountId, CancellationToken ct = default)
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
        bool claimantHasAccount = await _db.Users.AnyAsync(u => u.Id == accountId, ct);
        if (claimantHasAccount)
        {
            var takenByOther = await _db.Users
                .AnyAsync(u => u.PhoneNumber == verification.Phone && u.Id != accountId, ct);
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
    /// Drops every claimed proof of <paramref name="phone"/>. Called when an account gives the
    /// number up: those claims are what alias an anonymous identity onto the account holding the
    /// number, so left behind they both kept the old number's sessions attached to nothing (and free
    /// to register a second account with it) and, once someone else registered the number, silently
    /// signed every one of them into the new owner's account. A session that should survive the
    /// change holds a fresh claim on the new number instead.
    /// </summary>
    public async Task ReleaseClaimsOnNumberAsync(string phone, CancellationToken ct = default) =>
        await _db.PhoneVerifications
            .Where(v => v.Phone == phone && v.ClaimedByUserId != null)
            .ExecuteDeleteAsync(ct);

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
