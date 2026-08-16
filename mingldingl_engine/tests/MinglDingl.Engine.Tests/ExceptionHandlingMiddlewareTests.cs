using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests;

public class ExceptionHandlingMiddlewareTests
{
    [Fact]
    public async Task InvokeAsync_DownstreamThrows_Returns500WithErrorEnvelope()
    {
        var middleware = new ExceptionHandlingMiddleware(
            _ => throw new NullReferenceException("simulated crash"),
            NullLogger<ExceptionHandlingMiddleware>.Instance);

        var context = new DefaultHttpContext();
        var body = new MemoryStream();
        context.Response.Body = body;

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status500InternalServerError, context.Response.StatusCode);
        Assert.StartsWith("application/json", context.Response.ContentType);

        body.Seek(0, SeekOrigin.Begin);
        var json = await new StreamReader(body).ReadToEndAsync();
        Assert.Contains("Something went wrong", json);
        Assert.DoesNotContain("NullReferenceException", json);
        Assert.DoesNotContain("simulated crash", json);
    }

    [Fact]
    public async Task InvokeAsync_DownstreamSucceeds_PassesResponseThrough()
    {
        var middleware = new ExceptionHandlingMiddleware(
            ctx =>
            {
                ctx.Response.StatusCode = StatusCodes.Status200OK;
                return Task.CompletedTask;
            },
            NullLogger<ExceptionHandlingMiddleware>.Instance);

        var context = new DefaultHttpContext();

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
    }
}
