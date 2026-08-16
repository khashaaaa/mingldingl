public record AdminLoginRequest(string Username, string Password);

public record AdminLoginResponse(string Token, DateTime ExpiresAt);
