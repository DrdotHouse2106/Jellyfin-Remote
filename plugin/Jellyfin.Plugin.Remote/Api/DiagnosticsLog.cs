using System.Collections.Concurrent;
using System.Globalization;
using System.Text;

namespace Jellyfin.Plugin.Remote.Api;

/// <summary>
/// Diagnoseprotokoll im Arbeitsspeicher (die letzten 1000 Einträge, nach einem Neustart leer).
/// Fernbedienung und Web-Client schreiben hinein, wenn es in den Plugin-Einstellungen eingeschaltet ist.
/// </summary>
public static class DiagnosticsLog
{
    private const int MaxEntries = 1000;

    private static readonly ConcurrentQueue<string> Entries = new();

    /// <summary>Fügt Einträge hinzu.</summary>
    /// <param name="source">Herkunft, z. B. „Fernbedienung“ oder „Web-Client Chrome“.</param>
    /// <param name="lines">Einträge (bereits mit Zeitstempel des Geräts).</param>
    public static void Add(string source, IEnumerable<string> lines)
    {
        var received = DateTime.Now.ToString("HH:mm:ss", CultureInfo.InvariantCulture);
        foreach (var line in lines.Take(200))
        {
            var text = line.Length > 500 ? line[..500] + " …" : line;
            Entries.Enqueue($"{received} [{source}] {text}");
        }

        while (Entries.Count > MaxEntries && Entries.TryDequeue(out _))
        {
        }
    }

    /// <summary>Gibt das Protokoll als Text zurück.</summary>
    /// <returns>Protokoll, älteste Einträge zuerst.</returns>
    public static string AsText()
    {
        var builder = new StringBuilder();
        foreach (var entry in Entries)
        {
            builder.AppendLine(entry);
        }

        return builder.ToString();
    }

    /// <summary>Leert das Protokoll.</summary>
    public static void Clear() => Entries.Clear();
}
