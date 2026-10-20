using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Auth;

public sealed class SessionService(
    AppDb db, PhoneVerificationService verifications, TokenIssuer issuer, IClock clock, IConfig config,
    ILiveOutbox live, IDataProtectionProvider protection, IMemoryCache cache)
{
    /// A verification must be completed within this window of being verified.
    public static readonly TimeSpan ClaimWindow = TimeSpan.FromMinutes(30);
    public static readonly TimeSpan Grace = TimeSpan.FromSeconds(30);

    private IDataProtector Protector => protection.CreateProtector("refresh-grace");

    /// Proven number → session. Finds the number's account or creates it.
    public async Task<SessionPair> CompleteAsync(Guid verificationId, string deviceName, CancellationToken ct = default,
        string? allyCode = null, string? deviceKey = null)
    {
        var v = await verifications.LoadAsync(verificationId, ct);
        if (v.State != VerificationState.Verified)
            throw new DomainException(409, "auth.not_verified", "Type the code first");
        if (v.ClaimedAt is not null)
            throw new DomainException(409, "auth.already_claimed", "This code was already used");
        if (clock.UtcNow - v.VerifiedAt > ClaimWindow)
            throw new DomainException(409, "auth.verification_expired", "This code is too old — send a new one");

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var now = clock.UtcNow;
        // Single writer wins: the WHERE clause is the guard against a concurrent complete.
        var claimed = await db.Database.ExecuteSqlInterpolatedAsync(
            $"""UPDATE phone_verifications SET "ClaimedAt" = {now} WHERE "Id" = {verificationId} AND "ClaimedAt" IS NULL""", ct);
        if (claimed == 0)
            throw new DomainException(409, "auth.already_claimed", "This code was already used");

        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({AccountLockKey(v.Phone)})", ct);
        var account = await db.Set<Account>().SingleOrDefaultAsync(a => a.Phone == v.Phone, ct);
        var created = false;
        if (account is null)
        {
            if (!config.Bool(ConfigKeys.SignupsEnabled))
                throw new DomainException(403, "signups.closed", "New sign-ups are closed for now");
            account = new Account { Phone = v.Phone, Status = AccountStatus.Active, CreatedAt = now };
            // A new traveller brought by an ally's call remembers whose (the bounty lands when they finish).
            if (allyCode?.Trim().ToUpperInvariant() is { Length: > 0 } code)
                account.CalledBy = await db.Set<Account>().Where(a => a.AllyCode == code && a.Status == AccountStatus.Active)
                    .Select(a => (Guid?)a.Id).SingleOrDefaultAsync(ct);
            db.Add(account);
            created = true;
        }
        // Signing in before the day keeps an abandoned character.
        if (account.DeleteAt is not null)
        {
            account.DeleteAt = null;
            live.ToAccount(account.Id, LiveKinds.ProfileUpdated, account.Id);
            live.ToAdmins(LiveKinds.UserUpdated, account.Id);
        }

        var key = DeviceKeys.Hash(deviceKey);
        var device = new DeviceSession
        {
            AccountId = account.Id, DeviceName = deviceName.Trim(), DeviceKey = key, CreatedAt = now, LastSeenAt = now,
        };
        db.Add(device);
        await db.SaveChangesAsync(ct);
        if (key is not null && account.FlaggedAt is null && await DeviceFlagAsync(key, account.Id, ct) is { } why)
        {
            (account.FlaggedAt, account.FlaggedWhy) = (now, why);
            live.ToAdmins(LiveKinds.UserUpdated, account.Id);
        }
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"""UPDATE phone_verifications SET "ClaimedByAccountId" = {account.Id} WHERE "Id" = {verificationId}""", ct);

        var (pair, hash) = issuer.Issue(device);
        db.Add(new RefreshToken { DeviceSessionId = device.Id, Hash = hash, IssuedAt = now });
        if (created) live.ToAdmins(LiveKinds.UserCreated, account.Id);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return pair;
    }

    /// Why a sign-in on this device is worth a keeper's look: it carried a removed character, or
    /// carries a suspended one. Never a refusal — phones are shared and sold.
    private async Task<string?> DeviceFlagAsync(string key, Guid accountId, CancellationToken ct)
    {
        if (await db.Set<BarredDevice>().AnyAsync(d => d.Key == key, ct))
            return "Signed in on a device a removed character used";
        var suspended = await (from d in db.Set<DeviceSession>()
                               join a in db.Set<Account>() on d.AccountId equals a.Id
                               where d.DeviceKey == key && a.Id != accountId && a.Status == AccountStatus.Suspended
                               select a.Id).AnyAsync(ct);
        return suspended ? "Signed in on a device a suspended character uses" : null;
    }

    /// Rotates a refresh token. A duplicate within 30 s gets the same pair (a race never signs
    /// anyone out); a replay after that is theft, and revokes the device.
    public async Task<SessionPair> RefreshAsync(string presented, CancellationToken ct = default)
    {
        var hash = TokenIssuer.Hash(presented);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        // Row lock: concurrent refreshes of one token queue here; the first rotates, the rest read its grace.
        await db.Database.ExecuteSqlInterpolatedAsync($"""SELECT 1 FROM refresh_tokens WHERE "Hash" = {hash} FOR UPDATE""", ct);
        var row = await db.Set<RefreshToken>().Include(t => t.Device).SingleOrDefaultAsync(t => t.Hash == hash, ct)
            ?? throw new DomainException(401, "auth.invalid_refresh", "Sign in again");
        if (row.Device.RevokedAt is not null)
            throw new DomainException(401, "auth.revoked", "Sign in again");

        var now = clock.UtcNow;
        if (row.UsedAt is not null)
        {
            if (row.GraceUntil > now && row.GracePayload is not null)
                return JsonSerializer.Deserialize<SessionPair>(Protector.Unprotect(row.GracePayload))!;
            await tx.RollbackAsync(ct);
            await RevokeAsync(row.DeviceSessionId, ct);
            throw new DomainException(401, "auth.reused", "Sign in again");
        }

        var (pair, newHash) = issuer.Issue(row.Device);
        row.UsedAt = now;
        row.GraceUntil = now.Add(Grace);
        row.GracePayload = Protector.Protect(JsonSerializer.Serialize(pair));
        row.Device.LastSeenAt = now;
        db.Add(new RefreshToken { DeviceSessionId = row.DeviceSessionId, Hash = newHash, IssuedAt = now });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return pair;
    }

    public async Task RevokeAsync(Guid deviceSessionId, CancellationToken ct = default)
    {
        var device = await db.Set<DeviceSession>().SingleOrDefaultAsync(d => d.Id == deviceSessionId, ct);
        if (device is null || device.RevokedAt is not null) return;
        device.RevokedAt = clock.UtcNow;
        live.ToSession(device.Id, LiveKinds.SessionRevoked, device.Id);
        await db.SaveChangesAsync(ct);
        cache.Remove(RevokedCacheKey(device.Id));
    }

    public async Task RevokeAllAsync(Guid accountId, CancellationToken ct = default)
    {
        var devices = await db.Set<DeviceSession>().Where(d => d.AccountId == accountId && d.RevokedAt == null).ToListAsync(ct);
        foreach (var d in devices)
        {
            d.RevokedAt = clock.UtcNow;
            live.ToSession(d.Id, LiveKinds.SessionRevoked, d.Id);
        }
        await db.SaveChangesAsync(ct);
        foreach (var d in devices) cache.Remove(RevokedCacheKey(d.Id));
    }

    /// Checked on every authenticated request; cached 30 s, evicted on revoke.
    public static async Task<bool> IsRevokedAsync(AppDb db, IMemoryCache cache, Guid sid, CancellationToken ct) =>
        await cache.GetOrCreateAsync(RevokedCacheKey(sid), async e =>
        {
            e.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30);
            var row = await db.Set<DeviceSession>().Where(d => d.Id == sid).Select(d => new { d.RevokedAt }).SingleOrDefaultAsync(ct);
            return row is null || row.RevokedAt is not null;
        });

    private static string RevokedCacheKey(Guid sid) => "revoked:" + sid;

    /// After a revoke committed elsewhere, so the next request sees it at once.
    public void ForgetRevoked(Guid sid) => cache.Remove(RevokedCacheKey(sid));

    /// Held while a number is bound to an account (sign-in, sigil move).
    public static long AccountLockKey(string phone) =>
        BitConverter.ToInt64(SHA256.HashData(Encoding.UTF8.GetBytes("account:" + phone)), 0);
}
