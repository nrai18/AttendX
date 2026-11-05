package com.attendx.app;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
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
    public void requestDndPermission(PluginCall call) {
        boolean opened = openDndPermissionSettings(getContext());
        JSObject ret = new JSObject();
        ret.put("opened", opened);
        call.resolve(ret);
    }

    @PluginMethod
    public void testMuteNotification(PluginCall call) {
        Context context = getContext();
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

        // Android 6.0+ DND Permission Check
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && (notificationManager == null || !notificationManager.isNotificationPolicyAccessGranted())) {
            openDndPermissionSettings(context);
            call.reject("DND_PERMISSION_REQUIRED");
            return;
        }

        if ("silent".equalsIgnoreCase(mode)) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && notificationManager != null && notificationManager.isNotificationPolicyAccessGranted()) {
                try {
                    notificationManager.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY);
                    Log.d(TAG, "DND interruption filter engaged (PRIORITY).");
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
                // Save to SharedPreferences so receivers persist across process death
                SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                prefs.edit()
                    .putLong(KEY_UNMUTE_EPOCH, unmuteEpochMs)
                    .putString(KEY_CLASS_NAME, className)
                    .apply();

                Intent serviceIntent = new Intent(context, RingerForegroundService.class);
                serviceIntent.setAction(RingerForegroundService.ACTION_START_CLASS_MUTE);
                serviceIntent.putExtra(RingerForegroundService.EXTRA_CLASS_NAME, className);
                serviceIntent.putExtra(RingerForegroundService.EXTRA_UNMUTE_EPOCH, unmuteEpochMs);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }

                scheduleNativeUnmuteAlarm(context, unmuteEpochMs);
            }
        } else if ("vibrate".equalsIgnoreCase(mode)) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && notificationManager != null && notificationManager.isNotificationPolicyAccessGranted()) {
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
            Intent stopIntent = new Intent(context, RingerForegroundService.class);
            stopIntent.setAction(RingerForegroundService.ACTION_STOP_CLASS_MUTE);
            context.startService(stopIntent);

            cancelNativeUnmuteAlarm(context);
            clearRingerPrefs(context);
            RingerAlarmReceiver.cancelPinnedMuteNotification(context);
        } else {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && notificationManager != null && notificationManager.isNotificationPolicyAccessGranted()) {
                try {
                    notificationManager.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL);
                    Log.d(TAG, "DND interruption filter cleared (ALL) for normal ringer.");
                } catch (Exception e) {
                    Log.w(TAG, "Could not restore INTERRUPTION_FILTER_ALL for normal", e);
                }
            }
            if (audioManager != null) {
                try {
                    audioManager.setRingerMode(AudioManager.RINGER_MODE_NORMAL);
                    int maxRing = audioManager.getStreamMaxVolume(AudioManager.STREAM_RING);
                    int curRing = audioManager.getStreamVolume(AudioManager.STREAM_RING);
                    if (curRing == 0 && maxRing > 0) {
                        audioManager.setStreamVolume(AudioManager.STREAM_RING, Math.max(1, (int)(maxRing * 0.7)), 0);
                    }
                    int maxNotif = audioManager.getStreamMaxVolume(AudioManager.STREAM_NOTIFICATION);
                    int curNotif = audioManager.getStreamVolume(AudioManager.STREAM_NOTIFICATION);
                    if (curNotif == 0 && maxNotif > 0) {
                        audioManager.setStreamVolume(AudioManager.STREAM_NOTIFICATION, Math.max(1, (int)(maxNotif * 0.7)), 0);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Could not restore normal ringer/streams", e);
                }
            }
            Intent stopIntent = new Intent(context, RingerForegroundService.class);
            stopIntent.setAction(RingerForegroundService.ACTION_STOP_CLASS_MUTE);
            context.startService(stopIntent);

            cancelNativeUnmuteAlarm(context);
            clearRingerPrefs(context);
            RingerAlarmReceiver.cancelPinnedMuteNotification(context);
        }

        call.resolve();
    }

    public static void scheduleNativeUnmuteAlarm(Context context, long triggerAtMillis) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
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
