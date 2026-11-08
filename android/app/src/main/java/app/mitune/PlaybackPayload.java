package app.mitune;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public final class PlaybackPayload {
    public final List<JSONObject> tracks;
    public final int index;
    public final JSONObject options;

    public PlaybackPayload(JSONObject value) throws JSONException {
        JSONArray queue = value.optJSONArray("queue");
        JSONObject selected = value.optJSONObject("track");
        if (queue == null || queue.length() == 0 || queue.length() > 200 || selected == null) throw new IllegalArgumentException("Pilih audio dari katalog Mi Tune.");
        tracks = parseQueue(queue);
        String id = selected.optString("id");
        int selectedIndex = -1;
        for (int cursor = 0; cursor < tracks.size(); cursor++) if (tracks.get(cursor).optString("id").equals(id)) selectedIndex = cursor;
        if (selectedIndex < 0) throw new IllegalArgumentException("Audio tidak ada dalam antrean.");
        index = selectedIndex;
        options = value;
        number(value, "position", 0, 0, 28800);
    }

    public static List<JSONObject> parseQueue(JSONArray queue) throws JSONException {
        if (queue == null || queue.length() > 200) throw new IllegalArgumentException("Antrean maksimal 200 audio.");
        List<JSONObject> tracks = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        for (int index = 0; index < queue.length(); index++) {
            JSONObject item = queue.getJSONObject(index);
            String id = item.optString("id");
            if (!OriginPolicy.audioId(id) || (OriginPolicy.episode(id) ? !"episode".equals(item.optString("type")) : !"song".equals(item.optString("type"))) || item.optString("title").isBlank() || item.optString("title").length() > 600) throw new IllegalArgumentException("Audio tidak valid.");
            number(item, "duration", 0, 0, 28800);
            if (ids.add(id)) tracks.add(new JSONObject(item.toString()));
        }
        return tracks;
    }

    public static double number(JSONObject value, String key, double fallback, double minimum, double maximum) {
        double result = value.has(key) ? value.optDouble(key, Double.NaN) : fallback;
        if (!Double.isFinite(result) || result < minimum || result > maximum) throw new IllegalArgumentException("Nilai " + key + " tidak valid.");
        return result;
    }

    public static String repeat(JSONObject value, String fallback) {
        String result = value.optString("repeat", fallback);
        if (!result.equals("off") && !result.equals("one") && !result.equals("all")) throw new IllegalArgumentException("Mode ulang tidak valid.");
        return result;
    }
}
