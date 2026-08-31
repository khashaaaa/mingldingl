using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

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

            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.CoreEventId.ManyServiceProvidersCreatedWarning))
            .Options;

        Db = new AppDbContext(options);
        _transaction = await Db.Database.BeginTransactionAsync();
    }

    public async Task DisposeAsync()
    {
        await _transaction.RollbackAsync();
        await Db.DisposeAsync();

        await _dataSource.DisposeAsync();
    }

    protected static SupabaseBroadcastService BuildTestBroadcast()
    {
        var httpClient = new HttpClient();
        var mockConfig = new Moq.Mock<Microsoft.Extensions.Configuration.IConfiguration>();
        mockConfig.Setup(c => c["Supabase:ProjectUrl"]).Returns("https://test.supabase.co");
        mockConfig.Setup(c => c["Supabase:SecretKey"]).Returns("test-key");
        return new SupabaseBroadcastService(httpClient, mockConfig.Object, NullLogger<SupabaseBroadcastService>.Instance);
    }

    protected PushNotificationService BuildTestPush() =>
        new(new HttpClient(), Db, NullLogger<PushNotificationService>.Instance);

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
        return (new SupabaseBroadcastService(httpClient, mockConfig.Object, NullLogger<SupabaseBroadcastService>.Instance), handler);
    }

    protected static UsersController NewUsersController(
        AppDbContext db, OathService oaths, Microsoft.AspNetCore.Http.HttpContext httpContext)
    {
        var score = new ScoreService(db, new ConfigService());
        var loot = new LootService(db, score, NullLogger<LootService>.Instance);
        var ships = new ShipService(db, loot, score, new ConfigService(),
            new MilestoneService(db, NullLogger<MilestoneService>.Instance), new PushNotificationService(new HttpClient(), db, NullLogger<PushNotificationService>.Instance), BuildTestBroadcast(), NullLogger<ShipService>.Instance);
        var controller = new UsersController(db, score, new ReferralService(db, loot, NullLogger<ReferralService>.Instance), ships, oaths);
        controller.ControllerContext = new Microsoft.AspNetCore.Mvc.ControllerContext { HttpContext = httpContext };
        return controller;
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
