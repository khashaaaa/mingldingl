using System.Collections.Concurrent;
using System.Text.Json.Serialization;
using MinglDingl.Engine.Features.Membership;

namespace MinglDingl.Engine.Features.Payments;

/// The store's side (Google Play, later the App Store) as RevenueCat holds it. The app logs in to
/// RevenueCat with the account id, so a subscriber is always one of our accounts.
public interface IRevenueCat
{
    Task<IReadOnlyList<StoreEntitlement>> EntitlementsAsync(Guid accountId, CancellationToken ct);
}

public sealed class RevenueCatSettings
{
    /// RevenueCat's secret API key (REST v1).
    public string SecretKey { get; init; } = "";
    /// The Authorization header RevenueCat sends with every webhook.
    public string WebhookAuth { get; init; } = "";
}

public sealed class RevenueCatClient(HttpClient http) : IRevenueCat
{
    /// Entitlement ids configured in RevenueCat, one per paid floor.
    public static Floor? FloorOf(string entitlement) => entitlement switch
    {
        "hall" => Floor.Hall,
        "high_table" => Floor.HighTable,
        _ => null,
    };

    public async Task<IReadOnlyList<StoreEntitlement>> EntitlementsAsync(Guid accountId, CancellationToken ct)
    {
        var body = await http.GetFromJsonAsync<SubscriberResponse>($"subscribers/{accountId}", ct);
        var s = body?.Subscriber;
        if (s?.Entitlements is null) return [];
        var list = new List<StoreEntitlement>();
        foreach (var (id, e) in s.Entitlements)
        {
            if (FloorOf(id) is not { } floor || e.ExpiresDate is not { } expires) continue;
            var sub = s.Subscriptions?.GetValueOrDefault(e.ProductIdentifier ?? "");
            var refunded = sub?.RefundedAt is not null;
            list.Add(new StoreEntitlement(floor, e.ProductIdentifier ?? id, e.PurchaseDate ?? expires,
                refunded && sub!.RefundedAt < expires ? sub.RefundedAt.Value : expires,
                sub is not null && sub.UnsubscribeDetectedAt is null && !refunded, refunded));
        }
        return list;
    }

    private sealed record SubscriberResponse([property: JsonPropertyName("subscriber")] Subscriber? Subscriber);

    private sealed record Subscriber(
        [property: JsonPropertyName("entitlements")] Dictionary<string, EntitlementRow>? Entitlements,
        [property: JsonPropertyName("subscriptions")] Dictionary<string, SubscriptionRow>? Subscriptions);

    private sealed record EntitlementRow(
        [property: JsonPropertyName("expires_date")] DateTimeOffset? ExpiresDate,
        [property: JsonPropertyName("purchase_date")] DateTimeOffset? PurchaseDate,
        [property: JsonPropertyName("product_identifier")] string? ProductIdentifier);

    private sealed record SubscriptionRow(
        [property: JsonPropertyName("unsubscribe_detected_at")] DateTimeOffset? UnsubscribeDetectedAt,
        [property: JsonPropertyName("refunded_at")] DateTimeOffset? RefundedAt);
}

/// Development and tests: what each account "bought in the store".
public sealed class FakeRevenueCat : IRevenueCat
{
    public ConcurrentDictionary<Guid, List<StoreEntitlement>> Accounts { get; } = new();

    public Task<IReadOnlyList<StoreEntitlement>> EntitlementsAsync(Guid accountId, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<StoreEntitlement>>(Accounts.TryGetValue(accountId, out var l) ? [.. l] : []);
}
