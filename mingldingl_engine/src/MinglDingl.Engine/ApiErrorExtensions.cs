using Microsoft.AspNetCore.Mvc;

/// <summary>
/// Every error response carries a stable <paramref name="code"/> alongside its English message.
/// The message is for developers and logs; clients localise from the code, so a new error is not
/// user-ready until the code has copy in <c>lib/i18n/</c> on both locales.
/// </summary>
public static class ApiErrorExtensions
{
    public static IActionResult NotFoundError(this ControllerBase c, string message, string code) =>
        c.NotFound(new ErrorResponse(message, code));

    public static IActionResult BadRequestError(this ControllerBase c, string message, string code) =>
        c.BadRequest(new ErrorResponse(message, code));

    public static IActionResult ConflictError(this ControllerBase c, string message, string code) =>
        c.Conflict(new ErrorResponse(message, code));

    public static IActionResult ForbiddenError(this ControllerBase c, string message, string code) =>
        c.StatusCode(403, new ErrorResponse(message, code));

    public static IActionResult TooManyRequestsError(this ControllerBase c, string message, string code) =>
        c.StatusCode(429, new ErrorResponse(message, code));

    public static IActionResult NotImplementedError(this ControllerBase c, string message, string code) =>
        c.StatusCode(501, new ErrorResponse(message, code));
}
