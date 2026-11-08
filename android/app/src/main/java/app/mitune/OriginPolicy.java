package app.mitune;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

public final class OriginPolicy {
    private static final Pattern SONG = Pattern.compile("(?:yt:[A-Za-z0-9_-]{11}|audius:[A-Za-z0-9]{1,64})");
    private static final Pattern EPISODE = Pattern.compile("podcast:yt:[A-Za-z0-9_-]{11}");

    private OriginPolicy() {}

    public static String server(String value, boolean debug) {
        if (value == null || value.isBlank() || value.length() > 300) throw new IllegalArgumentException("Masukkan alamat server Mi Tune.");
        URI uri;
        try { uri = new URI(value.trim()); }
        catch (Exception error) { throw new IllegalArgumentException("Alamat server tidak valid."); }
        String host = uri.getHost();
        String scheme = uri.getScheme();
        if (host == null || uri.getUserInfo() != null || uri.getFragment() != null || uri.getQuery() != null || (uri.getRawPath() != null && !uri.getRawPath().isEmpty() && !uri.getRawPath().equals("/")) || uri.getPort() > 65535 || uri.getPort() == 0) throw new IllegalArgumentException("Gunakan alamat utama server, tanpa path, password, atau parameter.");
        if (!"https".equals(scheme) && !(debug && "http".equals(scheme) && local(host))) throw new IllegalArgumentException("Gunakan HTTPS. HTTP hanya untuk server lokal di APK debug.");
        return scheme + "://" + uri.getRawAuthority();
    }

    private static boolean local(String host) {
        if (host.equals("localhost") || host.equals("[::1]") || host.equals("::1")) return true;
        String[] parts = host.split("\\.");
        if (parts.length != 4) return false;
        int[] octets = new int[4];
        try { for (int index = 0; index < 4; index++) { if (!parts[index].matches("[0-9]{1,3}")) return false; octets[index] = Integer.parseInt(parts[index]); if (octets[index] > 255) return false; } }
        catch (NumberFormatException error) { return false; }
        return octets[0] == 127 || octets[0] == 10 || (octets[0] == 192 && octets[1] == 168) || (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31);
    }

    public static boolean sameOrigin(String origin, String value) {
        try {
            URI expected = URI.create(origin);
            URI actual = URI.create(value);
            return actual.getUserInfo() == null && expected.getScheme().equalsIgnoreCase(actual.getScheme()) && expected.getHost().equalsIgnoreCase(actual.getHost()) && port(expected) == port(actual);
        } catch (Exception error) { return false; }
    }

    private static int port(URI uri) { return uri.getPort() >= 0 ? uri.getPort() : "https".equals(uri.getScheme()) ? 443 : 80; }

    public static boolean audioId(String id) { return id != null && (SONG.matcher(id).matches() || EPISODE.matcher(id).matches()); }
    public static boolean episode(String id) { return id != null && EPISODE.matcher(id).matches(); }
    public static String stream(String origin, String id) {
        if (!audioId(id)) throw new IllegalArgumentException("Identitas audio tidak valid.");
        return origin + (episode(id) ? "/api/podcasts/episodes/" : "/api/tracks/") + URLEncoder.encode(id, StandardCharsets.UTF_8) + "/stream";
    }
    public static String artwork(String origin, String path) {
        if (path == null || !path.startsWith("/api/") || path.startsWith("//") || path.contains("..") || path.contains("\\") || path.indexOf('\0') >= 0) return null;
        String url = origin + path;
        return sameOrigin(origin, url) ? url : null;
    }
}
