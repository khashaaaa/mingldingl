using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Kernel.Auth;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Profile;

/// The deep profile (Figma 35:285–35:475, 254:6663–254:7018): answers from fixed lists. Members of
/// the Hall fill it and read another's — only after the fourth seal (thirty letters each). The one
/// open answer is whether someone has children: anyone sets it, and may show it in Seek and every
/// bond at once (ShowChildren) instead of waiting for the fourth seal. The game is the same for everyone.
public static class DeepProfile
{
    public static readonly IReadOnlyDictionary<string, string[]> Choices = new Dictionary<string, string[]>
    {
        ["hasChildren"] = ["yes", "no", "ratherNot"],
        ["wantsChildren"] = ["yes", "no", "notSure", "ratherNot"],
        ["partnerChildren"] = ["welcome", "open", "preferNot", "ratherNot"],
        ["smoking"] = ["never", "sometimes", "daily", "ratherNot"],
        ["drinking"] = ["never", "withFriends", "often", "ratherNot"],
        ["faith"] = ["buddhist", "shamanic", "christian", "muslim", "none", "other", "ratherNot"],
        ["lifestyle"] = ["outdoors", "city", "homebody", "traveller", "ratherNot"],
    };

    public static bool Allowed(string field, string value) => Choices.TryGetValue(field, out var c) && c.Contains(value);

    public static DeepView? Of(Profile p) =>
        p.HasChildren is null && p.WantsChildren is null && p.PartnerChildren is null && p.Smoking is null && p.Drinking is null
            && p.Faith is null && p.Lifestyle is null
            ? null
            : View(p);

    /// Whether others see "has children" before the fourth seal: she said yes and chose to show it.
    public static bool ShowsChildren(Profile p) => p.ShowChildren && p.HasChildren == "yes";

    public static DeepView View(Profile p) =>
        new(p.HasChildren, p.WantsChildren, p.PartnerChildren, p.Smoking, p.Drinking, p.Faith, p.Lifestyle);
}

/// Each answer is a key from DeepProfile.Choices, or null when unanswered.
public sealed record DeepView(string? HasChildren, string? WantsChildren, string? PartnerChildren, string? Smoking, string? Drinking,
    string? Faith, string? Lifestyle);

/// open: this person may fill the Hall's answers (a member); hasChildren and showChildren are everyone's.
/// The answers stay when a floor lapses, sealed until it returns.
public sealed record MyDeepView(bool Open, bool ShowChildren, DeepView Answers);

/// A field left out (null) is unchanged; "" clears it.
public sealed record DeepUpdateRequest(
    [System.ComponentModel.DataAnnotations.StringLength(16)] string? HasChildren,
    bool? ShowChildren,
    [System.ComponentModel.DataAnnotations.StringLength(16)] string? WantsChildren,
    [System.ComponentModel.DataAnnotations.StringLength(16)] string? PartnerChildren,
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
        return new MyDeepView((await membership.PerksAsync(me, ct)).Paid, p.ShowChildren, DeepProfile.View(p));
    }

    public async Task<MyDeepView> SetAsync(Guid me, DeepUpdateRequest req, CancellationToken ct = default)
    {
        var hall = req.WantsChildren ?? req.PartnerChildren ?? req.Smoking ?? req.Drinking ?? req.Faith ?? req.Lifestyle;
        if (hall is not null && !(await membership.PerksAsync(me, ct)).Paid)
            throw new DomainException(403, "membership.hall", "The deep profile is the Hall's");
        var p = await db.Set<Profile>().SingleOrDefaultAsync(x => x.AccountId == me, ct)
            ?? throw new DomainException(409, "profile.missing", "Create your character first");
        string? Take(string field, string? value, string? current)
        {
            if (value is null) return current;
            if (value.Length == 0) return null;
            return DeepProfile.Allowed(field, value) ? value : throw new DomainException(400, "profile.deep", "Choose from the list");
        }
        p.HasChildren = Take("hasChildren", req.HasChildren, p.HasChildren);
        if (req.ShowChildren is { } show) p.ShowChildren = show;
        p.WantsChildren = Take("wantsChildren", req.WantsChildren, p.WantsChildren);
        p.PartnerChildren = Take("partnerChildren", req.PartnerChildren, p.PartnerChildren);
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
