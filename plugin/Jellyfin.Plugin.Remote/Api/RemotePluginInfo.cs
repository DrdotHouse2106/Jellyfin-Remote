namespace Jellyfin.Plugin.Remote.Api;

/// <summary>
/// Antwort von GET /JellyfinRemote/Info.
/// </summary>
public class RemotePluginInfo
{
    /// <summary>Gets or sets die Plugin-Version.</summary>
    public string Version { get; set; } = string.Empty;

    /// <summary>Gets or sets den Namen des Servers.</summary>
    public string ServerName { get; set; } = string.Empty;

    /// <summary>Gets or sets den Pfad der App relativ zur Server-Adresse.</summary>
    public string AppPath { get; set; } = string.Empty;

    /// <summary>Gets or sets a value indicating whether das Diagnoseprotokoll eingeschaltet ist.</summary>
    public bool Diagnostics { get; set; }
}
