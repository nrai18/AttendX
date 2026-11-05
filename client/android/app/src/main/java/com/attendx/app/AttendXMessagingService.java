package com.attendx.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import androidx.annotation.NonNull;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Map;

public class AttendXMessagingService extends MessagingService {
    private static final String TAG = "AttendXMessagingService";
    private static final String PREFS_NAME = "attendx_widget_prefs";
    private static final String KEY_BUFFERED_ANNOUNCEMENTS = "attendx_fcm_buffered_announcements";

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
                if (classroomId == null) classroomId = data.get("id");

                if (classroomId != null && !classroomId.isEmpty()) {
                    JSONObject announcement = new JSONObject();
                    String id = data.get("announcementId");
                    if (id == null) id = data.get("id");
                    if (id == null) id = "fcm-" + System.currentTimeMillis();
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
                    arr.put(item);
                    prefs.edit().putString(KEY_BUFFERED_ANNOUNCEMENTS, arr.toString()).apply();
                    Log.d(TAG, "Cached background FCM announcement for classroom: " + classroomId);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to buffer background FCM announcement", e);
        }
    }
}
