package app.mitune;

import android.Manifest;
import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.media3.common.C;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionCommand;
import androidx.media3.session.SessionResult;
import androidx.media3.session.SessionToken;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.google.common.util.concurrent.ListenableFuture;
import org.json.JSONObject;
import java.util.Set;

@UnstableApi
public final class MainActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private SharedPreferences preferences;
    private WebView web;
    private String serverOrigin = "";
    private JavaScriptReplyProxy client;
    private MediaController controller;
    private ListenableFuture<MediaController> controllerFuture;
    private boolean visible;
    private Bundle webState;
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (!visible || controller == null) return;
            try {
                double duration = controller.getDuration() == C.TIME_UNSET ? 0 : Math.max(0, controller.getDuration() / 1000d);
                JSONObject state = new JSONObject().put("position", Math.max(0, controller.getCurrentPosition() / 1000d)).put("playing", controller.isPlaying()).put("playWhenReady", controller.getPlayWhenReady()).put("loading", controller.getPlaybackState() == Player.STATE_BUFFERING);
                if (duration > 0) state.put("duration", duration);
                post(client, new JSONObject().put("type", "state").put("state", state));
            } catch (Exception ignored) {}
            handler.postDelayed(this, 250);
        }
    };

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        preferences = getSharedPreferences("mi-tune", MODE_PRIVATE);
        webState = saved == null ? null : saved.getBundle("web");
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        if (Build.VERSION.SDK_INT >= 33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::back);
        String configured = preferences.getString("server", BuildConfig.DEFAULT_SERVER_URL);
        if (configured.isBlank()) showSetup(null);
        else try { open(OriginPolicy.server(configured, BuildConfig.DEBUG)); } catch (Exception error) { showSetup(error.getMessage()); }
    }

    private void insets(View view) {
        view.setOnApplyWindowInsetsListener((target, value) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = value.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                android.graphics.Insets keyboard = value.getInsets(WindowInsets.Type.ime());
                target.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, keyboard.bottom));
                return WindowInsets.CONSUMED;
            }
            target.setPadding(value.getSystemWindowInsetLeft(), value.getSystemWindowInsetTop(), value.getSystemWindowInsetRight(), value.getSystemWindowInsetBottom());
            return value.consumeSystemWindowInsets();
        });
    }

    private void showSetup(String message) {
        LinearLayout frame = new LinearLayout(this);
        frame.setOrientation(LinearLayout.VERTICAL);
        frame.setBackgroundColor(color(preferences.getString("uiBackgroundColor", "#f4efe7"), 0xfff4efe7));
        insets(frame);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        int padding = (int) (24 * getResources().getDisplayMetrics().density);
        content.setPadding(padding, padding, padding, padding);
        frame.addView(content, new LinearLayout.LayoutParams(-1, -1));
        int foreground = color(preferences.getString("uiTextColor", "#302c29"), 0xff302c29);
        TextView title = new TextView(this);
        title.setText(R.string.server_title);
        title.setTextSize(26);
        title.setTextColor(foreground);
        content.addView(title);
        TextView description = new TextView(this);
        description.setText(R.string.server_description);
        description.setTextSize(15);
        description.setTextColor(foreground);
        description.setPadding(0, padding, 0, padding);
        content.addView(description);
        EditText address = new EditText(this);
        address.setSingleLine(true);
        address.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        address.setHint(R.string.server_hint);
        address.setText(preferences.getString("server", BuildConfig.DEFAULT_SERVER_URL));
        address.setTextColor(foreground);
        address.setHintTextColor(foreground);
        address.setContentDescription(getString(R.string.server_title));
        content.addView(address);
        TextView problem = new TextView(this);
        problem.setTextColor(foreground);
        problem.setText(message == null ? "" : message);
        problem.setPadding(0, padding / 2, 0, padding / 2);
        content.addView(problem);
        Button submit = new Button(this);
        submit.setText(R.string.server_open);
        submit.setTextColor(foreground);
        submit.setOnClickListener(view -> {
            try {
                String next = OriginPolicy.server(address.getText().toString(), BuildConfig.DEBUG);
                if (!serverOrigin.isBlank() && !OriginPolicy.sameOrigin(serverOrigin, next) && controller != null) { controller.pause(); controller.clearMediaItems(); }
                preferences.edit().putString("server", next).apply();
                open(next);
            } catch (Exception error) { problem.setText(error.getMessage()); }
        });
        content.addView(submit);
        setContentView(frame);
    }

    private int color(String value, int fallback) { try { return value.matches("#[A-Fa-f0-9]{6}") ? Color.parseColor(value) : fallback; } catch (Exception error) { return fallback; } }

    private void open(String origin) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) { showSetup(getString(R.string.webview_error)); return; }
        if (web != null && OriginPolicy.sameOrigin(serverOrigin, origin)) { setContentView(web); return; }
        if (web != null) web.destroy();
        serverOrigin = origin;
        client = null;
        preferences.edit().putString("server", origin).apply();
        web = new WebView(this);
        insets(web);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (OriginPolicy.sameOrigin(serverOrigin, request.getUrl().toString())) return false;
                if (request.isForMainFrame() && ("https".equals(request.getUrl().getScheme()) || "http".equals(request.getUrl().getScheme()))) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl())); } catch (Exception ignored) {}
                }
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) { client = null; }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) { if (request.isForMainFrame()) showSetup(getString(R.string.server_error)); }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) { if (request.isForMainFrame()) showSetup(getString(R.string.server_error)); }
        });
        WebViewCompat.addWebMessageListener(web, "MiTuneNative", Set.of(serverOrigin), (view, message, source, mainFrame, reply) -> {
            if (!mainFrame || !OriginPolicy.sameOrigin(serverOrigin, source.toString())) return;
            String raw = message.getData();
            if (raw == null || raw.length() > 524288) return;
            try {
                JSONObject envelope = new JSONObject(raw);
                String id = envelope.optString("id");
                String action = envelope.optString("action");
                if (envelope.optInt("version") != 1 || !id.matches("mi-tune-[0-9]{1,12}")) return;
                client = reply;
                if (action.equals("configure")) { post(reply, new JSONObject().put("id", id).put("ok", true).put("result", true)); showSetup(null); return; }
                if (action.equals("play") && Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 2);
                dispatch(id, action, envelope.optJSONObject("payload") == null ? new JSONObject() : envelope.getJSONObject("payload"), reply);
            } catch (Exception ignored) {}
        });
        setContentView(web);
        if (webState != null && web.restoreState(webState) != null) webState = null;
        else { webState = null; web.loadUrl(serverOrigin + "/"); }
    }

    private void connect() {
        if (controller != null || controllerFuture != null) return;
        SessionToken token = new SessionToken(this, new ComponentName(this, PlaybackService.class));
        controllerFuture = new MediaController.Builder(this, token).buildAsync();
        ListenableFuture<MediaController> future = controllerFuture;
        future.addListener(() -> {
            try {
                if (future != controllerFuture || !visible) { MediaController.releaseFuture(future); if (future == controllerFuture) controllerFuture = null; return; }
                controller = future.get();
                controller.addListener(new Player.Listener() {
                    @Override public void onEvents(Player player, Player.Events events) { fullState(); }
                });
                fullState();
                handler.removeCallbacks(tick);
                handler.post(tick);
            } catch (Exception ignored) {}
        }, getMainExecutor());
    }

    private void dispatch(String id, String action, JSONObject payload, JavaScriptReplyProxy reply) {
        if (!visible) { error(reply, id, "Player Android belum merespons. Coba lagi."); return; }
        connect();
        if (controller == null) {
            if (controllerFuture != null) controllerFuture.addListener(() -> { if (controller != null) dispatch(id, action, payload, reply); else error(reply, id, "Player Android belum tersedia."); }, getMainExecutor());
            else error(reply, id, "Player Android belum tersedia.");
            return;
        }
        Bundle args = new Bundle();
        args.putString("action", action);
        args.putString("payload", payload.toString());
        ListenableFuture<SessionResult> future = controller.sendCustomCommand(new SessionCommand(PlaybackService.COMMAND, Bundle.EMPTY), args);
        future.addListener(() -> {
            try {
                SessionResult result = future.get();
                if (result.resultCode != SessionResult.RESULT_SUCCESS) { error(reply, id, result.extras.getString("error", "Player Android belum bisa menjalankan perintah ini.")); return; }
                JSONObject response = new JSONObject().put("ok", true);
                if (id != null) response.put("id", id);
                String state = result.extras.getString("state");
                String value = result.extras.getString("result");
                if (state != null) response.put("state", new JSONObject(state));
                if (value != null) response.put("result", new JSONObject(value));
                post(reply, response);
            } catch (Exception error) { error(reply, id, "Player Android belum merespons. Coba lagi."); }
        }, getMainExecutor());
    }

    private void fullState() { if (client != null && visible && controller != null) dispatch(null, "state", new JSONObject(), client); }
    private void post(JavaScriptReplyProxy reply, JSONObject value) { if (reply != null) try { reply.postMessage(value.toString()); } catch (Exception ignored) {} }
    private void error(JavaScriptReplyProxy reply, String id, String message) { try { post(reply, new JSONObject().put("id", id).put("ok", false).put("error", message)); } catch (Exception ignored) {} }

    @Override public void onStart() { super.onStart(); visible = true; connect(); }
    @Override public void onStop() {
        visible = false;
        handler.removeCallbacks(tick);
        if (controllerFuture != null) MediaController.releaseFuture(controllerFuture);
        controllerFuture = null;
        controller = null;
        super.onStop();
    }
    @Override public void onSaveInstanceState(Bundle saved) { if (web != null) { Bundle data = new Bundle(); web.saveState(data); saved.putBundle("web", data); } super.onSaveInstanceState(saved); }
    private void back() { if (web != null && web.canGoBack()) web.goBack(); else moveTaskToBack(true); }
    @Override public void onBackPressed() { back(); }
    @Override public void onDestroy() { handler.removeCallbacksAndMessages(null); if (web != null) web.destroy(); super.onDestroy(); }
}
