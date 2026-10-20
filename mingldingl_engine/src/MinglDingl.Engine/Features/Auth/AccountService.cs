using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Photos;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Kernel.Storage;

namespace MinglDingl.Engine.Features.Auth;

/// The War Room's account rows: abandon and keep a character, move it to a new sigil, and the
/// sweep that burns an abandoned one on its day.
public sealed class AccountService(
    AppDb db, PhoneVerificationService verifications, SessionService sessions, IClock clock, IConfig config,
    ILiveOutbox live, IPhotoStore store, ILogger<AccountService> log)
{
    /// Returns the day the character burns. The app's War Room and the web page both come here.
    public async Task<DateTimeOffset> AbandonAsync(Guid accountId, CancellationToken ct = default)
    {
        var a = await db.Set<Account>().SingleAsync(x => x.Id == accountId, ct);
        a.DeleteAt ??= clock.UtcNow.AddDays(config.Int(ConfigKeys.AccountDeleteDays));
        Announce(accountId);
        await db.SaveChangesAsync(ct);
        return a.DeleteAt.Value;
    }

    public async Task KeepAsync(Guid accountId, CancellationToken ct = default)
    {
        var a = await db.Set<Account>().SingleAsync(x => x.Id == accountId, ct);
        if (a.DeleteAt is null) return;
        a.DeleteAt = null;
        Announce(accountId);
        await db.SaveChangesAsync(ct);
    }

    /// Sends a code to the new number. A number another character holds is refused before any
    /// text goes (each costs us 80₮).
    public async Task<PhoneVerification> StartSigilAsync(Guid accountId, string phone, Guid? resumeId, string? locale,
        CancellationToken ct = default)
    {
        await RefuseTakenAsync(accountId, phone, ct);
        return await verifications.StartAsync(phone, resumeId, locale, ct);
    }

    /// The new number is proven: the account moves to it and every other device is signed out.
    public async Task CompleteSigilAsync(Guid accountId, Guid sessionId, Guid verificationId, CancellationToken ct = default)
    {
        var v = await verifications.LoadAsync(verificationId, ct);
        if (v.State != VerificationState.Verified)
            throw new DomainException(409, "auth.not_verified", "Type the code first");
        if (v.ClaimedAt is not null)
            throw new DomainException(409, "auth.already_claimed", "This code was already used");
        if (clock.UtcNow - v.VerifiedAt > SessionService.ClaimWindow)
            throw new DomainException(409, "auth.verification_expired", "This code is too old — send a new one");

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var now = clock.UtcNow;
        var claimed = await db.Database.ExecuteSqlInterpolatedAsync(
            $"""UPDATE phone_verifications SET "ClaimedAt" = {now}, "ClaimedByAccountId" = {accountId} WHERE "Id" = {verificationId} AND "ClaimedAt" IS NULL""", ct);
        if (claimed == 0)
            throw new DomainException(409, "auth.already_claimed", "This code was already used");
        // The same lock sign-in takes, so a sign-up on the new number cannot race the move.
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({SessionService.AccountLockKey(v.Phone)})", ct);
        await RefuseTakenAsync(accountId, v.Phone, ct);

        var a = await db.Set<Account>().SingleAsync(x => x.Id == accountId, ct);
        a.Phone = v.Phone;
        var others = await db.Set<DeviceSession>()
            .Where(d => d.AccountId == accountId && d.Id != sessionId && d.RevokedAt == null).ToListAsync(ct);
        foreach (var d in others)
        {
            d.RevokedAt = now;
            live.ToSession(d.Id, LiveKinds.SessionRevoked, d.Id);
        }
        Announce(accountId);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        foreach (var d in others) sessions.ForgetRevoked(d.Id);
    }

    /// Abandoned characters whose day has come.
    public Task<List<Guid>> DueAsync(CancellationToken ct = default)
    {
        var now = clock.UtcNow;
        return db.Set<Account>().AsNoTracking().Where(a => a.DeleteAt != null && a.DeleteAt <= now)
            .Select(a => a.Id).Take(100).ToListAsync(ct);
    }

    /// Burns one: the row goes (everything hanging off it cascades), then the portrait files.
    /// The other side of each bond hears it live.
    public async Task<bool> BurnAsync(Guid accountId, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var a = await db.Set<Account>().FromSqlInterpolated(
            $"""SELECT * FROM accounts WHERE "Id" = {accountId} FOR UPDATE SKIP LOCKED""").SingleOrDefaultAsync(ct);
        if (a?.DeleteAt is null || a.DeleteAt > clock.UtcNow) return false;

        var paths = await db.Set<Photo>().Where(p => p.AccountId == accountId).Select(p => p.Path).ToListAsync(ct);
        var bonds = await db.Set<Bond>().Where(b => b.AId == accountId || b.BId == accountId)
            .Select(b => new { b.Id, Other = b.AId == accountId ? b.BId : b.AId }).ToListAsync(ct);
        foreach (var b in bonds) live.ToAccount(b.Other, LiveKinds.BondUpdated, b.Id);
        live.ToAdmins(LiveKinds.UserUpdated, accountId);
        var reported = await db.Set<Safety.Report>().AnyAsync(r => r.TargetId == accountId && r.Status == Safety.ReportStatus.Open, ct);
        if (a.Status == AccountStatus.Suspended || reported)
            await BarAsync(a, a.Status == AccountStatus.Suspended ? a.SuspendedWhy ?? "Suspended" : "Left with reports still open", ct);
        db.Remove(a);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        foreach (var path in paths)
        {
            try { await store.DeleteAsync(path, ct); }
            catch (Exception e) { log.LogWarning(e, "Burned account {Account}: portrait file {Path} not deleted", accountId, path); }
        }
        return true;
    }

    /// A removed character's number and devices outlive it (see BarredNumber).
    private async Task BarAsync(Account a, string why, CancellationToken ct)
    {
        var now = clock.UtcNow;
        if (!await db.Set<BarredNumber>().AnyAsync(b => b.Phone == a.Phone, ct))
            db.Add(new BarredNumber { Phone = a.Phone, Why = why, CreatedAt = now });
        var keys = await db.Set<DeviceSession>().Where(d => d.AccountId == a.Id && d.DeviceKey != null)
            .Select(d => d.DeviceKey!).Distinct().ToListAsync(ct);
        var known = await db.Set<BarredDevice>().Where(d => keys.Contains(d.Key)).Select(d => d.Key).ToListAsync(ct);
        foreach (var k in keys.Except(known)) db.Add(new BarredDevice { Key = k, Why = why, CreatedAt = now });
        live.ToAdmins(LiveKinds.BarredChanged);
    }

    private async Task RefuseTakenAsync(Guid accountId, string phone, CancellationToken ct)
    {
        if (!PhoneVerificationService.IsPhoneValid(phone))
            throw new DomainException(400, "auth.bad_phone", "Enter an 8-digit Mongolian number");
        var holder = await db.Set<Account>().Where(a => a.Phone == phone).Select(a => (Guid?)a.Id).SingleOrDefaultAsync(ct);
        if (holder == accountId)
            throw new DomainException(409, "auth.same_phone", "That is already your number");
        if (holder is not null)
            throw new DomainException(409, "auth.phone_taken", "That number belongs to another character");
    }

    private void Announce(Guid accountId)
    {
        live.ToAccount(accountId, LiveKinds.ProfileUpdated, accountId);
        live.ToAdmins(LiveKinds.UserUpdated, accountId);
    }
}
