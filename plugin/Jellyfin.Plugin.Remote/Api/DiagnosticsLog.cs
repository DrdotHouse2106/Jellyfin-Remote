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

    private const int MaxLinesPerRequest = 200;

    private const int MaxLineLength = 500;

    private const int MaxSourceLength = 60;

    /// <summary>Höchstzahl an Anfragen je Benutzer und Minute (Fernbedienung und Web-Client senden je alle 3 s).</summary>
    private const int MaxRequestsPerMinute = 60;

    private static readonly ConcurrentQueue<string> Entries = new();

    private static readonly ConcurrentDictionary<string, (long Minute, int Count)> Requests = new();

    /// <summary>Zählt eine Anfrage des Benutzers und prüft das Limit je Minute.</summary>
    /// <param name="user">Benutzer-ID (oder IP-Adresse).</param>
    /// <returns>false, wenn das Limit überschritten ist.</returns>
    public static bool TryAcquire(string user)
    {
        var minute = DateTime.UtcNow.Ticks / TimeSpan.TicksPerMinute;
        var entry = Requests.AddOrUpdate(
            user,
            _ => (minute, 1),
            (_, old) => old.Minute == minute ? (minute, old.Count + 1) : (minute, 1));

        // Alte Zähler gelegentlich aufräumen.
        if (Requests.Count > 1000)
        {
            foreach (var key in Requests.Where(pair => pair.Value.Minute != minute).Select(pair => pair.Key))
            {
                Requests.TryRemove(key, out _);
            }
        }

        return entry.Count <= MaxRequestsPerMinute;
    }

    /// <summary>Fügt Einträge hinzu.</summary>
    /// <param name="source">Herkunft, z. B. „Fernbedienung“ oder „Web-Client Chrome“.</param>
    /// <param name="lines">Einträge (bereits mit Zeitstempel des Geräts).</param>
    public static void Add(string? source, IEnumerable<string?> lines)
    {
        var origin = Sanitize(source, MaxSourceLength);
        if (origin.Length == 0)
        {
            origin = "?";
        }

        var received = DateTime.Now.ToString("HH:mm:ss", CultureInfo.InvariantCulture);
        foreach (var line in lines.Take(MaxLinesPerRequest))
        {
            Entries.Enqueue($"{received} [{origin}] {Sanitize(line, MaxLineLength)}");
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

    /// <summary>
    /// Ersetzt Zeilenumbrüche und andere Steuerzeichen, damit ein Eintrag keine weiteren
    /// (gefälschten) Protokollzeilen erzeugen kann, und kürzt ihn.
    /// </summary>
    private static string Sanitize(string? text, int maxLength)
    {
        if (string.IsNullOrEmpty(text))
        {
            return string.Empty;
        }

        var builder = new StringBuilder(Math.Min(text.Length, maxLength + 2));
        foreach (var c in text)
        {
            if (builder.Length >= maxLength)
            {
                builder.Append(" …");
                break;
            }

            builder.Append(char.IsControl(c) || c == '\u2028' || c == '\u2029' ? ' ' : c);
        }

        return builder.ToString().Trim();
    }

    /// <summary>Leert das Protokoll.</summary>
    public static void Clear() => Entries.Clear();
}
