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
    private readonly List<NpgsqlDataSource> _extraDataSources = [];

    private static NpgsqlDataSource BuildDataSource()
    {
        var builder = new NpgsqlDataSourceBuilder(ConnectionString);
        builder.EnableDynamicJson();
        return builder.Build();
    }

    private static AppDbContext BuildContext(NpgsqlDataSource dataSource) =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(dataSource)
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.CoreEventId.ManyServiceProvidersCreatedWarning))
            .Options);

    /// <summary>
    /// A context outside the per-test rollback transaction, for the rare code path that opens a
    /// transaction of its own and so cannot run nested inside one. Whatever a test writes through it
    /// is really committed, so the test owns the cleanup.
    /// </summary>
    protected AppDbContext NewUncommittedContext()
    {
        var dataSource = BuildDataSource();
        _extraDataSources.Add(dataSource);
        return BuildContext(dataSource);
    }

    public async Task InitializeAsync()
    {
        _dataSource = BuildDataSource();
        Db = BuildContext(_dataSource);
        _transaction = await Db.Database.BeginTransactionAsync();
    }

    public async Task DisposeAsync()
    {
        await _transaction.RollbackAsync();
        await Db.DisposeAsync();

        await _dataSource.DisposeAsync();
        foreach (var extra in _extraDataSources)
            await extra.DisposeAsync();
    }

    protected static SupabaseBroadcastService BuildTestBroadcast()
    {
        var httpClient = new HttpClient();
        var mockConfig = new Moq.Mock<Microsoft.Extensions.Configuration.IConfiguration>();
        mockConfig.Setup(c => c["Supabase:ProjectUrl"]).Returns("https://test.supabase.co");
        mockConfig.Setup(c => c["Supabase:SecretKey"]).Returns("test-key");
        return new SupabaseBroadcastService(httpClient, mockConfig.Object, NullLogger<SupabaseBroadcastService>.Instance);
    }

    /// <summary>
    /// A push service whose delivery runs inline (no background loop) so a test can assert on the
    /// Expo request the moment <c>NotifyUserAsync</c> returns. By default Expo answers 200 with no
    /// tickets and nothing leaves the process.
    /// </summary>
    protected static PushNotificationService BuildTestPush(AppDbContext db, HttpMessageHandler? handler = null) =>
        new(db, new InlinePushDispatcher(BuildPushDispatch(db, handler)));

    protected PushNotificationService BuildTestPush() => BuildTestPush(Db);

    protected PushNotificationService BuildTestPush(HttpMessageHandler handler) => BuildTestPush(Db, handler);

    /// <summary>A push service whose Expo POST bodies are captured instead of sent.</summary>
    protected (PushNotificationService Push, RecordingHandler Handler) BuildCapturingPush()
    {
        var handler = new RecordingHandler();
        return (BuildTestPush(Db, handler), handler);
    }

    /// <summary>The production dispatcher, with Expo replaced by <paramref name="handler"/> and token pruning aimed at <paramref name="db"/>.</summary>
    protected static PushDispatchBackgroundService BuildPushDispatch(AppDbContext db, HttpMessageHandler? handler = null)
    {
        var provider = new Microsoft.Extensions.DependencyInjection.ServiceCollection();
        Microsoft.Extensions.DependencyInjection.ServiceCollectionServiceExtensions.AddSingleton(provider, db);
        return new PushDispatchBackgroundService(
            new SingleClientFactory(new HttpClient(handler ?? new RecordingHandler()) { BaseAddress = new Uri("https://exp.host") }),
            new SingleProviderScopeFactory(Microsoft.Extensions.DependencyInjection.ServiceCollectionContainerBuilderExtensions.BuildServiceProvider(provider)),
            NullLogger<PushDispatchBackgroundService>.Instance);
    }

    protected sealed class InlinePushDispatcher : IPushDispatcher
    {
        private readonly PushDispatchBackgroundService _service;
        public InlinePushDispatcher(PushDispatchBackgroundService service) => _service = service;
        public ValueTask DispatchAsync(PushEnvelope envelope, CancellationToken ct = default) =>
            new(_service.DeliverAsync(envelope, ct));
    }

    private sealed class SingleClientFactory : IHttpClientFactory
    {
        private readonly HttpClient _client;
        public SingleClientFactory(HttpClient client) => _client = client;
        public HttpClient CreateClient(string name) => _client;
    }

    /// <summary>Hands every scope the same provider, so a background service resolves the test's own <c>Db</c>.</summary>
    protected sealed class SingleProviderScopeFactory : Microsoft.Extensions.DependencyInjection.IServiceScopeFactory
    {
        private readonly IServiceProvider _provider;
        public SingleProviderScopeFactory(IServiceProvider provider) => _provider = provider;
        public Microsoft.Extensions.DependencyInjection.IServiceScope CreateScope() => new NonDisposingScope(_provider);

        private sealed class NonDisposingScope : Microsoft.Extensions.DependencyInjection.IServiceScope
        {
            public NonDisposingScope(IServiceProvider provider) => ServiceProvider = provider;
            public IServiceProvider ServiceProvider { get; }
            public void Dispose() { }
        }
    }

    protected async Task<string> RegisterPushTokenAsync(Guid userId)
    {
        string token = $"ExponentPushToken[{userId:N}]";
        Db.PushTokens.Add(new PushToken { Id = Guid.NewGuid(), UserId = userId, Token = token, Platform = "ios" });
        await Db.SaveChangesAsync();
        return token;
    }

    protected sealed class RecordingHandler : System.Net.Http.HttpMessageHandler
    {
        public string? LastRequestBody { get; private set; }
        public List<string> RequestBodies { get; } = [];
        public int RequestCount { get; private set; }
        /// <summary>Scripted reply; defaults to an empty 200.</summary>
        public Func<HttpRequestMessage, HttpResponseMessage>? Respond { get; init; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestCount++;
            LastRequestBody = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
            if (LastRequestBody is not null) RequestBodies.Add(LastRequestBody);
            return Respond is null ? new HttpResponseMessage(System.Net.HttpStatusCode.OK) : Respond(request);
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

    /// <summary>Phone verification with no API key configured — enforcement is inert.</summary>
    protected static PhoneVerificationService BuildUnconfiguredPhoneVerification(AppDbContext db)
    {
        var config = new Moq.Mock<Microsoft.Extensions.Configuration.IConfiguration>().Object;
        var client = new VerifyMnClient(new HttpClient(), config, NullLogger<VerifyMnClient>.Instance);
        return new PhoneVerificationService(db, client, config, NullLogger<PhoneVerificationService>.Instance);
    }

    /// <summary>File storage rooted at a throwaway temp directory.</summary>
    protected static LocalFileStorageService BuildTestStorage()
    {
        var env = new Moq.Mock<Microsoft.AspNetCore.Hosting.IWebHostEnvironment>();
        var root = Path.Combine(Path.GetTempPath(), "mingldingl-tests", Guid.NewGuid().ToString("N"));
        env.SetupGet(e => e.ContentRootPath).Returns(root);
        var config = new Moq.Mock<Microsoft.Extensions.Configuration.IConfiguration>().Object;
        return new LocalFileStorageService(env.Object, config, NullLogger<LocalFileStorageService>.Instance);
    }

    /// <summary>
    /// A storage service that records the URLs it was asked to unlink instead of touching disk,
    /// so a test can assert on <em>when</em> deletion happens relative to validation.
    /// </summary>
    protected static LocalFileStorageService BuildRecordingStorage(List<string> deleted)
    {
        var env = new Moq.Mock<Microsoft.AspNetCore.Hosting.IWebHostEnvironment>();
        env.SetupGet(e => e.ContentRootPath).Returns(Path.Combine(Path.GetTempPath(), "mingldingl-tests", Guid.NewGuid().ToString("N")));
        var config = new Moq.Mock<Microsoft.Extensions.Configuration.IConfiguration>().Object;
        var mock = new Moq.Mock<LocalFileStorageService>(env.Object, config, NullLogger<LocalFileStorageService>.Instance) { CallBase = true };
        mock.Setup(m => m.DeleteByPublicUrl(Moq.It.IsAny<string?>()))
            .Callback<string?>(url => { if (url is not null) deleted.Add(url); })
            .Returns(true);
        return mock.Object;
    }

    protected static UsersController NewUsersController(
        AppDbContext db, OathService oaths, Microsoft.AspNetCore.Http.HttpContext httpContext)
    {
        var score = new ScoreService(db, new ConfigService());
        var loot = new HonourService(db, NullLogger<HonourService>.Instance);
        var ships = new ShipService(db, loot, score, new ConfigService(),
            new MilestoneService(db, NullLogger<MilestoneService>.Instance), BuildTestPush(db), BuildTestBroadcast(), NullLogger<ShipService>.Instance);
        var controller = new UsersController(db, score, new ReferralService(db, loot, NullLogger<ReferralService>.Instance), ships, oaths, BuildUnconfiguredPhoneVerification(db), BuildTestStorage(), new ConfigService());
        controller.ControllerContext = new Microsoft.AspNetCore.Mvc.ControllerContext { HttpContext = httpContext };
        return controller;
    }

    protected static User NewCompleteUser(Guid? id = null, string gender = "Female") => new()
    {
        Id = id ?? Guid.NewGuid(),
        DisplayName = "Integration Test User",
        Age = 30,
        Gender = gender,
        City = "Ulaanbaatar",
        Bio = "Created by an integration test",
        PhotoUrls = ["https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg"],
    };
}
