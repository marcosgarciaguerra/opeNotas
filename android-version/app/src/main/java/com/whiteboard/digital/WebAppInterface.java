package com.whiteboard.digital;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Puente de comunicación bidireccional entre la Pizarra Digital JavaScript y Android Nativo.
 */
public class WebAppInterface {
    private final Context mContext;
    private final Activity mActivity;

    public WebAppInterface(Activity activity) {
        this.mActivity = activity;
        this.mContext = activity.getApplicationContext();
    }

    /**
     * Muestra una notificación Toast nativa de Android.
     */
    @JavascriptInterface
    public void showToast(String message) {
        mActivity.runOnUiThread(() -> 
            Toast.makeText(mContext, message, Toast.LENGTH_SHORT).show()
        );
    }

    /**
     * Confirma a la aplicación web que se está ejecutando dentro del contenedor Android nativo.
     */
    @JavascriptInterface
    public boolean isAndroidApp() {
        return true;
    }

    /**
     * Retorna la versión actual de la app Android.
     */
    @JavascriptInterface
    public String getAppVersion() {
        return "2.5.0";
    }

    /**
     * Produce vibración háptica al pulsar herramientas o al enderezar trazos.
     */
    @JavascriptInterface
    public void triggerHapticFeedback() {
        try {
            Vibrator vibrator = (Vibrator) mContext.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(18, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    vibrator.vibrate(18);
                }
            }
        } catch (Exception ignored) {}
    }

    /**
     * Guarda un archivo PDF generado en la carpeta Descargas de Android (Scoped Storage compatible).
     */
    @JavascriptInterface
    public boolean savePdfToStorage(String base64Data, String filename) {
        try {
            byte[] pdfBytes = Base64.decode(base64Data.contains(",") ? base64Data.split(",")[1] : base64Data, Base64.DEFAULT);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename.endsWith(".pdf") ? filename : filename + ".pdf");
                values.put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf");
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/PizarraDigital");

                Uri uri = mContext.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri != null) {
                    try (OutputStream os = mContext.getContentResolver().openOutputStream(uri)) {
                        if (os != null) {
                            os.write(pdfBytes);
                            os.flush();
                        }
                    }
                    showToast("PDF guardado en Descargas/PizarraDigital");
                    return true;
                }
            } else {
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "PizarraDigital");
                if (!dir.exists()) dir.mkdirs();
                File file = new File(dir, filename.endsWith(".pdf") ? filename : filename + ".pdf");
                try (FileOutputStream fos = new FileOutputStream(file)) {
                    fos.write(pdfBytes);
                    fos.flush();
                }
                showToast("PDF guardado en Descargas");
                return true;
            }
        } catch (Exception e) {
            showToast("Error al guardar PDF: " + e.getMessage());
        }
        return false;
    }

    /**
     * Guarda una imagen PNG en la Galería de Fotos del dispositivo.
     */
    @JavascriptInterface
    public boolean saveImageToGallery(String base64Data, String filename) {
        try {
            byte[] imageBytes = Base64.decode(base64Data.contains(",") ? base64Data.split(",")[1] : base64Data, Base64.DEFAULT);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, filename.endsWith(".png") ? filename : filename + ".png");
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/PizarraDigital");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);

                Uri uri = mContext.getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (uri != null) {
                    try (OutputStream os = mContext.getContentResolver().openOutputStream(uri)) {
                        if (os != null) {
                            os.write(imageBytes);
                            os.flush();
                        }
                    }
                    values.clear();
                    values.put(MediaStore.Images.Media.IS_PENDING, 0);
                    mContext.getContentResolver().update(uri, values, null, null);
                    showToast("Imagen guardada en la Galería");
                    return true;
                }
            } else {
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "PizarraDigital");
                if (!dir.exists()) dir.mkdirs();
                File file = new File(dir, filename.endsWith(".png") ? filename : filename + ".png");
                try (FileOutputStream fos = new FileOutputStream(file)) {
                    fos.write(imageBytes);
                    fos.flush();
                }
                showToast("Imagen guardada en Fotos");
                return true;
            }
        } catch (Exception e) {
            showToast("Error al guardar imagen: " + e.getMessage());
        }
        return false;
    }

    /**
     * Comparte el cuaderno o PDF directamente a través de WhatsApp, Gmail, Drive, etc.
     */
    @JavascriptInterface
    public void shareFile(String base64Data, String filename, String mimeType) {
        try {
            byte[] fileBytes = Base64.decode(base64Data.contains(",") ? base64Data.split(",")[1] : base64Data, Base64.DEFAULT);
            File cacheDir = new File(mContext.getCacheDir(), "shared");
            if (!cacheDir.exists()) cacheDir.mkdirs();
            File shareFile = new File(cacheDir, filename);

            try (FileOutputStream fos = new FileOutputStream(shareFile)) {
                fos.write(fileBytes);
                fos.flush();
            }

            Uri contentUri = FileProvider.getUriForFile(mContext, mContext.getPackageName() + ".fileprovider", shareFile);

            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType(mimeType);
            shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            mActivity.startActivity(Intent.createChooser(shareIntent, "Compartir documento"));
        } catch (Exception e) {
            showToast("Error al compartir: " + e.getMessage());
        }
    }
}

