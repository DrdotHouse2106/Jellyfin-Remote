namespace Jellyfin.Plugin.Remote.Api;

/// <summary>
/// Einträge für das Diagnoseprotokoll (POST /JellyfinRemote/Diagnostics).
/// </summary>
public class DiagnosticsBatch
{
    /// <summary>Gets or sets die Herkunft, z. B. „Fernbedienung“.</summary>
    public string Source { get; set; } = string.Empty;

    /// <summary>Gets or sets die Einträge.</summary>
    public List<string> Lines { get; set; } = new();
}
