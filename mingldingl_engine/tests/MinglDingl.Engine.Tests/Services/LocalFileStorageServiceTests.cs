using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Moq;

namespace MinglDingl.Engine.Tests.Services;

public class LocalFileStorageServiceTests : IDisposable
{
    private readonly string _tempRoot =
        Path.Combine(Path.GetTempPath(), "mingldingl-storage-tests", Guid.NewGuid().ToString("N"));

    private LocalFileStorageService Build(string? publicBaseUrl)
    {
        var env = new Mock<IWebHostEnvironment>();
        env.Setup(e => e.ContentRootPath).Returns(_tempRoot);
        var values = new Dictionary<string, string?>();
        if (publicBaseUrl is not null) values["Storage:PublicBaseUrl"] = publicBaseUrl;
        var config = new ConfigurationBuilder().AddInMemoryCollection(values).Build();
        return new LocalFileStorageService(env.Object, config, NullLogger<LocalFileStorageService>.Instance);
    }

    [Fact]
    public async Task UploadAsync_NoPublicBaseUrlConfigured_FallsBackToLocalhostUploads()
    {
        var url = await Build(null).UploadAsync("photos", "u1/a.jpg", [1, 2, 3], "image/jpeg");

        Assert.Equal("http://localhost:5150/uploads/photos/u1/a.jpg", url);
        Assert.True(File.Exists(Path.Combine(_tempRoot, "uploads", "photos", "u1", "a.jpg")));
    }

    [Fact]
    public async Task UploadAsync_ConfiguredPublicBaseUrl_TrailingSlashTrimmed()
    {
        var url = await Build("https://cdn.example.com/files/").UploadAsync("photos", "b.jpg", [1], "image/jpeg");

        Assert.Equal("https://cdn.example.com/files/photos/b.jpg", url);
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempRoot)) Directory.Delete(_tempRoot, recursive: true);
    }

    [Fact]
    public async Task DeleteByPublicUrl_RemovesTheFileItIssued()
    {
        var storage = Build("https://cdn.example.com/uploads");
        var url = await storage.UploadAsync("photos", "u1/a.jpg", [1, 2, 3], "image/jpeg");
        var path = Path.Combine(_tempRoot, "uploads", "photos", "u1", "a.jpg");
        Assert.True(File.Exists(path));

        Assert.True(storage.DeleteByPublicUrl(url));
        Assert.False(File.Exists(path));
    }

    [Fact]
    public async Task DeleteByPublicUrl_IsIdempotent()
    {
        var storage = Build("https://cdn.example.com/uploads");
        var url = await storage.UploadAsync("photos", "u1/a.jpg", [1, 2, 3], "image/jpeg");

        Assert.True(storage.DeleteByPublicUrl(url));
        Assert.False(storage.DeleteByPublicUrl(url));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("https://elsewhere.example.com/uploads/photos/u1/a.jpg")]
    [InlineData("https://cdn.example.com/uploads")]
    [InlineData("https://cdn.example.com/uploads/photos")]
    public void DeleteByPublicUrl_RefusesUrlsItDidNotIssue(string? url) =>
        Assert.False(Build("https://cdn.example.com/uploads").DeleteByPublicUrl(url));

    [Fact]
    public void DeleteByPublicUrl_RefusesToEscapeTheUploadsRoot()
    {
        var storage = Build("https://cdn.example.com/uploads");
        var outside = Path.Combine(_tempRoot, "secret.txt");
        Directory.CreateDirectory(_tempRoot);
        File.WriteAllText(outside, "do not delete");

        Assert.False(storage.DeleteByPublicUrl("https://cdn.example.com/uploads/photos/../../secret.txt"));
        Assert.True(File.Exists(outside));
    }

    [Fact]
    public async Task UploadAsync_RefusesAPathThatEscapesTheUploadsRoot()
    {
        var storage = Build("https://cdn.example.com/uploads");

        await Assert.ThrowsAsync<ArgumentException>(
            () => storage.UploadAsync("photos", "../../escaped.jpg", [1], "image/jpeg"));
    }

    [Theory]
    [InlineData("http://localhost:5150/uploads/photos/u1/a.jpg")]
    [InlineData("http://192.168.1.32:5150/uploads/photos/u1/a.jpg")]
    [InlineData("https://api.example.com/uploads/photos/u1/a.jpg")]
    public async Task DeleteByPublicUrl_StillDeletesWhenTheOriginHasChanged(string storedUrl)
    {
        // PublicBaseUrl differs per environment (localhost, the LAN IP used for on-device
        // testing, the production domain). A photo stored under an older origin must remain
        // deletable, or it silently survives account deletion on a public path.
        var storage = Build("https://cdn.example.com/uploads");
        await storage.UploadAsync("photos", "u1/a.jpg", [1, 2, 3], "image/jpeg");
        var onDisk = Path.Combine(_tempRoot, "uploads", "photos", "u1", "a.jpg");

        Assert.True(storage.DeleteByPublicUrl(storedUrl));
        Assert.False(File.Exists(onDisk));
    }

    [Fact]
    public async Task DeleteByPublicUrl_HandlesAPercentEncodedPath()
    {
        var storage = Build("https://cdn.example.com/uploads");
        await storage.UploadAsync("photos", "u 1/a.jpg", [1], "image/jpeg");

        Assert.True(storage.DeleteByPublicUrl("https://cdn.example.com/uploads/photos/u%201/a.jpg"));
    }

    [Fact]
    public void DeleteByPublicUrl_StillRefusesAUrlWithNoUploadsSegment() =>
        Assert.False(Build("https://cdn.example.com/uploads")
            .DeleteByPublicUrl("https://cdn.example.com/other/photos/u1/a.jpg"));

    private LocalFileStorageService BuildWithSealKey(string key)
    {
        var env = new Mock<IWebHostEnvironment>();
        env.Setup(e => e.ContentRootPath).Returns(_tempRoot);
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Storage:SealedPhotoKey"] = key })
            .Build();
        return new LocalFileStorageService(env.Object, config, NullLogger<LocalFileStorageService>.Instance);
    }

    /// <summary>
    /// The sealed URL is handed to strangers in the discover feed. When its name was the original's
    /// plus "-sealed", stripping the suffix fetched the unblurred photo from the same public folder.
    /// </summary>
    [Fact]
    public void SealedPathOf_SameDirectory_NameDoesNotRevealTheOriginal()
    {
        var sealedPath = Build(null).SealedPathOf("photos/u1/0123456789abcdef0123456789abcdef.jpg");

        Assert.StartsWith("photos/u1/sealed-", sealedPath);
        Assert.EndsWith(".jpg", sealedPath);
        Assert.DoesNotContain("0123456789abcdef", sealedPath);
    }

    [Fact]
    public void SealedPathOf_IsTheSameForEitherPathShape_AndDependsOnTheKey()
    {
        var storage = BuildWithSealKey("key-one");

        Assert.Equal(
            Path.GetFileName(storage.SealedPathOf("photos/u1/a.jpg")),
            Path.GetFileName(storage.SealedPathOf("u1/a.jpg")));
        Assert.NotEqual(storage.SealedPathOf("photos/u1/a.jpg"), BuildWithSealKey("key-two").SealedPathOf("photos/u1/a.jpg"));
    }

    [Theory]
    [InlineData("photos/u1/sealed-0123456789abcdef0123456789abcdef.jpg", true)]
    [InlineData("photos/u1/a-sealed.jpg", true)]
    [InlineData("photos/u1/0123456789abcdef0123456789abcdef.jpg", false)]
    public void IsSealedPath_RecognisesBothNamingSchemes(string relativePath, bool expected) =>
        Assert.Equal(expected, LocalFileStorageService.IsSealedPath(relativePath));

    [Fact]
    public async Task OriginalPathOfSealed_FindsTheOriginalBesideIt()
    {
        var storage = Build(null);
        await storage.UploadAsync("photos", "u1/a.jpg", [1, 2, 3], "image/jpeg");
        await storage.UploadAsync("photos", "u1/b.jpg", [1, 2, 3], "image/jpeg");
        await storage.UploadAsync("photos", storage.SealedPathOf("u1/a.jpg"), [4, 5, 6], "image/jpeg");

        Assert.Equal("photos/u1/a.jpg", storage.OriginalPathOfSealed(storage.SealedPathOf("photos/u1/a.jpg")));
    }

    [Fact]
    public async Task OriginalPathOfSealed_NullForAnOriginalItself_ALegacyName_OrAGoneOriginal()
    {
        var storage = Build(null);
        await storage.UploadAsync("photos", "u1/a.jpg", [1, 2, 3], "image/jpeg");

        Assert.Null(storage.OriginalPathOfSealed("photos/u1/a.jpg"));
        Assert.Null(storage.OriginalPathOfSealed("photos/u1/a-sealed.jpg"));
        Assert.Null(storage.OriginalPathOfSealed(storage.SealedPathOf("photos/u1/gone.jpg")));
    }

    [Fact]
    public async Task SealedPublicUrlOf_NoSealedFileYet_ReturnsNull()
    {
        var storage = Build("https://cdn.example.com/uploads");
        var url = await storage.UploadAsync("photos", "u1/a.jpg", [1, 2, 3], "image/jpeg");

        Assert.Null(storage.SealedPublicUrlOf(url));
    }

    [Fact]
    public async Task SealedPublicUrlOf_SealedFileExists_ReturnsItsUrl()
    {
        var storage = Build("https://cdn.example.com/uploads");
        var url = await storage.UploadAsync("photos", "u1/a.jpg", [1, 2, 3], "image/jpeg");
        await storage.UploadAsync("photos", storage.SealedPathOf("u1/a.jpg"), [4, 5, 6], "image/jpeg");

        Assert.Equal($"https://cdn.example.com/uploads/{storage.SealedPathOf("photos/u1/a.jpg")}", storage.SealedPublicUrlOf(url));
    }

    /// <summary>A legacy "-sealed" file is never served again: its name is the leak.</summary>
    [Fact]
    public async Task SealedPublicUrlOf_OnlyALegacyNamedSiblingExists_ReturnsNull()
    {
        var storage = Build("https://cdn.example.com/uploads");
        var url = await storage.UploadAsync("photos", "u1/a.jpg", [1, 2, 3], "image/jpeg");
        await storage.UploadAsync("photos", "u1/a-sealed.jpg", [4, 5, 6], "image/jpeg");

        Assert.Null(storage.SealedPublicUrlOf(url));
    }

    [Fact]
    public async Task DeleteByPublicUrl_AlsoRemovesTheSealedSibling_UnderEitherName()
    {
        var storage = Build("https://cdn.example.com/uploads");
        var url = await storage.UploadAsync("photos", "u1/a.jpg", [1, 2, 3], "image/jpeg");
        await storage.UploadAsync("photos", storage.SealedPathOf("u1/a.jpg"), [4, 5, 6], "image/jpeg");
        await storage.UploadAsync("photos", "u1/a-sealed.jpg", [4, 5, 6], "image/jpeg");
        var sealedPath = Path.Combine(_tempRoot, "uploads", storage.SealedPathOf("photos/u1/a.jpg").Replace('/', Path.DirectorySeparatorChar));
        var legacyPath = Path.Combine(_tempRoot, "uploads", "photos", "u1", "a-sealed.jpg");
        Assert.True(File.Exists(sealedPath));

        Assert.True(storage.DeleteByPublicUrl(url));

        Assert.False(File.Exists(sealedPath));
        Assert.False(File.Exists(legacyPath));
    }

    [Fact]
    public async Task DeleteByPublicUrl_NoSealedSiblingOnDisk_StillDeletesTheOriginal()
    {
        // Most deleted files (a business photo, say) never had a sealed sibling at all — the
        // attempt to remove one must be a silent no-op, not a reason the original survives.
        var storage = Build("https://cdn.example.com/uploads");
        var url = await storage.UploadAsync("photos", "u1/a.jpg", [1, 2, 3], "image/jpeg");

        Assert.True(storage.DeleteByPublicUrl(url));
    }
}
