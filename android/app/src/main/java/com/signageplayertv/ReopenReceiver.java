package com.signageplayertv;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class ReopenReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            Intent launchIntent = context.getPackageManager()
                    .getLaunchIntentForPackage(context.getPackageName());
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                context.startActivity(launchIntent);
                Log.d("ReopenReceiver", "App relaunch requested");
            }
        } catch (Exception e) {
            Log.e("ReopenReceiver", "Failed to relaunch app", e);
        }
    }
}

