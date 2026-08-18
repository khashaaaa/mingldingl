using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;

namespace MinglDingl.Engine.Tests.Integration;

// Runs against the real dev Postgres database the engine actually talks to
// (not mocked/in-memory) inside a transaction that's always rolled back on
// teardown, so these tests exercise genuine Postgres behavior — jsonb
// (de)serialization, FK constraints, unique/identity behavior — without
// permanently writing test rows into the shared dev database.
//
// Existing mocked/in-memory unit tests missed several real bugs this
// session (missing EnableDynamicJson for jsonb columns, Add-vs-Update on
// new entities, a missing idempotency guard) precisely because none of
// those failure modes exist in a mock. These tests target that gap.
public abstract class IntegrationTestBase : IAsyncLifetime
{
    private const string ConnectionString =
        "Host=127.0.0.1;Database=mingldingl;Username=postgres;Password=1234;Port=5432";

    protected AppDbContext Db { get; private set; } = null!;
    private IDbContextTransaction _transaction = null!;
    private NpgsqlDataSource _dataSource = null!;

    public async Task InitializeAsync()
    {
        var dataSourceBuilder = new NpgsqlDataSourceBuilder(ConnectionString);
        dataSourceBuilder.EnableDynamicJson();
        _dataSource = dataSourceBuilder.Build();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(_dataSource)
            // Each test class intentionally builds its own DataSource/DbContext for
            // transaction-per-test isolation, which is exactly the pattern EF Core's
            // ManyServiceProvidersCreatedWarning is designed to flag as an error past
            // ~20 instances. That's a real cost concern for production code reusing a
            // single AddDbContext registration (Program.cs isn't affected), but here
            // it's by design, so suppress it rather than throw.
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.CoreEventId.ManyServiceProvidersCreatedWarning))
            .Options;

        Db = new AppDbContext(options);
        _transaction = await Db.Database.BeginTransactionAsync();
    }

    public async Task DisposeAsync()
    {
        await _transaction.RollbackAsync();
        await Db.DisposeAsync();
        // Db.DisposeAsync() does not dispose the NpgsqlDataSource it was built
        // on — each test builds its own dedicated one (see InitializeAsync),
        // so leaving this undisposed leaked a whole connection pool per test.
        // With enough tests in one run that alone was enough to exhaust
        // Postgres's max_connections ("too many clients already").
        await _dataSource.DisposeAsync();
    }

    // Same mocked-config, real-HttpClient shape as
    // EngagementControllerIntegrationTests.BuildController — the POST to
    // test.supabase.co fails (unresolvable host) but BroadcastAsync's
    // best-effort try/catch swallows it, so tests just eat that latency
    // rather than needing a fake IHttpClientFactory.
    protected static SupabaseBroadcastService BuildTestBroadcast()
    {
        var httpClient = new HttpClient();
        var mockConfig = new Moq.Mock<Microsoft.Extensions.Configuration.IConfiguration>();
        mockConfig.Setup(c => c["Supabase:ProjectUrl"]).Returns("https://test.supabase.co");
        mockConfig.Setup(c => c["Supabase:SecretKey"]).Returns("test-key");
        return new SupabaseBroadcastService(httpClient, mockConfig.Object);
    }

    // A capturing HttpMessageHandler in place of the real network call, so a
    // test can assert exactly what topic/event/payload a code path pushed to
    // Supabase Broadcast without depending on test.supabase.co actually
    // resolving (BuildTestBroadcast's failure is silent by design — fine for
    // "did the surrounding action still succeed", useless for "did it
    // actually try to broadcast the right thing").
    protected sealed class RecordingHandler : System.Net.Http.HttpMessageHandler
    {
        public string? LastRequestBody { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastRequestBody = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(System.Net.HttpStatusCode.OK);
        }
    }

    protected static (SupabaseBroadcastService Broadcast, RecordingHandler Handler) BuildCapturingBroadcast()
    {
        var handler = new RecordingHandler();
        var httpClient = new HttpClient(handler);
        var mockConfig = new Moq.Mock<Microsoft.Extensions.Configuration.IConfiguration>();
        mockConfig.Setup(c => c["Supabase:ProjectUrl"]).Returns("https://test.supabase.co");
        mockConfig.Setup(c => c["Supabase:SecretKey"]).Returns("test-key");
        return (new SupabaseBroadcastService(httpClient, mockConfig.Object), handler);
    }

    protected static User NewCompleteUser(Guid? id = null) => new()
    {
        Id = id ?? Guid.NewGuid(),
        DisplayName = "Integration Test User",
        Age = 30,
        Gender = "Female",
        City = "Ulaanbaatar",
        Bio = "Created by an integration test",
        PhotoUrls = ["https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg"],
    };
}
