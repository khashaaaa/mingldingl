using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

/// <summary>
/// The shape a DataAnnotations failure comes back in. This was the one error path outside the
/// <see cref="DomainException"/> contract: it returned raw framework prose with no code, so the app
/// could neither localise it nor branch on it, and a Mongolian user read "The field Content must be
/// a string or array type with a maximum length of '2000'." in English.
/// <para>
/// The code is deliberately one value rather than one per attribute: the app cannot say anything
/// more useful about a malformed request than that the form needs another look, and inventing a
/// code per field would be a vocabulary nobody consumes. The framework's own text is kept as
/// <see cref="ErrorResponse.Error"/> so logs and developers still see exactly what failed.
/// </para>
/// </summary>
public static class ModelValidationResponse
{
    public const string Code = "request.invalid";

    public static IActionResult For(ModelStateDictionary modelState)
    {
        var message = modelState
            .SelectMany(kvp => kvp.Value?.Errors.Select(e => e.ErrorMessage) ?? [])
            .FirstOrDefault(m => !string.IsNullOrWhiteSpace(m)) ?? "Invalid request";

        return new BadRequestObjectResult(new ErrorResponse(message, Code));
    }
}
