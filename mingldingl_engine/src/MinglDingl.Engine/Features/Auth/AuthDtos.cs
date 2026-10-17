using System.ComponentModel.DataAnnotations;
using MinglDingl.Engine.Kernel.Validation;

namespace MinglDingl.Engine.Features.Auth;

public sealed record StartRequest(
    [Required, StringLength(FieldLimits.Phone)] string Phone,
    Guid? ResumeVerificationId);

public sealed record StartResponse(
    Guid VerificationId, string Code, string DisplayInstruction, string SmsUri, DateTimeOffset ExpiresAt);

/// state: pending | verified | expired | superseded
public sealed record StatusResponse(string State);

/// allyCode: the call that brought a new traveller (from a shared link), if any.
public sealed record CompleteRequest(
    Guid VerificationId,
    [Required, StringLength(FieldLimits.DeviceName)] string DeviceName,
    [StringLength(FieldLimits.AllyCode)] string? AllyCode = null);

public sealed record RefreshRequest([Required, StringLength(FieldLimits.Code)] string RefreshToken);

public sealed record SessionPair(string AccessToken, DateTimeOffset AccessExpiresAt, string RefreshToken, Guid AccountId);

public sealed record SigilStartRequest(
    [Required, StringLength(FieldLimits.Phone)] string Phone,
    Guid? ResumeVerificationId);

public sealed record SigilCompleteRequest(Guid VerificationId);
