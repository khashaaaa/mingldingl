using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

/// <summary>
/// Phone ownership proof via verify.mn (Mobile-Originated SMS: the user texts our code to the
/// shortcode). Start/status are anonymous because they run before the caller has an identity;
/// claim binds the proven number to the authenticated Supabase user.
/// </summary>
[ApiController]
[Route("auth/phone")]
[Produces("application/json")]
public class AuthController : ControllerBase
{
    private readonly PhoneVerificationService _verification;

    public AuthController(PhoneVerificationService verification)
    {
        _verification = verification;
    }

    [HttpPost("start")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(StartPhoneVerificationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Start([FromBody] StartPhoneVerificationRequest req, CancellationToken ct)
    {
        var phone = (req.Phone ?? "").Trim();
        if (!PhoneVerificationService.IsPhoneValid(phone))
            return this.BadRequestError("Phone must be 8 digits", "phone.invalid_format");

        if (!_verification.IsConfigured)
            return StatusCode(503, new { error = "Phone verification is not configured" });

        var verification = await _verification.StartAsync(phone, req.ResumeVerificationId, ct);
        if (verification is null)
            return StatusCode(503, new { error = "Could not start phone verification" });

        return Ok(new StartPhoneVerificationResponse(
            verification.Id,
            "144773",
            verification.SmsUri,
            verification.DisplayInstruction,
            verification.ExpiresAt,
            verification.Code));
    }

    [HttpGet("status/{verificationId:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PhoneVerificationStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Status(Guid verificationId, CancellationToken ct)
    {
        var verification = await _verification.RefreshAsync(verificationId, ct);
        if (verification is null) return this.NotFoundError("Verification not found", "verification.not_found");

        return Ok(new PhoneVerificationStatusResponse(
            verification.Status.ToString(), verification.ExpiresAt, verification.VerifiedAt));
    }

    /// <summary>
    /// verify.mn's wake-up ping. It carries no body and no signature, so it is treated purely as a
    /// hint to re-read authoritative status; it must return 2xx quickly or verify.mn will retry.
    /// </summary>
    [HttpGet("callback/{verificationId:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Callback(Guid verificationId, CancellationToken ct)
    {
        await _verification.RefreshAsync(verificationId, ct);
        return Ok();
    }

    [HttpPost("claim")]
    [Authorize]
    [ProducesResponseType(typeof(ClaimPhoneVerificationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Claim([FromBody] ClaimPhoneVerificationRequest req, CancellationToken ct)
    {
        var userId = this.CurrentUserId();
        var result = await _verification.ClaimAsync(req.VerificationId, userId, ct);

        switch (result)
        {
            case PhoneClaimResult.NotFound:
                return this.NotFoundError("Verification not found", "verification.not_found");
            case PhoneClaimResult.NotVerified:
                return this.BadRequestError("Phone is not verified yet", "phone.not_verified");
            case PhoneClaimResult.Expired:
                return this.BadRequestError("Verification expired before it was claimed", "verification.expired");
            case PhoneClaimResult.AlreadyClaimed:
                return this.ConflictError("Verification already used", "verification.already_used");
            case PhoneClaimResult.PhoneInUse:
                return this.ConflictError("That phone number already belongs to another account", "phone.claimed_by_other");
        }

        var phone = await _verification.GetVerifiedPhoneAsync(userId, ct);
        return Ok(new ClaimPhoneVerificationResponse(phone ?? ""));
    }
}
