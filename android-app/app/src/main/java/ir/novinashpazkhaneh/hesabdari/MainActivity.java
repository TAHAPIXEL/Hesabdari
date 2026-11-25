package ir.novinashpazkhaneh.hesabdari;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {

    private static final String APP_HOST = "hesabdari-taupe.vercel.app";
    private static final String APP_ORIGIN = "https://" + APP_HOST;
    private static final int REQ_PERMISSIONS = 1001;
    private static final int REQ_FILE_CHOOSER = 1002;
    private static final String CACHED_HTML_NAME = "cached_hsab_v8.html";

    private static final int COLOR_PAPER = Color.parseColor("#FCFAF5");

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private PermissionRequest pendingWebCameraRequest;
    private ConnectivityManager.NetworkCallback networkCallback;
    private OnBackInvokedCallback backInvokedCallback;
    private final ExecutorService bgExecutor = Executors.newSingleThreadExecutor();

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(COLOR_PAPER);

        webView = new WebView(this);
        webView.setBackgroundColor(COLOR_PAPER);
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        setContentView(root);

        setupSystemBars();

        configureWebView();
        requestStartupPermissions();
        registerNetworkSyncWatcher();
        registerPredictiveBackIfSupported();

        String initialUrl = buildLaunchUrl(getIntent());
        webView.loadUrl(initialUrl);
        refreshCachedHtmlInBackground();
    }

    /**
     * Mirrors Capacitor 8 SystemBars (as used in Hamdel):
     * pads DecorView by systemBars | displayCutout (plus IME when keyboard is open)
     * and passes zeroed system-bar insets down to WebView so the app sits strictly
     * below the top status / control-center bar and above the bottom navigation bar
     * without triggering Android 15/16 cutout-mode IllegalArgumentException.
     */
    private void setupSystemBars() {
        try {
            final Window window = getWindow();
            if (window == null) return;
            final View decorView = window.getDecorView();

            decorView.setBackgroundColor(COLOR_PAPER);

            ViewCompat.setOnApplyWindowInsetsListener(decorView, (v, insets) -> {
                Insets systemBarsInsets = insets.getInsets(
                        WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                );
                Insets imeInsets = insets.getInsets(WindowInsetsCompat.Type.ime());
                boolean keyboardVisible = insets.isVisible(WindowInsetsCompat.Type.ime());
                int bottomPad = keyboardVisible
                        ? Math.max(systemBarsInsets.bottom, imeInsets.bottom)
                        : systemBarsInsets.bottom;

                v.setPadding(
                        systemBarsInsets.left,
                        systemBarsInsets.top,
                        systemBarsInsets.right,
                        bottomPad
                );

                return new WindowInsetsCompat.Builder(insets)
                        .setInsets(
                                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout(),
                                Insets.of(0, 0, 0, 0)
                        )
                        .build();
            });

            applySystemBarAppearance();
            ViewCompat.requestApplyInsets(decorView);
        } catch (Throwable ignored) {
        }
    }

    private void applySystemBarAppearance() {
        try {
            Window window = getWindow();
            if (window == null) return;
            View decorView = window.getDecorView();
            decorView.setBackgroundColor(COLOR_PAPER);
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decorView);
            controller.setAppearanceLightStatusBars(true);
            controller.setAppearanceLightNavigationBars(true);
            controller.show(WindowInsetsCompat.Type.systemBars());
        } catch (Throwable ignored) {
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        applySystemBarAppearance();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applySystemBarAppearance();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String action = extractShortcutAction(intent);
        if (action != null && !action.isEmpty() && webView != null) {
            webView.loadUrl(APP_ORIGIN + "/?action=" + Uri.encode(action));
        }
    }

    private String extractShortcutAction(Intent intent) {
        if (intent == null) return null;
        Uri data = intent.getData();
        if (data != null) {
            String act = data.getQueryParameter("action");
            if (act != null && !act.isEmpty()) {
                return act;
            }
        }
        return null;
    }

    private String buildLaunchUrl(Intent intent) {
        String action = extractShortcutAction(intent);
        if (action != null && !action.isEmpty()) {
            return APP_ORIGIN + "/?action=" + Uri.encode(action);
        }
        return APP_ORIGIN + "/";
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void configureWebView() {
        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setMediaPlaybackRequiresUserGesture(false);
        ws.setAllowFileAccess(false);
        ws.setAllowContentAccess(true);
        ws.setLoadWithOverviewMode(true);
        ws.setUseWideViewPort(true);
        ws.setSupportZoom(false);
        ws.setBuiltInZoomControls(false);
        ws.setDisplayZoomControls(false);
        ws.setTextZoom(100);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        ws.setUserAgentString(ws.getUserAgentString() + " NovinAshpazkhanehAPK/1.0.2");

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(webView, false);

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidNative");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (request == null || request.getUrl() == null) return null;
                if (!"GET".equalsIgnoreCase(request.getMethod())) return null;

                Uri uri = request.getUrl();
                String host = uri.getHost();
                if (host == null || !APP_HOST.equalsIgnoreCase(host)) {
                    return null;
                }

                String path = uri.getPath();
                if (path == null || path.isEmpty()) {
                    path = "/";
                }

                // Never intercept live cloud API endpoints (/api/sync, /api/health)
                if (path.startsWith("/api/")) {
                    return null;
                }

                if ("/".equals(path) || "/hsab.html".equals(path)) {
                    return serveAppHtml();
                }

                String assetRelPath = path.startsWith("/") ? path.substring(1) : path;
                return serveBundledAsset("web/" + assetRelPath, guessMimeType(assetRelPath));
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request == null || request.getUrl() == null) return false;
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if ("tel".equalsIgnoreCase(scheme) || "mailto".equalsIgnoreCase(scheme) || "sms".equalsIgnoreCase(scheme)) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception ignored) {
                    }
                    return true;
                }
                if (APP_HOST.equalsIgnoreCase(uri.getHost())) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                view.evaluateJavascript(
                        "(function(){if(window.AndroidNative&&!window.__novinPrintPatched){window.__novinPrintPatched=true;window.print=function(){window.AndroidNative.printPage();};}})();",
                        null
                );
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> handleWebPermissionRequest(request));
            }

            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams
            ) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;

                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                        "application/json",
                        "text/plain",
                        "application/octet-stream"
                });
                try {
                    startActivityForResult(Intent.createChooser(intent, "انتخاب فایل پشتیبان JSON"), REQ_FILE_CHOOSER);
                    return true;
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    return false;
                }
            }
        });
    }

    private WebResourceResponse serveAppHtml() {
        Map<String, String> headers = buildLocalHeaders("no-cache");
        try {
            File cached = new File(getFilesDir(), CACHED_HTML_NAME);
            if (cached.exists() && cached.length() > 1024) {
                InputStream fis = new FileInputStream(cached);
                return new WebResourceResponse("text/html", "UTF-8", 200, "OK", headers, fis);
            }
        } catch (Exception ignored) {
        }
        return serveBundledAsset("web/hsab.html", "text/html");
    }

    private WebResourceResponse serveBundledAsset(String assetPath, String mimeType) {
        try {
            InputStream is = getAssets().open(assetPath);
            String cacheControl = assetPath.contains("/fonts/") || assetPath.contains("/icons/")
                    ? "public, max-age=31536000, immutable"
                    : "no-cache";
            Map<String, String> headers = buildLocalHeaders(cacheControl);
            String encoding = mimeType.startsWith("text/") || mimeType.contains("json") || mimeType.contains("javascript") || mimeType.contains("svg")
                    ? "UTF-8"
                    : null;
            return new WebResourceResponse(mimeType, encoding, 200, "OK", headers, is);
        } catch (Exception e) {
            return null;
        }
    }

    private Map<String, String> buildLocalHeaders(String cacheControl) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", APP_ORIGIN);
        headers.put("Cache-Control", cacheControl);
        return headers;
    }

    private String guessMimeType(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".html")) return "text/html";
        if (lower.endsWith(".js")) return "application/javascript";
        if (lower.endsWith(".webmanifest") || lower.endsWith(".json")) return "application/manifest+json";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".ico")) return "image/x-icon";
        if (lower.endsWith(".css")) return "text/css";
        return "application/octet-stream";
    }

    private void refreshCachedHtmlInBackground() {
        bgExecutor.execute(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(APP_ORIGIN + "/hsab.html");
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(4000);
                conn.setReadTimeout(6000);
                conn.setUseCaches(false);
                if (conn.getResponseCode() == 200) {
                    ByteArrayOutputStream bos = new ByteArrayOutputStream();
                    try (InputStream in = conn.getInputStream()) {
                        byte[] buf = new byte[8192];
                        int r;
                        while ((r = in.read(buf)) != -1) {
                            bos.write(buf, 0, r);
                        }
                    }
                    byte[] data = bos.toByteArray();
                    String preview = new String(data, 0, Math.min(data.length, 512), StandardCharsets.UTF_8);
                    if (data.length > 20000 && preview.toLowerCase().contains("<!doctype html>")) {
                        File tmp = new File(getFilesDir(), CACHED_HTML_NAME + ".tmp");
                        try (FileOutputStream fos = new FileOutputStream(tmp)) {
                            fos.write(data);
                            fos.flush();
                        }
                        File dst = new File(getFilesDir(), CACHED_HTML_NAME);
                        //noinspection ResultOfMethodCallIgnored
                        tmp.renameTo(dst);
                    }
                }
            } catch (Exception ignored) {
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    private void requestStartupPermissions() {
        List<String> needed = new ArrayList<>();
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.CAMERA);
        }
        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }
        if (Build.VERSION.SDK_INT <= 28) {
            if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
            }
        }
        if (!needed.isEmpty()) {
            requestPermissions(needed.toArray(new String[0]), REQ_PERMISSIONS);
        }
    }

    private void handleWebPermissionRequest(PermissionRequest request) {
        if (request == null) return;
        boolean wantsVideo = false;
        for (String res : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(res)) {
                wantsVideo = true;
                break;
            }
        }
        if (!wantsVideo) {
            request.grant(request.getResources());
            return;
        }
        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
        } else {
            pendingWebCameraRequest = request;
            requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_PERMISSIONS);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_PERMISSIONS && pendingWebCameraRequest != null) {
            PermissionRequest req = pendingWebCameraRequest;
            pendingWebCameraRequest = null;
            if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                req.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            } else {
                req.deny();
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE_CHOOSER) {
            ValueCallback<Uri[]> cb = filePathCallback;
            filePathCallback = null;
            if (cb == null) return;
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                if (data.getData() != null) {
                    results = new Uri[]{data.getData()};
                } else if (data.getClipData() != null && data.getClipData().getItemCount() > 0) {
                    results = new Uri[]{data.getClipData().getItemAt(0).getUri()};
                }
            }
            cb.onReceiveValue(results);
        }
    }

    private void registerNetworkSyncWatcher() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return;
            NetworkRequest request = new NetworkRequest.Builder()
                    .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    .build();
            networkCallback = new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(Network network) {
                    refreshCachedHtmlInBackground();
                    runOnUiThread(() -> {
                        if (webView != null) {
                            webView.evaluateJavascript(
                                    "if(typeof window.__novinTriggerSync==='function')window.__novinTriggerSync();",
                                    null
                            );
                        }
                    });
                }
            };
            cm.registerNetworkCallback(request, networkCallback);
        } catch (Exception ignored) {
        }
    }

    private void registerPredictiveBackIfSupported() {
        try {
            if (Build.VERSION.SDK_INT >= 33) {
                backInvokedCallback = this::dispatchBackToWebOrExit;
                getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                        OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                        backInvokedCallback
                );
            }
        } catch (Throwable ignored) {
        }
    }

    private void dispatchBackToWebOrExit() {
        if (webView == null) {
            finish();
            return;
        }
        webView.evaluateJavascript(
                "(typeof window.__novinHandleBack==='function')?Boolean(window.__novinHandleBack()):false",
                value -> {
                    if (!"true".equalsIgnoreCase(value != null ? value.trim() : "")) {
                        moveTaskToBack(true);
                    }
                }
        );
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        dispatchBackToWebOrExit();
    }

    @Override
    protected void onDestroy() {
        if (Build.VERSION.SDK_INT >= 33 && backInvokedCallback != null) {
            try {
                getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backInvokedCallback);
            } catch (Exception ignored) {
            }
        }
        if (networkCallback != null) {
            try {
                ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
                if (cm != null) cm.unregisterNetworkCallback(networkCallback);
            } catch (Exception ignored) {
            }
        }
        bgExecutor.shutdownNow();
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private final class AndroidBridge {

        @JavascriptInterface
        public boolean saveFile(String fileName, String content, String mimeType) {
            try {
                String safeName = sanitizeFileName(fileName);
                String cleanMime = cleanMimeType(mimeType, safeName);
                byte[] bytes = (content != null ? content : "").getBytes(StandardCharsets.UTF_8);

                if (Build.VERSION.SDK_INT >= 29) {
                    ContentResolver resolver = getContentResolver();
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, cleanMime);
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri != null) {
                        try (OutputStream os = resolver.openOutputStream(uri)) {
                            if (os != null) {
                                os.write(bytes);
                                os.flush();
                                return true;
                            }
                        }
                    }
                }

                File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (downloadsDir == null || (!downloadsDir.exists() && !downloadsDir.mkdirs())) {
                    downloadsDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                }
                if (downloadsDir != null) {
                    if (!downloadsDir.exists()) {
                        //noinspection ResultOfMethodCallIgnored
                        downloadsDir.mkdirs();
                    }
                    File outFile = new File(downloadsDir, safeName);
                    try (FileOutputStream fos = new FileOutputStream(outFile)) {
                        fos.write(bytes);
                        fos.flush();
                        return true;
                    }
                }
            } catch (Exception ignored) {
            }
            return false;
        }

        @JavascriptInterface
        public boolean shareFile(String fileName, String content, String mimeType) {
            try {
                String safeName = sanitizeFileName(fileName);
                String cleanMime = cleanMimeType(mimeType, safeName);
                byte[] bytes = (content != null ? content : "").getBytes(StandardCharsets.UTF_8);

                File shareDir = new File(getCacheDir(), "shared");
                if (!shareDir.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    shareDir.mkdirs();
                }
                File target = new File(shareDir, safeName);
                try (FileOutputStream fos = new FileOutputStream(target)) {
                    fos.write(bytes);
                    fos.flush();
                }

                Uri contentUri = BackupFileProvider.getUriForFile(MainActivity.this, target);
                Intent shareIntent = new Intent(Intent.ACTION_SEND);
                shareIntent.setType(cleanMime);
                shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                shareIntent.putExtra(Intent.EXTRA_SUBJECT, "پشتیبان نوین آشپزخانه");
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                runOnUiThread(() -> {
                    Intent chooser = Intent.createChooser(shareIntent, "اشتراک‌گذاری فایل پشتیبان");
                    startActivity(chooser);
                });
                return true;
            } catch (Exception ignored) {
                return false;
            }
        }

        @JavascriptInterface
        public void printPage() {
            runOnUiThread(() -> {
                try {
                    if (webView == null) return;
                    PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                    if (pm == null) return;
                    String jobName = "NovinAshpazkhaneh-" + System.currentTimeMillis();
                    PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(jobName);
                    pm.print(jobName, adapter, new PrintAttributes.Builder().build());
                } catch (Exception ignored) {
                }
            });
        }

        private String sanitizeFileName(String raw) {
            if (raw == null || raw.trim().isEmpty()) {
                return "novin-ashpazkhaneh-backup.json";
            }
            return raw.replaceAll("[^a-zA-Z0-9._\\-\\u0600-\\u06FF]", "_");
        }

        private String cleanMimeType(String rawMime, String safeName) {
            if (rawMime != null && !rawMime.isEmpty()) {
                int semi = rawMime.indexOf(';');
                return (semi > 0 ? rawMime.substring(0, semi) : rawMime).trim();
            }
            if (safeName.endsWith(".json")) return "application/json";
            if (safeName.endsWith(".csv")) return "text/csv";
            return "application/octet-stream";
        }
    }
}
