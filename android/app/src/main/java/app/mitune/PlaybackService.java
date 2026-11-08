package app.mitune;

import android.app.PendingIntent;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.webkit.CookieManager;
import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DataSource;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.session.DefaultMediaNotificationProvider;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import androidx.media3.session.SessionCommand;
import androidx.media3.session.SessionCommands;
import androidx.media3.session.SessionResult;
import androidx.media3.session.SessionError;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@UnstableApi
public final class PlaybackService extends MediaSessionService {
    public static final String COMMAND = "app.mitune.PLAYER";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private ExoPlayer player;
    private MediaSession session;
    private SharedPreferences preferences;
    private OfflineAudio offline;
    private String serverOrigin = "";
    private String owner = "guest";
    private float volume = 0.7f;
    private boolean muted;
    private boolean autoplayNext = true;
    private boolean preloadNext = true;
    private boolean dataSaver;
    private long sleepDeadline;
    private int sleepMinutes;
    private final Runnable saveTick = new Runnable() {
        @Override public void run() { persist(); handler.postDelayed(this, 5000); }
    };
    private final Runnable sleep = () -> {
        if (player != null) player.pause();
        sleepDeadline = 0;
        persist();
    };

    @Override public void onCreate() {
        super.onCreate();
        preferences = getSharedPreferences("mi-tune", MODE_PRIVATE);
        offline = new OfflineAudio(this);
        DataSource.Factory http = () -> {
            DefaultHttpDataSource.Factory factory = new DefaultHttpDataSource.Factory().setUserAgent("MiTuneAndroid/0.2").setConnectTimeoutMs(20000).setReadTimeoutMs(300000).setAllowCrossProtocolRedirects(false);
            String cookie = CookieManager.getInstance().getCookie(serverOrigin);
            if (cookie != null && !cookie.isBlank()) factory.setDefaultRequestProperties(Map.of("Cookie", cookie));
            return factory.createDataSource();
        };
        player = new ExoPlayer.Builder(this).setMediaSourceFactory(new DefaultMediaSourceFactory(new DefaultDataSource.Factory(this, http))).build();
        player.setWakeMode(C.WAKE_MODE_NETWORK);
        player.setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(), true);
        player.setHandleAudioBecomingNoisy(true);
        player.addListener(new Player.Listener() {
            @Override public void onEvents(Player ignored, Player.Events events) { persist(); }
            @Override public void onMediaItemTransition(@Nullable MediaItem item, int reason) {
                boolean speech = item != null && OriginPolicy.episode(item.mediaId);
                player.setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(speech ? C.AUDIO_CONTENT_TYPE_SPEECH : C.AUDIO_CONTENT_TYPE_MUSIC).build(), true);
            }
        });
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent activity = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        session = new MediaSession.Builder(this, player).setCallback(new Commands()).setSessionActivity(activity).build();
        DefaultMediaNotificationProvider notifications = new DefaultMediaNotificationProvider(this);
        notifications.setSmallIcon(android.R.drawable.ic_media_play);
        setMediaNotificationProvider(notifications);
        restore();
        handler.postDelayed(saveTick, 5000);
    }

    @Override public MediaSession onGetSession(MediaSession.ControllerInfo controller) { return session; }

    private final class Commands implements MediaSession.Callback {
        @Override public MediaSession.ConnectionResult onConnect(MediaSession session, MediaSession.ControllerInfo controller) {
            boolean own = getPackageName().equals(controller.getPackageName()) && controller.isPackageNameVerified();
            if (!own && !controller.isTrusted()) return MediaSession.ConnectionResult.reject();
            SessionCommands.Builder commands = new SessionCommands.Builder();
            if (own) commands.add(new SessionCommand(COMMAND, Bundle.EMPTY));
            Player.Commands.Builder controls = new Player.Commands.Builder().addAllCommands();
            if (!own) controls.remove(Player.COMMAND_CHANGE_MEDIA_ITEMS).remove(Player.COMMAND_SET_MEDIA_ITEM);
            return new MediaSession.ConnectionResult.AcceptedResultBuilder(session, controller).setAvailableSessionCommands(commands.build()).setAvailablePlayerCommands(controls.build()).build();
        }

        @Override public ListenableFuture<SessionResult> onCustomCommand(MediaSession session, MediaSession.ControllerInfo controller, SessionCommand command, Bundle args) {
            if (!getPackageName().equals(controller.getPackageName()) || !controller.isPackageNameVerified() || !COMMAND.equals(command.customAction)) return Futures.immediateFuture(new SessionResult(SessionError.ERROR_PERMISSION_DENIED));
            Bundle response = new Bundle();
            try {
                String raw = args.getString("payload", "{}");
                if (raw.length() > 524288) throw new IllegalArgumentException("Data player terlalu besar.");
                JSONObject payload = new JSONObject(raw);
                String action = args.getString("action", "");
                if (action.startsWith("cache-")) response.putString("result", offline.command(action, payload).toString());
                else { execute(action, payload); response.putString("state", state().toString()); }
                return Futures.immediateFuture(new SessionResult(SessionResult.RESULT_SUCCESS, response));
            } catch (Exception error) {
                response.putString("error", error instanceof IllegalArgumentException ? error.getMessage() : "Player Android belum bisa menjalankan perintah ini.");
                return Futures.immediateFuture(new SessionResult(SessionError.ERROR_BAD_VALUE, response));
            }
        }
    }

    private void execute(String action, JSONObject payload) throws Exception {
        switch (action) {
            case "state" -> { }
            case "play" -> {
                PlaybackPayload data = new PlaybackPayload(payload);
                String configured = preferences.getString("server", "");
                serverOrigin = OriginPolicy.server(configured, BuildConfig.DEBUG);
                String requestedOwner = payload.optString("owner", "guest");
                if (!requestedOwner.matches("guest|[A-Za-z0-9_-]{1,80}")) throw new IllegalArgumentException("Pemilik audio tidak valid.");
                owner = requestedOwner;
                applyPreferences(payload);
                List<MediaItem> media = new ArrayList<>();
                for (JSONObject track : data.tracks) media.add(item(track));
                long position = (long) (PlaybackPayload.number(payload, "position", 0, 0, 28800) * 1000);
                player.setMediaItems(media, data.index, position);
                player.prepare();
                player.play();
            }
            case "pause" -> player.pause();
            case "resume" -> { if (player.getMediaItemCount() > 0) { player.prepare(); player.play(); } }
            case "stop" -> { player.pause(); player.clearMediaItems(); sleepDeadline = 0; handler.removeCallbacks(sleep); }
            case "next" -> {
                if (player.getMediaItemCount() > 0) { int index = player.hasNextMediaItem() ? player.getNextMediaItemIndex() : 0; player.seekTo(index, 0); player.prepare(); player.play(); }
            }
            case "previous" -> {
                if (player.getMediaItemCount() > 0) { if (player.getCurrentPosition() > 3000) player.seekTo(0); else player.seekTo(player.hasPreviousMediaItem() ? player.getPreviousMediaItemIndex() : player.getMediaItemCount() - 1, 0); player.prepare(); player.play(); }
            }
            case "seek" -> {
                long position = (long) (PlaybackPayload.number(payload, "position", 0, 0, 28800) * 1000);
                long duration = player.getDuration();
                player.seekTo(duration > 0 ? Math.min(position, duration) : position);
            }
            case "preferences" -> applyPreferences(payload);
            case "queue" -> updateQueue(payload);
            default -> throw new IllegalArgumentException("Perintah player Android tidak valid.");
        }
        persist();
    }

    private void applyPreferences(JSONObject values) {
        if (values.has("volume")) volume = (float) PlaybackPayload.number(values, "volume", volume, 0, 1);
        if (values.has("muted")) muted = values.optBoolean("muted", false);
        if (values.has("shuffle")) player.setShuffleModeEnabled(values.optBoolean("shuffle", false));
        if (values.has("repeat")) {
            String repeat = PlaybackPayload.repeat(values, "off");
            player.setRepeatMode(repeat.equals("one") ? Player.REPEAT_MODE_ONE : repeat.equals("all") ? Player.REPEAT_MODE_ALL : Player.REPEAT_MODE_OFF);
        }
        if (values.has("autoplayNext")) autoplayNext = values.optBoolean("autoplayNext", true);
        if (values.has("preloadNext")) preloadNext = values.optBoolean("preloadNext", true);
        if (values.has("dataSaver")) dataSaver = values.optBoolean("dataSaver", false);
        player.setPreloadConfiguration(new ExoPlayer.PreloadConfiguration(preloadNext && !dataSaver ? 3000000L : 0));
        player.setPauseAtEndOfMediaItems(!autoplayNext && player.getRepeatMode() != Player.REPEAT_MODE_ONE);
        player.setVolume(muted ? 0 : volume);
        if (values.has("sleepMinutes")) {
            long minutes = (long) PlaybackPayload.number(values, "sleepMinutes", 0, 0, 180);
            sleepMinutes = (int) minutes;
            handler.removeCallbacks(sleep);
            sleepDeadline = minutes == 0 ? 0 : SystemClock.elapsedRealtime() + minutes * 60000;
            if (minutes > 0) handler.postDelayed(sleep, minutes * 60000);
        }
        if (values.optString("textColor").matches("#[A-Fa-f0-9]{6}")) preferences.edit().putString("uiTextColor", values.optString("textColor")).apply();
        if (values.optString("backgroundColor").matches("#[A-Fa-f0-9]{6}")) preferences.edit().putString("uiBackgroundColor", values.optString("backgroundColor")).apply();
    }

    private MediaItem item(JSONObject value) throws Exception {
        String id = value.getString("id");
        Bundle extras = new Bundle();
        extras.putString("track", value.toString());
        MediaMetadata.Builder metadata = new MediaMetadata.Builder().setTitle(value.optString("title")).setArtist(value.optString("artist")).setAlbumTitle(value.optString("album")).setExtras(extras).setIsPlayable(true);
        String artwork = OriginPolicy.artwork(serverOrigin, value.optString("coverUrl"));
        if (artwork != null) metadata.setArtworkUri(Uri.parse(artwork));
        File cached = OriginPolicy.episode(id) ? null : offline.existing(owner, id);
        Uri uri = cached == null ? Uri.parse(OriginPolicy.stream(serverOrigin, id)) : Uri.fromFile(cached);
        return new MediaItem.Builder().setMediaId(id).setUri(uri).setMediaMetadata(metadata.build()).build();
    }

    private void updateQueue(JSONObject payload) throws Exception {
        List<JSONObject> tracks = PlaybackPayload.parseQueue(payload.optJSONArray("queue"));
        String id = player.getCurrentMediaItem() == null ? "" : player.getCurrentMediaItem().mediaId;
        long position = player.getCurrentPosition();
        boolean playing = player.getPlayWhenReady();
        List<MediaItem> items = new ArrayList<>();
        int index = -1;
        for (JSONObject track : tracks) { if (track.optString("id").equals(id)) index = items.size(); items.add(item(track)); }
        if (!id.isEmpty() && index < 0) throw new IllegalArgumentException("Audio yang sedang diputar harus tetap ada dalam antrean.");
        player.setMediaItems(items, Math.max(0, index), position);
        player.prepare();
        player.setPlayWhenReady(playing);
    }

    private JSONObject track(MediaItem item) throws Exception {
        return item == null || item.mediaMetadata.extras == null ? null : new JSONObject(item.mediaMetadata.extras.getString("track", "{}"));
    }

    public JSONObject state() throws Exception {
        JSONObject current = track(player.getCurrentMediaItem());
        JSONArray queue = new JSONArray();
        for (int index = 0; index < player.getMediaItemCount(); index++) queue.put(track(player.getMediaItemAt(index)));
        double duration = player.getDuration() > 0 ? player.getDuration() / 1000d : current == null ? 0 : current.optDouble("duration", 0);
        return new JSONObject().put("track", current == null ? JSONObject.NULL : current).put("queue", queue).put("position", Math.max(0, player.getCurrentPosition() / 1000d)).put("duration", duration).put("playing", player.isPlaying()).put("playWhenReady", player.getPlayWhenReady()).put("sleepMinutes", sleepDeadline > SystemClock.elapsedRealtime() ? sleepMinutes : 0).put("loading", player.getPlaybackState() == Player.STATE_BUFFERING).put("error", player.getPlayerError() == null ? "" : "Audio belum bisa diputar. Cek koneksi, lalu coba lagi.").put("shuffle", player.getShuffleModeEnabled()).put("repeat", player.getRepeatMode() == Player.REPEAT_MODE_ONE ? "one" : player.getRepeatMode() == Player.REPEAT_MODE_ALL ? "all" : "off").put("volume", volume).put("muted", muted).put("autoplayNext", autoplayNext).put("preloadNext", preloadNext).put("dataSaver", dataSaver).put("sleepActive", sleepDeadline > SystemClock.elapsedRealtime()).put("owner", owner);
    }

    private void persist() {
        if (player == null || preferences == null) return;
        try { preferences.edit().putString("player", state().put("serverOrigin", serverOrigin).toString()).apply(); }
        catch (Exception ignored) {}
    }

    private void restore() {
        try {
            String configured = preferences.getString("server", "");
            if (configured.isBlank()) return;
            serverOrigin = OriginPolicy.server(configured, BuildConfig.DEBUG);
            JSONObject stored = new JSONObject(preferences.getString("player", "{}"));
            if (!serverOrigin.equals(stored.optString("serverOrigin")) || stored.optJSONArray("queue") == null || stored.getJSONArray("queue").length() == 0 || stored.optJSONObject("track") == null) return;
            PlaybackPayload data = new PlaybackPayload(stored);
            owner = stored.optString("owner", "guest");
            applyPreferences(stored);
            List<MediaItem> items = new ArrayList<>();
            for (JSONObject value : data.tracks) items.add(item(value));
            player.setMediaItems(items, data.index, (long) (PlaybackPayload.number(stored, "position", 0, 0, 28800) * 1000));
            player.prepare();
            player.pause();
        } catch (Exception ignored) { player.clearMediaItems(); }
    }

    @Override public void onTaskRemoved(Intent rootIntent) {
        persist();
        if (!player.getPlayWhenReady() || player.getMediaItemCount() == 0 || player.getPlaybackState() == Player.STATE_ENDED || player.getPlaybackState() == Player.STATE_IDLE) stopSelf();
    }

    @Override public void onDestroy() {
        persist();
        handler.removeCallbacksAndMessages(null);
        offline.close();
        if (session != null) { session.release(); session = null; }
        if (player != null) { player.release(); player = null; }
        super.onDestroy();
    }
}
