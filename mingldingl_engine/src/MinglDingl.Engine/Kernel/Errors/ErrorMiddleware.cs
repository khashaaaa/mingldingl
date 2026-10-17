namespace MinglDingl.Engine.Kernel.Errors;

public sealed record ErrorBody(string Code, string Message);

public sealed class ErrorMiddleware(RequestDelegate next, ILogger<ErrorMiddleware> log)
{
    public async Task InvokeAsync(HttpContext ctx)
    {
        try
        {
            await next(ctx);
        }
        catch (DomainException e) when (!ctx.Response.HasStarted)
        {
            log.LogInformation("Rule {Code} on {Path}", e.Code, ctx.Request.Path);
            ctx.Response.StatusCode = e.Status;
            await ctx.Response.WriteAsJsonAsync(new ErrorBody(e.Code, e.Message));
        }
        catch (Exception e) when (!ctx.Response.HasStarted && !ctx.RequestAborted.IsCancellationRequested)
        {
            log.LogError(e, "Unhandled on {Method} {Path}", ctx.Request.Method, ctx.Request.Path);
            ctx.Response.StatusCode = StatusCodes.Status500InternalServerError;
            await ctx.Response.WriteAsJsonAsync(new ErrorBody("server.error", "Something went wrong"));
        }
    }
}
