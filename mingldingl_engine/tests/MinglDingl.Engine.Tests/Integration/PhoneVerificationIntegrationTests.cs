using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class PhoneVerificationIntegrationTests : IntegrationTestBase
{
    /// <summary>Serves canned verify.mn responses so the flow can be driven without the network.</summary>
    private sealed class StubVerifyMnHandler : HttpMessageHandler
    {
        public string SessionStatus { get; set; } = "PENDING";
        public HttpStatusCode CreateStatus { get; set; } = HttpStatusCode.OK;
        public string? LastAuthorization { get; private set; }
        public string? LastCreateBody { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            LastAuthorization = request.Headers.Authorization?.ToString();

            if (request.Method == HttpMethod.Post)
            {
                LastCreateBody = request.Content is null ? null : await request.Content.ReadAsStringAsync(ct);
                if (CreateStatus != HttpStatusCode.OK) return new HttpResponseMessage(CreateStatus);

                const string body = """
                {
                  "sessionId": "4d4c95ff-0fd4-4d9e-900d-6d18fb8ce6a7",
                  "phone": "99119911",
                  "shortcode": "144773",
                  "text": "482916",
                  "smsUri": "sms:144773?body=482916",
                  "displayInstruction": "Та өөрийн 99119911 дугаараас 144773 дугаарт \"482916\" гэж SMS илгээнэ үү",
                  "expiresAt": "2999-01-01T00:00:00.000Z"
                }
                """;
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(body, Encoding.UTF8, "application/json"),
                };
            }

            var status = $$"""
            {
              "sessionId": "4d4c95ff-0fd4-4d9e-900d-6d18fb8ce6a7",
              "sessionStatus": "{{SessionStatus}}",
              "callbackStatus": "PENDING",
              "verifiedAt": null,
              "expiresAt": "2999-01-01T00:00:00.000Z"
            }
            """;
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(status, Encoding.UTF8, "application/json"),
            };
        }
    }

    /// <summary>Users.PhoneNumber is uniquely indexed, so each test needs its own number.</summary>
    private static string NewPhone() => Random.Shared.Next(10_000_000, 100_000_000).ToString();

    private (PhoneVerificationService Service, StubVerifyMnHandler Handler) BuildService()
    {
        var handler = new StubVerifyMnHandler();
        var config = new Moq.Mock<Microsoft.Extensions.Configuration.IConfiguration>();
        config.Setup(c => c["VerifyMn:ApiKey"]).Returns("vrf_test_key");
        config.Setup(c => c["VerifyMn:BaseUrl"]).Returns("https://api.verify.mn");
        config.Setup(c => c["VerifyMn:CallbackBaseUrl"]).Returns((string?)null);

        var client = new VerifyMnClient(new HttpClient(handler), config.Object, NullLogger<VerifyMnClient>.Instance);
        return (new PhoneVerificationService(Db, client, config.Object, NullLogger<PhoneVerificationService>.Instance), handler);
    }

    [Theory]
    [InlineData("99119911", true)]
    [InlineData("9911991", false)]
    [InlineData("991199111", false)]
    [InlineData("9911-991", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void IsPhoneValid_accepts_only_eight_digits(string? phone, bool expected) =>
        Assert.Equal(expected, PhoneVerificationService.IsPhoneValid(phone));

    [Fact]
    public async Task Start_persists_a_pending_verification_and_authenticates_with_the_api_key()
    {
        var phone = NewPhone();
        var (service, handler) = BuildService();

        var verification = await service.StartAsync(phone);

        Assert.NotNull(verification);
        Assert.Equal(PhoneVerificationStatus.Pending, verification!.Status);
        Assert.Equal("sms:144773?body=482916", verification.SmsUri);
        Assert.Contains("144773", verification.DisplayInstruction);
        Assert.Equal("Bearer vrf_test_key", handler.LastAuthorization);
        Assert.Matches(@"^\d{6}$", verification.Code);
    }

    [Fact]
    public async Task Start_never_hands_an_in_flight_session_to_a_caller_who_cannot_name_it()
    {
        // Start is anonymous. Returning "the pending session for this number" to whoever asked gave
        // an attacker the same id and code the real owner was about to prove, and the single-use
        // claim then went to whichever of them polled faster.
        var phone = NewPhone();
        var (service, _) = BuildService();

        var owner = await service.StartAsync(phone);
        var attacker = await service.StartAsync(phone);

        Assert.NotEqual(owner!.Id, attacker!.Id);
        Assert.Equal(2, await Db.PhoneVerifications.CountAsync(v => v.Phone == phone));
    }

    [Fact]
    public async Task Start_resumes_the_callers_own_session_so_the_user_is_not_charged_twice()
    {
        var phone = NewPhone();
        var (service, _) = BuildService();

        var first = await service.StartAsync(phone);
        var resumed = await service.StartAsync(phone, first!.Id);

        Assert.Equal(first.Id, resumed!.Id);
        Assert.Equal(1, await Db.PhoneVerifications.CountAsync(v => v.Phone == phone));
    }

    [Fact]
    public async Task Start_ignores_a_resume_id_issued_for_a_different_number()
    {
        var (service, _) = BuildService();
        var other = await service.StartAsync(NewPhone());

        var phone = NewPhone();
        var started = await service.StartAsync(phone, other!.Id);

        Assert.NotEqual(other.Id, started!.Id);
        Assert.Equal(phone, started.Phone);
    }

    /// <summary>
    /// Start is anonymous. Refusing a sixth session let anyone who filled the five slots for a
    /// number lock its real owner out for as long as they kept refilling them.
    /// </summary>
    [Fact]
    public async Task Start_at_the_cap_supersedes_the_oldest_instead_of_locking_the_owner_out()
    {
        var phone = NewPhone();
        var (service, _) = BuildService();
        var first = await service.StartAsync(phone);
        for (int i = 1; i < PhoneVerificationService.MaxPendingPerPhone; i++)
            Assert.NotNull(await service.StartAsync(phone));

        var owner = await service.StartAsync(phone);

        Assert.NotNull(owner);
        Assert.Equal(PhoneVerificationService.MaxPendingPerPhone,
            await Db.PhoneVerifications.CountAsync(v => v.Phone == phone && v.Status == PhoneVerificationStatus.Pending));
        var oldest = await Db.PhoneVerifications.AsNoTracking().SingleAsync(v => v.Id == first!.Id);
        Assert.Equal(PhoneVerificationStatus.Superseded, oldest.Status);
    }

    /// <summary>Eviction must not undo an SMS the owner already paid for.</summary>
    [Fact]
    public async Task A_superseded_session_still_verifies_and_can_still_be_resumed_by_its_holder()
    {
        var phone = NewPhone();
        var (service, handler) = BuildService();
        var first = await service.StartAsync(phone);
        for (int i = 0; i < PhoneVerificationService.MaxPendingPerPhone; i++)
            await service.StartAsync(phone);

        Assert.Equal(first!.Id, (await service.StartAsync(phone, first.Id))!.Id);

        handler.SessionStatus = "VERIFIED";
        Assert.Equal(PhoneVerificationStatus.Verified, (await service.RefreshAsync(first.Id))!.Status);
        Assert.Equal(PhoneClaimResult.Ok, await service.ClaimAsync(first.Id, Guid.NewGuid()));
    }

    private UsersController BuildUsersController(PhoneVerificationService phones, Guid accountId, Guid authId)
    {
        var httpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext
        {
            User = new System.Security.Claims.ClaimsPrincipal(new System.Security.Claims.ClaimsIdentity(
                [new System.Security.Claims.Claim("sub", authId.ToString())], "Bearer")),
        };
        httpContext.Items["UserId"] = accountId;
        var score = new ScoreService(Db, new ConfigService());
        var loot = new HonourService(Db, NullLogger<HonourService>.Instance);
        var milestones = new MilestoneService(Db, NullLogger<MilestoneService>.Instance);
        var oaths = new OathService(Db, new ConfigService(), score, milestones, loot);
        var ships = new ShipService(Db, loot, score, new ConfigService(), milestones, BuildTestPush(), BuildTestBroadcast(), NullLogger<ShipService>.Instance);
        return new UsersController(Db, score, new ReferralService(Db, loot, NullLogger<ReferralService>.Instance), ships, oaths, phones, BuildTestStorage(), new ConfigService())
        {
            ControllerContext = new Microsoft.AspNetCore.Mvc.ControllerContext { HttpContext = httpContext },
        };
    }

    private async Task AddClaimAsync(Guid authId, string phone)
    {
        Db.PhoneVerifications.Add(new PhoneVerification
        {
            Id = Guid.NewGuid(), Phone = phone, Code = "482916", ProviderSessionId = Guid.NewGuid().ToString(),
            Status = PhoneVerificationStatus.Verified, ExpiresAt = DateTime.UtcNow.AddMinutes(5),
            VerifiedAt = DateTime.UtcNow, ClaimedByUserId = authId, ClaimedAt = DateTime.UtcNow,
        });
        await Db.SaveChangesAsync();
    }

    /// <summary>
    /// A returning user's session is an alias whose only link to the account is a claim on its
    /// number. Changing the number must keep the session that changed it, cut every other session
    /// that only proved the old number, and leave those unable to register the old number again.
    /// </summary>
    [Fact]
    public async Task ChangePhone_keeps_the_changing_session_and_releases_the_old_numbers_other_sessions()
    {
        var oldPhone = NewPhone();
        var newPhone = NewPhone();
        var (service, handler) = BuildService();
        var account = NewCompleteUser();
        account.PhoneNumber = oldPhone;
        Db.Users.Add(account);
        await Db.SaveChangesAsync();
        var otherSession = Guid.NewGuid();
        var changingSession = Guid.NewGuid();
        await AddClaimAsync(otherSession, oldPhone);
        await AddClaimAsync(changingSession, oldPhone);
        Assert.Equal(account.Id, await PhoneVerificationService.ResolveAliasAsync(Db, otherSession));

        var verification = await service.StartAsync(newPhone);
        handler.SessionStatus = "VERIFIED";
        var result = await BuildUsersController(service, account.Id, changingSession)
            .ChangePhone(new ChangePhoneRequest(newPhone, verification!.Id));

        Assert.IsType<Microsoft.AspNetCore.Mvc.OkObjectResult>(result);
        Assert.Equal(account.Id, await PhoneVerificationService.ResolveAliasAsync(Db, changingSession));
        Assert.Null(await PhoneVerificationService.ResolveAliasAsync(Db, otherSession));
        Assert.Null(await service.GetVerifiedPhoneAsync(otherSession));
    }

    /// <summary>The stale sessions must not follow the old number onto whoever registers it next.</summary>
    [Fact]
    public async Task ChangePhone_leaves_no_stale_session_for_the_next_owner_of_the_old_number_to_inherit()
    {
        var oldPhone = NewPhone();
        var newPhone = NewPhone();
        var (service, handler) = BuildService();
        var account = NewCompleteUser();
        account.PhoneNumber = oldPhone;
        Db.Users.Add(account);
        await Db.SaveChangesAsync();
        var staleSession = Guid.NewGuid();
        await AddClaimAsync(staleSession, oldPhone);

        var verification = await service.StartAsync(newPhone);
        handler.SessionStatus = "VERIFIED";
        Assert.IsType<Microsoft.AspNetCore.Mvc.OkObjectResult>(
            await BuildUsersController(service, account.Id, account.Id).ChangePhone(new ChangePhoneRequest(newPhone, verification!.Id)));

        var nextOwner = NewCompleteUser();
        nextOwner.PhoneNumber = oldPhone;
        Db.Users.Add(nextOwner);
        await Db.SaveChangesAsync();

        Assert.Null(await PhoneVerificationService.ResolveAliasAsync(Db, staleSession));
        Assert.Equal(account.Id, (await Db.Users.AsNoTracking().SingleAsync(u => u.PhoneNumber == newPhone)).Id);
    }

    [Fact]
    public async Task Refresh_moves_pending_to_verified_once_the_provider_confirms()
    {
        var phone = NewPhone();
        var (service, handler) = BuildService();
        var verification = await service.StartAsync(phone);

        var stillPending = await service.RefreshAsync(verification!.Id);
        Assert.Equal(PhoneVerificationStatus.Pending, stillPending!.Status);

        handler.SessionStatus = "VERIFIED";
        var verified = await service.RefreshAsync(verification.Id);

        Assert.Equal(PhoneVerificationStatus.Verified, verified!.Status);
        Assert.NotNull(verified.VerifiedAt);
    }

    [Fact]
    public async Task Refresh_marks_expired_when_the_provider_reports_expiry()
    {
        var phone = NewPhone();
        var (service, handler) = BuildService();
        var verification = await service.StartAsync(phone);

        handler.SessionStatus = "EXPIRED";
        var expired = await service.RefreshAsync(verification!.Id);

        Assert.Equal(PhoneVerificationStatus.Expired, expired!.Status);
    }

    [Fact]
    public async Task Start_returns_null_when_the_api_key_is_rejected()
    {
        var phone = NewPhone();
        var (service, handler) = BuildService();
        handler.CreateStatus = HttpStatusCode.Unauthorized;

        Assert.Null(await service.StartAsync(phone));
        Assert.False(await Db.PhoneVerifications.AnyAsync(v => v.Phone == phone));
    }

    [Fact]
    public async Task Claim_binds_a_verified_phone_to_the_caller()
    {
        var phone = NewPhone();
        var (service, handler) = BuildService();
        var verification = await service.StartAsync(phone);
        handler.SessionStatus = "VERIFIED";
        var userId = Guid.NewGuid();

        Assert.Equal(PhoneClaimResult.Ok, await service.ClaimAsync(verification!.Id, userId));
        Assert.Equal(phone, await service.GetVerifiedPhoneAsync(userId));
    }

    [Fact]
    public async Task Claim_is_rejected_while_the_phone_is_still_unverified()
    {
        var phone = NewPhone();
        var (service, _) = BuildService();
        var verification = await service.StartAsync(phone);

        Assert.Equal(PhoneClaimResult.NotVerified, await service.ClaimAsync(verification!.Id, Guid.NewGuid()));
        Assert.Null(await service.GetVerifiedPhoneAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task Claim_cannot_be_replayed_onto_a_second_account()
    {
        var phone = NewPhone();
        var (service, handler) = BuildService();
        var verification = await service.StartAsync(phone);
        handler.SessionStatus = "VERIFIED";

        var firstUser = Guid.NewGuid();
        Assert.Equal(PhoneClaimResult.Ok, await service.ClaimAsync(verification!.Id, firstUser));

        var attacker = Guid.NewGuid();
        Assert.Equal(PhoneClaimResult.AlreadyClaimed, await service.ClaimAsync(verification.Id, attacker));
        Assert.Null(await service.GetVerifiedPhoneAsync(attacker));
    }

    [Fact]
    public async Task Claim_is_idempotent_for_the_same_caller()
    {
        var phone = NewPhone();
        var (service, handler) = BuildService();
        var verification = await service.StartAsync(phone);
        handler.SessionStatus = "VERIFIED";
        var userId = Guid.NewGuid();

        Assert.Equal(PhoneClaimResult.Ok, await service.ClaimAsync(verification!.Id, userId));
        Assert.Equal(PhoneClaimResult.Ok, await service.ClaimAsync(verification.Id, userId));
    }

    [Fact]
    public async Task Claim_is_refused_when_an_existing_account_proves_a_number_that_belongs_to_someone_else()
    {
        var phone = NewPhone();
        var (service, handler) = BuildService();
        var owner = NewCompleteUser();
        owner.PhoneNumber = phone;
        var claimant = NewCompleteUser();
        claimant.PhoneNumber = NewPhone();
        Db.Users.AddRange(owner, claimant);
        await Db.SaveChangesAsync();

        var verification = await service.StartAsync(phone);
        handler.SessionStatus = "VERIFIED";

        Assert.Equal(PhoneClaimResult.PhoneInUse, await service.ClaimAsync(verification!.Id, claimant.Id));
    }

    [Fact]
    public async Task Claim_lets_the_owner_sign_back_in_from_a_fresh_identity()
    {
        // A returning user gets a new anonymous Supabase identity on every sign-in. Proving the
        // number is what entitles them to the account that holds it; CurrentUserMiddleware then
        // aliases the new identity onto that account through ResolveAliasAsync.
        var phone = NewPhone();
        var (service, handler) = BuildService();
        var owner = NewCompleteUser();
        owner.PhoneNumber = phone;
        Db.Users.Add(owner);
        await Db.SaveChangesAsync();

        var verification = await service.StartAsync(phone);
        handler.SessionStatus = "VERIFIED";
        var freshAuthId = Guid.NewGuid();

        Assert.Equal(PhoneClaimResult.Ok, await service.ClaimAsync(verification!.Id, freshAuthId));
        Assert.Equal(owner.Id, await PhoneVerificationService.ResolveAliasAsync(Db, freshAuthId));
    }

    [Fact]
    public async Task ResolveAlias_is_null_for_an_identity_that_proved_nothing_or_a_number_with_no_account()
    {
        var (service, handler) = BuildService();
        Assert.Null(await PhoneVerificationService.ResolveAliasAsync(Db, Guid.NewGuid()));

        var verification = await service.StartAsync(NewPhone());
        handler.SessionStatus = "VERIFIED";
        var newcomer = Guid.NewGuid();
        Assert.Equal(PhoneClaimResult.Ok, await service.ClaimAsync(verification!.Id, newcomer));

        Assert.Null(await PhoneVerificationService.ResolveAliasAsync(Db, newcomer));
    }

    [Fact]
    public async Task Claim_expires_outside_the_claim_window()
    {
        var phone = NewPhone();
        var (service, handler) = BuildService();
        var verification = await service.StartAsync(phone);
        handler.SessionStatus = "VERIFIED";
        await service.RefreshAsync(verification!.Id);

        var stored = await Db.PhoneVerifications.FindAsync(verification.Id);
        stored!.VerifiedAt = DateTime.UtcNow - PhoneVerificationService.ClaimWindow - TimeSpan.FromMinutes(1);
        await Db.SaveChangesAsync();

        Assert.Equal(PhoneClaimResult.Expired, await service.ClaimAsync(verification.Id, Guid.NewGuid()));
    }

    [Fact]
    public async Task Claim_reports_not_found_for_an_unknown_verification() =>
        Assert.Equal(PhoneClaimResult.NotFound, await BuildService().Service.ClaimAsync(Guid.NewGuid(), Guid.NewGuid()));

    [Fact]
    public void Service_reports_unconfigured_when_no_api_key_is_set()
    {
        var config = new Moq.Mock<Microsoft.Extensions.Configuration.IConfiguration>().Object;
        var client = new VerifyMnClient(new HttpClient(), config, NullLogger<VerifyMnClient>.Instance);
        var service = new PhoneVerificationService(Db, client, config, NullLogger<PhoneVerificationService>.Instance);

        Assert.False(service.IsConfigured);
    }
}

/// <summary>
/// The per-IP rate limit on <c>POST /auth/phone/start</c> (<see cref="PhoneStartRateLimit"/>).
/// Unlike the rest of this file, these tests drive the real HTTP pipeline (the limiter is
/// registered as ASP.NET Core middleware, not something a direct call into
/// <see cref="PhoneVerificationService"/> would ever exercise) via
/// <see cref="WebApplicationFactory{TEntryPoint}"/> against local Postgres.
///
/// Two deliberate differences from a real boot, both there only to make this test safe and fast to
/// run repeatedly against the developer's own local dev database: VerifyMn stays unconfigured, so a
/// *permitted* `start` call returns 503 immediately with no outbound call to verify.mn and no DB
/// write (the verification flow itself is covered end-to-end above); and the hourly/10s maintenance
/// sweepers are stripped so simply booting the app for this test cannot silently ghost matches,
/// expire memberships, or advance a real Town Square round sitting in that database.
/// </summary>
public class PhoneStartRateLimitTests : IClassFixture<PhoneStartRateLimitTests.Factory>
{
    public class Factory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureAppConfiguration((_, config) =>
                config.AddInMemoryCollection(new Dictionary<string, string?> { ["VerifyMn:ApiKey"] = "" }));
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IHostedService>();
                services.AddSingleton<IStartupFilter>(new FakeClientIpStartupFilter());

                // The full suite runs hundreds of tests in parallel, each opening its own
                // NpgsqlDataSource; across the whole process that trips EF Core's "more than
                // twenty internal service providers" diagnostic. Every other AppDbContext in this
                // project is built through IntegrationTestBase.BuildContext, which already ignores
                // it (see that method) — Program.cs's own registration does not, because outside
                // tests there is only ever one. Re-register with the same ignore so booting the
                // real app here doesn't fail on a diagnostic that has nothing to do with this test.
                services.RemoveAll<DbContextOptions<AppDbContext>>();
                services.AddDbContext<AppDbContext>(opt =>
                {
                    var dataSourceBuilder = new Npgsql.NpgsqlDataSourceBuilder(
                        "Host=127.0.0.1;Database=mingldingl;Username=postgres;Password=1234;Port=5432");
                    dataSourceBuilder.EnableDynamicJson();
                    opt.UseNpgsql(dataSourceBuilder.Build(), npgsql => npgsql.EnableRetryOnFailure(maxRetryCount: 3))
                        .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.CoreEventId.ManyServiceProvidersCreatedWarning));
                });
            });
        }
    }

    /// <summary>
    /// TestServer has no real socket, so <c>Connection.RemoteIpAddress</c> is whatever this sets it
    /// to from a test-only header — the only way to simulate "two different callers" and "one
    /// caller retrying" against the limiter's per-IP partition key.
    /// </summary>
    private sealed class FakeClientIpStartupFilter : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use(async (context, nextMiddleware) =>
            {
                if (context.Request.Headers.TryGetValue("X-Test-Client-Ip", out var ip) &&
                    IPAddress.TryParse(ip.ToString(), out var parsed))
                {
                    context.Connection.RemoteIpAddress = parsed;
                }
                await nextMiddleware();
            });
            next(app);
        };
    }

    private readonly Factory _factory;

    public PhoneStartRateLimitTests(Factory factory) => _factory = factory;

    /// <summary>Users.PhoneNumber is uniquely indexed elsewhere; harmless here since Start never
    /// persists while VerifyMn is unconfigured, but kept consistent with the rest of this file.</summary>
    private static string NewPhone() => Random.Shared.Next(10_000_000, 100_000_000).ToString();

    private static Task<HttpResponseMessage> PostStart(HttpClient client, string ip, string phone)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/auth/phone/start")
        {
            Content = JsonContent.Create(new { phone }),
        };
        request.Headers.Add("X-Test-Client-Ip", ip);
        return client.SendAsync(request);
    }

    [Fact]
    public async Task Start_is_refused_once_one_ip_spends_its_window_budget()
    {
        var client = _factory.CreateClient();
        var ip = "203.0.113.10";

        // Every call below uses a *different* number, and none of them is refused by the
        // per-number cap (each is fresh) — proving this is a source-address budget, not a
        // per-number one. VerifyMn is unconfigured, so a permitted call returns 503, never 429.
        for (int i = 0; i < PhoneStartRateLimit.PermitLimit; i++)
        {
            var res = await PostStart(client, ip, NewPhone());
            Assert.NotEqual(HttpStatusCode.TooManyRequests, res.StatusCode);
        }

        var blocked = await PostStart(client, ip, NewPhone());
        Assert.Equal(HttpStatusCode.TooManyRequests, blocked.StatusCode);

        // Same body shape as the per-number 429 (phone.too_many_attempts) — only the code differs,
        // so the client needs no new error-handling branch.
        var body = await blocked.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.Equal("phone.too_many_attempts_ip", body!.Code);
        Assert.False(string.IsNullOrWhiteSpace(body.Error));
    }

    [Fact]
    public async Task Start_budget_is_partitioned_per_ip_not_shared_globally()
    {
        var client = _factory.CreateClient();
        var spentIp = "203.0.113.20";
        for (int i = 0; i <= PhoneStartRateLimit.PermitLimit; i++)
            await PostStart(client, spentIp, NewPhone());

        // spentIp is now over budget (see the previous test). A second, unrelated IP must be
        // completely unaffected — this is what makes the limiter safe to ship despite mobile
        // carrier NAT: it only ever penalises the address that actually burned its own budget.
        var otherIp = "203.0.113.21";
        var res = await PostStart(client, otherIp, NewPhone());
        Assert.NotEqual(HttpStatusCode.TooManyRequests, res.StatusCode);
    }

    [Fact]
    public async Task Status_polling_is_never_rate_limited()
    {
        // The app polls this endpoint on a timer for the entire duration of every verification. If
        // the limiter ever caught it, every real sign-up would eventually 429 mid-poll. Hammer it
        // well past the start policy's permit count from one simulated IP and confirm none of them
        // trip the limiter.
        var client = _factory.CreateClient();
        var ip = "203.0.113.30";

        for (int i = 0; i < PhoneStartRateLimit.PermitLimit + 10; i++)
        {
            var request = new HttpRequestMessage(HttpMethod.Get, $"/auth/phone/status/{Guid.NewGuid()}");
            request.Headers.Add("X-Test-Client-Ip", ip);
            var res = await client.SendAsync(request);
            Assert.NotEqual(HttpStatusCode.TooManyRequests, res.StatusCode);
        }
    }
}
