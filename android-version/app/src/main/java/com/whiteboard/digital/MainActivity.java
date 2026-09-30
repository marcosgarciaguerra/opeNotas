package com.whiteboard.digital;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.content.res.Configuration;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

public class MainActivity extends AppCompatActivity {

    private WebView mWebView;
    private ValueCallback<Uri[]> mFilePathCallback;
    private static final int FILE_CHOOSER_REQUEST_CODE = 1001;

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        setupFullscreen();

        mWebView = findViewById(R.id.webView);
        mWebView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        WebSettings settings = mWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Habilitar compatibilidad con Modo Oscuro nativo del sistema
        try {
            if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) {
                WebSettingsCompat.setForceDark(settings, WebSettingsCompat.FORCE_DARK_AUTO);
            }
            if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK_STRATEGY)) {
                WebSettingsCompat.setForceDarkStrategy(settings, WebSettingsCompat.DARK_STRATEGY_WEB_THEME_DARKENING_ONLY);
            }
        } catch (Exception ignored) {}

        // Registro de la interfaz nativa puente JavaScript
        mWebView.addJavascriptInterface(new WebAppInterface(this), "Android");

        mWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("file:///android_asset/")) {
                    return false;
                }
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                    return true;
                } catch (Exception e) {
                    return false;
                }
            }
        });

        mWebView.setWebChromeClient(new WebChromeClient() {
            // Manejador para carga de archivos/PDFs importados en la app
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (mFilePathCallback != null) {
                    mFilePathCallback.onReceiveValue(null);
                    mFilePathCallback = null;
                }
                mFilePathCallback = filePathCallback;

                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);

                String[] acceptTypes = fileChooserParams != null ? fileChooserParams.getAcceptTypes() : null;
                if (acceptTypes != null && acceptTypes.length > 0 && !acceptTypes[0].isEmpty()) {
                    boolean hasPdf = false;
                    boolean hasJson = false;
                    for (String type : acceptTypes) {
                        if (type.contains("pdf") || type.equals(".pdf")) hasPdf = true;
                        if (type.contains("json") || type.equals(".json")) hasJson = true;
                    }
                    if (hasPdf && !hasJson) {
                        intent.setType("application/pdf");
                    } else if (hasJson && !hasPdf) {
                        intent.setType("*/*");
                        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream", "*/*"});
                    } else {
                        intent.setType("*/*");
                        intent.putExtra(Intent.EXTRA_MIME_TYPES, acceptTypes);
                    }
                } else {
                    intent.setType("*/*");
                }

                try {
                    startActivityForResult(Intent.createChooser(intent, "Seleccionar archivo"), FILE_CHOOSER_REQUEST_CODE);
                } catch (ActivityNotFoundException e) {
                    try {
                        Intent fallbackIntent = fileChooserParams != null ? fileChooserParams.createIntent() : intent;
                        startActivityForResult(fallbackIntent, FILE_CHOOSER_REQUEST_CODE);
                    } catch (Exception ex) {
                        if (mFilePathCallback != null) {
                            mFilePathCallback.onReceiveValue(null);
                            mFilePathCallback = null;
                        }
                        Toast.makeText(MainActivity.this, "No se encontró explorador de archivos", Toast.LENGTH_SHORT).show();
                        return false;
                    }
                }
                return true;
            }
        });

        // Manejo del botón atrás físico de Android
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                // Notificar a la web si está en modo editor para volver al dashboard
                mWebView.evaluateJavascript("if (typeof window.handleAndroidBackButton === 'function') { window.handleAndroidBackButton(); } else { 'default'; }", result -> {
                    if (result != null && result.contains("handled")) {
                        // El evento fue gestionado por la app web (ej. cerrar modal o volver al dashboard)
                        return;
                    }
                    if (mWebView.canGoBack()) {
                        mWebView.goBack();
                    } else {
                        setEnabled(false);
                        MainActivity.super.onBackPressed();
                    }
                });
            }
        });

        // Carga la app web empaquetada
        mWebView.loadUrl("file:///android_asset/www/index.html");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (mFilePathCallback != null) {
                Uri[] results = null;
                if (resultCode == RESULT_OK && data != null) {
                    String dataString = data.getDataString();
                    if (dataString != null) {
                        results = new Uri[]{Uri.parse(dataString)};
                    } else if (data.getData() != null) {
                        results = new Uri[]{data.getData()};
                    } else if (data.getClipData() != null) {
                        final int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    }
                }
                mFilePathCallback.onReceiveValue(results);
                mFilePathCallback = null;
            }
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    private void setupFullscreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            );
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    @Override
    protected void onResume() {
        super.onResume();
        setupFullscreen();
    }

    @Override
    public void onConfigurationChanged(@NonNull Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        boolean isDark = (newConfig.uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        if (mWebView != null) {
            mWebView.post(() -> mWebView.evaluateJavascript(
                "if (typeof window !== 'undefined' && typeof window.onAndroidNightModeChanged === 'function') { window.onAndroidNightModeChanged(" + isDark + "); }",
                null
            ));
        }
    }
}

