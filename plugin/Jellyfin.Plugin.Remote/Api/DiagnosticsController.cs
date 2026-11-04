using MediaBrowser.Common.Api;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
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
    public IActionResult Add([FromBody] DiagnosticsBatch? batch)
    {
        if (batch?.Lines is null)
        {
            return BadRequest();
        }

        if (Plugin.Instance?.Configuration.EnableDiagnostics != true || batch.Lines.Count == 0)
        {
            return NoContent();
        }

        // Begrenzung je Benutzer, damit niemand das Protokoll fluten kann.
        var user = User.FindFirst("Jellyfin-UserId")?.Value
            ?? HttpContext.Connection.RemoteIpAddress?.ToString()
            ?? "?";
        if (!DiagnosticsLog.TryAcquire(user))
        {
            return StatusCode(StatusCodes.Status429TooManyRequests);
        }

        DiagnosticsLog.Add(batch.Source, batch.Lines);
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
