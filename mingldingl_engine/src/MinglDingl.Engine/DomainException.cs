/// <summary>
/// A rule the caller broke, with a message written for the caller and therefore safe to return
/// verbatim. Anything else escaping a service is a bug and must surface as a logged 500 with a
/// generic body — which is why services must not signal business rules with framework types like
/// <see cref="InvalidOperationException"/>, whose messages EF and the BCL also produce.
/// </summary>
public class DomainException : Exception
{
    public int StatusCode { get; }

    public DomainException(string message, int statusCode = StatusCodes.Status400BadRequest)
        : base(message) => StatusCode = statusCode;

    public static DomainException Forbidden(string message) =>
        new(message, StatusCodes.Status403Forbidden);

    public static DomainException Conflict(string message) =>
        new(message, StatusCodes.Status409Conflict);

    public static DomainException NotFound(string message) =>
        new(message, StatusCodes.Status404NotFound);
}
