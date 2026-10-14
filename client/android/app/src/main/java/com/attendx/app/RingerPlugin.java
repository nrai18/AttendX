package com.attendx.app;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RingerMode")
public class RingerPlugin extends Plugin {
    private static final String TAG = "RingerPlugin";
    private static final int AUTO_UNMUTE_ALARM_ID = 7001;

    @PluginMethod
    public void setRingerMode(PluginCall call) {
        String mode = call.getString("mode", "normal");
        Double unmuteEpoch = call.getDouble("unmuteEpochMs");
        long unmuteEpochMs = unmuteEpoch != null ? unmuteEpoch.longValue() : 0L;

        Context context = getContext();
        AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        // Android 6.0+ DND Permission Check
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !notificationManager.isNotificationPolicyAccessGranted()) {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
            getActivity().startActivity(intent);
            call.reject("DND_PERMISSION_REQUIRED");
            return;
        }

        if ("silent".equalsIgnoreCase(mode)) {
            audioManager.setRingerMode(AudioManager.RINGER_MODE_SILENT);
            if (unmuteEpochMs > System.currentTimeMillis()) {
                scheduleNativeUnmuteAlarm(context, unmuteEpochMs);
            }
        } else if ("vibrate".equalsIgnoreCase(mode)) {
            audioManager.setRingerMode(AudioManager.RINGER_MODE_VIBRATE);
            cancelNativeUnmuteAlarm(context);
        } else {
            audioManager.setRingerMode(AudioManager.RINGER_MODE_NORMAL);
            cancelNativeUnmuteAlarm(context);
        }

        call.resolve();
    }

    private void scheduleNativeUnmuteAlarm(Context context, long triggerAtMillis) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        Intent intent = new Intent(context, RingerAlarmReceiver.class);
        intent.setAction(RingerAlarmReceiver.ACTION_AUTO_UNMUTE);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getBroadcast(context, AUTO_UNMUTE_ALARM_ID, intent, flags);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
                } else {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            }
            Log.d(TAG, "Scheduled native unmute alarm at " + triggerAtMillis);
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

    private void cancelNativeUnmuteAlarm(Context context) {
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
}
