namespace MinglDingl.Engine.Features.Photos;

/// url is signed (private storage) and stays the same for ~50 minutes; cache by id, never by url.
public sealed record PhotoView(Guid Id, string Url, DateTimeOffset ExpiresAt, string ThumbHash, int Width, int Height, int Position);

public sealed record ReorderRequest(IReadOnlyList<Guid> Ids);

/// Another person's portrait. url/expiresAt are null while it is sealed: draw the thumbHash blur.
public sealed record PortraitView(Guid Id, int Position, string ThumbHash, int Width, int Height, string? Url, DateTimeOffset? ExpiresAt);
