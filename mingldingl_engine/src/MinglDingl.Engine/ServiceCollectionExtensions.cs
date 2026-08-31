using Microsoft.Extensions.DependencyInjection;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddScoped<ScoreService>();
        services.AddScoped<QuestService>();
        services.AddScoped<LootService>();
        services.AddScoped<ReferralService>();
        services.AddScoped<ShipService>();
        services.AddScoped<EngagementService>();
        services.AddScoped<GhostingService>();
        services.AddScoped<ActivityService>();
        services.AddScoped<MilestoneService>();
        services.AddScoped<AdminAuditService>();
        services.AddScoped<TownSquareService>();
        services.AddScoped<OathService>();
        services.AddSingleton<VideoTokenService>();
        services.AddSingleton<PhotoCompressionService>();
        services.AddSingleton<LocalFileStorageService>();
        services.AddSingleton<ConfigService>();

        services.AddHttpClient<PushNotificationService>(client => client.Timeout = TimeSpan.FromSeconds(5));

        services.AddHttpClient<SupabaseBroadcastService>(client => client.Timeout = TimeSpan.FromSeconds(5));

        services.AddSingleton<DailyMaintenanceBackgroundService>();
        services.AddHostedService<DailyMaintenanceBackgroundService>(sp => sp.GetRequiredService<DailyMaintenanceBackgroundService>());
        services.AddSingleton<TownSquareSchedulerBackgroundService>();
        services.AddHostedService<TownSquareSchedulerBackgroundService>(sp => sp.GetRequiredService<TownSquareSchedulerBackgroundService>());
        return services;
    }
}
