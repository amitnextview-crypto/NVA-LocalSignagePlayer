// package com.signageplayertv;

// import android.content.BroadcastReceiver;
// import android.content.Context;
// import android.content.Intent;

// public class BootReceiver extends BroadcastReceiver {
//   @Override
//   public void onReceive(Context context, Intent intent) {
//     if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
//       Intent i = new Intent(context, MainActivity.class);
//       i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
//       context.startActivity(i);
//     }
//   }
// }


package com.signageplayertv;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {

        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())
            || "android.intent.action.QUICKBOOT_POWERON".equals(intent.getAction())) {

            Log.d("BOOT", "Boot completed received");

            Intent i = context.getPackageManager()
                    .getLaunchIntentForPackage(context.getPackageName());

            if (i != null) {
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(i);
            }
        }
    }
}