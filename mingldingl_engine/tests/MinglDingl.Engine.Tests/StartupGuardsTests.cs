using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace MinglDingl.Engine.Tests;

/// <summary>
/// <c>StartupGuards.RequireProductionConfig</c> is what refuses to boot outside Development without
/// <c>VerifyMn:ApiKey</c> — the same shape as <c>Cors:AllowedOrigins</c>'s own startup guard. Without
/// it, phone ownership goes unproven and the client-writable JWT <c>user_metadata.phone</c> fallback
/// becomes trusted again, which is exactly how anyone could become anyone.
/// </summary>
public class StartupGuardsTests
{
    private static readonly IHostEnvironment Production =
        new TestHostEnvironment { EnvironmentName = Environments.Production };

    private static IConfiguration Build(Dictionary<string, string?> values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values).Build();

    private static Dictionary<string, string?> ValidConfig() => new()
    {
        ["VerifyMn:ApiKey"] = "test-verifymn-key",
        ["Supabase:ProjectUrl"] = "https://test.supabase.co",
        ["Admin:Username"] = "admin",
        ["Admin:PasswordHash"] = "some-hash",
        ["Admin:JwtSigningKey"] = new string('a', 32),
    };

    [Fact]
    public void OutsideDevelopment_MissingVerifyMnApiKey_Throws()
    {
        var config = ValidConfig();
        config["VerifyMn:ApiKey"] = "";

        var ex = Assert.Throws<InvalidOperationException>(
            () => StartupGuards.RequireProductionConfig(Build(config), Production));

        Assert.Contains("VerifyMn:ApiKey", ex.Message);
        Assert.Contains("must be configured outside Development", ex.Message);
    }

    [Fact]
    public void OutsideDevelopment_MissingVerifyMnApiKey_WhitespaceOnly_Throws()
    {
        var config = ValidConfig();
        config["VerifyMn:ApiKey"] = "   ";

        var ex = Assert.Throws<InvalidOperationException>(
            () => StartupGuards.RequireProductionConfig(Build(config), Production));

        Assert.Contains("VerifyMn:ApiKey", ex.Message);
    }

    [Fact]
    public void OutsideDevelopment_AllRequiredConfigPresent_DoesNotThrow()
    {
        var ex = Record.Exception(
            () => StartupGuards.RequireProductionConfig(Build(ValidConfig()), Production));

        Assert.Null(ex);
    }

    [Fact]
    public void Development_MissingVerifyMnApiKey_StaysInert()
    {
        var config = ValidConfig();
        config["VerifyMn:ApiKey"] = "";

        var ex = Record.Exception(() => StartupGuards.RequireProductionConfig(
            Build(config), TestHostEnvironment.Development));

        Assert.Null(ex);
    }

    [Fact]
    public void Development_NoConfigAtAll_StaysInert()
    {
        var ex = Record.Exception(() => StartupGuards.RequireProductionConfig(
            Build(new Dictionary<string, string?>()), TestHostEnvironment.Development));

        Assert.Null(ex);
    }
}
