package com.signageplayertv

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder

class KioskKeepAliveService : Service() {

  companion object {
    private const val CHANNEL_ID = "signage_keepalive_channel"
    private const val CHANNEL_NAME = "Signage Keep Alive"
    private const val NOTIF_ID = 4401
    private const val REOPEN_DELAY_MS = 1200L
    private const val REOPEN_REQ_CODE = 7202
    private const val PREFS_NAME = "kiosk_prefs"
    private const val KEY_AUTO_REOPEN_ENABLED = "auto_reopen_enabled"
  }

  override fun onCreate() {
    super.onCreate()
    startInForeground()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startInForeground()
    return START_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    scheduleReopen()
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    scheduleReopen()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun startInForeground() {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        CHANNEL_NAME,
        NotificationManager.IMPORTANCE_MIN
      ).apply {
        setShowBadge(false)
        lockscreenVisibility = Notification.VISIBILITY_SECRET
      }
      nm.createNotificationChannel(channel)
    }

    val notification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
        .setSmallIcon(android.R.drawable.ic_media_play)
        .setContentTitle("Signage Player Running")
        .setContentText("Auto-reopen is active")
        .setOngoing(true)
        .setCategory(Notification.CATEGORY_SERVICE)
        .build()
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
        .setSmallIcon(android.R.drawable.ic_media_play)
        .setContentTitle("Signage Player Running")
        .setContentText("Auto-reopen is active")
        .setOngoing(true)
        .build()
    }

    startForeground(NOTIF_ID, notification)
  }

  private fun scheduleReopen() {
    if (!isAutoReopenEnabled()) return

    val reopenIntent = Intent(this, ReopenReceiver::class.java)
    val pendingIntent = PendingIntent.getBroadcast(
      this,
      REOPEN_REQ_CODE,
      reopenIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val triggerAt = System.currentTimeMillis() + REOPEN_DELAY_MS

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      alarmManager.setExactAndAllowWhileIdle(
        AlarmManager.RTC_WAKEUP,
        triggerAt,
        pendingIntent
      )
    } else {
      alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
    }
  }

  private fun isAutoReopenEnabled(): Boolean {
    val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    return prefs.getBoolean(KEY_AUTO_REOPEN_ENABLED, true)
  }
}
