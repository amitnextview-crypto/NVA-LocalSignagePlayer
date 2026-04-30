package com.nvaplayerpc

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import androidx.core.content.ContextCompat
import android.os.Bundle
import android.view.View
import android.content.Intent
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.widget.Toast

class MainActivity : ReactActivity() {

  companion object {
    private const val REOPEN_DELAY_MS = 10000L
    private const val REOPEN_REQ_CODE = 7201
    private const val PREFS_NAME = "kiosk_prefs"
    private const val KEY_AUTO_REOPEN_ENABLED = "auto_reopen_enabled"
    private const val KEY_AUTO_REOPEN_LOCKED_OFF = "auto_reopen_locked_off"
    private const val KEY_PENDING_STARTUP_ACTION = "pending_startup_action"
    private const val EXTRA_SKIP_AUTO_REOPEN_RESTORE_ONCE = "skip_auto_reopen_restore_once"
  }

  private val reopenHandler = Handler(Looper.getMainLooper())
  private var skipAutoReopenRestoreThisLaunch = false
  private val reopenRunnable = Runnable {
    if (!isAutoReopenEnabled()) return@Runnable
    try {
      val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
      launchIntent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      if (launchIntent != null) {
        startActivity(launchIntent)
      }
    } catch (_: Exception) {
      // Alarm receiver fallback is also scheduled.
    }
  }

  override fun getMainComponentName(): String = "NVAPlayerPC"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    skipAutoReopenRestoreThisLaunch =
      intent?.getBooleanExtra(EXTRA_SKIP_AUTO_REOPEN_RESTORE_ONCE, false) == true
    restoreAutoReopenOnLaunchIfNeeded()
    window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    val keepAliveIntent = Intent(this, KioskKeepAliveService::class.java)
    ContextCompat.startForegroundService(this, keepAliveIntent)
    hideSystemUI()
  }

  override fun onResume() {
    super.onResume()
    restoreAutoReopenOnLaunchIfNeeded()
    cancelScheduledReopen()
    hideSystemUI()
  }

  override fun onPause() {
    super.onPause()
    scheduleReopen()
  }

  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    scheduleReopen()
  }

  override fun onDestroy() {
    reopenHandler.removeCallbacks(reopenRunnable)
    cancelScheduledReopen()
    super.onDestroy()
  }


override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
        window.decorView.systemUiVisibility =
            (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            or View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_STABLE)
    }
}

  private fun hideSystemUI() {
    window.decorView.systemUiVisibility =
      View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
      View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
      View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
      View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
      View.SYSTEM_UI_FLAG_FULLSCREEN or
      View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
  }

  private fun scheduleReopen() {
    if (!isAutoReopenEnabled()) return

    // 1) In-process fast reopen (worked well on many Smart TVs).
    reopenHandler.removeCallbacks(reopenRunnable)
    reopenHandler.postDelayed(reopenRunnable, REOPEN_DELAY_MS)

    // 2) OS alarm fallback for stricter TV builds (use activity PendingIntent to bypass BAL).
    val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val triggerAt = System.currentTimeMillis() + REOPEN_DELAY_MS
    scheduleAlarm(alarmManager, buildReopenPendingIntent(), triggerAt)
    scheduleAlarm(alarmManager, buildReopenBroadcastPendingIntent(), triggerAt)
  }

  private fun cancelScheduledReopen() {
    reopenHandler.removeCallbacks(reopenRunnable)
    val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
    alarmManager.cancel(buildReopenPendingIntent())
    alarmManager.cancel(buildReopenBroadcastPendingIntent())
  }

  fun cancelScheduledReopenFromJs() {
    cancelScheduledReopen()
  }

  private fun buildReopenPendingIntent(): PendingIntent {
    val intent = Intent(this, MainActivity::class.java).apply {
      action = Intent.ACTION_MAIN
      addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER)
      addCategory(Intent.CATEGORY_LAUNCHER)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    return PendingIntent.getActivity(
      this,
      REOPEN_REQ_CODE,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun buildReopenBroadcastPendingIntent(): PendingIntent {
    val intent = Intent(this, ReopenReceiver::class.java).apply {
      action = ReopenReceiver.ACTION_FORCE_REOPEN
      `package` = packageName
    }
    return PendingIntent.getBroadcast(
      this,
      REOPEN_REQ_CODE + 1,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun scheduleAlarm(
    alarmManager: AlarmManager,
    pendingIntent: PendingIntent,
    triggerAt: Long
  ) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        alarmManager.setExactAndAllowWhileIdle(
          AlarmManager.RTC_WAKEUP,
          triggerAt,
          pendingIntent
        )
      } else {
        alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
      }
    } catch (_: Exception) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
      } else {
        alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
      }
    }
  }

  override fun onBackPressed() {
    DeviceIdModule.emitSimpleEvent("adminBackPress")
  }

  override fun onKeyLongPress(keyCode: Int, event: KeyEvent?): Boolean {
    // Long-press OK/Center: toggle auto reopen ON/OFF.
    if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER) {
      val enabled = !isAutoReopenEnabled()
      setAutoReopenEnabled(enabled, !enabled)
      if (!enabled) {
        cancelScheduledReopen()
      }
      Toast.makeText(
        this,
        if (enabled) "Auto reopen enabled" else "Auto reopen disabled",
        Toast.LENGTH_SHORT
      ).show()
      return true
    }

    // Long-press BACK: clear signage data and restart app.
    if (keyCode == KeyEvent.KEYCODE_BACK) {
      clearSignageDataAndRestart()
      return true
    }

    return super.onKeyLongPress(keyCode, event)
  }

  private fun getPrefs() = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  private fun restoreAutoReopenOnLaunchIfNeeded() {
    try {
      if (skipAutoReopenRestoreThisLaunch) {
        return
      }
      val prefs = getPrefs()
      if (!prefs.contains(KEY_AUTO_REOPEN_ENABLED)) {
        prefs.edit()
          .putBoolean(KEY_AUTO_REOPEN_ENABLED, true)
          .putBoolean(KEY_AUTO_REOPEN_LOCKED_OFF, false)
          .apply()
        return
      }
      if (prefs.getBoolean(KEY_AUTO_REOPEN_LOCKED_OFF, false)) {
        prefs.edit().putBoolean(KEY_AUTO_REOPEN_ENABLED, false).apply()
      }
    } catch (_: Exception) {
    }
  }

  private fun isAutoReopenEnabled(): Boolean {
    return getPrefs().getBoolean(KEY_AUTO_REOPEN_ENABLED, true)
  }

  private fun setAutoReopenEnabled(enabled: Boolean, lockDisabledState: Boolean = false) {
    getPrefs().edit()
      .putBoolean(KEY_AUTO_REOPEN_ENABLED, enabled)
      .putBoolean(KEY_AUTO_REOPEN_LOCKED_OFF, !enabled && lockDisabledState)
      .apply()
  }

  private fun clearSignageDataAndRestart() {
    try {
      setAutoReopenEnabled(false, true)
      getPrefs().edit()
        .putString(KEY_PENDING_STARTUP_ACTION, "clear-data-keep-identity")
        .apply()
      cancelScheduledReopen()
    } catch (_: Exception) {
      // Continue to restart even if partial cleanup fails.
    }

    Toast.makeText(this, "Data cleared, restarting...", Toast.LENGTH_SHORT).show()
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    launchIntent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    launchIntent?.putExtra(EXTRA_SKIP_AUTO_REOPEN_RESTORE_ONCE, true)
    if (launchIntent != null) {
      startActivity(launchIntent)
      finishAffinity()
    }
  }
}
