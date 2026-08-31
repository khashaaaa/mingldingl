using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Moq;

namespace MinglDingl.Engine.Tests;

public class VideoTokenServiceTests
{
    private static IHostEnvironment BuildEnv(string environmentName)
    {
        var env = new Mock<IHostEnvironment>();
        env.Setup(e => e.EnvironmentName).Returns(environmentName);
        return env.Object;
    }

    private static IConfiguration BuildConfig(Dictionary<string, string?> values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values).Build();

    private static VideoTokenService CreateService()
    {
        var config = BuildConfig(new Dictionary<string, string?>
        {
            ["Agora:AppId"] = "test_app_id",
            ["Agora:AppCertificate"] = "test_cert",
        });
        return new VideoTokenService(config, BuildEnv(Environments.Production));
    }

    [Fact]
    public void Constructor_MissingAgoraConfigOutsideDevelopment_Throws()
    {
        var ex = Assert.Throws<InvalidOperationException>(() =>
            new VideoTokenService(BuildConfig([]), BuildEnv(Environments.Production)));
        Assert.Contains("Agora", ex.Message);
    }

    [Fact]
    public void Constructor_MissingAgoraConfigInDevelopment_FallsBackToDevPlaceholders()
    {
        var service = new VideoTokenService(BuildConfig([]), BuildEnv(Environments.Development));
        Assert.Equal("dev_app_id", service.AppId);
        Assert.NotEmpty(service.GenerateToken(Guid.NewGuid()));
    }

    [Theory]
    [InlineData(300u)]
    [InlineData(86400u)]
    public void GenerateToken_WithExplicitTtl_EncodesThatExactTtlOnTheWire(uint ttlSeconds)
    {
        var service = CreateService();

        string token = service.GenerateToken(Guid.NewGuid(), ttlSeconds);

        Assert.Equal(ttlSeconds, VideoTokenDecoder.DecodeTtlSeconds(token));
    }

    [Fact]
    public void GenerateToken_ParameterlessOverload_DefaultsToTheExisting24HourTtl()
    {
        var service = CreateService();

        string token = service.GenerateToken(Guid.NewGuid());

        Assert.Equal(24u * 3600, VideoTokenDecoder.DecodeTtlSeconds(token));
    }
}
