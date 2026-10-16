using Jellyfin.Plugin.Remote.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.Remote;

/// <summary>
/// Jellyfin Remote: liefert die Fernbedienungs-App unter /remote/ aus und
/// verlinkt sie im Jellyfin-Web-Client.
/// </summary>
public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    /// <summary>Eindeutige ID des Plugins (muss mit der Repository-Datei übereinstimmen).</summary>
    public static readonly Guid PluginId = Guid.Parse("e7f6d1e2-2069-4a41-804f-19632a1e5966");

    /// <summary>
    /// Initializes a new instance of the <see cref="Plugin"/> class.
    /// </summary>
    /// <param name="applicationPaths">Pfade der Jellyfin-Installation.</param>
    /// <param name="xmlSerializer">Serializer für die Plugin-Konfiguration.</param>
    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
    }

    /// <summary>Gets the current plugin instance.</summary>
    public static Plugin? Instance { get; private set; }

    /// <inheritdoc />
    public override string Name => "Jellyfin Remote";

    /// <inheritdoc />
    public override Guid Id => PluginId;

    /// <inheritdoc />
    public override string Description =>
        "Fernbedienung und Mediathek-Browser für Smartphones – erreichbar unter /remote/.";

    /// <inheritdoc />
    public IEnumerable<PluginPageInfo> GetPages()
    {
        yield return new PluginPageInfo
        {
            Name = "JellyfinRemote",
            DisplayName = "Fernbedienung",
            EmbeddedResourcePath = $"{GetType().Namespace}.Configuration.configPage.html",
            EnableInMainMenu = true,
            MenuIcon = "settings_remote",
        };
    }
}
