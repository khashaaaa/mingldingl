using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Dev;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Cli;

/// `dotnet run -- seed <state> [--phone 99xxxxxx]` (Development only). With the fake verify.mn,
/// signing in with the printed number lands in that state. `seed crowd` puts the 48-person crowd
/// (phones 99100000–99100047) back exactly as Seed/crowd/crowd.json describes it.
public static class Seed
{
    public static async Task RunAsync(WebApplication app, string stateName, string[] args)
    {
        if (!app.Environment.IsDevelopment()) throw new InvalidOperationException("seed runs only in Development");
        if (stateName == "crowd")
        {
            await using var crowdScope = app.Services.CreateAsyncScope();
            await DatabaseBootstrap.RunAsync(app.Services);
            var crowd = await crowdScope.ServiceProvider.GetRequiredService<CrowdSeeder>().ApplyAsync();
            foreach (var g in crowd.GroupBy(c => c.State == "Onboarding" ? $"Onboarding step {c.Step}" : c.State))
                Console.WriteLine($"{g.Key,-20} {string.Join(", ", g.Select(c => $"{c.Phone} {c.Name}{(c.Edge is null ? "" : $" [{c.Edge}]")}"))}");
            return;
        }
        if (!Enum.TryParse<SeedState>(stateName, ignoreCase: true, out var state))
        {
            Console.Error.WriteLine($"Unknown state. One of: {string.Join(", ", Enum.GetNames<SeedState>())}");
            Environment.ExitCode = 1;
            return;
        }
        var i = Array.IndexOf(args, "--phone");
        var phone = i >= 0 && i + 1 < args.Length ? args[i + 1] : "99" + Random.Shared.Next(0, 1_000_000).ToString("D6");

        await using var scope = app.Services.CreateAsyncScope();
        await DatabaseBootstrap.RunAsync(app.Services);
        var seeder = scope.ServiceProvider.GetRequiredService<DevSeeder>();
        var id = await seeder.EnsureAccountAsync(phone);
        await seeder.ApplyAsync(id, state);
        Console.WriteLine($"{state}: phone {phone} (account {id})");
    }
}
