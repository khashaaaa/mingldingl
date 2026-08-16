public class PushToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Token { get; set; } = "";     // Expo push token, e.g. "ExponentPushToken[...]"
    public string Platform { get; set; } = "";  // ios|android
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
