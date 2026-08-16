using Microsoft.AspNetCore.Mvc;

// One consistent error envelope ({ "error": "message" }) for every non-2xx
// response the API returns, instead of a mix of custom objects, bare empty
// bodies, and the framework's default ProblemDetails shape.
public static class ApiErrorExtensions
{
    public static IActionResult NotFoundError(this ControllerBase c, string message) =>
        c.NotFound(new { error = message });

    public static IActionResult BadRequestError(this ControllerBase c, string message) =>
        c.BadRequest(new { error = message });

    public static IActionResult ConflictError(this ControllerBase c, string message) =>
        c.Conflict(new { error = message });

    public static IActionResult ForbiddenError(this ControllerBase c, string message) =>
        c.StatusCode(403, new { error = message });

    public static IActionResult NotImplementedError(this ControllerBase c, string message) =>
        c.StatusCode(501, new { error = message });
}
