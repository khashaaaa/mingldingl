using System.ComponentModel.DataAnnotations;

public record StartPhoneVerificationRequest(
    [Required, MaxLength(FieldLimits.Phone)] string Phone);

/// <summary>
/// DisplayInstruction is verify.mn's Mongolian copy and must be shown verbatim — it names the
/// number the SMS has to be sent from, which is the most common point of failure.
/// </summary>
public record StartPhoneVerificationResponse(
    Guid VerificationId,
    string Shortcode,
    string SmsUri,
    string DisplayInstruction,
    DateTime ExpiresAt,
    /// <summary>
    /// The code the user texts to the shortcode. Already embedded in <see cref="SmsUri"/>; returned
    /// on its own so the app can show the manual "text CODE to 144773" fallback without parsing the
    /// URI — that fallback is what the user needs when opening their SMS app failed.
    /// </summary>
    string Code = "");

public record PhoneVerificationStatusResponse(string Status, DateTime ExpiresAt, DateTime? VerifiedAt);

public record ClaimPhoneVerificationRequest(Guid VerificationId);

public record ClaimPhoneVerificationResponse(string Phone);
