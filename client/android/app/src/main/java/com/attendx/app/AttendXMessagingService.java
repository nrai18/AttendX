package com.attendx.app;

import android.app.ActivityManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;

public class AttendXMessagingService extends MessagingService {
    private static final String TAG = "AttendXMessagingService";
    private static final String PREFS_NAME = "attendx_widget_prefs";
    private static final String KEY_BUFFERED_ANNOUNCEMENTS = "attendx_fcm_buffered_announcements";
    private static final String CHANNEL_ID_ALERTS = "class_alerts";

    private boolean isAppInForeground() {
        try {
            ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
            if (am == null) return false;
            List<ActivityManager.RunningAppProcessInfo> procs = am.getRunningAppProcesses();
            if (procs == null) return false;
            String pkg = getPackageName();
            for (ActivityManager.RunningAppProcessInfo proc : procs) {
                if (proc.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
                        && pkg.equals(proc.processName)) {
                    return true;
                }
            }
        } catch (Exception ignored) {}
        return false;
    }

    private void ensureAlertsChannel(NotificationManager nm) {
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel existing = nm.getNotificationChannel(CHANNEL_ID_ALERTS);
            if (existing == null) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID_ALERTS,
                    "Class Reminders",
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Class reminders, classroom broadcasts, and high-priority alerts.");
                channel.enableLights(true);
                channel.setLightColor(0xFF6366F1);
                channel.enableVibration(true);
                nm.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        try {
            Map<String, String> data = remoteMessage.getData();
            if (data == null || data.isEmpty()) return;

            String type = data.get("type");
            if (type == null) type = data.get("notification_type");

            if ("classroom_announcement".equalsIgnoreCase(type) || 
                "classroom_broadcast".equalsIgnoreCase(type) || 
                "announcement".equalsIgnoreCase(type)) {

                String classroomId = data.get("classroomId");
                if (classroomId == null) classroomId = data.get("classroom_id");

                if (classroomId != null && !classroomId.isEmpty()) {
                    JSONObject announcement = new JSONObject();
                    String id = data.get("announcementId");
                    if (id == null) id = data.get("announcement_id");
                    if (id == null) id = data.get("id");
                    if (id == null || id.equals(classroomId)) id = "fcm-" + System.currentTimeMillis();
                    announcement.put("id", id);

                    String title = data.get("title");
                    if (title == null && remoteMessage.getNotification() != null) {
                        title = remoteMessage.getNotification().getTitle();
                    }
                    announcement.put("title", title != null ? title : "Broadcast");

                    String content = data.get("content");
                    if (content == null) content = data.get("body");
                    if (content == null && remoteMessage.getNotification() != null) {
                        content = remoteMessage.getNotification().getBody();
                    }
                    announcement.put("content", content != null ? content : "");
                    announcement.put("body", content != null ? content : "");

                    announcement.put("importance", data.get("importance") != null ? data.get("importance") : "low");
                    announcement.put("isPinned", "true".equalsIgnoreCase(data.get("isPinned")));

                    String createdAt = data.get("createdAt");
                    if (createdAt == null) {
                        SimpleDateFormat isoFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
                        isoFormat.setTimeZone(TimeZone.getTimeZone("UTC"));
                        createdAt = isoFormat.format(new Date());
                    }
                    announcement.put("createdAt", createdAt);

                    String authorName = data.get("authorName");
                    if (authorName != null && !authorName.isEmpty()) {
                        JSONObject authorObj = new JSONObject();
                        authorObj.put("name", authorName);
                        announcement.put("createdBy", authorObj);
                        announcement.put("author", authorObj);
                    }

                    JSONObject item = new JSONObject();
                    item.put("classroomId", classroomId);
                    item.put("announcement", announcement);

                    SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                    String existingStr = prefs.getString(KEY_BUFFERED_ANNOUNCEMENTS, "[]");
                    JSONArray arr = new JSONArray(existingStr);
                    boolean alreadyBuffered = false;
                    for (int i = 0; i < arr.length(); i++) {
                        JSONObject existingItem = arr.optJSONObject(i);
                        if (existingItem != null && classroomId.equals(existingItem.optString("classroomId"))) {
                            JSONObject existingAnn = existingItem.optJSONObject("announcement");
                            if (existingAnn != null && id.equals(existingAnn.optString("id"))) {
                                alreadyBuffered = true;
                                break;
                            }
                        }
                    }
                    if (!alreadyBuffered) {
                        arr.put(item);
                        prefs.edit().putString(KEY_BUFFERED_ANNOUNCEMENTS, arr.toString()).apply();
                        Log.d(TAG, "Cached background FCM announcement for classroom: " + classroomId);
                    }
                }
            }

            // For data-only messages when app is in background/killed, render a native Android tray notification
            if (remoteMessage.getNotification() == null && !isAppInForeground()) {
                String notifTitle = data.get("pushTitle");
                if (notifTitle == null || notifTitle.isEmpty()) notifTitle = data.get("title");
                String notifBody = data.get("pushBody");
                if (notifBody == null || notifBody.isEmpty()) notifBody = data.get("body");
                if (notifBody == null || notifBody.isEmpty()) notifBody = data.get("content");

                if (notifTitle != null && !notifTitle.isEmpty()) {
                    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                    ensureAlertsChannel(nm);

                    Intent launchIntent = new Intent(this, MainActivity.class);
                    launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    String msgId = remoteMessage.getMessageId();
                    if (msgId == null || msgId.isEmpty()) {
                        msgId = "attendx-fcm-" + System.currentTimeMillis();
                    }
                    launchIntent.putExtra("google.message_id", msgId);
                    launchIntent.putExtra("attendx_from_notification", "true");
                    for (Map.Entry<String, String> entry : data.entrySet()) {
                        launchIntent.putExtra(entry.getKey(), entry.getValue());
                    }
                    if (!data.containsKey("route") && !data.containsKey("url") && data.get("classroomId") != null) {
                        launchIntent.putExtra("route", "/classrooms/" + data.get("classroomId"));
                    }

                    String uniqueKey = data.get("pollId");
                    if (uniqueKey == null || uniqueKey.isEmpty()) {
                        uniqueKey = data.get("announcementId");
                    }
                    if (uniqueKey == null || uniqueKey.isEmpty()) {
                        uniqueKey = msgId;
                    }
                    int reqCode = uniqueKey.hashCode();
                    int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        piFlags |= PendingIntent.FLAG_IMMUTABLE;
                    }
                    PendingIntent tapPI = PendingIntent.getActivity(this, reqCode, launchIntent, piFlags);
                    Bitmap largeIcon = BitmapFactory.decodeResource(getResources(), R.drawable.attendx_notification_icon);

                    NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID_ALERTS)
                        .setSmallIcon(R.drawable.ic_stat_attendx)
                        .setLargeIcon(largeIcon)
                        .setContentTitle(notifTitle)
                        .setContentText(notifBody != null ? notifBody : "")
                        .setStyle(new NotificationCompat.BigTextStyle().bigText(notifBody != null ? notifBody : ""))
                        .setColor(0xFF10B981)
                        .setPriority(NotificationCompat.PRIORITY_HIGH)
                        .setAutoCancel(true)
                        .setContentIntent(tapPI);

                    if (nm != null) {
                        nm.notify(reqCode, builder.build());
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to process FCM message", e);
        }
    }
}
