using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Kernel.Auth;
using MinglDingl.Engine.Kernel.RateLimits;

namespace MinglDingl.Engine.Features.Auth;

public sealed class AuthEndpoints : IEndpointModule
{
    public void Map(IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/auth").WithTags("Auth");

        g.MapPost("/phone/start", async (StartRequest req, PhoneVerificationService svc, CancellationToken ct) =>
        {
            var v = await svc.StartAsync(req.Phone, req.ResumeVerificationId, req.Locale, ct);
            return Started(v);
        }).RequireRateLimiting(RateLimitPolicies.Auth).WithName("StartPhone");

        // The one check for every proof: sign-in, a new sigil and the Guild House.
        g.MapPost("/phone/check", async (CheckRequest req, PhoneVerificationService svc, CancellationToken ct) =>
        {
            var v = await svc.CheckAsync(req.VerificationId, req.Code, ct);
            return new CheckResponse(v.State.ToString().ToLowerInvariant());
        }).RequireRateLimiting(RateLimitPolicies.Auth).WithName("CheckPhone");

        g.MapPost("/phone/complete", (CompleteRequest req, SessionService svc, CancellationToken ct) =>
            svc.CompleteAsync(req.VerificationId, req.DeviceName, ct, req.AllyCode, req.DeviceKey))
            .RequireRateLimiting(RateLimitPolicies.Auth).WithName("CompletePhone");

        g.MapPost("/refresh", async (RefreshRequest req, SessionService svc, Profile.ProfileService profiles, CancellationToken ct) =>
        {
            var p = await svc.RefreshAsync(req.RefreshToken, ct);
            return new RefreshResponse(p.AccessToken, p.AccessExpiresAt, p.RefreshToken, p.AccountId, await profiles.MeAsync(p.AccountId, ct));
        }).RequireRateLimiting(RateLimitPolicies.Refresh).WithName("Refresh");

        g.MapPost("/sign-out", async (System.Security.Claims.ClaimsPrincipal user, SessionService svc, CancellationToken ct) =>
        {
            await svc.RevokeAsync(user.SessionId(), ct);
            return Results.NoContent();
        }).RequireAuthorization().WithName("SignOut");

        g.MapPost("/sign-out-all", async (System.Security.Claims.ClaimsPrincipal user, SessionService svc, CancellationToken ct) =>
        {
            await svc.RevokeAllAsync(user.AccountId(), ct);
            return Results.NoContent();
        }).RequireAuthorization().WithName("SignOutAll");

        // The War Room's account rows.
        var me = app.MapGroup("/me").WithTags("Account");
        me.MapPost("/abandon", async (System.Security.Claims.ClaimsPrincipal u, AccountService svc, CancellationToken ct) =>
        {
            await svc.AbandonAsync(u.AccountId(), ct);
            return Results.NoContent();
        }).AsWrite().WithName("AbandonCharacter");
        me.MapPost("/keep", async (System.Security.Claims.ClaimsPrincipal u, AccountService svc, CancellationToken ct) =>
        {
            await svc.KeepAsync(u.AccountId(), ct);
            return Results.NoContent();
        }).AsWrite().WithName("KeepCharacter");
        me.MapPost("/sigil/start", async (SigilStartRequest req, System.Security.Claims.ClaimsPrincipal u, AccountService svc, CancellationToken ct) =>
        {
            var v = await svc.StartSigilAsync(u.AccountId(), req.Phone, req.ResumeVerificationId, req.Locale, ct);
            return Started(v);
        }).AsWrite().RequireRateLimiting(RateLimitPolicies.Auth).WithName("StartSigil");
        me.MapPost("/sigil/complete", async (SigilCompleteRequest req, System.Security.Claims.ClaimsPrincipal u, AccountService svc, CancellationToken ct) =>
        {
            await svc.CompleteSigilAsync(u.AccountId(), u.SessionId(), req.VerificationId, ct);
            return Results.NoContent();
        }).AsWrite().WithName("CompleteSigil");
    }

    private static StartResponse Started(PhoneVerification v) =>
        new(v.Id, v.ExpiresAt, PhoneVerificationService.ResendAt(v));
}
