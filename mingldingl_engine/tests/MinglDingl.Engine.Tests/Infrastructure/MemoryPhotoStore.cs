using System.Collections.Concurrent;
using MinglDingl.Engine.Kernel.Storage;

namespace MinglDingl.Engine.Tests.Infrastructure;

public sealed class MemoryPhotoStore : IPhotoStore
{
    public ConcurrentDictionary<string, byte[]> Files { get; } = new();
    private int _signs;

    public async Task PutAsync(string path, Stream jpeg, CancellationToken ct = default)
    {
        using var ms = new MemoryStream();
        await jpeg.CopyToAsync(ms, ct);
        Files[path] = ms.ToArray();
    }

    public Task DeleteAsync(string path, CancellationToken ct = default)
    {
        Files.TryRemove(path, out _);
        return Task.CompletedTask;
    }

    public Task<byte[]> GetAsync(string path, CancellationToken ct = default) => Task.FromResult(Files[path]);

    public Task<string> SignAsync(string path, TimeSpan ttl, CancellationToken ct = default) =>
        Task.FromResult($"https://storage.test/{path}?sig={Interlocked.Increment(ref _signs)}");
}
