using System.Net;
using System.Text;
using Microsoft.EntityFrameworkCore;
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
    public async Task Start_reuses_an_in_flight_session_so_the_user_is_not_charged_twice()
    {
        var phone = NewPhone();
        var (service, _) = BuildService();

        var first = await service.StartAsync(phone);
        var second = await service.StartAsync(phone);

        Assert.Equal(first!.Id, second!.Id);
        Assert.Equal(1, await Db.PhoneVerifications.CountAsync(v => v.Phone == phone));
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
    public async Task Claim_is_refused_when_the_number_already_belongs_to_someone_else()
    {
        var phone = NewPhone();
        var (service, handler) = BuildService();
        var owner = NewCompleteUser();
        owner.PhoneNumber = phone;
        Db.Users.Add(owner);
        await Db.SaveChangesAsync();

        var verification = await service.StartAsync(phone);
        handler.SessionStatus = "VERIFIED";

        Assert.Equal(PhoneClaimResult.PhoneInUse, await service.ClaimAsync(verification!.Id, Guid.NewGuid()));
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
