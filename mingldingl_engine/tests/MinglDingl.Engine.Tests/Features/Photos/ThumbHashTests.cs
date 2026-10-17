using System.Text.Json;
using FluentAssertions;
using MinglDingl.Engine.Features.Photos;
using MinglDingl.Engine.Tests.Infrastructure;

namespace MinglDingl.Engine.Tests.Features.Photos;

public class ThumbHashTests
{
    private sealed record Case(string Name, int W, int H, string Rgba, string Hash);

    [Fact]
    public void ThumbHash_matches_reference_library()
    {
        var cases = JsonSerializer.Deserialize<List<Case>>(File.ReadAllText(PhotoDriver.Fixture("thumbhash-expected.json")),
            new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        cases.Should().HaveCount(3);
        foreach (var c in cases)
            Convert.ToBase64String(ThumbHash.FromRgba(c.W, c.H, Convert.FromBase64String(c.Rgba)))
                .Should().Be(c.Hash, c.Name);
    }
}
