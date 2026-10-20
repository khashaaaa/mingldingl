using System.Text.Json;
using System.Text.RegularExpressions;
using FluentAssertions;

namespace MinglDingl.Engine.Tests.Kernel;

/// The app shows a rule as its `error.<code>` line (tError), so every code a dater can meet needs one
/// in en.json — otherwise a Mongolian reader gets the engine's English. Admin, internal and
/// session-handling codes never reach a dater's screen and are named here instead.
public class ErrorLinesTests
{
    private static readonly HashSet<string> NeverShownToADater =
    [
        "admin.bad_action", "admin.bad_cursor", "admin.bad_login", "admin.bad_status", "admin.login_throttled",
        "admin.report_not_found", "admin.report_resolved", "admin.user_not_found", "admin.already_suspended", "admin.not_suspended",
        "admin.busy", "admin.bad_field", "admin.bad_floor", "admin.not_barred", "square.started", "square.seats_taken",
        "auth.invalid_refresh", "auth.reused", "auth.revoked", // the session layer signs out instead
        "block.self", "report.not_found", "report.self", "push.token", "photos.key", "profile.locale",
        "codex.locale", "codex.not_found", "config.bad_value", "config.out_of_bounds", "config.unknown",
        "festival.dates", "festival.not_found", "square.past", "stats.group", "stats.metric", "stats.range",
        "venue.district", "venue.kind", "venue.photo_not_found", "venue.photos_full",
        // the Guild House web page (its own words.ts)
        "guild.no_character", "payments.not_found", "payments.refund_by_hand", "payments.settled",
    ];

    [Fact]
    public void Every_rule_a_dater_can_meet_has_an_app_line()
    {
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root is not null && !Directory.Exists(Path.Combine(root.FullName, "mingldingl_app"))) root = root.Parent;
        root.Should().NotBeNull("the tests run inside the repository");
        var engine = Path.Combine(root!.FullName, "mingldingl_engine", "src", "MinglDingl.Engine");
        var codes = Directory.EnumerateFiles(engine, "*.cs", SearchOption.AllDirectories)
            .Where(f => !f.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}"))
            .SelectMany(f => Regex.Matches(File.ReadAllText(f), @"DomainException\(\s*\d+\s*,\s*""([^""]+)""").Select(m => m.Groups[1].Value))
            .ToHashSet();
        using var en = JsonDocument.Parse(File.ReadAllText(Path.Combine(root.FullName, "mingldingl_app", "src", "lib", "i18n", "en.json")));
        var lines = en.RootElement.EnumerateObject().Select(p => p.Name).ToHashSet();

        codes.Where(c => !NeverShownToADater.Contains(c) && !lines.Contains($"error.{c}")).Should().BeEmpty();
        NeverShownToADater.Where(c => !codes.Contains(c)).Should().BeEmpty("a code that no longer exists leaves this list");
    }
}
