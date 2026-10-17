using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using Npgsql;

namespace MinglDingl.Engine.Tests.Infrastructure;

/// One throwaway Postgres server per test run (initdb into a temp dir, never the dev database);
/// a fresh database per fixture instance (per test class). Needs the Postgres server binaries:
/// `PG_BIN`, else `pg_config --bindir`, else the newest /usr/lib/postgresql/*/bin.
public sealed class PostgresFixture : IAsyncLifetime
{
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static string? _server;

    public string ConnectionString { get; private set; } = "";

    public async Task InitializeAsync()
    {
        await Gate.WaitAsync();
        try { _server ??= StartServer(); }
        finally { Gate.Release(); }

        ConnectionString = await CreateDatabaseAsync(new NpgsqlConnectionStringBuilder(_server));
    }

    /// A further empty database on the same server, for tests that need a world of their own.
    public Task<string> FreshDatabaseAsync() =>
        CreateDatabaseAsync(new NpgsqlConnectionStringBuilder(_server!) { MaxPoolSize = 20, ConnectionIdleLifetime = 10 });

    public Task DisposeAsync() => Task.CompletedTask;

    private static async Task<string> CreateDatabaseAsync(NpgsqlConnectionStringBuilder b)
    {
        var name = "t_" + Guid.NewGuid().ToString("N");
        await using (var conn = new NpgsqlConnection(_server))
        {
            await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand($"CREATE DATABASE {name}", conn);
            await cmd.ExecuteNonQueryAsync();
        }
        b.Database = name;
        return b.ConnectionString;
    }

    // Every test class and world gets its own database and connection pool on this one server, so it
    // takes many connections; durability is pointless for a throwaway cluster.
    private static string StartServer()
    {
        var bin = BinDir();
        // An earlier run's stopped server (the exit can end before its directory is deleted).
        foreach (var old in Directory.GetDirectories(Path.GetTempPath(), "mingldingl-pg-*"))
            if (!File.Exists(Path.Combine(old, "data", "postmaster.pid")))
                try { Directory.Delete(old, recursive: true); } catch { /* best effort */ }
        var dir = Directory.CreateTempSubdirectory("mingldingl-pg-").FullName;
        var data = Path.Combine(dir, "data");
        var port = FreePort();
        Run(Path.Combine(bin, "initdb"), $"-D \"{data}\" -U postgres -A trust -E UTF8 --no-sync --no-instructions");
        Run(Path.Combine(bin, "pg_ctl"),
            $"-D \"{data}\" -l \"{Path.Combine(dir, "log")}\" -w -o \"-p {port} -k '{dir}' -c listen_addresses=127.0.0.1 " +
            "-c max_connections=1000 -c fsync=off -c synchronous_commit=off -c full_page_writes=off\" start");
        AppDomain.CurrentDomain.ProcessExit += (_, _) =>
        {
            try { Run(Path.Combine(bin, "pg_ctl"), $"-D \"{data}\" -m immediate stop"); } catch { /* already gone */ }
            try { Directory.Delete(dir, recursive: true); } catch { /* the next run sweeps it */ }
        };
        return $"Host=127.0.0.1;Port={port};Username=postgres;Database=postgres";
    }

    private static string BinDir()
    {
        if (Environment.GetEnvironmentVariable("PG_BIN") is { Length: > 0 } env) return env;
        try
        {
            var fromConfig = Run("pg_config", "--bindir").Trim();
            if (File.Exists(Path.Combine(fromConfig, "initdb"))) return fromConfig;
        }
        catch { /* no pg_config */ }
        return Directory.Exists("/usr/lib/postgresql")
            ? Directory.GetDirectories("/usr/lib/postgresql")
                .Select(d => Path.Combine(d, "bin"))
                .Where(d => File.Exists(Path.Combine(d, "initdb")))
                .OrderByDescending(d => int.TryParse(Path.GetFileName(Path.GetDirectoryName(d)), out var v) ? v : 0)
                .FirstOrDefault() ?? throw NoPostgres()
            : throw NoPostgres();
    }

    private static InvalidOperationException NoPostgres() =>
        new("The engine tests start their own Postgres and need its server binaries (initdb, pg_ctl): install postgresql or set PG_BIN.");

    private static int FreePort()
    {
        var l = new TcpListener(IPAddress.Loopback, 0);
        l.Start();
        var port = ((IPEndPoint)l.LocalEndpoint).Port;
        l.Stop();
        return port;
    }

    private static string Run(string file, string args)
    {
        using var p = Process.Start(new ProcessStartInfo(file, args)
        {
            RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false,
        })!;
        var stdout = p.StandardOutput.ReadToEndAsync();
        var stderr = p.StandardError.ReadToEndAsync();
        p.WaitForExit();
        if (p.ExitCode != 0) throw new InvalidOperationException($"{Path.GetFileName(file)} failed: {stderr.Result}{stdout.Result}");
        return stdout.Result;
    }
}
