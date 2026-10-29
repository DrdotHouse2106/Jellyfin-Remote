using System.Reflection;
using System.Text.RegularExpressions;
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
    private static readonly Regex VersionPrefix = new(@"^v\d[^/]*/?", RegexOptions.Compiled);

    private static readonly string AppVersion = typeof(Plugin).Assembly.GetName().Version?.ToString(3) ?? "0.0.0";

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
        // Versionierte Pfade (/remote/v1.2.3/js/app.js) liefern dieselben Dateien.
        // Jede Plugin-Version hat dadurch eigene Adressen – kein Browser- oder App-Zwischenspeicher
        // kann nach einem Update noch alte Dateien ausliefern (z. B. die Jellyfin-App auf dem iPhone).
        var requested = path ?? string.Empty;
        path = VersionPrefix.Replace(requested, string.Empty, 1);
        var versioned = path.Length != requested.Length;

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

        if (path == "index.html")
        {
            return Index();
        }

        // Versionierte Adressen ändern sich mit jedem Update → dürfen dauerhaft im Speicher bleiben
        // (keine Nachfrage beim Server, schnelles Öffnen). Unversionierte immer neu prüfen.
        return Asset("app/" + path, noCache: !versioned, immutable: versioned);
    }

    /// <summary>
    /// index.html mit &lt;base href="…/remote/v{Version}/"&gt;: Alle relativen Adressen der App
    /// (CSS, JavaScript-Module, Icons, Manifest) zeigen damit auf den versionierten Pfad.
    /// </summary>
    private IActionResult Index()
    {
        using var stream = EmbeddedAssets.Open("app/index.html");
        if (stream is null)
        {
            return NotFound();
        }

        using var reader = new StreamReader(stream);
        var html = reader.ReadToEnd();
        var baseTag = $"<base href=\"{Request.PathBase}/remote/v{AppVersion}/\">";
        var headIndex = html.IndexOf("<head>", StringComparison.OrdinalIgnoreCase);
        if (headIndex >= 0)
        {
            html = html.Insert(headIndex + "<head>".Length, baseTag);
        }

        // Das Manifest unversioniert einbinden: start_url und scope ("./") zeigen dann auf /remote/
        // statt auf /remote/v{Version}/ – eine installierte PWA bleibt so auch nach Updates gültig.
        html = html.Replace(
            "<link rel=\"manifest\" href=\"manifest.json\">",
            $"<link rel=\"manifest\" href=\"{Request.PathBase}/remote/manifest.json\">",
            StringComparison.Ordinal);

        Response.Headers.CacheControl = "no-cache";
        return Content(html, "text/html; charset=utf-8");
    }

    /// <summary>
    /// Informationen über das Plugin. Die App (Web und iPhone) erkennt daran,
    /// ob das Plugin installiert ist. Die Antwort ist ohne Anmeldung abrufbar und enthält
    /// darum bewusst keine Konfiguration wie die öffentliche Server-Adresse.
    /// </summary>
    /// <returns>Plugin-Informationen.</returns>
    [HttpGet("JellyfinRemote/Info")]
    [Produces("application/json")]
    public ActionResult<RemotePluginInfo> GetInfo()
    {
        var config = Plugin.Instance?.Configuration;
        return new RemotePluginInfo
        {
            Version = AppVersion,
            ServerName = _applicationHost.FriendlyName,
            AppPath = "remote/",
            Diagnostics = config?.EnableDiagnostics ?? false,
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

    private IActionResult Asset(string logicalName, bool noCache, bool immutable = false)
    {
        var stream = EmbeddedAssets.Open(logicalName);
        if (stream is null)
        {
            return NotFound();
        }

        Response.Headers.CacheControl = immutable
            ? "public, max-age=31536000, immutable"
            : noCache ? "no-cache" : "public, max-age=86400";
        return File(
            stream,
            EmbeddedAssets.GetContentType(logicalName),
            lastModified: null,
            entityTag: new EntityTagHeaderValue(EmbeddedAssets.ETag));
    }
}
