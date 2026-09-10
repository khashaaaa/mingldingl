using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

/// <summary>
/// Config that must be present outside Development or the engine refuses to boot, the same way
/// <c>Cors:AllowedOrigins</c> already does. These do not fail loudly when unset — they fail open,
/// which is worse. Without <c>VerifyMn:ApiKey</c> the engine stops requiring proof of phone
/// ownership at all and falls back to the JWT's client-written <c>user_metadata.phone</c>, which is
/// exactly how anyone could become anyone; without the Admin pair the panel is simply unreachable
/// but the reason only surfaces as a 401 at login.
/// </summary>
public static class StartupGuards
{
    public static void RequireProductionConfig(IConfiguration configuration, IHostEnvironment environment)
    {
        if (environment.IsDevelopment()) return;

        foreach (var required in new[] { "VerifyMn:ApiKey", "Supabase:ProjectUrl", "Admin:Username", "Admin:PasswordHash" })
            if (string.IsNullOrWhiteSpace(configuration[required]))
                throw new InvalidOperationException($"{required} must be configured outside Development.");

        // HmacSha256 needs 256 bits of key. A shorter one is accepted here and then throws on the
        // first admin login instead, which reads as a server fault rather than a misconfiguration.
        var adminSigningKey = configuration["Admin:JwtSigningKey"];
        if (adminSigningKey is null || System.Text.Encoding.UTF8.GetByteCount(adminSigningKey) < 32)
            throw new InvalidOperationException(
                "Admin:JwtSigningKey must be configured outside Development and be at least 32 bytes.");
    }
}
