using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;

namespace Jellyfin.Plugin.Remote.Middleware;

/// <summary>
/// Setzt die <see cref="WebClientInjectionMiddleware"/> an den Anfang der Jellyfin-Pipeline.
/// </summary>
public sealed class WebClientInjectionStartupFilter : IStartupFilter
{
    /// <inheritdoc />
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next)
    {
        return app =>
        {
            app.UseMiddleware<WebClientInjectionMiddleware>();
            next(app);
        };
    }
}
