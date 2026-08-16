using Microsoft.AspNetCore.Mvc;

// Single source of truth for reading the authenticated user's id/phone off
// HttpContext.Items, set by CurrentUserMiddleware. Replaces the same unsafe
// cast that used to be repeated in every controller action.
public static class CurrentUserExtensions
{
    public static Guid CurrentUserId(this ControllerBase c) => (Guid)c.HttpContext.Items["UserId"]!;

    public static string? CurrentPhoneNumber(this ControllerBase c) => c.HttpContext.Items["PhoneNumber"] as string;
}
