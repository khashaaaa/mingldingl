using System.ComponentModel.DataAnnotations;

public record AdminLoginRequest(
    [Required, MaxLength(FieldLimits.ShortLabel)] string Username,
    [Required, MaxLength(FieldLimits.Password)] string Password);

public record AdminLoginResponse(string Token, DateTime ExpiresAt);
