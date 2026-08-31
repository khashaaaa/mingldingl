public class ContentPage
{
    public Guid Id { get; set; }
    public string Slug { get; set; } = "";
    public string TitleEn { get; set; } = "";
    public string TitleMn { get; set; } = "";
    public string BodyEn { get; set; } = "";
    public string BodyMn { get; set; } = "";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
