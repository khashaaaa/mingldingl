using Microsoft.Extensions.Configuration;

namespace MinglDingl.Engine.Tests;

public class CorsOriginsTests
{
    private static IConfiguration Build(Dictionary<string, string?> values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values).Build();

    [Fact]
    public void Parse_CommaSeparatedScalar_SplitsAndTrimsEachOrigin()
    {
        var config = Build(new() { ["Cors:AllowedOrigins"] = "https://app.example.com, https://admin.example.com ," });

        var origins = CorsOrigins.Parse(config);

        Assert.Equal(["https://app.example.com", "https://admin.example.com"], origins);
    }

    [Fact]
    public void Parse_IndexedArray_ReadsEveryChild()
    {
        var config = Build(new()
        {
            ["Cors:AllowedOrigins:0"] = "https://app.example.com",
            ["Cors:AllowedOrigins:1"] = "https://admin.example.com",
        });

        Assert.Equal(["https://app.example.com", "https://admin.example.com"], CorsOrigins.Parse(config));
    }

    [Fact]
    public void Parse_Unset_ReturnsEmpty()
    {
        Assert.Empty(CorsOrigins.Parse(Build(new())));
    }
}
