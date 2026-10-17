namespace MinglDingl.Engine.Kernel.Errors;

/// A broken business rule. The only way a rule leaves a service: the middleware turns it into
/// its status with `{ code, message }`. Framework exceptions are never used for rules.
public sealed class DomainException(int status, string code, string message) : Exception(message)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
}
