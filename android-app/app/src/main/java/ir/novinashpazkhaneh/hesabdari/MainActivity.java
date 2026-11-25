package ir.novinashpazkhaneh.hesabdari;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.media.MediaScannerConnection;
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
import android.provider.Settings;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
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
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {

    public static final String HESABDARI_FOLDER_NAME = "حسابداری";

    private static final String APP_HOST = "hesabdari-taupe.vercel.app";
    private static final String APP_ORIGIN = "https://" + APP_HOST;
    private static final int REQ_STARTUP_PERMS = 1001;
    private static final int REQ_FILE_CHOOSER = 1002;
    private static final int REQ_WEB_CAMERA = 1003;
    private static final int REQ_MANAGE_STORAGE = 1004;
    private static final int APP_VERSION_CODE = 9;
    private static final String CACHED_HTML_NAME = "cached_hsab_v12.html";
    private static final String PREFS_NAME = "hesabdari_native_prefs";
    private static final String PREF_THEME_KEY = "app.theme";
    private static final String PREF_VER_KEY = "app.installed_version";

    private static final int COLOR_PAPER = Color.parseColor("#EEF2F9");
    private static final int COLOR_DARK = Color.parseColor("#070B14");

    private String currentTheme = "dark";

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private PermissionRequest pendingWebCameraRequest;
    private ConnectivityManager.NetworkCallback networkCallback;
    private OnBackInvokedCallback backInvokedCallback;
    private boolean allFilesDialogShownThisSession = false;
    private boolean startupPermsTriggered = false;
    private boolean fallbackLoaded = false;
    private Bitmap transparentPosterBitmap;
    private final ExecutorService bgExecutor = Executors.newSingleThreadExecutor();

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        cleanupStaleCachedHtml();

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

        // Restore saved theme preference before drawing system bars
        try {
            currentTheme = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .getString(PREF_THEME_KEY, "dark");
            if (!"light".equals(currentTheme)) currentTheme = "dark";
        } catch (Throwable ignored) {}
        int initialBg = "dark".equals(currentTheme) ? COLOR_DARK : COLOR_PAPER;
        root.setBackgroundColor(initialBg);
        webView.setBackgroundColor(initialBg);

        setupSystemBars();

        configureWebView();
        purgeStaleWebCacheOnUpgrade();
        ensureHesabdariFolderCreated(false);
        registerNetworkSyncWatcher();
        registerPredictiveBackIfSupported();

        String initialUrl = buildLaunchUrl(getIntent());
        webView.loadUrl(initialUrl);
        webView.postDelayed(this::triggerStartupPermissionsOnce, 1800);
        refreshCachedHtmlInBackground();
    }

    private void cleanupStaleCachedHtml() {
        try {
            File dir = getFilesDir();
            File[] files = dir != null ? dir.listFiles() : null;
            if (files == null) return;
            for (File f : files) {
                String nm = f.getName();
                if (nm.startsWith("cached_hsab_") && !CACHED_HTML_NAME.equals(nm)) {
                    //noinspection ResultOfMethodCallIgnored
                    f.delete();
                }
            }
        } catch (Throwable ignored) {
        }
    }

    /**
     * When the user installs a newer APK on top of an older version, purge stale WebView HTTP
     * resource caches and any old cached HTML shell while keeping localStorage / IndexedDB intact.
     */
    private void purgeStaleWebCacheOnUpgrade() {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            int prevVer = prefs.getInt(PREF_VER_KEY, 0);
            if (prevVer < APP_VERSION_CODE) {
                File dir = getFilesDir();
                File[] files = dir != null ? dir.listFiles() : null;
                if (files != null) {
                    for (File f : files) {
                        if (f.getName().startsWith("cached_hsab_")) {
                            //noinspection ResultOfMethodCallIgnored
                            f.delete();
                        }
                    }
                }
                if (webView != null) {
                    webView.clearCache(true);
                }
                prefs.edit().putInt(PREF_VER_KEY, APP_VERSION_CODE).apply();
            }
        } catch (Throwable ignored) {
        }
    }

    private void triggerStartupPermissionsOnce() {
        if (startupPermsTriggered || isFinishing() || isDestroyed()) return;
        startupPermsTriggered = true;
        requestStartupPermissionsAndFolderSetup();
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
            boolean isDark = "dark".equals(currentTheme);
            int bg = isDark ? COLOR_DARK : COLOR_PAPER;
            decorView.setBackgroundColor(bg);
            if (webView != null) webView.setBackgroundColor(bg);
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decorView);
            // Light (Crystal Daylight) → dark icons on light bars; Dark (Aurora) → light icons
            controller.setAppearanceLightStatusBars(!isDark);
            controller.setAppearanceLightNavigationBars(!isDark);
            controller.show(WindowInsetsCompat.Type.systemBars());
        } catch (Throwable ignored) {
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        applySystemBarAppearance();
        ensureHesabdariFolderCreated(true);
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

    /**
     * Checks whether this app can directly create/write top-level /storage/emulated/0/حسابداری.
     */
    private boolean canWriteTopLevelStorage() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return Environment.isExternalStorageManager();
        }
        return checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
    }

    /**
     * Returns the top-level phone folder /storage/emulated/0/حسابداری among main folders.
     */
    private File getTopLevelHesabdariDir() {
        return new File(Environment.getExternalStorageDirectory(), HESABDARI_FOLDER_NAME);
    }

    /**
     * Ensures the top-level folder "حسابداری" exists in the phone's main internal storage root.
     */
    private boolean ensureHesabdariFolderCreated(boolean notifyIfFirstTime) {
        try {
            if (!canWriteTopLevelStorage()) {
                return false;
            }
            File dir = getTopLevelHesabdariDir();
            boolean existedBefore = dir.exists() && dir.isDirectory();
            boolean ok = existedBefore || dir.mkdirs();
            if (ok) {
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
                boolean announced = prefs.getBoolean("hesabdari_folder_ready", false);
                if (!announced) {
                    prefs.edit().putBoolean("hesabdari_folder_ready", true).apply();
                    if (notifyIfFirstTime) {
                        Toast.makeText(
                                this,
                                "پوشهٔ «حسابداری» در پوشه‌های اصلی حافظهٔ گوشی ساخته شد",
                                Toast.LENGTH_LONG
                        ).show();
                    }
                }
            }
            return ok;
        } catch (Throwable ignored) {
            return false;
        }
    }

    private void openAllFilesAccessSettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return;
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
            intent.setData(Uri.parse("package:" + getPackageName()));
            startActivityForResult(intent, REQ_MANAGE_STORAGE);
        } catch (Exception e) {
            try {
                Intent fallback = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                startActivityForResult(fallback, REQ_MANAGE_STORAGE);
            } catch (Exception ignored) {
            }
        }
    }

    private void promptAllFilesAccessDialog(boolean forceShow) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return;
        if (Environment.isExternalStorageManager()) {
            ensureHesabdariFolderCreated(true);
            return;
        }
        if (!forceShow && allFilesDialogShownThisSession) return;
        allFilesDialogShownThisSession = true;

        runOnUiThread(() -> {
            if (isFinishing() || isDestroyed()) return;
            try {
                AlertDialog dialog = new AlertDialog.Builder(MainActivity.this)
                        .setTitle("ساخت پوشهٔ اصلی «حسابداری»")
                        .setMessage("برای ایجاد پوشهٔ «حسابداری» بین پوشه‌های اصلی حافظهٔ گوشی و ذخیرهٔ خودکار تمام فایل‌های دانلودی داخل آن، لطفاً در صفحهٔ بعد کلید دسترسی مدیریت فایل‌ها را روشن کنید.")
                        .setCancelable(true)
                        .setPositiveButton("فعال‌سازی", (d, which) -> openAllFilesAccessSettings())
                        .setNegativeButton("بعداً", (d, which) -> d.dismiss())
                        .create();
                dialog.show();
            } catch (Throwable ignored) {
            }
        });
    }

    /**
     * Central helper that saves EVERY downloaded/exported file inside the "حسابداری" folder.
     */
    private boolean saveBytesToHesabdariFolder(String rawFileName, byte[] bytes, String rawMime) {
        String safeName = sanitizeFileName(rawFileName);
        String cleanMime = cleanMimeType(rawMime, safeName);
        byte[] payload = bytes != null ? bytes : new byte[0];

        // 1. Primary path: top-level phone folder /storage/emulated/0/حسابداری
        if (canWriteTopLevelStorage()) {
            try {
                File rootFolder = getTopLevelHesabdariDir();
                if (!rootFolder.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    rootFolder.mkdirs();
                }
                if (rootFolder.exists() && rootFolder.isDirectory()) {
                    File outFile = new File(rootFolder, safeName);
                    try (FileOutputStream fos = new FileOutputStream(outFile)) {
                        fos.write(payload);
                        fos.flush();
                    }
                    MediaScannerConnection.scanFile(
                            MainActivity.this,
                            new String[]{outFile.getAbsolutePath()},
                            new String[]{cleanMime},
                            null
                    );
                    return true;
                }
            } catch (Exception ignored) {
            }
        }

        // 2. Fallback path if Android 11+ All-Files Access has not been toggled yet:
        //    Save into Download/حسابداری via MediaStore so the file is STILL inside "حسابداری",
        //    and prompt the user to enable All-Files Access for top-level /storage/emulated/0/حسابداری.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                ContentResolver resolver = getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
                values.put(MediaStore.MediaColumns.MIME_TYPE, cleanMime);
                values.put(
                        MediaStore.MediaColumns.RELATIVE_PATH,
                        Environment.DIRECTORY_DOWNLOADS + "/" + HESABDARI_FOLDER_NAME
                );
                Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri != null) {
                    try (OutputStream os = resolver.openOutputStream(uri)) {
                        if (os != null) {
                            os.write(payload);
                            os.flush();
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && !Environment.isExternalStorageManager()) {
                                promptAllFilesAccessDialog(true);
                            }
                            return true;
                        }
                    }
                }
            } catch (Exception ignored) {
            }
        }

        // 3. Legacy Android 7-9 fallback
        try {
            File legacyRoot = getTopLevelHesabdariDir();
            if (!legacyRoot.exists() && !legacyRoot.mkdirs()) {
                File dl = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                legacyRoot = new File(dl, HESABDARI_FOLDER_NAME);
                //noinspection ResultOfMethodCallIgnored
                legacyRoot.mkdirs();
            }
            File outFile = new File(legacyRoot, safeName);
            try (FileOutputStream fos = new FileOutputStream(outFile)) {
                fos.write(payload);
                fos.flush();
            }
            MediaScannerConnection.scanFile(
                    MainActivity.this,
                    new String[]{outFile.getAbsolutePath()},
                    new String[]{cleanMime},
                    null
            );
            return true;
        } catch (Exception ignored) {
        }

        return false;
    }

    private String sanitizeFileName(String raw) {
        if (raw == null || raw.trim().isEmpty()) {
            return "hesabdari-file-" + System.currentTimeMillis() + ".json";
        }
        String cleaned = raw.trim().replaceAll("[\\\\/:*?\"<>|]", "_");
        if (cleaned.isEmpty() || ".".equals(cleaned) || "..".equals(cleaned)) {
            return "hesabdari-file-" + System.currentTimeMillis();
        }
        return cleaned;
    }

    private String cleanMimeType(String rawMime, String safeName) {
        if (rawMime != null && !rawMime.isEmpty()) {
            int semi = rawMime.indexOf(';');
            String trimmed = (semi > 0 ? rawMime.substring(0, semi) : rawMime).trim();
            if (!trimmed.isEmpty()) return trimmed;
        }
        String lower = safeName.toLowerCase();
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".csv")) return "text/csv";
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".html")) return "text/html";
        return "application/octet-stream";
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
        ws.setLoadWithOverviewMode(false);
        ws.setUseWideViewPort(true);
        ws.setSupportZoom(false);
        ws.setBuiltInZoomControls(false);
        ws.setDisplayZoomControls(false);
        ws.setTextZoom(100);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        ws.setUserAgentString(ws.getUserAgentString() + " HesabdariAPK/1.0.6");

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(webView, false);

        // Route Service Worker fetches through the same local asset interceptor for instant offline/online launch
        try {
            ServiceWorkerController swc = ServiceWorkerController.getInstance();
            swc.getServiceWorkerWebSettings().setAllowContentAccess(true);
            swc.getServiceWorkerWebSettings().setAllowFileAccess(false);
            swc.setServiceWorkerClient(new ServiceWorkerClient() {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                    return interceptLocalWebAsset(request);
                }
            });
        } catch (Throwable ignored) {
        }

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidNative");

        // Intercept EVERY WebView download (blob:, data:, http/https, <a download>) -> save into "حسابداری"
        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            if (url == null || url.isEmpty()) return;
            final String guessedName = sanitizeFileName(URLUtil.guessFileName(url, contentDisposition, mimetype));
            if (url.startsWith("data:")) {
                bgExecutor.execute(() -> {
                    boolean ok = saveDataUriToHesabdari(guessedName, url, mimetype);
                    showSavedToastOnUi(guessedName, ok);
                });
                return;
            }
            if (url.startsWith("blob:")) {
                String escapedUrl = url.replace("\\", "\\\\").replace("'", "\\'");
                String escapedName = guessedName.replace("\\", "\\\\").replace("'", "\\'");
                String escapedMime = (mimetype != null ? mimetype : "").replace("\\", "\\\\").replace("'", "\\'");
                String js = "(function(){fetch('" + escapedUrl + "').then(function(r){return r.blob();}).then(function(b){" +
                        "var fr=new FileReader();fr.onloadend=function(){" +
                        "if(window.AndroidNative&&window.AndroidNative.saveBase64File){" +
                        "var ok=window.AndroidNative.saveBase64File('" + escapedName + "',String(fr.result||''),b.type||'" + escapedMime + "');" +
                        "if(typeof toast==='function')toast(ok?'فایل " + escapedName + " در پوشهٔ «حسابداری» گوشی ذخیره شد':'ذخیرهٔ فایل ممکن نشد',ok?'ok':'bad');" +
                        "}};fr.readAsDataURL(b);}).catch(function(){});})();";
                webView.evaluateJavascript(js, null);
                return;
            }
            if (url.startsWith("http://") || url.startsWith("https://")) {
                final String cookie = CookieManager.getInstance().getCookie(url);
                bgExecutor.execute(() -> {
                    boolean ok = downloadHttpUrlToHesabdari(url, userAgent, cookie, guessedName, mimetype);
                    showSavedToastOnUi(guessedName, ok);
                });
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return interceptLocalWebAsset(request);
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
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request != null && request.isForMainFrame() && !fallbackLoaded) {
                    fallbackLoaded = true;
                    loadBundledHtmlFallback(view, request.getUrl() != null ? request.getUrl().toString() : (APP_ORIGIN + "/"));
                }
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                try {
                    if (!isFinishing() && !isDestroyed()) {
                        recreate();
                    }
                } catch (Throwable ignored) {
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
                view.postDelayed(MainActivity.this::triggerStartupPermissionsOnce, 500);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public Bitmap getDefaultVideoPoster() {
                if (transparentPosterBitmap == null) {
                    transparentPosterBitmap = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888);
                }
                return transparentPosterBitmap;
            }

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

    private void showSavedToastOnUi(String fileName, boolean ok) {
        runOnUiThread(() -> Toast.makeText(
                MainActivity.this,
                ok
                        ? "فایل " + fileName + " در پوشهٔ «حسابداری» گوشی ذخیره شد"
                        : "ذخیرهٔ فایل ممکن نشد",
                Toast.LENGTH_SHORT
        ).show());
    }

    private boolean saveDataUriToHesabdari(String fallbackName, String dataUri, String fallbackMime) {
        try {
            int comma = dataUri.indexOf(',');
            if (comma < 0) return false;
            String meta = dataUri.substring(5, comma);
            String payloadPart = dataUri.substring(comma + 1);
            boolean isBase64 = meta.contains(";base64");
            String mime = fallbackMime;
            int semi = meta.indexOf(';');
            String parsedMime = semi >= 0 ? meta.substring(0, semi) : meta;
            if (!parsedMime.trim().isEmpty()) {
                mime = parsedMime.trim();
            }
            byte[] bytes = isBase64
                    ? Base64.decode(payloadPart, Base64.DEFAULT)
                    : URLDecoder.decode(payloadPart, "UTF-8").getBytes(StandardCharsets.UTF_8);
            return saveBytesToHesabdariFolder(fallbackName, bytes, mime);
        } catch (Exception e) {
            return false;
        }
    }

    private boolean downloadHttpUrlToHesabdari(
            String urlStr,
            String userAgent,
            String cookie,
            String fileName,
            String mimeType
    ) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlStr);
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(20000);
            if (userAgent != null && !userAgent.isEmpty()) {
                conn.setRequestProperty("User-Agent", userAgent);
            }
            if (cookie != null && !cookie.isEmpty()) {
                conn.setRequestProperty("Cookie", cookie);
            }
            int status = conn.getResponseCode();
            if (status >= 200 && status < 300) {
                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                try (InputStream in = conn.getInputStream()) {
                    byte[] buf = new byte[8192];
                    int r;
                    while ((r = in.read(buf)) != -1) {
                        bos.write(buf, 0, r);
                    }
                }
                String finalMime = conn.getContentType() != null ? conn.getContentType() : mimeType;
                return saveBytesToHesabdariFolder(fileName, bos.toByteArray(), finalMime);
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
        return false;
    }

    private WebResourceResponse interceptLocalWebAsset(WebResourceRequest request) {
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

    private void loadBundledHtmlFallback(WebView view, String baseUrl) {
        try (InputStream is = getAssets().open("web/hsab.html")) {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int r;
            while ((r = is.read(buf)) != -1) {
                bos.write(buf, 0, r);
            }
            String html = new String(bos.toByteArray(), StandardCharsets.UTF_8);
            String originBase = (baseUrl != null && baseUrl.startsWith(APP_ORIGIN)) ? baseUrl : (APP_ORIGIN + "/");
            view.loadDataWithBaseURL(originBase, html, "text/html", "UTF-8", originBase);
        } catch (Exception ignored) {
        }
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

    private void requestStartupPermissionsAndFolderSetup() {
        List<String> needed = new ArrayList<>();
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.CAMERA);
        }
        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.Q) {
            if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
            }
        }
        if (!needed.isEmpty()) {
            requestPermissions(needed.toArray(new String[0]), REQ_STARTUP_PERMS);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && !Environment.isExternalStorageManager()) {
            promptAllFilesAccessDialog(false);
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
            try {
                request.grant(request.getResources());
            } catch (Throwable ignored) {
            }
            return;
        }
        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            try {
                request.grant(request.getResources());
            } catch (Throwable ignored) {
            }
        } else {
            if (pendingWebCameraRequest != null && pendingWebCameraRequest != request) {
                try {
                    pendingWebCameraRequest.deny();
                } catch (Throwable ignored) {
                }
            }
            pendingWebCameraRequest = request;
            requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_WEB_CAMERA);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        ensureHesabdariFolderCreated(true);

        if ((requestCode == REQ_WEB_CAMERA || requestCode == REQ_STARTUP_PERMS) && pendingWebCameraRequest != null) {
            PermissionRequest req = pendingWebCameraRequest;
            pendingWebCameraRequest = null;
            try {
                if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    req.grant(req.getResources());
                } else {
                    req.deny();
                }
            } catch (Throwable ignored) {
            }
        }

        if (requestCode == REQ_STARTUP_PERMS
                && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                && !Environment.isExternalStorageManager()) {
            promptAllFilesAccessDialog(false);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_MANAGE_STORAGE) {
            ensureHesabdariFolderCreated(true);
            return;
        }
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
        public void requestNativePermissions() {
            runOnUiThread(() -> {
                allFilesDialogShownThisSession = false;
                requestStartupPermissionsAndFolderSetup();
            });
        }

        @JavascriptInterface
        public boolean saveFile(String fileName, String content, String mimeType) {
            byte[] bytes = (content != null ? content : "").getBytes(StandardCharsets.UTF_8);
            return saveBytesToHesabdariFolder(fileName, bytes, mimeType);
        }

        @JavascriptInterface
        public boolean saveBase64File(String fileName, String base64OrDataUrl, String mimeType) {
            if (base64OrDataUrl == null || base64OrDataUrl.isEmpty()) return false;
            if (base64OrDataUrl.startsWith("data:")) {
                return saveDataUriToHesabdari(fileName, base64OrDataUrl, mimeType);
            }
            try {
                byte[] bytes = Base64.decode(base64OrDataUrl, Base64.DEFAULT);
                return saveBytesToHesabdariFolder(fileName, bytes, mimeType);
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean shareFile(String fileName, String content, String mimeType) {
            try {
                String safeName = sanitizeFileName(fileName);
                String cleanMime = cleanMimeType(mimeType, safeName);
                byte[] bytes = (content != null ? content : "").getBytes(StandardCharsets.UTF_8);

                // Always save a permanent copy inside the "حسابداری" folder as well
                saveBytesToHesabdariFolder(safeName, bytes, cleanMime);

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
                shareIntent.putExtra(Intent.EXTRA_SUBJECT, "پشتیبان حسابداری — نوین آشپزخانه");
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
        public void setAppTheme(String mode) {
            final String m = ("light".equals(mode)) ? "light" : "dark";
            runOnUiThread(() -> {
                currentTheme = m;
                try {
                    getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                            .edit().putString(PREF_THEME_KEY, m).apply();
                } catch (Throwable ignored) {}
                applySystemBarAppearance();
            });
        }

        @JavascriptInterface
        public void printPage() {
            runOnUiThread(() -> {
                try {
                    if (webView == null) return;
                    PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                    if (pm == null) return;
                    String jobName = "Hesabdari-" + System.currentTimeMillis();
                    PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(jobName);
                    pm.print(jobName, adapter, new PrintAttributes.Builder().build());
                } catch (Exception ignored) {
                }
            });
        }
    }
}
