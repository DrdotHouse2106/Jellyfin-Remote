using System.Reflection;
using MediaBrowser.Controller;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;

namespace Jellyfin.Plugin.Remote.Api;

/// <summary>
/// Liefert die Fernbedienungs-App unter /remote/ sowie Hilfsdateien des Plugins aus.
/// Alle Endpunkte sind ohne Anmeldung erreichbar – die App meldet sich selbst bei Jellyfin an.
/// </summary>
[ApiController]
[AllowAnonymous]
public class RemoteController : ControllerBase
{
    private static readonly HashSet<string> NoCacheFiles = new(StringComparer.Ordinal)
    {
        "index.html",
        "manifest.json",
        "service-worker.js",
    };

    private readonly IServerApplicationHost _applicationHost;

    /// <summary>
    /// Initializes a new instance of the <see cref="RemoteController"/> class.
    /// </summary>
    /// <param name="applicationHost">Der Jellyfin-Server.</param>
    public RemoteController(IServerApplicationHost applicationHost)
    {
        _applicationHost = applicationHost;
    }

    /// <summary>
    /// Die Fernbedienungs-App (index.html, CSS, JavaScript, Icons …).
    /// </summary>
    /// <param name="path">Pfad innerhalb der App.</param>
    /// <returns>Die angeforderte Datei.</returns>
    [HttpGet("remote/{**path}")]
    [ApiExplorerSettings(IgnoreApi = true)]
    public IActionResult GetApp([FromRoute] string? path)
    {
        if (string.IsNullOrEmpty(path))
        {
            // "/remote" → "/remote/", damit relative Pfade in der App stimmen.
            var requestPath = Request.Path.Value ?? string.Empty;
            if (!requestPath.EndsWith('/'))
            {
                return Redirect($"{Request.PathBase}{requestPath}/{Request.QueryString}");
            }

            path = "index.html";
        }

        if (path.Contains("..", StringComparison.Ordinal))
        {
            return NotFound();
        }

        return Asset("app/" + path, NoCacheFiles.Contains(path));
    }

    /// <summary>
    /// Informationen über das Plugin. Die App (Web und iPhone) erkennt daran,
    /// ob das Plugin installiert ist und unter welcher Adresse der Server öffentlich erreichbar ist.
    /// </summary>
    /// <returns>Plugin-Informationen.</returns>
    [HttpGet("JellyfinRemote/Info")]
    [Produces("application/json")]
    public ActionResult<RemotePluginInfo> GetInfo()
    {
        var config = Plugin.Instance?.Configuration;
        return new RemotePluginInfo
        {
            Version = typeof(Plugin).Assembly.GetName().Version?.ToString(3) ?? "0.0.0",
            ServerName = _applicationHost.FriendlyName,
            AppPath = "remote/",
            PublicUrl = string.IsNullOrWhiteSpace(config?.PublicUrl) ? null : config.PublicUrl.TrimEnd('/'),
        };
    }

    /// <summary>Skript, das den Fernbedienungs-Link in die Kopfzeile des Web-Clients einfügt.</summary>
    /// <returns>JavaScript-Datei.</returns>
    [HttpGet("JellyfinRemote/inject.js")]
    [ApiExplorerSettings(IgnoreApi = true)]
    public IActionResult GetInjectScript() => Asset("web/inject.js", noCache: true);

    /// <summary>QR-Code-Bibliothek für die Einstellungsseite.</summary>
    /// <returns>JavaScript-Datei.</returns>
    [HttpGet("JellyfinRemote/qrcode.js")]
    [ApiExplorerSettings(IgnoreApi = true)]
    public IActionResult GetQrCodeScript() => Asset("web/qrcode.js", noCache: false);

    private IActionResult Asset(string logicalName, bool noCache)
    {
        var stream = EmbeddedAssets.Open(logicalName);
        if (stream is null)
        {
            return NotFound();
        }

        Response.Headers.CacheControl = noCache ? "no-cache" : "public, max-age=86400";
        return File(
            stream,
            EmbeddedAssets.GetContentType(logicalName),
            lastModified: null,
            entityTag: new EntityTagHeaderValue(EmbeddedAssets.ETag));
    }
}
