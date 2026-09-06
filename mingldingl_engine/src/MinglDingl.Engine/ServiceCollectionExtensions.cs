using Microsoft.Extensions.DependencyInjection;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddScoped<ScoreService>();
        services.AddScoped<QuestService>();
        services.AddScoped<HonourService>();
        services.AddScoped<ReferralService>();
        services.AddScoped<ShipService>();
        services.AddScoped<EngagementService>();
        services.AddScoped<GhostingService>();
        services.AddScoped<ActivityService>();
        services.AddScoped<MilestoneService>();
        services.AddScoped<AdminAuditService>();
        services.AddScoped<TownSquareService>();
        services.AddScoped<TownSquareEnabledFilter>();
        services.AddScoped<OathService>();
        services.AddScoped<PhoneVerificationService>();
        services.AddScoped<CampaignService>();
        services.AddSingleton<VideoTokenService>();
        services.AddSingleton<PhotoCompressionService>();
        services.AddSingleton<LocalFileStorageService>();
        services.AddSingleton<ConfigService>();
        services.AddSingleton<MembershipCatalog>();
        services.AddSingleton<LoginThrottleService>();

        services.AddScoped<PushNotificationService>();
        services.AddHttpClient(PushDispatchBackgroundService.HttpClientName, client =>
        {
            client.BaseAddress = new Uri("https://exp.host");
            client.Timeout = TimeSpan.FromSeconds(5);
        });
        services.AddSingleton<PushDispatchBackgroundService>();
        services.AddSingleton<IPushDispatcher>(sp => sp.GetRequiredService<PushDispatchBackgroundService>());
        services.AddHostedService<PushDispatchBackgroundService>(sp => sp.GetRequiredService<PushDispatchBackgroundService>());

        services.AddHttpClient<SupabaseBroadcastService>(client => client.Timeout = TimeSpan.FromSeconds(5));

        services.AddHttpClient<VerifyMnClient>(client => client.Timeout = TimeSpan.FromSeconds(10));

        services.AddSingleton<DailyMaintenanceBackgroundService>();
        services.AddHostedService<DailyMaintenanceBackgroundService>(sp => sp.GetRequiredService<DailyMaintenanceBackgroundService>());
        services.AddSingleton<TownSquareSchedulerBackgroundService>();
        services.AddHostedService<TownSquareSchedulerBackgroundService>(sp => sp.GetRequiredService<TownSquareSchedulerBackgroundService>());
        return services;
    }
}
