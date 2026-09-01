using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Moq;

namespace MinglDingl.Engine.Tests;

public class AdminAuthControllerTests
{
    private const string Username = "admin";
    private const string Password = "correct-horse-battery-staple";
    private const string SigningKey = "test-signing-key-at-least-32-bytes-long!!";

    private AdminAuthController BuildController()
    {
        var config = new Mock<IConfiguration>();
        config.Setup(c => c["Admin:Username"]).Returns(Username);
        config.Setup(c => c["Admin:PasswordHash"]).Returns(AdminPasswordHasher.Hash(Password));
        config.Setup(c => c["Admin:JwtSigningKey"]).Returns(SigningKey);
        var controller = new AdminAuthController(config.Object, new LoginThrottleService());
        controller.ControllerContext = new Microsoft.AspNetCore.Mvc.ControllerContext
        {
            HttpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext(),
        };
        return controller;
    }

    [Fact]
    public void Login_CorrectCredentials_ReturnsToken()
    {
        var result = Assert.IsType<OkObjectResult>(BuildController().Login(new AdminLoginRequest(Username, Password)));
        var response = Assert.IsType<AdminLoginResponse>(result.Value);

        Assert.False(string.IsNullOrEmpty(response.Token));
        Assert.True(response.ExpiresAt > DateTime.UtcNow);
    }

    [Fact]
    public void Login_WrongPassword_ReturnsUnauthorized()
    {
        var result = BuildController().Login(new AdminLoginRequest(Username, "wrong-password"));
        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public void Login_WrongUsername_ReturnsUnauthorized()
    {
        var result = BuildController().Login(new AdminLoginRequest("not-admin", Password));
        Assert.IsType<UnauthorizedObjectResult>(result);
    }
}
