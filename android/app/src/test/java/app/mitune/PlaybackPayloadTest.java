package app.mitune;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

public class PlaybackPayloadTest {
    private JSONObject song(String id, String type) throws Exception { return new JSONObject().put("id", id).put("type", type).put("title", "Explicit fixture title").put("artist", "Explicit fixture artist").put("duration", 3600); }
    @Test public void musicAndPodcastsShareAnEntireNativeOwnedQueue() throws Exception {
        JSONObject first = song("yt:abcdefghijk", "song");
        JSONObject second = song("podcast:yt:ABCDEFGHIJK", "episode");
        PlaybackPayload payload = new PlaybackPayload(new JSONObject().put("track", second).put("queue", new JSONArray().put(first).put(second)));
        assertEquals(2, payload.tracks.size());
        assertEquals(1, payload.index);
        assertEquals("podcast:yt:ABCDEFGHIJK", payload.tracks.get(payload.index).getString("id"));
    }
    @Test public void mismatchedTypesAndMissingCurrentAudioAreRejected() throws Exception {
        JSONObject song = song("yt:abcdefghijk", "song");
        JSONObject episode = song("podcast:yt:ABCDEFGHIJK", "song");
        assertThrows(IllegalArgumentException.class, () -> new PlaybackPayload(new JSONObject().put("track", episode).put("queue", new JSONArray().put(episode))));
        assertThrows(IllegalArgumentException.class, () -> new PlaybackPayload(new JSONObject().put("track", song).put("queue", new JSONArray().put(song("yt:ABCDEFGHIJK", "song")))));
    }
    @Test public void queueIdsStayLiteralAndNumericalControlsAreBounded() throws Exception {
        JSONArray duplicates = new JSONArray().put(song("yt:abcdefghijk", "song")).put(song("yt:abcdefghijk", "song"));
        assertEquals(1, PlaybackPayload.parseQueue(duplicates).size());
        assertThrows(IllegalArgumentException.class, () -> PlaybackPayload.parseQueue(new JSONArray().put(song("YT:abcdefghijk", "song"))));
        assertThrows(IllegalArgumentException.class, () -> PlaybackPayload.number(new JSONObject().put("volume", 2), "volume", 0, 0, 1));
        assertThrows(IllegalArgumentException.class, () -> PlaybackPayload.number(new JSONObject().put("position", -1), "position", 0, 0, 28800));
        assertThrows(IllegalArgumentException.class, () -> PlaybackPayload.repeat(new JSONObject().put("repeat", "infinite"), "off"));
    }
}
