package com.attendx.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class RingerForegroundService extends Service {
    public static final String ACTION_START_CLASS_MUTE = "com.attendx.app.ACTION_START_CLASS_MUTE";
    public static final String ACTION_STOP_CLASS_MUTE = "com.attendx.app.ACTION_STOP_CLASS_MUTE";
    public static final String EXTRA_CLASS_NAME = "extra_class_name";
    public static final String EXTRA_UNMUTE_EPOCH = "extra_unmute_epoch";
    public static final int NOTIF_ID = 7001;
    public static final String CHANNEL_ID = "silent_mode";

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        String action = intent.getAction();
        if (ACTION_STOP_CLASS_MUTE.equals(action)) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
            stopSelf();
            return START_NOT_STICKY;
        }
        if (ACTION_START_CLASS_MUTE.equals(action)) {
            String className = intent.getStringExtra(EXTRA_CLASS_NAME);
            long unmuteEpoch = intent.getLongExtra(EXTRA_UNMUTE_EPOCH, 0L);
            Notification notification = buildNotification(this, className, unmuteEpoch);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                // Compatible with Android 14+ foreground service types
                startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(NOTIF_ID, notification);
            }
        }
        return START_STICKY;
    }

    public static Notification buildNotification(Context context, String className, long unmuteEpochMs) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
            NotificationChannel channel = nm.getNotificationChannel(CHANNEL_ID);
            if (channel == null) {
                channel = new NotificationChannel(CHANNEL_ID, "Silent Mode & Class Session", NotificationManager.IMPORTANCE_DEFAULT);
                channel.setDescription("Active while phone is muted for class.");
                channel.setSound(null, null);
                channel.enableVibration(false);
                channel.setBypassDnd(true); // Ensures notification remains visible during DND
                nm.createNotificationChannel(channel);
            }
        }
        SimpleDateFormat timeFormat = new SimpleDateFormat("hh:mm a", Locale.getDefault());
        String timeStr = timeFormat.format(new Date(unmuteEpochMs));
        String cleanTitle = (className != null && !className.trim().isEmpty()) ? className.trim() : "Class";
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) piFlags |= PendingIntent.FLAG_IMMUTABLE;
        Intent tapIntent = new Intent(context, MainActivity.class);
        tapIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tapPending = PendingIntent.getActivity(context, 0, tapIntent, piFlags);
        Intent unmuteIntent = new Intent(context, RingerAlarmReceiver.class);
        unmuteIntent.setAction(RingerAlarmReceiver.ACTION_MANUAL_UNMUTE);
        PendingIntent unmutePending = PendingIntent.getBroadcast(context, 1, unmuteIntent, piFlags);
        return new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_attendx)
            .setLargeIcon(BitmapFactory.decodeResource(context.getResources(), R.drawable.attendx_notification_icon))
            .setContentTitle("Class in Session")
            .setContentText("Phone is silenced until " + timeStr)
            .setSubText("Do Not Disturb Active")
            .setStyle(new NotificationCompat.BigTextStyle()
                .bigText("🔕 Current Class: " + cleanTitle + "\n\nYour phone is muted via AttendX. It will automatically unmute at " + timeStr + "."))
            .setColor(0xFF10B981)
            .setOngoing(true)
            .setAutoCancel(false)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(tapPending)
            .addAction(R.drawable.ic_stat_attendx, "🔊 Unmute Phone", unmutePending)
            .build();
    }
}
