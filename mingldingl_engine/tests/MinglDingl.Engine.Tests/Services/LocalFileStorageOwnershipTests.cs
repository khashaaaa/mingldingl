namespace MinglDingl.Engine.Tests.Services;

/// <summary>
/// Which photo URLs a profile may carry. Anything this engine did not issue is someone else's
/// origin: it leaks every viewer's IP to whoever runs it, and its contents can be swapped after
/// moderation has already passed them.
/// </summary>
public class LocalFileStorageOwnershipTests
{
    private static LocalFileStorageService Storage(string? publicBaseUrl = null)
    {
        var env = new Moq.Mock<Microsoft.AspNetCore.Hosting.IWebHostEnvironment>();
        env.SetupGet(e => e.ContentRootPath).Returns(
            Path.Combine(Path.GetTempPath(), "mingldingl-tests", Guid.NewGuid().ToString("N")));
        var config = new Moq.Mock<Microsoft.Extensions.Configuration.IConfiguration>();
        config.SetupGet(c => c["Storage:PublicBaseUrl"]).Returns(publicBaseUrl);
        return new LocalFileStorageService(
            env.Object,
            config.Object,
            Microsoft.Extensions.Logging.Abstractions.NullLogger<LocalFileStorageService>.Instance);
    }

    [Theory]
    [InlineData("/uploads/photos/a.jpg")]                       // relative, as the app stores it
    [InlineData("http://localhost:5150/uploads/photos/a.jpg")]  // the configured origin
    public void AFileUnderThisEnginesUploadsRoot_IsOwned(string url) =>
        Assert.True(Storage().IsOwnedPublicUrl(url));

    [Fact]
    public void AnAbsoluteUrlOnADifferentOrigin_IsNotOwnedEvenThoughThePathMatches() =>
        Assert.False(Storage().IsOwnedPublicUrl("http://192.168.1.32:5150/uploads/photos/a.jpg"));

    [Fact]
    public void ThatSameLanOrigin_IsOwnedOnceItIsTheConfiguredPublicBase() =>
        Assert.True(Storage("http://192.168.1.32:5150/uploads")
            .IsOwnedPublicUrl("http://192.168.1.32:5150/uploads/photos/a.jpg"));

    [Theory]
    [InlineData("https://evil.example/x.jpg")]
    [InlineData("https://evil.example/uploads/photos/a.jpg")]  // path-shaped, still not our file
    [InlineData("javascript:alert(1)")]
    [InlineData("/uploads/")]
    [InlineData("/uploads/photos")]                            // names a bucket but no file
    [InlineData("")]
    [InlineData(null)]
    public void AnythingElse_IsNotOwned(string? url) =>
        Assert.False(Storage().IsOwnedPublicUrl(url));
}
