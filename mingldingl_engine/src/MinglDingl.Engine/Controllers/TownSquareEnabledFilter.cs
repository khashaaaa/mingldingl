using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

/// <summary>
/// The Town Square kill switch. Applied to the whole user-facing controller so a disabled
/// feature is a 404 with a stable code on every route, while the admin scheduling routes and
/// the background scheduler keep working so sessions already in flight can finish.
/// </summary>
public class TownSquareEnabledFilter : IActionFilter
{
    private readonly TownSquareService _townSquare;
    public TownSquareEnabledFilter(TownSquareService townSquare) => _townSquare = townSquare;

    public void OnActionExecuting(ActionExecutingContext context)
    {
        if (!_townSquare.IsEnabled)
            context.Result = new NotFoundObjectResult(new ErrorResponse("Town Square is not open", "square.disabled"));
    }

    public void OnActionExecuted(ActionExecutedContext context) { }
}
