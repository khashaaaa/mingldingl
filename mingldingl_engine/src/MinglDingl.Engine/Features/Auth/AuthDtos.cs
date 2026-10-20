using System.ComponentModel.DataAnnotations;
using MinglDingl.Engine.Kernel.Validation;

namespace MinglDingl.Engine.Features.Auth;

/// locale: the language the code's text is in (mn | en, default mn).
public sealed record StartRequest(
    [Required, StringLength(FieldLimits.Phone)] string Phone,
    Guid? ResumeVerificationId,
    [StringLength(2)] string? Locale = null);

/// resendAt: when another code may be asked for this number.
public sealed record StartResponse(Guid VerificationId, DateTimeOffset ExpiresAt, DateTimeOffset ResendAt);

public sealed record CheckRequest(Guid VerificationId, [Required, StringLength(FieldLimits.SmsCode)] string Code);

/// state: verified (a wrong, spent or old code is an error instead)
public sealed record CheckResponse(string State);

/// allyCode: the call that brought a new traveller (from a shared link), if any.
/// deviceKey: the app's install id (Android ID / iOS vendor id); stored only as a hash.
public sealed record CompleteRequest(
    Guid VerificationId,
    [Required, StringLength(FieldLimits.DeviceName)] string DeviceName,
    [StringLength(FieldLimits.AllyCode)] string? AllyCode = null,
    [StringLength(FieldLimits.DeviceKey)] string? DeviceKey = null);

public sealed record RefreshRequest([Required, StringLength(FieldLimits.Code)] string RefreshToken);

public sealed record SessionPair(string AccessToken, DateTimeOffset AccessExpiresAt, string RefreshToken, Guid AccountId);

public sealed record SigilStartRequest(
    [Required, StringLength(FieldLimits.Phone)] string Phone,
    Guid? ResumeVerificationId,
    [StringLength(2)] string? Locale = null);

public sealed record SigilCompleteRequest(Guid VerificationId);
