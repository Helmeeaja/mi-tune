package app.mitune;

import android.content.Context;
import android.util.Base64;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;

public final class OfflineAudio {
    private final File directory;
    private final Map<String, Transfer> transfers = new HashMap<>();

    private static final class Transfer {
        final File temporary;
        final File target;
        final FileOutputStream output;
        final long expected;
        long received;
        Transfer(File temporary, File target, long expected) throws Exception { this.temporary = temporary; this.target = target; this.expected = expected; output = new FileOutputStream(temporary); }
    }

    public OfflineAudio(Context context) {
        directory = new File(context.getFilesDir(), "offline-audio");
        if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("Penyimpanan audio belum tersedia.");
    }

    private String key(String owner, String trackId) throws Exception {
        if (owner == null || !owner.matches("guest|[A-Za-z0-9_-]{1,80}") || !OriginPolicy.audioId(trackId)) throw new IllegalArgumentException("Unduhan tidak valid.");
        byte[] bytes = MessageDigest.getInstance("SHA-256").digest((owner + ":" + trackId).getBytes(StandardCharsets.UTF_8));
        StringBuilder result = new StringBuilder();
        for (byte value : bytes) result.append(String.format("%02x", value));
        return result.toString();
    }

    public File existing(String owner, String trackId) {
        try { File file = new File(directory, key(owner, trackId) + ".audio"); return file.isFile() && file.length() > 0 ? file : null; }
        catch (Exception error) { return null; }
    }

    public JSONObject command(String action, JSONObject value) throws Exception {
        String owner = value.optString("owner", "guest");
        JSONObject track = value.optJSONObject("track");
        String trackId = track != null ? track.optString("id") : value.optString("trackId");
        String key = key(owner, trackId);
        File target = new File(directory, key + ".audio");
        if (action.equals("cache-delete")) {
            Transfer transfer = transfers.remove(key);
            if (transfer != null) { transfer.output.close(); transfer.temporary.delete(); }
            if (target.exists() && !target.delete()) throw new IllegalStateException("Unduhan belum bisa dihapus.");
            return new JSONObject().put("removed", true);
        }
        if (action.equals("cache-start")) {
            if (track == null || !"song".equals(track.optString("type"))) throw new IllegalArgumentException("Pilih unduhan lagu yang valid.");
            long size = (long) PlaybackPayload.number(value, "size", 0, 1, 67108864);
            String mime = value.optString("mime");
            if (!mime.matches("audio/(mpeg|mp3|mp4|webm)(;.*)?")) throw new IllegalArgumentException("Format unduhan tidak valid.");
            File saved = existing(owner, trackId);
            if (saved != null && saved.length() == size) return new JSONObject().put("alreadyCached", true).put("bytes", saved.length());
            Transfer old = transfers.remove(key);
            if (old != null) old.output.close();
            transfers.put(key, new Transfer(new File(directory, key + ".part"), target, size));
            return new JSONObject().put("started", true);
        }
        Transfer transfer = transfers.get(key);
        if (transfer == null) throw new IllegalStateException("Unduhan belum dimulai.");
        if (action.equals("cache-chunk")) {
            long offset = (long) PlaybackPayload.number(value, "offset", -1, 0, 67108864);
            String encoded = value.optString("data");
            if (offset != transfer.received || encoded.length() > 131080) throw new IllegalArgumentException("Urutan unduhan tidak cocok.");
            byte[] bytes = Base64.decode(encoded, Base64.NO_WRAP);
            if (bytes.length == 0 || transfer.received + bytes.length > transfer.expected) throw new IllegalArgumentException("Ukuran unduhan tidak cocok.");
            transfer.output.write(bytes);
            transfer.received += bytes.length;
            return new JSONObject().put("received", transfer.received);
        }
        if (!action.equals("cache-finish")) throw new IllegalArgumentException("Perintah unduhan tidak valid.");
        if (transfer.received != transfer.expected) throw new IllegalStateException("Audio unduhan belum lengkap.");
        transfer.output.getFD().sync();
        transfer.output.close();
        transfers.remove(key);
        if (target.exists() && !target.delete()) throw new IllegalStateException("Unduhan lama belum bisa diganti.");
        if (!transfer.temporary.renameTo(target)) throw new IllegalStateException("Unduhan belum bisa disimpan.");
        return new JSONObject().put("cached", true).put("bytes", target.length());
    }

    public void close() {
        for (Transfer transfer : transfers.values()) try { transfer.output.close(); transfer.temporary.delete(); } catch (Exception ignored) {}
        transfers.clear();
    }
}
