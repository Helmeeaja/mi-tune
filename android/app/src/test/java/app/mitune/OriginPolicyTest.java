package app.mitune;

import org.junit.Test;
import static org.junit.Assert.*;

public class OriginPolicyTest {
    @Test public void productionUsesHttpsAndDoesNotRepairMalformedAddresses() {
        assertEquals("https://music.example:8443", OriginPolicy.server("https://music.example:8443/", false));
        for (String value : new String[]{"http://music.example", "https://user:password@music.example", "https://music.example/path", "https://music.example?key=secret", "https://music.example#fragment", "file:///sdcard/audio", "https://music.example:65536"}) assertThrows(IllegalArgumentException.class, () -> OriginPolicy.server(value, false));
    }
    @Test public void debugHttpIsRestrictedToRealLocalAddresses() {
        assertEquals("http://192.168.1.20:5173", OriginPolicy.server("http://192.168.1.20:5173", true));
        assertEquals("http://127.0.0.1:5173", OriginPolicy.server("http://127.0.0.1:5173", true));
        for (String value : new String[]{"http://8.8.8.8", "http://172.32.1.1", "http://127.0.0.1.evil.example", "http://10.999.0.1"}) assertThrows(IllegalArgumentException.class, () -> OriginPolicy.server(value, true));
    }
    @Test public void nativeSourcesAreTheSameMusicAndPodcastApisNotSpotify() {
        String origin = "https://music.example";
        assertEquals(origin + "/api/tracks/yt%3Aabcdefghijk/stream", OriginPolicy.stream(origin, "yt:abcdefghijk"));
        assertEquals(origin + "/api/podcasts/episodes/podcast%3Ayt%3Aabcdefghijk/stream", OriginPolicy.stream(origin, "podcast:yt:abcdefghijk"));
        assertFalse(OriginPolicy.audioId("YT:abcdefghijk"));
        assertFalse(OriginPolicy.audioId("yt:short"));
        assertThrows(IllegalArgumentException.class, () -> OriginPolicy.stream(origin, "spotify:track:abcdefghijk"));
        assertNull(OriginPolicy.artwork(origin, "https://spotify.example/audio"));
        assertNull(OriginPolicy.artwork(origin, "/api/../../audio"));
    }
    @Test public void bridgeTrustRequiresAnExactOriginIncludingPort() {
        assertTrue(OriginPolicy.sameOrigin("https://music.example:443", "https://music.example/podcasts"));
        assertFalse(OriginPolicy.sameOrigin("https://music.example", "https://music.example.evil.test"));
        assertFalse(OriginPolicy.sameOrigin("https://music.example", "http://music.example"));
        assertFalse(OriginPolicy.sameOrigin("https://music.example:8443", "https://music.example"));
        assertFalse(OriginPolicy.sameOrigin("https://music.example", "https://user@music.example"));
    }
}
