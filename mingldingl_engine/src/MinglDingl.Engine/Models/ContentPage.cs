// Admin-editable static content (Terms of Service, Privacy Policy, in-app
// Guides) served to the app instead of baked into the client bundle, so it
// can change without an app-store release. No admin UI yet — this is just
// the data, seeded via migration, the same "data now, dashboard later"
// pattern as MembershipPurchases.
public class ContentPage
{
    public Guid Id { get; set; }
    public string Slug { get; set; } = ""; // "terms" | "privacy" | "guides"
    public string TitleEn { get; set; } = "";
    public string TitleMn { get; set; } = "";
    public string BodyEn { get; set; } = "";
    public string BodyMn { get; set; } = "";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
