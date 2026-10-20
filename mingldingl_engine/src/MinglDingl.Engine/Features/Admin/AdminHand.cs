using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Membership;
using MinglDingl.Engine.Features.Photos;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Admin;

public sealed record KeeperReason([Required, StringLength(Kernel.Validation.FieldLimits.KeeperReason)] string Reason);

/// field: name | tale.
public sealed record KeeperClearRequest([Required] string Field, [Required, StringLength(Kernel.Validation.FieldLimits.KeeperReason)] string Reason);

/// floor: hall | highTable.
public sealed record KeeperFloorRequest([Required] string Floor, [Range(1, 366)] int Days,
    [Required, StringLength(Kernel.Validation.FieldLimits.KeeperReason)] string Reason);

public sealed record KeeperAdjustRequest([Range(-10000, 10000)] int Points, [Range(-100, 100)] int Reputation,
    [Required, StringLength(Kernel.Validation.FieldLimits.KeeperReason)] string Reason);

/// The keeper's hand on one person (Figma S8 266:2253–266:14979): suspend and lift, sign out
/// everywhere, delete now, clear a name or a tale, remove a portrait, give a floor, adjust score.
/// Every one takes a reason, which the audit log keeps beside the action.
public sealed class AdminHand(AppDb db, IClock clock, ILiveOutbox live, BondService bonds, SessionService sessions,
    AccountService accounts, PhotoService photos, ScoreService score)
{
    public async Task SuspendAsync(Guid id, string why, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var a = await AccountAsync(id, ct);
        if (a.Status == AccountStatus.Suspended) throw new DomainException(409, "admin.already_suspended", "Already suspended");
        a.Status = AccountStatus.Suspended;
        (a.SuspendedAt, a.SuspendedWhy) = (clock.UtcNow, Short(why));
        await bonds.SeverAllAsync(id, ct);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        await sessions.RevokeAllAsync(id, ct);
        Tell(id);
    }

    /// The suspension ends; they sign in again as themselves. Severed bonds stay severed.
    public async Task LiftAsync(Guid id, CancellationToken ct = default)
    {
        var a = await AccountAsync(id, ct);
        if (a.Status != AccountStatus.Suspended) throw new DomainException(409, "admin.not_suspended", "Not suspended");
        a.Status = AccountStatus.Active;
        (a.SuspendedAt, a.SuspendedWhy) = (null, null);
        await db.SaveChangesAsync(ct);
        Tell(id);
    }

    public async Task SignOutAsync(Guid id, CancellationToken ct = default)
    {
        await AccountAsync(id, ct);
        await sessions.RevokeAllAsync(id, ct);
        Tell(id);
    }

    /// Burned at once, as the 30-day deletion does at its end (a legal request).
    public async Task DeleteNowAsync(Guid id, CancellationToken ct = default)
    {
        var a = await AccountAsync(id, ct);
        a.DeleteAt = clock.UtcNow.AddSeconds(-1);
        await db.SaveChangesAsync(ct);
        await sessions.RevokeAllAsync(id, ct);
        if (!await accounts.BurnAsync(id, ct)) throw new DomainException(409, "admin.busy", "Someone else is changing this account; try again");
    }

    /// A cleared name becomes "Аянчин" until they choose another; a cleared tale sends them back to
    /// write a new one (onboarding's tale step).
    public async Task ClearAsync(Guid id, string field, CancellationToken ct = default)
    {
        var p = await db.Set<Profile.Profile>().SingleOrDefaultAsync(x => x.AccountId == id, ct)
            ?? throw new DomainException(404, "admin.user_not_found", "No such user");
        switch (field)
        {
            case "name": p.Name = ClearedName; break;
            case "tale": p.Bio = null; break;
            default: throw new DomainException(400, "admin.bad_field", "Clear the name or the tale");
        }
        p.UpdatedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        Tell(id);
    }

    public const string ClearedName = "Аянчин";

    /// Below the minimum, onboarding asks for another portrait.
    public Task RemovePhotoAsync(Guid id, Guid photoId, CancellationToken ct = default) =>
        photos.DeleteAsync(id, photoId, ct, keepMinimum: false);

    /// A gift from the keepers: never renews, shown as given by the keepers.
    public async Task GiveFloorAsync(Guid id, string floor, int days, CancellationToken ct = default)
    {
        await AccountAsync(id, ct);
        var f = floor switch
        {
            "hall" => Floor.Hall,
            "highTable" => Floor.HighTable,
            _ => throw new DomainException(400, "admin.bad_floor", "The Hall or the High Table"),
        };
        var now = clock.UtcNow;
        db.Add(new MembershipGrant
        {
            Id = Guid.CreateVersion7(), AccountId = id, Floor = f, Source = GrantSource.Keeper, Ref = $"keeper:{now:yyyyMMddHHmmss}",
            StartsAt = now, EndsAt = now.AddDays(days),
        });
        await db.SaveChangesAsync(ct);
        live.ToAccount(id, LiveKinds.MembershipUpdated, id);
        Tell(id);
    }

    public async Task AdjustAsync(Guid id, int points, int reputation, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var p = await db.Set<Profile.Profile>().SingleOrDefaultAsync(x => x.AccountId == id, ct)
            ?? throw new DomainException(404, "admin.user_not_found", "No such user");
        if (reputation != 0)
        {
            p.Reputation = Math.Clamp(p.Reputation + reputation, 0, 100);
            await db.SaveChangesAsync(ct);
        }
        if (points != 0) await score.AwardAsync(id, DeedKinds.KeeperAdjusted, points, null, ct);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        Tell(id);
    }

    /// The keeper has looked at the shared device and found nothing wrong.
    public async Task ClearFlagAsync(Guid id, CancellationToken ct = default)
    {
        var a = await AccountAsync(id, ct);
        (a.FlaggedAt, a.FlaggedWhy) = (null, null);
        await db.SaveChangesAsync(ct);
        Tell(id);
    }

    public Task<List<AdminBarredRow>> BarredAsync(CancellationToken ct = default) =>
        db.Set<BarredNumber>().AsNoTracking().OrderByDescending(b => b.CreatedAt).Take(500)
            .Select(b => new AdminBarredRow(b.Phone, b.Why, b.CreatedAt)).ToListAsync(ct);

    /// The number may make a character again. Its devices stay marked.
    public async Task UnbarAsync(string phone, CancellationToken ct = default)
    {
        var row = await db.Set<BarredNumber>().SingleOrDefaultAsync(b => b.Phone == phone, ct)
            ?? throw new DomainException(404, "admin.not_barred", "That number is not barred");
        db.Remove(row);
        live.ToAdmins(LiveKinds.BarredChanged);
        await db.SaveChangesAsync(ct);
    }

    /// For the audit log, before an action can make the person unreadable.
    public Task<string?> NameAsync(Guid id, CancellationToken ct = default) =>
        db.Set<Profile.Profile>().AsNoTracking().Where(p => p.AccountId == id).Select(p => p.Name).SingleOrDefaultAsync(ct);

    private async Task<Account> AccountAsync(Guid id, CancellationToken ct) =>
        await db.Set<Account>().SingleOrDefaultAsync(a => a.Id == id, ct) ?? throw new DomainException(404, "admin.user_not_found", "No such user");

    private void Tell(Guid id)
    {
        live.ToAccount(id, LiveKinds.ProfileUpdated, id);
        live.ToAdmins(LiveKinds.UserUpdated, id);
    }

    private static string Short(string s) => s.Trim().Length > 300 ? s.Trim()[..300] : s.Trim();
}
