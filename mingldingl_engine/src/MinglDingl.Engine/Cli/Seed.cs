using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Dev;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Cli;

/// `dotnet run -- seed <state> [--phone 99xxxxxx]` (Development only). With the fake WeSend (code 000000),
/// signing in with the printed number lands in that state. `seed crowd` puts the 48-person crowd
/// (phones 99100000–99100047) back exactly as Seed/crowd/crowd.json describes it, and their world
/// (WorldSeeder); `seed crowd --phone 99xxxxxx` also gives that finished account a bond at every stage.
public static class Seed
{
    public static async Task RunAsync(WebApplication app, string stateName, string[] args)
    {
        if (!app.Environment.IsDevelopment()) throw new InvalidOperationException("seed runs only in Development");
        var i = Array.IndexOf(args, "--phone");
        var given = i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
        if (stateName == "crowd")
        {
            await using var crowdScope = app.Services.CreateAsyncScope();
            await DatabaseBootstrap.RunAsync(app.Services);
            var crowd = await crowdScope.ServiceProvider.GetRequiredService<CrowdSeeder>().ApplyAsync();
            foreach (var g in crowd.GroupBy(c => c.State == "Onboarding" ? $"Onboarding step {c.Step}" : c.State))
                Console.WriteLine($"{g.Key,-20} {string.Join(", ", g.Select(c => $"{c.Phone} {c.Name}{(c.Edge is null ? "" : $" [{c.Edge}]")}"))}");
            // --phone: that finished account is the hero, with a bond at every stage.
            Guid? hero = given is null ? null : await crowdScope.ServiceProvider.GetRequiredService<AppDb>()
                .Set<Features.Auth.Account>().Where(a => a.Phone == given).Select(a => (Guid?)a.Id).SingleOrDefaultAsync();
            if (given is not null && hero is null) Console.Error.WriteLine($"No account {given}: seed it first (seed Finished --phone {given})");
            Console.WriteLine("World".PadRight(21) + await crowdScope.ServiceProvider.GetRequiredService<WorldSeeder>().ApplyAsync(crowd, hero));
            return;
        }
        if (!Enum.TryParse<SeedState>(stateName, ignoreCase: true, out var state))
        {
            Console.Error.WriteLine($"Unknown state. One of: {string.Join(", ", Enum.GetNames<SeedState>())}");
            Environment.ExitCode = 1;
            return;
        }
        var phone = given ?? "99" + Random.Shared.Next(0, 1_000_000).ToString("D6");

        await using var scope = app.Services.CreateAsyncScope();
        await DatabaseBootstrap.RunAsync(app.Services);
        var seeder = scope.ServiceProvider.GetRequiredService<DevSeeder>();
        var id = await seeder.EnsureAccountAsync(phone);
        await seeder.ApplyAsync(id, state);
        Console.WriteLine($"{state}: phone {phone} (account {id})");
    }
}
