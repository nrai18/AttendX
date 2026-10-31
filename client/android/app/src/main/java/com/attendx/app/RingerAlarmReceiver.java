package com.attendx.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioManager;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class RingerAlarmReceiver extends BroadcastReceiver {
    public static final String ACTION_AUTO_UNMUTE = "com.attendx.app.ACTION_AUTO_UNMUTE";
    public static final String ACTION_MANUAL_UNMUTE = "com.attendx.app.ACTION_MANUAL_UNMUTE";
    public static final String ACTION_NOTIFICATION_DISMISSED = "com.attendx.app.ACTION_NOTIFICATION_DISMISSED";

    private static final String TAG = "RingerAlarmReceiver";
    public static final int PINNED_MUTE_NOTIF_ID = 7001;
    private static final int FALLBACK_NOTIF_ID = 8888;
    private static final int UNMUTE_CONFIRM_NOTIF_ID = 7003;
    private static final String CHANNEL_ID_SILENT = "silent_mode";
    private static final String CHANNEL_ID_ALERTS = "class_alerts";
    private static final String WAKELOCK_TAG = "attendx:unmute_wakelock";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        Log.d(TAG, "RingerAlarmReceiver onReceive action: " + action);

        if (ACTION_NOTIFICATION_DISMISSED.equals(action)) {
            handleNotificationDismissed(context);
            return;
        }

        if (ACTION_MANUAL_UNMUTE.equals(action)) {
            handleManualUnmute(context);
            return;
        }

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || "android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            handleBootCompleted(context);
            return;
        }

        // Default: ACTION_AUTO_UNMUTE
        handleAutoUnmute(context);
    }

    private void handleAutoUnmute(Context context) {
        Log.d(TAG, "Executing native auto-unmute...");
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKELOCK_TAG);
            wakeLock.acquire(10 * 1000L);
        }

        try {
            AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && notificationManager != null) {
                if (notificationManager.isNotificationPolicyAccessGranted()) {
                    try {
                        notificationManager.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL);
                        Log.d(TAG, "DND interruption filter successfully restored to INTERRUPTION_FILTER_ALL.");
                    } catch (Exception dndEx) {
                        Log.e(TAG, "Failed to restore DND interruption filter to ALL", dndEx);
                    }
                } else {
                    Log.w(TAG, "DND access not granted; unable to auto-restore interruption filter.");
                }
            }

            if (audioManager != null) {
                try {
                    audioManager.setRingerMode(AudioManager.RINGER_MODE_NORMAL);
                    Log.d(TAG, "Ringer successfully restored to NORMAL by native alarm.");
                } catch (Exception ringerEx) {
                    Log.e(TAG, "Failed to set ringer mode to NORMAL", ringerEx);
                }
            }

            // Clear stored unmute preferences
            RingerPlugin.clearRingerPrefs(context);

            if (notificationManager != null) {
                // Cancel ongoing pinned notification
                notificationManager.cancel(PINNED_MUTE_NOTIF_ID);
                notificationManager.cancel(FALLBACK_NOTIF_ID);

                // Show brief confirmation notification that phone has unmuted
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    NotificationChannel channel = notificationManager.getNotificationChannel(CHANNEL_ID_ALERTS);
                    if (channel == null) {
                        channel = new NotificationChannel(CHANNEL_ID_ALERTS, "Class Reminders", NotificationManager.IMPORTANCE_DEFAULT);
                        notificationManager.createNotificationChannel(channel);
                    }
                }

                Bitmap largeIcon = BitmapFactory.decodeResource(context.getResources(), R.drawable.attendx_notification_icon);

                NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID_ALERTS)
                    .setSmallIcon(R.drawable.ic_stat_attendx)
                    .setLargeIcon(largeIcon)
                    .setContentTitle("Class Ended")
                    .setContentText("Phone ringer restored to normal.")
                    .setColor(0xFF10B981)
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                    .setAutoCancel(true);

                notificationManager.notify(UNMUTE_CONFIRM_NOTIF_ID, builder.build());
            }
        } catch (Exception e) {
            Log.e(TAG, "Error executing native auto-unmute", e);
        } finally {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        }
    }

    private void handleManualUnmute(Context context) {
        Log.d(TAG, "User tapped Unmute Phone action button on notification.");
        try {
            AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && notificationManager != null && notificationManager.isNotificationPolicyAccessGranted()) {
                try {
                    notificationManager.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL);
                    Log.d(TAG, "DND interruption filter cleared on manual unmute.");
                } catch (Exception dndEx) {
                    Log.e(TAG, "Failed to restore DND interruption filter on manual unmute", dndEx);
                }
            }

            if (audioManager != null) {
                audioManager.setRingerMode(AudioManager.RINGER_MODE_NORMAL);
            }

            RingerPlugin.cancelNativeUnmuteAlarm(context);
            RingerPlugin.clearRingerPrefs(context);

            if (notificationManager != null) {
                notificationManager.cancel(PINNED_MUTE_NOTIF_ID);
                notificationManager.cancel(FALLBACK_NOTIF_ID);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error executing manual unmute", e);
        }
    }

    private void handleNotificationDismissed(Context context) {
        Log.d(TAG, "Pinned notification dismissed by user gesture. Checking if class is still active...");
        try {
            SharedPreferences prefs = context.getSharedPreferences(RingerPlugin.PREFS_NAME, Context.MODE_PRIVATE);
            long unmuteEpochMs = prefs.getLong(RingerPlugin.KEY_UNMUTE_EPOCH, 0L);
            String className = prefs.getString(RingerPlugin.KEY_CLASS_NAME, "Class");

            AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            boolean isMuted = audioManager != null && (audioManager.getRingerMode() == AudioManager.RINGER_MODE_SILENT || audioManager.getRingerMode() == AudioManager.RINGER_MODE_VIBRATE);

            // If class is still in session and phone is muted, re-post the pinned notification immediately
            if (unmuteEpochMs > System.currentTimeMillis() && isMuted) {
                Log.d(TAG, "Class is still active (" + (unmuteEpochMs - System.currentTimeMillis()) + "ms remaining). Re-posting pinned notification!");
                showPinnedMuteNotification(context, className, unmuteEpochMs);
            } else {
                Log.d(TAG, "Class has ended or phone already unmuted. Notification will not be resurrected.");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error handling notification dismissal", e);
        }
    }

    private void handleBootCompleted(Context context) {
        Log.d(TAG, "Device reboot detected. Reconciling ringer state...");
        try {
            SharedPreferences prefs = context.getSharedPreferences(RingerPlugin.PREFS_NAME, Context.MODE_PRIVATE);
            long unmuteEpochMs = prefs.getLong(RingerPlugin.KEY_UNMUTE_EPOCH, 0L);
            String className = prefs.getString(RingerPlugin.KEY_CLASS_NAME, "Class");

            if (unmuteEpochMs > System.currentTimeMillis()) {
                Log.d(TAG, "Reboot occurred during active class session. Re-scheduling alarm and re-posting pinned notification.");
                RingerPlugin.scheduleNativeUnmuteAlarm(context, unmuteEpochMs);
                showPinnedMuteNotification(context, className, unmuteEpochMs);
            } else if (unmuteEpochMs > 0) {
                Log.d(TAG, "Unmute time expired while device was powered off. Restoring ringer now.");
                handleAutoUnmute(context);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error handling boot completed", e);
        }
    }

    public static void showPinnedMuteNotification(Context context, String className, long unmuteEpochMs) {
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = notificationManager.getNotificationChannel(CHANNEL_ID_SILENT);
            if (channel == null) {
                channel = new NotificationChannel(CHANNEL_ID_SILENT, "Silent Mode & Class Session", NotificationManager.IMPORTANCE_DEFAULT);
                channel.setDescription("Pinned notification while class is actively running and phone is muted.");
                channel.setSound(null, null);
                channel.enableVibration(false);
                notificationManager.createNotificationChannel(channel);
            }
        }

        SimpleDateFormat timeFormat = new SimpleDateFormat("hh:mm a", Locale.getDefault());
        String timeStr = timeFormat.format(new Date(unmuteEpochMs));
        String cleanClassName = (className != null && !className.trim().isEmpty()) ? className.trim() : "Class";

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        // Tap notification body -> opens MainActivity
        Intent tapIntent = new Intent(context, MainActivity.class);
        tapIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tapPendingIntent = PendingIntent.getActivity(context, 0, tapIntent, piFlags);

        // Action button -> "Unmute Phone"
        Intent unmuteIntent = new Intent(context, RingerAlarmReceiver.class);
        unmuteIntent.setAction(ACTION_MANUAL_UNMUTE);
        PendingIntent unmutePendingIntent = PendingIntent.getBroadcast(context, 1, unmuteIntent, piFlags);

        // DeleteIntent -> if user swipes it away, re-posts if still in session
        Intent deleteIntent = new Intent(context, RingerAlarmReceiver.class);
        deleteIntent.setAction(ACTION_NOTIFICATION_DISMISSED);
        PendingIntent deletePendingIntent = PendingIntent.getBroadcast(context, 2, deleteIntent, piFlags);

        Bitmap largeIcon = BitmapFactory.decodeResource(context.getResources(), R.drawable.attendx_notification_icon);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID_SILENT)
            .setSmallIcon(R.drawable.ic_stat_attendx)
            .setLargeIcon(largeIcon)
            .setContentTitle("Class in Session")
            .setContentText("Phone is silenced until " + timeStr)
            .setSubText("Do Not Disturb Active")
            .setStyle(new NotificationCompat.BigTextStyle()
                .bigText("🔕 Current Class: " + cleanClassName + "\n\nYour phone has been muted via AttendX. It will restore to normal volume automatically at " + timeStr + ", or you can unmute manually below."))
            .setColor(0xFF10B981)
            .setOngoing(true)
            .setAutoCancel(false)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(tapPendingIntent)
            .setDeleteIntent(deletePendingIntent)
            .addAction(R.drawable.ic_stat_attendx, "🔊 Unmute Phone", unmutePendingIntent);

        android.app.Notification notif = builder.build();
        notif.flags |= android.app.Notification.FLAG_ONGOING_EVENT | android.app.Notification.FLAG_NO_CLEAR;

        notificationManager.notify(PINNED_MUTE_NOTIF_ID, notif);
        Log.d(TAG, "Pinned mute notification successfully posted for: " + cleanClassName + " until " + timeStr);
    }

    public static void cancelPinnedMuteNotification(Context context) {
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.cancel(PINNED_MUTE_NOTIF_ID);
            notificationManager.cancel(FALLBACK_NOTIF_ID);
            Log.d(TAG, "Cancelled pinned mute notification.");
        }
    }
}
