using Microsoft.Extensions.DependencyInjection;

// Single place to register the app's scoped services, so new services are
// added here instead of growing the list of AddScoped calls in Program.cs.
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
        services.AddSingleton<VideoTokenService>();
        services.AddSingleton<PhotoCompressionService>();
        services.AddSingleton<LocalFileStorageService>();
        services.AddSingleton<ConfigService>();
        services.AddHttpClient<PushNotificationService>();
        services.AddHttpClient<SupabaseBroadcastService>();
        // Registered as its own singleton (not just via AddHostedService, which
        // only makes it resolvable as IHostedService) so DevController can
        // inject the same running instance and trigger a sweep on demand —
        // otherwise the hourly sweep is untestable outside a test harness.
        services.AddSingleton<DailyMaintenanceBackgroundService>();
        services.AddHostedService<DailyMaintenanceBackgroundService>(sp => sp.GetRequiredService<DailyMaintenanceBackgroundService>());
        services.AddSingleton<TownSquareSchedulerBackgroundService>();
        services.AddHostedService<TownSquareSchedulerBackgroundService>(sp => sp.GetRequiredService<TownSquareSchedulerBackgroundService>());
        return services;
    }
}
