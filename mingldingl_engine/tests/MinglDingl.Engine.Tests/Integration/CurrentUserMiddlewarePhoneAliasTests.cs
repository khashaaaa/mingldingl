using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class CurrentUserMiddlewarePhoneAliasTests : IntegrationTestBase
{
    private static string NewPhone() => Random.Shared.Next(10_000_000, 100_000_000).ToString();

    private static VerifyMnClient BuildVerifyClient(bool configured)
    {
        var config = new Moq.Mock<IConfiguration>();
        if (configured) config.Setup(c => c["VerifyMn:ApiKey"]).Returns("vrf_test_key");
        return new VerifyMnClient(new HttpClient(), config.Object, NullLogger<VerifyMnClient>.Instance);
    }

    private HttpContext BuildContext(Guid authId, string? metadataPhone, bool verifyConfigured)
    {
        var claims = new List<Claim> { new("sub", authId.ToString()) };
        if (metadataPhone is not null) claims.Add(new Claim("user_metadata", $"{{\"phone\":\"{metadataPhone}\"}}"));

        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Bearer")),
            RequestServices = new ServiceCollection()
                .AddSingleton(Db)
                .AddSingleton(BuildVerifyClient(verifyConfigured))
                .BuildServiceProvider(),
        };
        context.Response.Body = new MemoryStream();
        return context;
    }

    private async Task<Guid> AddUserWithPhoneAsync(string phone)
    {
        var id = Guid.NewGuid();
        Db.Users.Add(new User { Id = id, PhoneNumber = phone, DisplayName = "Returning", Age = 25 });
        await Db.SaveChangesAsync();
        Db.ChangeTracker.Clear();
        return id;
    }

    private async Task AddClaimedVerificationAsync(Guid authId, string phone)
    {
        Db.PhoneVerifications.Add(new PhoneVerification
        {
            Id = Guid.NewGuid(),
            Phone = phone,
            Code = "482916",
            ProviderSessionId = Guid.NewGuid().ToString(),
            Status = PhoneVerificationStatus.Verified,
            ExpiresAt = DateTime.UtcNow.AddMinutes(5),
            VerifiedAt = DateTime.UtcNow,
            ClaimedByUserId = authId,
            ClaimedAt = DateTime.UtcNow,
        });
        await Db.SaveChangesAsync();
        Db.ChangeTracker.Clear();
    }

    private static async Task<object?> RunAsync(HttpContext context)
    {
        await new CurrentUserMiddleware(_ => Task.CompletedTask).InvokeAsync(context);
        return context.Items["UserId"];
    }

    [Fact]
    public async Task WithVerifyMn_TheClientWrittenPhoneClaimIsIgnored()
    {
        // user_metadata.phone is set by the app itself via PUT /auth/v1/user with the anon key, so
        // anyone can put any number there. Honouring it here made a fresh anonymous sign-up into
        // whichever account owned that number.
        var phone = NewPhone();
        var victimId = await AddUserWithPhoneAsync(phone);
        var attackerAuthId = Guid.NewGuid();

        var resolved = await RunAsync(BuildContext(attackerAuthId, phone, verifyConfigured: true));

        Assert.Equal(attackerAuthId, resolved);
        Assert.NotEqual(victimId, resolved);
    }

    [Fact]
    public async Task WithVerifyMn_AnIdentityThatProvedTheNumberIsAliasedOntoItsAccount()
    {
        var phone = NewPhone();
        var existingId = await AddUserWithPhoneAsync(phone);
        var newAuthId = Guid.NewGuid();
        await AddClaimedVerificationAsync(newAuthId, phone);

        var resolved = await RunAsync(BuildContext(newAuthId, metadataPhone: null, verifyConfigured: true));

        Assert.Equal(existingId, resolved);
    }

    [Fact]
    public async Task WithVerifyMn_AProvenNumberWithNoAccountYetStaysTheNewIdentity()
    {
        var newAuthId = Guid.NewGuid();
        await AddClaimedVerificationAsync(newAuthId, NewPhone());

        var resolved = await RunAsync(BuildContext(newAuthId, metadataPhone: null, verifyConfigured: true));

        Assert.Equal(newAuthId, resolved);
    }

    [Fact]
    public async Task WithVerifyMn_AnIdentityThatAlreadyOwnsAUserIsNeverRedirected()
    {
        var phone = NewPhone();
        var authId = await AddUserWithPhoneAsync(phone);
        var other = await AddUserWithPhoneAsync(NewPhone());
        await AddClaimedVerificationAsync(authId, (await Db.Users.FindAsync(other))!.PhoneNumber!);

        var resolved = await RunAsync(BuildContext(authId, phone, verifyConfigured: true));

        Assert.Equal(authId, resolved);
    }

    [Fact]
    public async Task WithVerifyMn_ABannedAliasTargetIsRefused()
    {
        var phone = NewPhone();
        var bannedId = await AddUserWithPhoneAsync(phone);
        var banned = await Db.Users.FindAsync(bannedId);
        banned!.IsBanned = true;
        await Db.SaveChangesAsync();
        Db.ChangeTracker.Clear();
        var newAuthId = Guid.NewGuid();
        await AddClaimedVerificationAsync(newAuthId, phone);

        var context = BuildContext(newAuthId, metadataPhone: null, verifyConfigured: true);
        await new CurrentUserMiddleware(_ => Task.CompletedTask).InvokeAsync(context);

        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
        Assert.False(context.Items.ContainsKey("UserId"));
    }

    [Fact]
    public async Task WithoutVerifyMn_ReturningPhone_AliasesNewAuthIdToExistingUser()
    {
        // Development has no proof to check, so the metadata phone stays the harness's handle there.
        var phone = NewPhone();
        var existingId = await AddUserWithPhoneAsync(phone);

        var resolved = await RunAsync(BuildContext(Guid.NewGuid(), phone, verifyConfigured: false));

        Assert.Equal(existingId, resolved);
    }

    [Fact]
    public async Task WithoutVerifyMn_UnknownPhone_TreatsAuthIdAsNewUser()
    {
        var newAuthId = Guid.NewGuid();

        var resolved = await RunAsync(BuildContext(newAuthId, NewPhone(), verifyConfigured: false));

        Assert.Equal(newAuthId, resolved);
    }

    [Fact]
    public async Task WithoutVerifyMn_AuthIdAlreadyOwnsAUser_SkipsPhoneLookup()
    {
        var phone = NewPhone();
        var authId = await AddUserWithPhoneAsync(phone);

        var resolved = await RunAsync(BuildContext(authId, phone, verifyConfigured: false));

        Assert.Equal(authId, resolved);
    }
}
