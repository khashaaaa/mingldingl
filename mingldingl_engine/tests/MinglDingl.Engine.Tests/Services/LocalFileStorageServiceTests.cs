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
        return new LocalFileStorageService(env.Object, config);
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
}
