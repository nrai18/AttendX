package com.attendx.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RingerMode")
public class RingerPlugin extends Plugin {
    private static final String TAG = "RingerPlugin";
    private static final int AUTO_UNMUTE_ALARM_ID = 7001;
    public static final String PREFS_NAME = "attendx_ringer_prefs";
    public static final String KEY_UNMUTE_EPOCH = "unmute_epoch_ms";
    public static final String KEY_CLASS_NAME = "class_name";

    public static final String PREFS_CLASS_REMINDERS = "attendx_class_reminders";
    public static final String KEY_HAS_SAVED_STATE = "has_saved_state";
    public static final String KEY_PREV_INTERRUPTION_FILTER = "prev_interruption_filter";
    public static final String KEY_PREV_RINGER_MODE = "prev_ringer_mode";
    public static final String KEY_PREV_RING_VOL = "prev_ring_vol";
    public static final String KEY_PREV_NOTIF_VOL = "prev_notif_vol";
    public static final String KEY_PREV_SYSTEM_VOL = "prev_system_vol";

    @Override
    public void load() {
        RingerForegroundService.ensureSilentChannel(getContext());
    }

    private boolean openDndPermissionSettings(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return false;
        }
        // On Android 11+ (API 30+), try opening AttendX's dedicated DND permission screen directly
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                Intent detailIntent = new Intent(
                    "android.settings.NOTIFICATION_POLICY_ACCESS_DETAIL_SETTINGS",
                    Uri.fromParts("package", context.getPackageName(), null)
                );
                detailIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(detailIntent);
                return true;
            } catch (Exception e) {
                Log.w(TAG, "Direct DND detail settings unavailable, falling back to policy list", e);
            }
        }
        try {
            Intent listIntent = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
            listIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(listIntent);
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to open DND policy access settings", e);
            try {
                Intent soundIntent = new Intent(Settings.ACTION_SOUND_SETTINGS);
                soundIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(soundIntent);
                return true;
            } catch (Exception ignored) {
                return false;
            }
        }
    }

    @PluginMethod
    public void checkDndPermission(PluginCall call) {
        Context context = getContext();
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        boolean granted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            granted = notificationManager != null && notificationManager.isNotificationPolicyAccessGranted();
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void isMuteSessionActive(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean hasSaved = prefs.getBoolean(KEY_HAS_SAVED_STATE, false);
        long unmuteEpochMs = prefs.getLong(KEY_UNMUTE_EPOCH, 0L);
        JSObject ret = new JSObject();
        ret.put("active", hasSaved || unmuteEpochMs > 0L);
        ret.put("unmuteEpochMs", unmuteEpochMs);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestDndPermission(PluginCall call) {
        boolean opened = openDndPermissionSettings(getContext());
        JSObject ret = new JSObject();
        ret.put("opened", opened);
        call.resolve(ret);
    }

    @PluginMethod
    public void checkNotificationPermission(PluginCall call) {
        Context context = getContext();
        boolean granted = NotificationManagerCompat.from(context).areNotificationsEnabled();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            granted = granted && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Context context = getContext();
        boolean opened = false;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, context.getPackageName());
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                opened = true;
            }
        } catch (Exception e) {
            Log.w(TAG, "Direct app notification settings failed, falling back to app details", e);
        }
        if (!opened) {
            opened = openAppDetailsIntent(context);
        }
        JSObject ret = new JSObject();
        ret.put("opened", opened);
        call.resolve(ret);
    }

    @PluginMethod
    public void checkExactAlarmPermission(PluginCall call) {
        Context context = getContext();
        boolean granted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            granted = am == null || am.canScheduleExactAlarms();
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestExactAlarmPermission(PluginCall call) {
        Context context = getContext();
        boolean opened = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                Intent exactIntent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                exactIntent.setData(Uri.parse("package:" + context.getPackageName()));
                exactIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(exactIntent);
                opened = true;
            } catch (Exception e) {
                Log.w(TAG, "Direct exact alarm permission screen unavailable", e);
                opened = openAppDetailsIntent(context);
            }
        }
        JSObject ret = new JSObject();
        ret.put("opened", opened);
        call.resolve(ret);
    }

    @PluginMethod
    public void checkMicrophonePermission(PluginCall call) {
        boolean granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        boolean opened = openAppDetailsIntent(getContext());
        JSObject ret = new JSObject();
        ret.put("opened", opened);
        call.resolve(ret);
    }

    private boolean openAppDetailsIntent(Context context) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", context.getPackageName(), null));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to open app details settings", e);
            return false;
        }
    }

    @PluginMethod
    public void consumePendingLaunchRoute(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(MainActivity.PREFS_LAUNCH, Context.MODE_PRIVATE);
        String route = prefs.getString(MainActivity.KEY_PENDING_ROUTE, null);
        long ts = prefs.getLong(MainActivity.KEY_PENDING_ROUTE_TS, 0L);
        if (route != null && !route.isEmpty()) {
            prefs.edit().remove(MainActivity.KEY_PENDING_ROUTE).remove(MainActivity.KEY_PENDING_ROUTE_TS).apply();
            // Expire stale pending routes older than 30 seconds
            if (ts > 0L && (System.currentTimeMillis() - ts) > 30000L) {
                route = null;
            }
        }
        JSObject ret = new JSObject();
        ret.put("route", route);
        call.resolve(ret);
    }

    @PluginMethod
    public void scheduleClassReminder(PluginCall call) {
        Context context = getContext();
        int notifId = call.getInt("id", 0);
        String title = call.getString("title", "Upcoming Class");
        String body = call.getString("body", "");
        String largeBody = call.getString("largeBody", body);
        String summaryText = call.getString("summaryText", "Class Reminder");
        String className = call.getString("className", "Class");
        Double triggerAtDouble = call.getDouble("triggerAtMs");
        Double endTimeDouble = call.getDouble("endTimeMs");
        boolean autoDnd = Boolean.TRUE.equals(call.getBoolean("autoDndIfPermitted", false));

        long triggerAtMs = triggerAtDouble != null ? triggerAtDouble.longValue() : 0L;
        long endTimeMs = endTimeDouble != null ? endTimeDouble.longValue() : (triggerAtMs + 60L * 60L * 1000L);

        if (notifId == 0 || triggerAtMs <= System.currentTimeMillis()) {
            JSObject ret = new JSObject();
            ret.put("scheduled", false);
            call.resolve(ret);
            return;
        }

        try {
            org.json.JSONObject item = new org.json.JSONObject();
            item.put("id", notifId);
            item.put("title", title);
            item.put("body", body);
            item.put("largeBody", largeBody);
            item.put("summaryText", summaryText);
            item.put("className", className);
            item.put("triggerAtMs", triggerAtMs);
            item.put("endTimeMs", endTimeMs);
            item.put("autoDndIfPermitted", autoDnd);

            SharedPreferences prefs = context.getSharedPreferences(PREFS_CLASS_REMINDERS, Context.MODE_PRIVATE);
            prefs.edit().putString(String.valueOf(notifId), item.toString()).apply();

            scheduleClassReminderAlarm(context, notifId, title, body, largeBody, summaryText, className, triggerAtMs, endTimeMs, autoDnd);

            JSObject ret = new JSObject();
            ret.put("scheduled", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to schedule native class reminder", e);
            call.reject("SCHEDULE_CLASS_REMINDER_FAILED", e);
        }
    }

    @PluginMethod
    public void cancelAllClassReminders(PluginCall call) {
        cancelAllClassReminderAlarms(getContext());
        JSObject ret = new JSObject();
        ret.put("cancelled", true);
        call.resolve(ret);
    }

    public static void scheduleClassReminderAlarm(
        Context context,
        int notifId,
        String title,
        String body,
        String largeBody,
        String summaryText,
        String className,
        long triggerAtMs,
        long endTimeMs,
        boolean autoDnd
    ) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null || triggerAtMs <= System.currentTimeMillis()) return;

        Intent showIntent = new Intent(context, RingerAlarmReceiver.class);
        showIntent.setAction(RingerAlarmReceiver.ACTION_SHOW_CLASS_REMINDER);
        showIntent.putExtra(RingerAlarmReceiver.EXTRA_NOTIF_ID, notifId);
        showIntent.putExtra(RingerAlarmReceiver.EXTRA_REMINDER_TITLE, title);
        showIntent.putExtra(RingerAlarmReceiver.EXTRA_REMINDER_BODY, body);
        showIntent.putExtra(RingerAlarmReceiver.EXTRA_REMINDER_LARGE_BODY, largeBody);
        showIntent.putExtra(RingerAlarmReceiver.EXTRA_REMINDER_SUMMARY, summaryText);
        showIntent.putExtra(RingerForegroundService.EXTRA_CLASS_NAME, className);
        showIntent.putExtra(RingerForegroundService.EXTRA_UNMUTE_EPOCH, endTimeMs);
        showIntent.putExtra(RingerAlarmReceiver.EXTRA_AUTO_DND, autoDnd);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getBroadcast(context, notifId, showIntent, flags);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
            }
        } catch (SecurityException se) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
            } else {
                am.set(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to schedule reminder alarm id=" + notifId, e);
        }
    }

    public static void cancelAllClassReminderAlarms(Context context) {
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            SharedPreferences prefs = context.getSharedPreferences(PREFS_CLASS_REMINDERS, Context.MODE_PRIVATE);
            java.util.Map<String, ?> all = prefs.getAll();
            int flags = PendingIntent.FLAG_NO_CREATE;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            for (String key : all.keySet()) {
                try {
                    int notifId = Integer.parseInt(key);
                    Intent showIntent = new Intent(context, RingerAlarmReceiver.class);
                    showIntent.setAction(RingerAlarmReceiver.ACTION_SHOW_CLASS_REMINDER);
                    PendingIntent pi = PendingIntent.getBroadcast(context, notifId, showIntent, flags);
                    if (pi != null && am != null) {
                        am.cancel(pi);
                        pi.cancel();
                    }
                    if (nm != null) {
                        nm.cancel(notifId);
                    }
                } catch (Exception ignored) {}
            }
            prefs.edit().clear().apply();
        } catch (Exception e) {
            Log.w(TAG, "Failed clearing native class reminders", e);
        }
    }

    /**
     * Reusable native silent/DND activation that runs cleanly from background BroadcastReceivers
     * without launching MainActivity or prompting system UI. Returns false only if DND access is missing.
     */
    public static boolean engageSilentModeNative(Context context, long unmuteEpochMs, String className) {
        AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        boolean hasDndPolicy = Build.VERSION.SDK_INT < Build.VERSION_CODES.M
            || (notificationManager != null && notificationManager.isNotificationPolicyAccessGranted());
        if (!hasDndPolicy) {
            return false;
        }

        RingerForegroundService.ensureSilentChannel(context);
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();

        // Save original state once so re-muting doesn't overwrite it with SILENT / 0
        if (!prefs.getBoolean(KEY_HAS_SAVED_STATE, false)) {
            editor.putBoolean(KEY_HAS_SAVED_STATE, true);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && notificationManager != null) {
                editor.putInt(KEY_PREV_INTERRUPTION_FILTER, notificationManager.getCurrentInterruptionFilter());
            }
            if (audioManager != null) {
                editor.putInt(KEY_PREV_RINGER_MODE, audioManager.getRingerMode());
                editor.putInt(KEY_PREV_RING_VOL, audioManager.getStreamVolume(AudioManager.STREAM_RING));
                editor.putInt(KEY_PREV_NOTIF_VOL, audioManager.getStreamVolume(AudioManager.STREAM_NOTIFICATION));
                editor.putInt(KEY_PREV_SYSTEM_VOL, audioManager.getStreamVolume(AudioManager.STREAM_SYSTEM));
            }
        }
        String cleanClassName = (className != null && !className.trim().isEmpty()) ? className.trim() : "Class";
        if (unmuteEpochMs > System.currentTimeMillis()) {
            editor.putLong(KEY_UNMUTE_EPOCH, unmuteEpochMs);
            editor.putString(KEY_CLASS_NAME, cleanClassName);
        }
        editor.apply();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && notificationManager != null) {
            try {
                notificationManager.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY);
                Log.d(TAG, "DND interruption filter engaged (PRIORITY) in background.");
            } catch (Exception e) {
                Log.w(TAG, "Could not engage INTERRUPTION_FILTER_PRIORITY", e);
            }
        }
        if (audioManager != null) {
            try {
                audioManager.setRingerMode(AudioManager.RINGER_MODE_SILENT);
            } catch (Exception e) {
                Log.w(TAG, "Could not set RINGER_MODE_SILENT", e);
            }
            try {
                audioManager.setStreamVolume(AudioManager.STREAM_RING, 0, 0);
                audioManager.setStreamVolume(AudioManager.STREAM_NOTIFICATION, 0, 0);
                audioManager.setStreamVolume(AudioManager.STREAM_SYSTEM, 0, 0);
            } catch (Exception e) {
                Log.w(TAG, "Could not set streams to 0 volume", e);
            }
        }
        if (unmuteEpochMs > System.currentTimeMillis()) {
            scheduleNativeUnmuteAlarm(context, unmuteEpochMs, false);

            Intent serviceIntent = new Intent(context, RingerForegroundService.class);
            serviceIntent.setAction(RingerForegroundService.ACTION_START_CLASS_MUTE);
            serviceIntent.putExtra(RingerForegroundService.EXTRA_CLASS_NAME, cleanClassName);
            serviceIntent.putExtra(RingerForegroundService.EXTRA_UNMUTE_EPOCH, unmuteEpochMs);
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            } catch (Exception fgsEx) {
                Log.w(TAG, "Foreground service start blocked from background; posting pinned notification fallback", fgsEx);
                RingerAlarmReceiver.showPinnedMuteNotification(context, cleanClassName, unmuteEpochMs);
            }
        }
        return true;
    }

    @PluginMethod
    public void testMuteNotification(PluginCall call) {
        Context context = getContext();
        RingerForegroundService.ensureSilentChannel(context);
        long testEpoch = System.currentTimeMillis() + 60 * 1000L; // 1-minute test
        RingerAlarmReceiver.showPinnedMuteNotification(context, "Test Class (Preview)", testEpoch);
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void setRingerMode(PluginCall call) {
        String mode = call.getString("mode", "normal");
        long unmuteEpochMs = 0L;
        Object rawEpoch = call.getData().opt("unmuteEpochMs");
        if (rawEpoch instanceof Number) {
            unmuteEpochMs = ((Number) rawEpoch).longValue();
        } else if (rawEpoch instanceof String) {
            try {
                unmuteEpochMs = Long.parseLong((String) rawEpoch);
            } catch (Exception ignored) {}
        }
        if (unmuteEpochMs == 0L) {
            Double d = call.getDouble("unmuteEpochMs");
            if (d != null) unmuteEpochMs = d.longValue();
        }
        String className = call.getString("className", "Class");
        Log.d(TAG, "setRingerMode: mode=" + mode + ", unmuteEpochMs=" + unmuteEpochMs + ", className=" + className);

        Context context = getContext();
        AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        // Android 6.0+ DND Permission Check (only block & prompt when muting, not when unmuting/reconciling)
        boolean hasDndPolicy = Build.VERSION.SDK_INT < Build.VERSION_CODES.M
            || (notificationManager != null && notificationManager.isNotificationPolicyAccessGranted());
        if ("silent".equalsIgnoreCase(mode) && !hasDndPolicy) {
            openDndPermissionSettings(context);
            call.reject("DND_PERMISSION_REQUIRED");
            return;
        }

        if ("silent".equalsIgnoreCase(mode)) {
            boolean engaged = engageSilentModeNative(context, unmuteEpochMs, className);
            if (!engaged) {
                openDndPermissionSettings(context);
                call.reject("DND_PERMISSION_REQUIRED");
                return;
            }
        } else if ("vibrate".equalsIgnoreCase(mode)) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && notificationManager != null && hasDndPolicy) {
                try {
                    notificationManager.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL);
                    Log.d(TAG, "DND interruption filter cleared (ALL) for vibrate.");
                } catch (Exception e) {
                    Log.w(TAG, "Could not restore INTERRUPTION_FILTER_ALL for vibrate", e);
                }
            }
            if (audioManager != null) {
                try {
                    audioManager.setRingerMode(AudioManager.RINGER_MODE_VIBRATE);
                } catch (Exception e) {
                    Log.w(TAG, "Could not set RINGER_MODE_VIBRATE", e);
                }
            }
            try {
                context.stopService(new Intent(context, RingerForegroundService.class));
            } catch (Exception ignored) {}

            cancelNativeUnmuteAlarm(context);
            clearRingerPrefs(context);
            RingerAlarmReceiver.cancelPinnedMuteNotification(context);
        } else {
            restoreSavedAudioState(context);
            try {
                context.stopService(new Intent(context, RingerForegroundService.class));
            } catch (Exception ignored) {}

            cancelNativeUnmuteAlarm(context);
            clearRingerPrefs(context);
            RingerAlarmReceiver.cancelPinnedMuteNotification(context);
        }

        call.resolve();
    }

    public static void restoreSavedAudioState(Context context) {
        AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        NotificationManager notificationManager = (NotificationManager) context
                .getSystemService(Context.NOTIFICATION_SERVICE);
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        boolean hasSaved = prefs.getBoolean(KEY_HAS_SAVED_STATE, false);
        int prevFilter = prefs.getInt(KEY_PREV_INTERRUPTION_FILTER, NotificationManager.INTERRUPTION_FILTER_ALL);
        int prevRingerMode = prefs.getInt(KEY_PREV_RINGER_MODE, AudioManager.RINGER_MODE_NORMAL);
        int prevRingVol = prefs.getInt(KEY_PREV_RING_VOL, -1);
        int prevNotifVol = prefs.getInt(KEY_PREV_NOTIF_VOL, -1);
        int prevSysVol = prefs.getInt(KEY_PREV_SYSTEM_VOL, -1);

        // 1. Clear DND interruption filter FIRST so AudioManager stream changes aren't blocked
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && notificationManager != null
                && notificationManager.isNotificationPolicyAccessGranted()) {
            try {
                notificationManager
                        .setInterruptionFilter(hasSaved ? prevFilter : NotificationManager.INTERRUPTION_FILTER_ALL);
            } catch (Exception e) {
                Log.w(TAG, "Could not restore DND interruption filter", e);
            }
        }

        if (audioManager == null)
            return;

        // 2. Restore prior ringer mode (preserves Vibrate / pre-existing Silent)
        int targetMode = hasSaved ? prevRingerMode : AudioManager.RINGER_MODE_NORMAL;
        try {
            audioManager.setRingerMode(targetMode);
        } catch (Exception e) {
            Log.w(TAG, "Could not restore ringer mode: " + targetMode, e);
        }

        // 3. Only restore volumes when returning to RINGER_MODE_NORMAL
        if (targetMode == AudioManager.RINGER_MODE_NORMAL) {
            try {
                int maxRing = audioManager.getStreamMaxVolume(AudioManager.STREAM_RING);
                int targetRing = prevRingVol >= 0 ? Math.min(prevRingVol, maxRing) : Math.max(1, (int) (maxRing * 0.7));
                if (!hasSaved && audioManager.getStreamVolume(AudioManager.STREAM_RING) > 0) {
                    targetRing = audioManager.getStreamVolume(AudioManager.STREAM_RING);
                }
                if (maxRing > 0 && targetRing > 0) {
                    audioManager.setStreamVolume(AudioManager.STREAM_RING, targetRing, 0);
                }

                int maxNotif = audioManager.getStreamMaxVolume(AudioManager.STREAM_NOTIFICATION);
                int targetNotif = prevNotifVol >= 0 ? Math.min(prevNotifVol, maxNotif)
                        : Math.max(1, (int) (maxNotif * 0.7));
                if (!hasSaved && audioManager.getStreamVolume(AudioManager.STREAM_NOTIFICATION) > 0) {
                    targetNotif = audioManager.getStreamVolume(AudioManager.STREAM_NOTIFICATION);
                }
                if (maxNotif > 0 && targetNotif > 0) {
                    audioManager.setStreamVolume(AudioManager.STREAM_NOTIFICATION, targetNotif, 0);
                }

                int maxSys = audioManager.getStreamMaxVolume(AudioManager.STREAM_SYSTEM);
                int targetSys = prevSysVol >= 0 ? Math.min(prevSysVol, maxSys) : Math.max(1, (int) (maxSys * 0.5));
                if (maxSys > 0 && (prevSysVol >= 0 || audioManager.getStreamVolume(AudioManager.STREAM_SYSTEM) == 0)) {
                    audioManager.setStreamVolume(AudioManager.STREAM_SYSTEM, targetSys, 0);
                }
            } catch (Exception e) {
                Log.w(TAG, "Could not restore audio stream volumes", e);
            }
        }
    }
    
        public static void scheduleNativeUnmuteAlarm(Context context, long triggerAtMillis) {
        scheduleNativeUnmuteAlarm(context, triggerAtMillis, false);
    }

    public static void scheduleNativeUnmuteAlarm(Context context, long triggerAtMillis, boolean allowPromptSettings) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        if (allowPromptSettings && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (!alarmManager.canScheduleExactAlarms()) {
                try {
                    Intent exactIntent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                    exactIntent.setData(Uri.parse("package:" + context.getPackageName()));
                    exactIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(exactIntent);
                } catch (Exception e) {
                    Log.w(TAG, "Could not open exact alarm settings screen", e);
                }
            }
        }

        Intent intent = new Intent(context, RingerAlarmReceiver.class);
        intent.setAction(RingerAlarmReceiver.ACTION_AUTO_UNMUTE);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getBroadcast(context, AUTO_UNMUTE_ALARM_ID, intent, flags);

        Intent showIntent = new Intent(context, MainActivity.class);
        showIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent showPendingIntent = PendingIntent.getActivity(context, 0, showIntent, flags);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                // AlarmClockInfo guarantees exact wake up regardless of Doze or OEM background throttling
                alarmManager.setAlarmClock(new AlarmManager.AlarmClockInfo(triggerAtMillis, showPendingIntent), pendingIntent);
                Log.d(TAG, "Scheduled high-priority alarm clock unmute at " + triggerAtMillis);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            }
        } catch (SecurityException se) {
            Log.w(TAG, "Exact alarm permission missing, falling back to setAndAllowWhileIdle", se);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            } else {
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to schedule native unmute alarm", e);
        }
    }

    public static void cancelNativeUnmuteAlarm(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        Intent intent = new Intent(context, RingerAlarmReceiver.class);
        intent.setAction(RingerAlarmReceiver.ACTION_AUTO_UNMUTE);

        int flags = PendingIntent.FLAG_NO_CREATE;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getBroadcast(context, AUTO_UNMUTE_ALARM_ID, intent, flags);
        if (pendingIntent != null) {
            alarmManager.cancel(pendingIntent);
            pendingIntent.cancel();
            Log.d(TAG, "Cancelled native unmute alarm.");
        }
    }

    public static void clearRingerPrefs(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().clear().apply();
        } catch (Exception e) {
            Log.w(TAG, "Failed to clear ringer prefs", e);
        }
    }
}
