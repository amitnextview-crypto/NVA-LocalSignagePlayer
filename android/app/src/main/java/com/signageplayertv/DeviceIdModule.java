package com.signageplayertv;

import android.provider.Settings;
import android.content.Context;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class DeviceIdModule extends ReactContextBaseJavaModule {
    private static final String PREFS_NAME = "kiosk_prefs";
    private static final String KEY_AUTO_REOPEN_ENABLED = "auto_reopen_enabled";

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

    @ReactMethod
    public void setAutoReopenEnabled(boolean enabled) {
        Context context = reactContext.getApplicationContext();
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(KEY_AUTO_REOPEN_ENABLED, enabled)
                .apply();
    }
}
