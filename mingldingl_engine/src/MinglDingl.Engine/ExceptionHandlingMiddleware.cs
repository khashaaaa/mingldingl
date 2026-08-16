// Last-resort safety net: turns any exception that escapes a controller/service
// (e.g. a malformed JWT with no parseable "sub" claim hitting the
// `(Guid)HttpContext.Items["UserId"]!` cast used across controllers) into the
// same { "error": "..." } envelope the rest of the API returns, instead of an
// empty-body 500. The real exception is logged server-side; only a generic
// message ever reaches the client.
public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception processing {Method} {Path}", context.Request.Method, context.Request.Path);

            if (context.Response.HasStarted) throw;

            context.Response.Clear();
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new { error = "Something went wrong. Please try again." });
        }
    }
}
