using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace MinglDingl.Engine.Tests;

public sealed class TestHostEnvironment : IHostEnvironment
{
    public static readonly IHostEnvironment Development = new TestHostEnvironment();

    public string EnvironmentName { get; set; } = Environments.Development;
    public string ApplicationName { get; set; } = "MinglDingl.Engine.Tests";
    public string ContentRootPath { get; set; } = ".";
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}
