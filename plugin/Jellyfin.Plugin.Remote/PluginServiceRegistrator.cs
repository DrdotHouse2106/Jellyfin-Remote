using Jellyfin.Plugin.Remote.Middleware;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace Jellyfin.Plugin.Remote;

/// <summary>
/// Registriert die Dienste des Plugins beim Start von Jellyfin.
/// </summary>
public class PluginServiceRegistrator : IPluginServiceRegistrator
{
    /// <inheritdoc />
    public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
    {
        // Hängt die Middleware vor die Jellyfin-Pipeline, um den Web-Client um den Fernbedienungs-Link zu ergänzen.
        serviceCollection.AddTransient<IStartupFilter, WebClientInjectionStartupFilter>();
    }
}
