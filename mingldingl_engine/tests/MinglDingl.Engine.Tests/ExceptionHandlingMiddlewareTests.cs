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

    [Fact]
    public async Task InvokeAsync_DomainException_ReturnsItsStatusAndMessageVerbatim()
    {
        var context = new DefaultHttpContext();
        var body = new MemoryStream();
        context.Response.Body = body;

        var middleware = new ExceptionHandlingMiddleware(
            _ => throw new DomainException("Session is not open for RSVP", "square.rsvp_closed"),
            NullLogger<ExceptionHandlingMiddleware>.Instance);

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status400BadRequest, context.Response.StatusCode);
        body.Position = 0;
        Assert.Contains("Session is not open for RSVP", await new StreamReader(body).ReadToEndAsync());
    }

    [Theory]
    [InlineData(StatusCodes.Status403Forbidden)]
    [InlineData(StatusCodes.Status404NotFound)]
    [InlineData(StatusCodes.Status409Conflict)]
    public async Task InvokeAsync_DomainException_HonoursItsStatusCode(int status)
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        var middleware = new ExceptionHandlingMiddleware(
            _ => throw new DomainException("nope", "test.nope", status),
            NullLogger<ExceptionHandlingMiddleware>.Instance);

        await middleware.InvokeAsync(context);

        Assert.Equal(status, context.Response.StatusCode);
    }

    [Fact]
    public async Task InvokeAsync_FrameworkException_DoesNotLeakItsMessage()
    {
        // The whole point of DomainException: an EF/BCL InvalidOperationException must not be
        // mistaken for a business rule and echoed to the caller.
        var context = new DefaultHttpContext();
        var body = new MemoryStream();
        context.Response.Body = body;

        var middleware = new ExceptionHandlingMiddleware(
            _ => throw new InvalidOperationException("The connection is already in a transaction"),
            NullLogger<ExceptionHandlingMiddleware>.Instance);

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status500InternalServerError, context.Response.StatusCode);
        body.Position = 0;
        var json = await new StreamReader(body).ReadToEndAsync();
        Assert.DoesNotContain("transaction", json);
        Assert.Contains("Something went wrong", json);
    }

    [Fact]
    public async Task InvokeAsync_ArgumentException_IsAlsoTreatedAsAFault()
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        var middleware = new ExceptionHandlingMiddleware(
            _ => throw new ArgumentNullException("someInternalParam"),
            NullLogger<ExceptionHandlingMiddleware>.Instance);

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status500InternalServerError, context.Response.StatusCode);
    }
}
