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
    public static final String ACTION_SHOW_CLASS_REMINDER = "com.attendx.app.ACTION_SHOW_CLASS_REMINDER";
    public static final String ACTION_MUTE_FOR_CLASS = "com.attendx.app.ACTION_MUTE_FOR_CLASS";

    public static final String EXTRA_NOTIF_ID = "extra_notif_id";
    public static final String EXTRA_REMINDER_TITLE = "extra_reminder_title";
    public static final String EXTRA_REMINDER_BODY = "extra_reminder_body";
    public static final String EXTRA_REMINDER_LARGE_BODY = "extra_reminder_large_body";
    public static final String EXTRA_REMINDER_SUMMARY = "extra_reminder_summary";
    public static final String EXTRA_AUTO_DND = "extra_auto_dnd";

    private static final String TAG = "RingerAlarmReceiver";
    public static final int PINNED_MUTE_NOTIF_ID = 7001;
    private static final int FALLBACK_NOTIF_ID = 8888;
    private static final int UNMUTE_CONFIRM_NOTIF_ID = 7003;
        private static final String CHANNEL_ID_SILENT = RingerForegroundService.CHANNEL_ID;
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

        if (ACTION_SHOW_CLASS_REMINDER.equals(action)) {
            handleShowClassReminder(context, intent);
            return;
        }

        if (ACTION_MUTE_FOR_CLASS.equals(action)) {
            handleMuteForClass(context, intent);
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
                        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            RingerPlugin.restoreSavedAudioState(context);

            // Stop foreground service safely when class ends
            try {
                context.stopService(new Intent(context, RingerForegroundService.class));
            } catch (Exception ignored) {}

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
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
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
                        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            RingerPlugin.restoreSavedAudioState(context);

            // Stop foreground service safely when manual unmute is tapped
            try {
                context.stopService(new Intent(context, RingerForegroundService.class));
            } catch (Exception ignored) {}

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

    private void handleShowClassReminder(Context context, Intent intent) {
        int notifId = intent.getIntExtra(EXTRA_NOTIF_ID, (int) (System.currentTimeMillis() % 100000));
        String title = intent.getStringExtra(EXTRA_REMINDER_TITLE);
        String body = intent.getStringExtra(EXTRA_REMINDER_BODY);
        String largeBody = intent.getStringExtra(EXTRA_REMINDER_LARGE_BODY);
        String summaryText = intent.getStringExtra(EXTRA_REMINDER_SUMMARY);
        String className = intent.getStringExtra(RingerForegroundService.EXTRA_CLASS_NAME);
        long endTimeMs = intent.getLongExtra(RingerForegroundService.EXTRA_UNMUTE_EPOCH, System.currentTimeMillis() + 60L * 60L * 1000L);
        boolean autoDnd = intent.getBooleanExtra(EXTRA_AUTO_DND, true);

        if (title == null || title.isEmpty()) title = "Upcoming Class";
        if (body == null) body = "";
        if (largeBody == null || largeBody.isEmpty()) largeBody = body;
        if (summaryText == null || summaryText.isEmpty()) summaryText = "Class Reminder";
        if (className == null || className.trim().isEmpty()) className = "Class";

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        // If DND access is granted and autoDnd is enabled, engage DND silently in background without opening the app
        boolean autoMutedNow = false;
        if (autoDnd && endTimeMs > System.currentTimeMillis()) {
            try {
                boolean hasDndPolicy = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || nm.isNotificationPolicyAccessGranted();
                if (hasDndPolicy) {
                    autoMutedNow = RingerPlugin.engageSilentModeNative(context, endTimeMs, className);
                }
            } catch (Exception e) {
                Log.w(TAG, "Background auto-DND check failed", e);
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = nm.getNotificationChannel(CHANNEL_ID_ALERTS);
            if (channel == null) {
                channel = new NotificationChannel(CHANNEL_ID_ALERTS, "Class Reminders", NotificationManager.IMPORTANCE_HIGH);
                nm.createNotificationChannel(channel);
            }
        }

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        // Body tap opens MainActivity directly to /today
        Intent tapIntent = new Intent(context, MainActivity.class);
        tapIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        tapIntent.putExtra("route", "/today");
        tapIntent.putExtra("type", "class_reminder");
        PendingIntent tapPendingIntent = PendingIntent.getActivity(context, notifId, tapIntent, piFlags);

        // Clean up stored alarm metadata once fired
        try {
            SharedPreferences remPrefs = context.getSharedPreferences(RingerPlugin.PREFS_CLASS_REMINDERS, Context.MODE_PRIVATE);
            remPrefs.edit().remove(String.valueOf(notifId)).apply();
        } catch (Exception ignored) {}

        Bitmap largeIcon = BitmapFactory.decodeResource(context.getResources(), R.drawable.attendx_notification_icon);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID_ALERTS)
            .setSmallIcon(R.drawable.ic_stat_attendx)
            .setLargeIcon(largeIcon)
            .setContentTitle(title)
            .setContentText(autoMutedNow ? (body + " · Auto-DND On") : body)
            .setSubText(summaryText)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(largeBody))
            .setColor(0xFF6366F1)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(tapPendingIntent);

        if (!autoMutedNow && endTimeMs > System.currentTimeMillis()) {
            // Broadcast action button -> engages DND in background WITHOUT opening MainActivity
            Intent muteIntent = new Intent(context, RingerAlarmReceiver.class);
            muteIntent.setAction(ACTION_MUTE_FOR_CLASS);
            muteIntent.putExtra(EXTRA_NOTIF_ID, notifId);
            muteIntent.putExtra(RingerForegroundService.EXTRA_CLASS_NAME, className);
            muteIntent.putExtra(RingerForegroundService.EXTRA_UNMUTE_EPOCH, endTimeMs);
            PendingIntent mutePendingIntent = PendingIntent.getBroadcast(context, notifId + 500000, muteIntent, piFlags);
            builder.addAction(R.drawable.ic_stat_attendx, "\uD83D\uDD15 Mute Phone for Class", mutePendingIntent);
        }

        nm.notify(notifId, builder.build());
    }

    private void handleMuteForClass(Context context, Intent intent) {
        int notifId = intent.getIntExtra(EXTRA_NOTIF_ID, 0);
        String className = intent.getStringExtra(RingerForegroundService.EXTRA_CLASS_NAME);
        long unmuteEpochMs = intent.getLongExtra(RingerForegroundService.EXTRA_UNMUTE_EPOCH, System.currentTimeMillis() + 60L * 60L * 1000L);
        if (unmuteEpochMs <= System.currentTimeMillis()) {
            unmuteEpochMs = System.currentTimeMillis() + 60L * 60L * 1000L;
        }
        if (className == null || className.trim().isEmpty()) {
            className = "Class";
        }

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && notifId != 0) {
            nm.cancel(notifId);
        }

        boolean muted = RingerPlugin.engageSilentModeNative(context, unmuteEpochMs, className);
        if (!muted && nm != null) {
            // DND access not granted: do NOT jump-scare open the app; post a settings prompt notification instead
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel sysChannel = nm.getNotificationChannel("system_alerts");
                if (sysChannel == null) {
                    sysChannel = new NotificationChannel("system_alerts", "System Alerts", NotificationManager.IMPORTANCE_HIGH);
                    nm.createNotificationChannel(sysChannel);
                }
            }
            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                piFlags |= PendingIntent.FLAG_IMMUTABLE;
            }
            Intent dndSettingsIntent = new Intent(android.provider.Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
            dndSettingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent settingsPi = PendingIntent.getActivity(context, 7002, dndSettingsIntent, piFlags);
            Bitmap largeIcon = BitmapFactory.decodeResource(context.getResources(), R.drawable.attendx_notification_icon);
            NotificationCompat.Builder warn = new NotificationCompat.Builder(context, "system_alerts")
                .setSmallIcon(R.drawable.ic_stat_attendx)
                .setLargeIcon(largeIcon)
                .setContentTitle("DND Permission Required")
                .setContentText("Tap to grant Do Not Disturb access so AttendX can mute your phone silently in background.")
                .setColor(0xFFF59E0B)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(settingsPi);
            nm.notify(7002, warn.build());
        }
    }

    private void handleNotificationDismissed(Context context) {
        Log.d(TAG, "Pinned notification dismissed by user gesture. Checking if class is still active...");
        try {
            SharedPreferences prefs = context.getSharedPreferences(RingerPlugin.PREFS_NAME, Context.MODE_PRIVATE);
            long unmuteEpochMs = prefs.getLong(RingerPlugin.KEY_UNMUTE_EPOCH, 0L);
            String className = prefs.getString(RingerPlugin.KEY_CLASS_NAME, "Class");

                        AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            boolean dndActive = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                && nm != null
                && nm.getCurrentInterruptionFilter() != NotificationManager.INTERRUPTION_FILTER_ALL;
            boolean isMuted = prefs.getBoolean(RingerPlugin.KEY_HAS_SAVED_STATE, false)
                || dndActive
                || (audioManager != null && (audioManager.getRingerMode() == AudioManager.RINGER_MODE_SILENT || audioManager.getRingerMode() == AudioManager.RINGER_MODE_VIBRATE));

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
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKELOCK_TAG + ":boot");
            wakeLock.acquire(10 * 1000L);
        }
        try {
            SharedPreferences prefs = context.getSharedPreferences(RingerPlugin.PREFS_NAME, Context.MODE_PRIVATE);
            long unmuteEpochMs = prefs.getLong(RingerPlugin.KEY_UNMUTE_EPOCH, 0L);
            String className = prefs.getString(RingerPlugin.KEY_CLASS_NAME, "Class");

            if (unmuteEpochMs > System.currentTimeMillis()) {
                Log.d(TAG, "Reboot occurred during active class session. Re-scheduling alarm and re-posting pinned notification.");
                RingerPlugin.scheduleNativeUnmuteAlarm(context, unmuteEpochMs, false);
                showPinnedMuteNotification(context, className, unmuteEpochMs);
            } else if (unmuteEpochMs > 0 || prefs.getBoolean(RingerPlugin.KEY_HAS_SAVED_STATE, false)) {
                Log.d(TAG, "Unmute time expired while device was powered off. Restoring ringer now.");
                handleAutoUnmute(context);
            }

            // Reschedule pending native class reminder alarms across reboot
            try {
                SharedPreferences remPrefs = context.getSharedPreferences(RingerPlugin.PREFS_CLASS_REMINDERS, Context.MODE_PRIVATE);
                java.util.Map<String, ?> allRem = remPrefs.getAll();
                long nowMs = System.currentTimeMillis();
                for (java.util.Map.Entry<String, ?> entry : allRem.entrySet()) {
                    try {
                        org.json.JSONObject item = new org.json.JSONObject(String.valueOf(entry.getValue()));
                        long trig = item.optLong("triggerAtMs", 0L);
                        if (trig > nowMs) {
                            RingerPlugin.scheduleClassReminderAlarm(
                                context,
                                item.optInt("id"),
                                item.optString("title", "Upcoming Class"),
                                item.optString("body", ""),
                                item.optString("largeBody", ""),
                                item.optString("summaryText", "Class Reminder"),
                                item.optString("className", "Class"),
                                trig,
                                item.optLong("endTimeMs", trig + 3600000L),
                                item.optBoolean("autoDndIfPermitted", true)
                            );
                        } else {
                            remPrefs.edit().remove(entry.getKey()).apply();
                        }
                    } catch (Exception ignored) {}
                }
            } catch (Exception ignored) {}
        } catch (Exception e) {
            Log.e(TAG, "Error handling boot completed", e);
        } finally {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        }
    }

    public static void showPinnedMuteNotification(Context context, String className, long unmuteEpochMs) {
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) return;

                RingerForegroundService.ensureSilentChannel(context);

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
            .setPriority(NotificationCompat.PRIORITY_HIGH)
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
