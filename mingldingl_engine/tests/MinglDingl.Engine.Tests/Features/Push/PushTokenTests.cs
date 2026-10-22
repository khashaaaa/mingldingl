using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using MinglDingl.Engine.Features.Push;
using MinglDingl.Engine.Kernel.Push;
using MinglDingl.Engine.Tests.Infrastructure;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;

namespace MinglDingl.Engine.Tests.Features.Push;

public class PushTokenTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    private const string Phone = "ExponentPushToken[shared-phone]";

    /// Sends one push to a person straight through the sender and returns the tokens it went to.
    private static async Task<List<string>> PushTo(World w, World.Person p)
    {
        w.Push.Sent.Clear();
        await w.F.Services.GetRequiredService<PushSender>().SendAsync(new PushItem(p.Id, PushKinds.Letter, null, "Anu", "hello"));
        return w.Push.Sent.Select(m => m.To).ToList();
    }

    [Fact]
    public async Task A_push_token_belongs_to_one_device_session_and_goes_with_its_sign_out()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        (await bat.C.PutAsJsonAsync("/me/push-token", new PushTokenRequest(Phone))).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await PushTo(w, bat)).Should().Equal(Phone);

        // Bat hands the phone to Saruul, who signs in on it: his pushes stop reaching it.
        (await saruul.C.PutAsJsonAsync("/me/push-token", new PushTokenRequest(Phone))).EnsureSuccessStatusCode();
        (await PushTo(w, bat)).Should().BeEmpty();
        (await PushTo(w, saruul)).Should().Equal(Phone);

        (await saruul.C.DeleteAsync("/me/push-token")).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await PushTo(w, saruul)).Should().BeEmpty();
        (await saruul.C.PutAsJsonAsync("/me/push-token", new PushTokenRequest(Phone))).EnsureSuccessStatusCode();
        (await saruul.C.PostAsync("/auth/sign-out", null)).EnsureSuccessStatusCode();
        (await PushTo(w, saruul)).Should().BeEmpty("a signed-out device hears nothing");

        (await CodeOf(await bat.C.PutAsJsonAsync("/me/push-token", new PushTokenRequest("not-a-token")))).Should().Be("push.token");
    }
}
