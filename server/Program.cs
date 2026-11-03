using System.Text.Json;
using System.Text.Json.Nodes;

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    WebRootPath = Path.Combine(AppContext.BaseDirectory, "wwwroot")
});

var port = Environment.GetEnvironmentVariable("PORT") ?? "5080";
var accessKey = Environment.GetEnvironmentVariable("COUPLE_KEY");
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
builder.Services.AddSingleton<StateStore>();

var app = builder.Build();

static bool IsAuthorized(HttpRequest request, string? key)
{
    if (string.IsNullOrEmpty(key)) return true;
    return request.Headers.TryGetValue("X-Couple-Key", out var value)
           && string.Equals(value.ToString(), key, StringComparison.Ordinal);
}

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/health", () => Results.Ok(new { ok = true, service = "couple-space" }));

app.MapGet("/api/version", async (HttpRequest request, StateStore store) =>
{
    if (!IsAuthorized(request, accessKey)) return Results.Unauthorized();

    var json = await store.ReadAsync();
    long updatedAt = 0;
    try
    {
        updatedAt = JsonNode.Parse(json)?["updatedAt"]?.GetValue<long>() ?? 0;
    }
    catch
    {
        updatedAt = 0;
    }

    return Results.Ok(new { updatedAt });
});
app.MapGet("/api/state", async (HttpRequest request, StateStore store) =>
{
    if (!IsAuthorized(request, accessKey)) return Results.Unauthorized();

    var json = await store.ReadAsync();
    return Results.Text(json, "application/json; charset=utf-8");
});

app.MapPut("/api/state", async (HttpRequest request, StateStore store) =>
{
    if (!IsAuthorized(request, accessKey)) return Results.Unauthorized();

    if (request.ContentLength is > 20_000_000)
    {
        return Results.BadRequest(new { error = "state too large" });
    }

    using var reader = new StreamReader(request.Body);
    var body = await reader.ReadToEndAsync();

    if (string.IsNullOrWhiteSpace(body))
    {
        return Results.BadRequest(new { error = "empty body" });
    }

    try
    {
        var saved = await store.WriteAsync(body);
        return Results.Text(saved, "application/json; charset=utf-8");
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

app.MapFallbackToFile("index.html");

app.Run();

internal sealed class StateStore
{
    private readonly string _path;
    private readonly string _backupPath;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public StateStore()
    {
        var dataDir = Environment.GetEnvironmentVariable("DATA_DIR")
                      ?? Path.Combine(Directory.GetCurrentDirectory(), "data");
        Directory.CreateDirectory(dataDir);
        _path = Path.Combine(dataDir, "state.json");
        _backupPath = _path + ".bak";
    }

    public async Task<string> ReadAsync()
    {
        await _lock.WaitAsync();
        try
        {
            if (!File.Exists(_path))
            {
                return "{\"updatedAt\":0}";
            }

            var text = await File.ReadAllTextAsync(_path);
            if (IsValidJson(text)) return text;

            if (File.Exists(_backupPath))
            {
                var backup = await File.ReadAllTextAsync(_backupPath);
                if (IsValidJson(backup))
                {
                    File.Copy(_backupPath, _path, true);
                    return backup;
                }
            }

            return "{\"updatedAt\":0}";
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<string> WriteAsync(string json)
    {
        if (json.Length > 20_000_000)
        {
            throw new InvalidOperationException("state too large");
        }

        JsonObject root;
        try
        {
            root = JsonNode.Parse(json) as JsonObject
                   ?? throw new InvalidOperationException("state must be a JSON object");
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException($"invalid json: {ex.Message}");
        }

        root["updatedAt"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var result = root.ToJsonString(new JsonSerializerOptions { WriteIndented = false });

        await _lock.WaitAsync();
        try
        {
            if (File.Exists(_path))
            {
                try { File.Copy(_path, _backupPath, true); } catch { /* keep the new state the priority */ }
            }

            var temp = _path + ".tmp";
            await File.WriteAllTextAsync(temp, result);
            File.Move(temp, _path, true);
            return result;
        }
        finally
        {
            _lock.Release();
        }
    }

    private static bool IsValidJson(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;
        try
        {
            JsonNode.Parse(text);
            return true;
        }
        catch
        {
            return false;
        }
    }
}
