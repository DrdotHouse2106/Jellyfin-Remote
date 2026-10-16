using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.Remote.Configuration;

/// <summary>
/// Einstellungen des Plugins (im Dashboard unter Plugins → Jellyfin Remote).
/// </summary>
public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>Gets or sets a value indicating whether im Seitenmenü des Web-Clients ein Link angezeigt wird.</summary>
    public bool ShowMenuLink { get; set; } = true;

    /// <summary>Gets or sets a value indicating whether in der Kopfzeile des Web-Clients ein Symbol angezeigt wird.</summary>
    public bool ShowHeaderButton { get; set; } = true;

    /// <summary>Gets or sets die Beschriftung des Links im Seitenmenü.</summary>
    public string MenuLinkName { get; set; } = "Fernbedienung";

    /// <summary>
    /// Gets or sets die öffentliche Adresse des Servers (z. B. https://jellyfin.example.de).
    /// Wird für QR-Codes und die Kopplung mit der iPhone-App verwendet.
    /// Leer = Adresse, unter der das Dashboard gerade aufgerufen wird.
    /// </summary>
    public string PublicUrl { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets a value indicating whether das Diagnoseprotokoll aktiv ist. Fernbedienung und
    /// Web-Client protokollieren dann Befehle und Fokuswechsel (Ansicht in den Plugin-Einstellungen).
    /// </summary>
    public bool EnableDiagnostics { get; set; }
}
