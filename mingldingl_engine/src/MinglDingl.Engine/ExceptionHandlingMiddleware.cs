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
        catch (DomainException ex)
        {
            // A broken rule, not a fault: the message was written for the caller, and this is an
            // expected outcome rather than something to alert on.
            _logger.LogInformation(
                "Domain rule rejected {Method} {Path}: {Message}",
                context.Request.Method, context.Request.Path, ex.Message);

            // Nothing can be rewritten once the response is on the wire — rethrow so the original
            // exception (and its stack) reaches the host rather than emitting a half-written body.
            if (context.Response.HasStarted) throw;
            await WriteError(context, ex.StatusCode, ex.Message, ex.Code);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception processing {Method} {Path}", context.Request.Method, context.Request.Path);

            if (context.Response.HasStarted) throw;
            await WriteError(context, StatusCodes.Status500InternalServerError, "Something went wrong. Please try again.", "server.unexpected");
        }
    }

    private static async Task WriteError(HttpContext context, int statusCode, string message, string code)
    {
        context.Response.Clear();
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new ErrorResponse(message, code));
    }
}
