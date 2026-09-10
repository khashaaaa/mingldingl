namespace MinglDingl.Engine.Tests.Services;

/// <summary>
/// Which photo URLs a profile may carry. Anything this engine did not issue is someone else's
/// origin: it leaks every viewer's IP to whoever runs it, and its contents can be swapped after
/// moderation has already passed them. And anything under this origin that this engine did not
/// issue <em>to this user</em> is someone else's photo.
/// </summary>
public class LocalFileStorageOwnershipTests
{
    private static readonly Guid Owner = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid Stranger = Guid.Parse("22222222-2222-2222-2222-222222222222");

    private static string Mine(string file = "a.jpg") => $"/uploads/photos/profiles/{Owner}/{file}";

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

    [Fact]
    public void ARelativeUrlInThisUsersOwnDirectory_IsOwned() =>
        Assert.True(Storage().IsOwnedPublicUrl(Mine(), Owner));

    [Fact]
    public void TheSameFileOnTheConfiguredOrigin_IsOwned() =>
        Assert.True(Storage().IsOwnedPublicUrl($"http://localhost:5150{Mine()}", Owner));

    /// <summary>
    /// The whole point of the check. Every candidate's photo URLs are handed out by the discover
    /// feed, so accepting one on another profile let a thief wear that person's face — and dropping
    /// the stolen entry later ran <c>PUT /users/me</c>'s unlink against the victim's real file.
    /// </summary>
    [Fact]
    public void AnotherUsersPhotoOnThisOrigin_IsNotOwned() =>
        Assert.False(Storage().IsOwnedPublicUrl(Mine(), Stranger));

    [Fact]
    public void AnAbsoluteUrlOnADifferentOrigin_IsNotOwnedEvenThoughThePathMatches() =>
        Assert.False(Storage().IsOwnedPublicUrl($"http://192.168.1.32:5150{Mine()}", Owner));

    [Fact]
    public void ThatSameLanOrigin_IsOwnedOnceItIsTheConfiguredPublicBase() =>
        Assert.True(Storage("http://192.168.1.32:5150/uploads")
            .IsOwnedPublicUrl($"http://192.168.1.32:5150{Mine()}", Owner));

    [Theory]
    [InlineData("https://evil.example/x.jpg")]
    [InlineData("https://evil.example/uploads/photos/profiles/11111111-1111-1111-1111-111111111111/a.jpg")]
    [InlineData("javascript:alert(1)")]
    [InlineData("/uploads/")]
    [InlineData("/uploads/photos")]                                     // names a bucket but no file
    [InlineData("/uploads/photos/a.jpg")]                               // right bucket, no owner directory
    [InlineData("/uploads/photos/profiles/a.jpg")]                      // no owner directory either
    [InlineData("/uploads/photos/profiles/11111111-1111-1111-1111-111111111111/sub/a.jpg")] // deeper than we write
    [InlineData("")]
    [InlineData(null)]
    public void AnythingElse_IsNotOwned(string? url) =>
        Assert.False(Storage().IsOwnedPublicUrl(url, Owner));

    /// <summary>
    /// Deletion stays origin-agnostic on purpose: a file recorded under an older PublicBaseUrl is
    /// still the same file on disk, and must not silently survive an account deletion.
    /// </summary>
    [Fact]
    public void RelativePathOf_IgnoresTheOriginSoAnOlderUrlStillResolves()
    {
        var storage = Storage();
        Assert.Equal(
            $"photos/profiles/{Owner}/a.jpg",
            storage.RelativePathOf($"http://192.168.1.32:5150{Mine()}"));
        Assert.Equal(
            $"photos/profiles/{Owner}/a.jpg",
            storage.RelativePathOf(Mine()));
    }

    [Theory]
    [InlineData("https://evil.example/x.jpg")]
    [InlineData("/uploads/photos")]
    [InlineData(null)]
    public void RelativePathOf_RefusesWhatItDoesNotStore(string? url) =>
        Assert.Null(Storage().RelativePathOf(url));
}
