using System.Reflection;
using Microsoft.AspNetCore.StaticFiles;

namespace Jellyfin.Plugin.Remote;

/// <summary>
/// Zugriff auf die im Plugin eingebetteten Dateien (App, Skripte).
/// </summary>
internal static class EmbeddedAssets
{
    private static readonly Assembly Assembly = typeof(EmbeddedAssets).Assembly;

    private static readonly FileExtensionContentTypeProvider ContentTypes = new();

    // Unter Windows enthalten die Ressourcennamen "\" statt "/" – daher normalisieren.
    private static readonly Dictionary<string, string> Resources = Assembly
        .GetManifestResourceNames()
        .ToDictionary(name => name.Replace('\\', '/'), name => name, StringComparer.Ordinal);

    /// <summary>Gets das ETag aller Dateien – ändert sich mit jeder Plugin-Version.</summary>
    public static string ETag { get; } = $"\"jfr-{Assembly.GetName().Version}\"";

    /// <summary>Öffnet eine eingebettete Datei, z. B. "app/index.html".</summary>
    public static Stream? Open(string logicalName) =>
        Resources.TryGetValue(logicalName, out var name) ? Assembly.GetManifestResourceStream(name) : null;

    /// <summary>Ermittelt den MIME-Typ anhand der Dateiendung.</summary>
    public static string GetContentType(string fileName)
    {
        if (!ContentTypes.TryGetContentType(fileName, out var type))
        {
            return "application/octet-stream";
        }

        return type.StartsWith("text/", StringComparison.Ordinal) || type.EndsWith("json", StringComparison.Ordinal)
            ? type + "; charset=utf-8"
            : type;
    }
}
