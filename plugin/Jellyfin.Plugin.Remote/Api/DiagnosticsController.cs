using MediaBrowser.Common.Api;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.Remote.Api;

/// <summary>
/// Diagnoseprotokoll: Schreiben für angemeldete Benutzer, Lesen und Leeren nur für Administratoren.
/// (Bewusst ein eigener Controller ohne [AllowAnonymous].)
/// </summary>
[ApiController]
[Authorize]
[Route("JellyfinRemote/Diagnostics")]
public class DiagnosticsController : ControllerBase
{
    /// <summary>Nimmt Einträge entgegen (nur wenn das Protokoll eingeschaltet ist).</summary>
    /// <param name="batch">Einträge.</param>
    /// <returns>204 No Content.</returns>
    [HttpPost]
    public IActionResult Add([FromBody] DiagnosticsBatch batch)
    {
        if (Plugin.Instance?.Configuration.EnableDiagnostics == true && batch.Lines.Count > 0)
        {
            var source = string.IsNullOrWhiteSpace(batch.Source) ? "?" : batch.Source.Trim();
            DiagnosticsLog.Add(source.Length > 60 ? source[..60] : source, batch.Lines);
        }

        return NoContent();
    }

    /// <summary>Das Protokoll als Text.</summary>
    /// <returns>Protokoll.</returns>
    [HttpGet]
    [Authorize(Policy = Policies.RequiresElevation)]
    public IActionResult Get() => Content(DiagnosticsLog.AsText(), "text/plain; charset=utf-8");

    /// <summary>Leert das Protokoll.</summary>
    /// <returns>204 No Content.</returns>
    [HttpDelete]
    [Authorize(Policy = Policies.RequiresElevation)]
    public IActionResult Clear()
    {
        DiagnosticsLog.Clear();
        return NoContent();
    }
}
