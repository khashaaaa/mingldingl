namespace MinglDingl.Engine.Kernel;

/// Each feature maps its own endpoints; Program maps every registered module.
public interface IEndpointModule
{
    void Map(IEndpointRouteBuilder app);
}
