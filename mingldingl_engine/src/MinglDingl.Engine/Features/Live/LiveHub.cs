using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using MinglDingl.Engine.Kernel.Auth;
using MinglDingl.Engine.Kernel.Live;

namespace MinglDingl.Engine.Features.Live;

/// The app's one live connection. Server → client only: method "event" carries a LiveEvent.
[Authorize(AuthenticationSchemes = AppClaims.Scheme)]
public sealed class LiveHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var user = Context.User!;
        await Groups.AddToGroupAsync(Context.ConnectionId, LiveGroups.Account(user.AccountId()));
        await Groups.AddToGroupAsync(Context.ConnectionId, LiveGroups.Session(user.SessionId()));
        await Groups.AddToGroupAsync(Context.ConnectionId, LiveGroups.All);
        await base.OnConnectedAsync();
    }
}

/// The admin panel's live connection.
[Authorize(AuthenticationSchemes = Admin.AdminAuth.Scheme, Policy = Admin.AdminEndpoints.Policy)]
public sealed class AdminLiveHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, LiveGroups.Admins);
        await base.OnConnectedAsync();
    }
}
