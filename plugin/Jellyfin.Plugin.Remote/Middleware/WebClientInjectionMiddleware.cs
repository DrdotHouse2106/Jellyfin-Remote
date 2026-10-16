using System.Text;
using System.Text.Json.Nodes;
using MediaBrowser.Common.Net;
using MediaBrowser.Controller.Configuration;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Remote.Middleware;

/// <summary>
/// Ergänzt den Jellyfin-Web-Client um den Link zur Fernbedienung – ohne Dateien auf der Festplatte zu verändern:
/// <list type="bullet">
/// <item><c>/web/config.json</c>: Eintrag in <c>menuLinks</c> (offizielle Funktion des Web-Clients, Seitenmenü).</item>
/// <item><c>/web/index.html</c>: kleines Skript, das ein Symbol in die Kopfzeile einfügt.</item>
/// </list>
/// </summary>
public sealed class WebClientInjectionMiddleware
{
    /// <summary>Relativ zu /web/ – funktioniert dadurch auch mit einer konfigurierten Basis-URL.</summary>
    private const string AppUrl = "../remote/";

    /// <summary>
    /// Ohne „defer“ und direkt am Anfang von &lt;head&gt;: Das Skript muss laufen, bevor der Web-Client
    /// seine Live-Verbindung (WebSocket) aufbaut, um Suchbefehle der Fernbedienung mitzulesen.
    /// </summary>
    private const string ScriptPath = "../JellyfinRemote/inject.js";

    private readonly RequestDelegate _next;
    private readonly IServerConfigurationManager _configurationManager;
    private readonly ILogger<WebClientInjectionMiddleware> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="WebClientInjectionMiddleware"/> class.
    /// </summary>
    /// <param name="next">Nächste Middleware.</param>
    /// <param name="configurationManager">Server-Konfiguration.</param>
    /// <param name="logger">Logger.</param>
    public WebClientInjectionMiddleware(
        RequestDelegate next,
        IServerConfigurationManager configurationManager,
        ILogger<WebClientInjectionMiddleware> logger)
    {
        _next = next;
        _configurationManager = configurationManager;
        _logger = logger;
    }

    /// <summary>Verarbeitet eine Anfrage.</summary>
    /// <param name="context">HTTP-Kontext.</param>
    /// <returns>Task.</returns>
    public async Task InvokeAsync(HttpContext context)
    {
        var config = Plugin.Instance?.Configuration;
        if (config is not null && HttpMethods.IsGet(context.Request.Method))
        {
            var path = context.Request.Path.Value ?? string.Empty;
            var webRoot = _configurationManager.GetNetworkConfiguration().BaseUrl + "/web/";

            if (config.ShowMenuLink && path.Equals(webRoot + "config.json", StringComparison.OrdinalIgnoreCase))
            {
                if (await TryServeWebConfig(context, config.MenuLinkName).ConfigureAwait(false))
                {
                    return;
                }
            }
            else if (path.Equals(webRoot, StringComparison.OrdinalIgnoreCase)
                || path.Equals(webRoot + "index.html", StringComparison.OrdinalIgnoreCase))
            {
                if (await TryServeIndex(context, config.ShowHeaderButton).ConfigureAwait(false))
                {
                    return;
                }
            }
        }

        await _next(context).ConfigureAwait(false);
    }

    private async Task<bool> TryServeWebConfig(HttpContext context, string linkName)
    {
        try
        {
            var file = Path.Combine(_configurationManager.ApplicationPaths.WebPath, "config.json");
            if (!File.Exists(file))
            {
                return false;
            }

            var json = JsonNode.Parse(await File.ReadAllTextAsync(file, context.RequestAborted).ConfigureAwait(false))?.AsObject();
            if (json is null)
            {
                return false;
            }

            if (json["menuLinks"] is not JsonArray links)
            {
                links = new JsonArray();
                json["menuLinks"] = links;
            }

            if (links.Any(link => link?["url"]?.GetValue<string>() == AppUrl))
            {
                return false;
            }

            links.Add(new JsonObject
            {
                ["name"] = string.IsNullOrWhiteSpace(linkName) ? "Fernbedienung" : linkName,
                ["icon"] = "settings_remote",
                ["url"] = AppUrl,
            });

            await WriteAsync(context, json.ToJsonString(), "application/json; charset=utf-8").ConfigureAwait(false);
            return true;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Jellyfin Remote: config.json konnte nicht ergänzt werden");
            return false;
        }
    }

    private async Task<bool> TryServeIndex(HttpContext context, bool showHeaderButton)
    {
        try
        {
            var file = Path.Combine(_configurationManager.ApplicationPaths.WebPath, "index.html");
            if (!File.Exists(file))
            {
                return false;
            }

            var html = await File.ReadAllTextAsync(file, context.RequestAborted).ConfigureAwait(false);
            var index = html.IndexOf("<head>", StringComparison.OrdinalIgnoreCase);
            if (index < 0 || html.Contains(ScriptPath, StringComparison.Ordinal))
            {
                return false;
            }

            // Das Skript läuft immer (automatische Anmeldung, Suche auf dem Fernseher);
            // das Kopfzeilen-Symbol wird per Parameter ein- oder ausgeschaltet.
            var scriptTag = $"<script src=\"{ScriptPath}?header={(showHeaderButton ? 1 : 0)}\"></script>";
            var injected = html.Insert(index + "<head>".Length, scriptTag);
            await WriteAsync(context, injected, "text/html; charset=utf-8").ConfigureAwait(false);
            return true;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Jellyfin Remote: index.html konnte nicht ergänzt werden");
            return false;
        }
    }

    private static Task WriteAsync(HttpContext context, string content, string contentType)
    {
        var bytes = Encoding.UTF8.GetBytes(content);
        context.Response.StatusCode = StatusCodes.Status200OK;
        context.Response.ContentType = contentType;
        context.Response.ContentLength = bytes.Length;
        context.Response.Headers.CacheControl = "no-cache";
        return context.Response.Body.WriteAsync(bytes, context.RequestAborted).AsTask();
    }
}
