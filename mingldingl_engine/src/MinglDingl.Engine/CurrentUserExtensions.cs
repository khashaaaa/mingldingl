using Microsoft.AspNetCore.Mvc;

public static class CurrentUserExtensions
{
    public static Guid CurrentUserId(this ControllerBase c) => (Guid)c.HttpContext.Items["UserId"]!;

    public static string? CurrentPhoneNumber(this ControllerBase c) => c.HttpContext.Items["PhoneNumber"] as string;
}
