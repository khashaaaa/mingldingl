public class PhoneVerification
{
    public Guid Id { get; set; }

    /// <summary>Local 8-digit Mongolian number, digits only.</summary>
    public string Phone { get; set; } = "";

    /// <summary>The 6-digit code the user must SMS to the shortcode. Never reused across sessions.</summary>
    public string Code { get; set; } = "";

    /// <summary>Session id returned by verify.mn — the handle we poll for status.</summary>
    public string ProviderSessionId { get; set; } = "";

    /// <summary>Mongolian instruction copy from verify.mn, shown to the user verbatim.</summary>
    public string DisplayInstruction { get; set; } = "";

    /// <summary>sms: URI that opens the user's SMS app pre-filled.</summary>
    public string SmsUri { get; set; } = "";

    public PhoneVerificationStatus Status { get; set; } = PhoneVerificationStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public DateTime? VerifiedAt { get; set; }

    /// <summary>Set once the holder of this verification binds it to their auth identity. Single use.</summary>
    public Guid? ClaimedByUserId { get; set; }
    public DateTime? ClaimedAt { get; set; }
}

public enum PhoneVerificationStatus
{
    Pending = 0,
    Verified = 1,
    Expired = 2,
}
