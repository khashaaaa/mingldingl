public class LocalFileStorageService
{
    private readonly string _root;
    private readonly string _publicBaseUrl;

    public LocalFileStorageService(IWebHostEnvironment env, IConfiguration config)
    {
        _root = Path.Combine(env.ContentRootPath, "uploads");
        _publicBaseUrl = (config["Storage:PublicBaseUrl"] ?? "http://localhost:5150/uploads").TrimEnd('/');
        Directory.CreateDirectory(_root);
    }

    public async Task<string> UploadAsync(string bucket, string path, byte[] bytes, string contentType)
    {
        var fullPath = Path.Combine(_root, bucket, path);
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
        await File.WriteAllBytesAsync(fullPath, bytes);
        return $"{_publicBaseUrl}/{bucket}/{path}";
    }
}
