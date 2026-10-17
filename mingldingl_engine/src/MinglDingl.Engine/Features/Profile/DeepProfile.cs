using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Kernel.Auth;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Profile;

/// The deep profile (Figma 35:285–35:475): five answers from fixed lists. Members of the Hall fill it
/// and read another's — only after the fourth seal (thirty letters each). The game is the same for
/// everyone; the Yard sees it sealed.
public static class DeepProfile
{
    public static readonly IReadOnlyDictionary<string, string[]> Choices = new Dictionary<string, string[]>
    {
        ["children"] = ["has", "wants", "doesNotWant", "notSure", "ratherNot"],
        ["smoking"] = ["never", "sometimes", "daily", "ratherNot"],
        ["drinking"] = ["never", "withFriends", "often", "ratherNot"],
        ["faith"] = ["buddhist", "shamanic", "christian", "muslim", "none", "other", "ratherNot"],
        ["lifestyle"] = ["outdoors", "city", "homebody", "traveller", "ratherNot"],
    };

    public static bool Allowed(string field, string value) => Choices.TryGetValue(field, out var c) && c.Contains(value);

    public static DeepView? Of(Profile p) =>
        p.Children is null && p.Smoking is null && p.Drinking is null && p.Faith is null && p.Lifestyle is null
            ? null
            : new DeepView(p.Children, p.Smoking, p.Drinking, p.Faith, p.Lifestyle);
}

/// Each answer is a key from DeepProfile.Choices, or null when unanswered.
public sealed record DeepView(string? Children, string? Smoking, string? Drinking, string? Faith, string? Lifestyle);

/// open: this person may fill it (a member). The answers stay when a floor lapses, sealed until it returns.
public sealed record MyDeepView(bool Open, DeepView Answers);

/// A field left out (null) is unchanged; "" clears it.
public sealed record DeepUpdateRequest(
    [System.ComponentModel.DataAnnotations.StringLength(16)] string? Children,
    [System.ComponentModel.DataAnnotations.StringLength(16)] string? Smoking,
    [System.ComponentModel.DataAnnotations.StringLength(16)] string? Drinking,
    [System.ComponentModel.DataAnnotations.StringLength(16)] string? Faith,
    [System.ComponentModel.DataAnnotations.StringLength(16)] string? Lifestyle);

public sealed class DeepProfileService(AppDb db, IClock clock, ILiveOutbox live, Membership.MembershipService membership)
{
    public async Task<MyDeepView> GetAsync(Guid me, CancellationToken ct = default)
    {
        var p = await db.Set<Profile>().AsNoTracking().SingleOrDefaultAsync(x => x.AccountId == me, ct)
            ?? throw new DomainException(409, "profile.missing", "Create your character first");
        return new MyDeepView((await membership.PerksAsync(me, ct)).Paid,
            new DeepView(p.Children, p.Smoking, p.Drinking, p.Faith, p.Lifestyle));
    }

    public async Task<MyDeepView> SetAsync(Guid me, DeepUpdateRequest req, CancellationToken ct = default)
    {
        if (!(await membership.PerksAsync(me, ct)).Paid)
            throw new DomainException(403, "membership.hall", "The deep profile is the Hall's");
        var p = await db.Set<Profile>().SingleOrDefaultAsync(x => x.AccountId == me, ct)
            ?? throw new DomainException(409, "profile.missing", "Create your character first");
        string? Take(string field, string? value, string? current)
        {
            if (value is null) return current;
            if (value.Length == 0) return null;
            return DeepProfile.Allowed(field, value) ? value : throw new DomainException(400, "profile.deep", "Choose from the list");
        }
        p.Children = Take("children", req.Children, p.Children);
        p.Smoking = Take("smoking", req.Smoking, p.Smoking);
        p.Drinking = Take("drinking", req.Drinking, p.Drinking);
        p.Faith = Take("faith", req.Faith, p.Faith);
        p.Lifestyle = Take("lifestyle", req.Lifestyle, p.Lifestyle);
        p.UpdatedAt = clock.UtcNow;
        live.ToAccount(me, LiveKinds.ProfileUpdated, me);
        await db.SaveChangesAsync(ct);
        return await GetAsync(me, ct);
    }
}

public sealed class DeepProfileEndpoints : IEndpointModule
{
    public void Map(IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/me/deep").WithTags("Profile");
        g.MapGet("", (ClaimsPrincipal u, DeepProfileService svc, CancellationToken ct) => svc.GetAsync(u.AccountId(), ct))
            .RequireAuthorization().WithName("GetDeepProfile");
        g.MapPut("", (DeepUpdateRequest req, ClaimsPrincipal u, DeepProfileService svc, CancellationToken ct) =>
            svc.SetAsync(u.AccountId(), req, ct)).AsWrite().WithName("SetDeepProfile");
    }
}
