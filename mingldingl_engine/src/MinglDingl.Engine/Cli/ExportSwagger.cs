namespace MinglDingl.Engine.Cli;

/// Writes the OpenAPI document and exits before anything touches Postgres.
public static class ExportSwagger
{
    public static async Task RunAsync(WebApplication app, string path)
    {
        app.Urls.Clear();
        app.Urls.Add("http://127.0.0.1:0");
        await app.StartAsync();
        var address = app.Urls.First();
        using var http = new HttpClient();
        var json = await http.GetStringAsync($"{address}/openapi/v1.json");
        await File.WriteAllTextAsync(path, json.EndsWith('\n') ? json : json + "\n");
        await app.StopAsync();
    }
}
