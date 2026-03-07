package com.signageplayertv;

import android.provider.Settings;
import android.content.Context;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.StatFs;
import android.app.Activity;

import androidx.core.content.FileProvider;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactMethod;

public class DeviceIdModule extends ReactContextBaseJavaModule {
    private static final String PREFS_NAME = "kiosk_prefs";
    private static final String KEY_AUTO_REOPEN_ENABLED = "auto_reopen_enabled";
    private static final int MAIN_REOPEN_REQ_CODE = 7201;
    private static final int SERVICE_REOPEN_REQ_CODE = 7202;

    private final ReactApplicationContext reactContext;

    DeviceIdModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }

    @Override
    public String getName() {
        return "DeviceIdModule";
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public String getDeviceId() {
        Context context = reactContext.getApplicationContext();
        return Settings.Secure.getString(
                context.getContentResolver(),
                Settings.Secure.ANDROID_ID
        );
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public String getAppVersion() {
        try {
            PackageManager pm = reactContext.getPackageManager();
            PackageInfo info = pm.getPackageInfo(reactContext.getPackageName(), 0);
            return String.valueOf(info.versionName);
        } catch (Exception ignored) {
            return "";
        }
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public WritableMap getStorageStats() {
        WritableMap out = Arguments.createMap();
        out.putDouble("freeBytes", 0);
        out.putDouble("totalBytes", 0);

        try {
            File dataDir = reactContext.getFilesDir();
            if (dataDir == null) return out;
            StatFs statFs = new StatFs(dataDir.getAbsolutePath());
            long blockSize = statFs.getBlockSizeLong();
            long totalBlocks = statFs.getBlockCountLong();
            long availableBlocks = statFs.getAvailableBlocksLong();
            out.putDouble("freeBytes", (double) (availableBlocks * blockSize));
            out.putDouble("totalBytes", (double) (totalBlocks * blockSize));
        } catch (Exception ignored) {
        }

        return out;
    }

    @ReactMethod
    public void setAutoReopenEnabled(boolean enabled) {
        Context context = reactContext.getApplicationContext();
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(KEY_AUTO_REOPEN_ENABLED, enabled)
                .commit();

        if (!enabled) {
            cancelReopenAlarm(context, MAIN_REOPEN_REQ_CODE);
            cancelReopenAlarm(context, SERVICE_REOPEN_REQ_CODE);
        }
    }

    @ReactMethod
    public void restartApp() {
        try {
            reactContext.runOnUiQueueThread(() -> {
                try {
                    Activity activity = getCurrentActivity();
                    Context appContext = reactContext.getApplicationContext();
                    Intent launchIntent = appContext.getPackageManager()
                            .getLaunchIntentForPackage(appContext.getPackageName());
                    if (launchIntent == null) return;

                    launchIntent.addFlags(
                            Intent.FLAG_ACTIVITY_NEW_TASK
                                    | Intent.FLAG_ACTIVITY_CLEAR_TOP
                                    | Intent.FLAG_ACTIVITY_CLEAR_TASK
                    );
                    appContext.startActivity(launchIntent);

                    if (activity != null) {
                        activity.finishAffinity();
                    }
                } catch (Exception ignored) {
                }
            });
        } catch (Exception ignored) {
        }
    }

    @ReactMethod
    public void installApkUpdate(String apkUrl) {
        try {
            Context appContext = reactContext.getApplicationContext();
            String safeUrl = apkUrl == null ? "" : apkUrl.trim();
            if (safeUrl.isEmpty()) return;
            String fileName = "NVA-SignagePlayerTV-update.apk";
            File apkFile = new File(appContext.getCacheDir(), fileName);

            new Thread(() -> {
                HttpURLConnection connection = null;
                InputStream inputStream = null;
                FileOutputStream outputStream = null;
                try {
                    URL url = new URL(safeUrl);
                    connection = (HttpURLConnection) url.openConnection();
                    connection.setConnectTimeout(20000);
                    connection.setReadTimeout(120000);
                    connection.setUseCaches(false);
                    connection.connect();
                    int status = connection.getResponseCode();
                    if (status < 200 || status >= 300) {
                        return;
                    }

                    inputStream = new BufferedInputStream(connection.getInputStream());
                    outputStream = new FileOutputStream(apkFile, false);
                    byte[] buffer = new byte[64 * 1024];
                    int read;
                    while ((read = inputStream.read(buffer)) != -1) {
                        outputStream.write(buffer, 0, read);
                    }
                    outputStream.flush();

                    reactContext.runOnUiQueueThread(() -> {
                        try {
                            Intent installIntent = new Intent(Intent.ACTION_VIEW);
                            android.net.Uri apkUri = FileProvider.getUriForFile(
                                    appContext,
                                    appContext.getPackageName() + ".fileprovider",
                                    apkFile
                            );
                            installIntent.setDataAndType(
                                    apkUri,
                                    "application/vnd.android.package-archive"
                            );
                            installIntent.addFlags(
                                    Intent.FLAG_ACTIVITY_NEW_TASK
                                            | Intent.FLAG_GRANT_READ_URI_PERMISSION
                            );
                            appContext.startActivity(installIntent);
                        } catch (Exception ignored) {
                        }
                    });
                } catch (Exception ignored) {
                } finally {
                    try {
                        if (inputStream != null) inputStream.close();
                    } catch (Exception ignored) {
                    }
                    try {
                        if (outputStream != null) outputStream.close();
                    } catch (Exception ignored) {
                    }
                    try {
                        if (connection != null) connection.disconnect();
                    } catch (Exception ignored) {
                    }
                }
            }).start();
        } catch (Exception ignored) {
        }
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public WritableMap getNetworkState() {
        WritableMap out = Arguments.createMap();
        out.putBoolean("connected", false);
        out.putBoolean("internet", false);
        out.putString("transport", "none");

        try {
            ConnectivityManager cm = (ConnectivityManager) reactContext.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return out;

            Network active = cm.getActiveNetwork();
            if (active == null) return out;

            NetworkCapabilities caps = cm.getNetworkCapabilities(active);
            if (caps == null) return out;

            boolean hasInternet = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
            boolean validated = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
            boolean wifi = caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI);
            boolean cellular = caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR);
            boolean ethernet = caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET);

            out.putBoolean("connected", wifi || cellular || ethernet);
            out.putBoolean("internet", hasInternet && validated);
            if (wifi) out.putString("transport", "wifi");
            else if (ethernet) out.putString("transport", "ethernet");
            else if (cellular) out.putString("transport", "cellular");
            else out.putString("transport", "other");
        } catch (Exception ignored) {
        }

        return out;
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public WritableMap tryRecoverInternet() {
        WritableMap out = Arguments.createMap();
        out.putBoolean("attempted", true);
        out.putBoolean("wifiEnabled", false);
        out.putBoolean("reassociateCalled", false);
        out.putBoolean("reconnectCalled", false);
        out.putString("note", "");

        try {
            WifiManager wifiManager = (WifiManager) reactContext.getApplicationContext()
                    .getSystemService(Context.WIFI_SERVICE);
            if (wifiManager == null) {
                out.putString("note", "wifi-manager-unavailable");
                return out;
            }

            boolean enabled = wifiManager.isWifiEnabled();
            if (!enabled && Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                enabled = wifiManager.setWifiEnabled(true);
            }
            out.putBoolean("wifiEnabled", enabled);

            try {
                wifiManager.reassociate();
                out.putBoolean("reassociateCalled", true);
            } catch (Exception ignored) {
            }

            try {
                wifiManager.reconnect();
                out.putBoolean("reconnectCalled", true);
            } catch (Exception ignored) {
            }

            if (!enabled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                out.putString("note", "android-q-plus-wifi-toggle-restricted");
            } else {
                out.putString("note", "wifi-recovery-triggered");
            }
        } catch (Exception e) {
            out.putString("note", "recovery-error:" + String.valueOf(e.getMessage()));
        }

        return out;
    }

    private void cancelReopenAlarm(Context context, int requestCode) {
        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;

            Intent reopenIntent = new Intent(context, ReopenReceiver.class);
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    context,
                    requestCode,
                    reopenIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            alarmManager.cancel(pendingIntent);
        } catch (Exception ignored) {
            // Best-effort cleanup. Preference remains source of truth.
        }
    }
}
