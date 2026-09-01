/// <summary>
/// A rule the caller broke, with a message written for the caller and therefore safe to return
/// verbatim. Anything else escaping a service is a bug and must surface as a logged 500 with a
/// generic body — which is why services must not signal business rules with framework types like
/// <see cref="InvalidOperationException"/>, whose messages EF and the BCL also produce.
/// </summary>
public class DomainException : Exception
{
    public int StatusCode { get; }

    /// <summary>
    /// Stable identifier the client maps to its own localised copy. The message is developer-facing
    /// English and is never shown to a user.
    /// </summary>
    public string Code { get; }

    public DomainException(string message, string code, int statusCode = StatusCodes.Status400BadRequest)
        : base(message)
    {
        Code = code;
        StatusCode = statusCode;
    }

    public static DomainException Forbidden(string message, string code) =>
        new(message, code, StatusCodes.Status403Forbidden);

    public static DomainException Conflict(string message, string code) =>
        new(message, code, StatusCodes.Status409Conflict);

    public static DomainException NotFound(string message, string code) =>
        new(message, code, StatusCodes.Status404NotFound);
}
