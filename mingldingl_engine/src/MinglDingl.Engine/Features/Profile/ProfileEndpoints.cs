using System.Security.Claims;
using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Kernel.Auth;
using MinglDingl.Engine.Kernel.Config;

namespace MinglDingl.Engine.Features.Profile;

public sealed class ProfileEndpoints : IEndpointModule
{
    public void Map(IEndpointRouteBuilder app)
    {
        var me = app.MapGroup("/me").WithTags("Profile");
        me.MapGet("", (ClaimsPrincipal u, ProfileService svc, CancellationToken ct) => svc.MeAsync(u.AccountId(), ct))
            .RequireAuthorization().WithName("GetMe");
        me.MapPost("", (CreateProfileRequest req, ClaimsPrincipal u, ProfileService svc, CancellationToken ct) =>
            svc.CreateAsync(u.AccountId(), req, ct)).AsWrite().WithName("CreateMe");
        me.MapPut("", (UpdateProfileRequest req, ClaimsPrincipal u, ProfileService svc, CancellationToken ct) =>
            svc.UpdateAsync(u.AccountId(), req, ct)).AsWrite().WithName("UpdateMe");

        app.MapGet("/geo/cities", () => MongoliaGeo.All.Select(c => new CityView(c.Name, c.Kind, c.Region, c.Lat, c.Lng)))
            .WithTags("Profile").WithName("GetCities");
        app.MapGet("/app/status", (IConfig config) =>
            new AppStatusView(config.Str(ConfigKeys.AppMinVersion), config.Bool(ConfigKeys.AppMaintenance),
                config.Int(ConfigKeys.PhotosMin), config.Int(ConfigKeys.PhotosMax), config.Int(ConfigKeys.AppRestMinutes), config.Int(ConfigKeys.AccountDeleteDays),
                config.Int(ConfigKeys.ScoreFinished)))
            .WithTags("App").WithName("GetAppStatus");
    }
}
