package com.attendx.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;

public class RingerAlarmReceiver extends BroadcastReceiver {
    public static final String ACTION_AUTO_UNMUTE = "com.attendx.app.ACTION_AUTO_UNMUTE";
    private static final String TAG = "RingerAlarmReceiver";
    private static final int PINNED_MUTE_NOTIF_ID = 7001;
    private static final int FALLBACK_NOTIF_ID = 8888;
    private static final int UNMUTE_CONFIRM_NOTIF_ID = 7003;
    private static final String CHANNEL_ID = "class_alerts";
    private static final String WAKELOCK_TAG = "attendx:unmute_wakelock";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "Native auto-unmute alarm triggered!");

        // Acquire a WakeLock so the CPU cannot suspend before we finish unmuting.
        // This is the critical fix: without it, Nothing OS / Android 12+ can freeze
        // the process after waking from Doze before AudioManager.setRingerMode() completes.
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (pm != null) {
            wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                WAKELOCK_TAG
            );
            // Acquire with a 10-second safety timeout so it is always released
            wakeLock.acquire(10 * 1000L);
        }

        try {
            AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (notificationManager == null || !notificationManager.isNotificationPolicyAccessGranted()) {
                    Log.w(TAG, "DND access not granted; unable to auto-restore ringer.");
                    return;
                }
            }

            if (audioManager != null) {
                audioManager.setRingerMode(AudioManager.RINGER_MODE_NORMAL);
                Log.d(TAG, "Ringer successfully restored to NORMAL by native alarm.");
            }

            if (notificationManager != null) {
                // Cancel ongoing pinned notification
                notificationManager.cancel(PINNED_MUTE_NOTIF_ID);
                notificationManager.cancel(FALLBACK_NOTIF_ID);

                // Show brief confirmation notification that phone has unmuted
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    NotificationChannel channel = notificationManager.getNotificationChannel(CHANNEL_ID);
                    if (channel == null) {
                        channel = new NotificationChannel(CHANNEL_ID, "Class Reminders", NotificationManager.IMPORTANCE_DEFAULT);
                        notificationManager.createNotificationChannel(channel);
                    }
                }

                NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(R.drawable.ic_stat_adobe)
                    .setContentTitle("Class Ended")
                    .setContentText("Phone ringer restored to normal.")
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                    .setAutoCancel(true);

                notificationManager.notify(UNMUTE_CONFIRM_NOTIF_ID, builder.build());
            }
        } catch (Exception e) {
            Log.e(TAG, "Error executing native auto-unmute", e);
        } finally {
            // Always release the WakeLock in the finally block
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        }
    }
}
