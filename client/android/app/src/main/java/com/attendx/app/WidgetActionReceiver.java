package com.attendx.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class WidgetActionReceiver extends BroadcastReceiver {
    private static final String TAG = "WidgetActionReceiver";
    public static final String ACTION_MARK_ATTENDANCE = "com.attendx.app.ACTION_WIDGET_MARK_ATTENDANCE";
    public static final String ACTION_NAVIGATE = "com.attendx.app.ACTION_WIDGET_NAVIGATE";
    public static final String ACTION_REFRESH = "com.attendx.app.ACTION_WIDGET_REFRESH";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Log.d(TAG, "WidgetActionReceiver onReceive: " + action);

        if (ACTION_MARK_ATTENDANCE.equals(action)) {
            handleMarkAttendance(context, intent);
        } else if (ACTION_NAVIGATE.equals(action)) {
            handleNavigate(context, intent);
        } else if (ACTION_REFRESH.equals(action) ||
                   Intent.ACTION_USER_PRESENT.equals(action) ||
                   Intent.ACTION_BOOT_COMPLETED.equals(action) ||
                   "android.appwidget.action.APPWIDGET_UPDATE".equals(action)) {
            handleRefresh(context);
        }
    }

    private void handleMarkAttendance(Context context, Intent intent) {
        String targetStatus = intent.getStringExtra("status");
        String slotId = intent.getStringExtra("slot_id");
        String subjectId = intent.getStringExtra("subject_id");
        int slotIndex = intent.getIntExtra("slot_index", -1);

        if (targetStatus == null) return;

        SharedPreferences prefs = context.getSharedPreferences(TodayWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE);
        String classesJsonStr = prefs.getString("today_classes_json", "[]");

        try {
            JSONArray classes = new JSONArray(classesJsonStr);
            if (classes.length() == 0) return;

            int targetIdx = slotIndex;
            if (targetIdx < 0 || targetIdx >= classes.length()) {
                targetIdx = prefs.getInt("selected_class_index", 0);
            }
            if (targetIdx < 0 || targetIdx >= classes.length()) targetIdx = 0;

            JSONObject targetClass = classes.getJSONObject(targetIdx);
            String currentStatus = targetClass.optString("status", null);
            String targetSubjectId = targetClass.optString("subjectId", subjectId);
            String targetSlotId = targetClass.optString("id", slotId);

            // Toggle if clicked on same status
            String finalStatus = targetStatus.equals(currentStatus) ? null : targetStatus;
            if (finalStatus != null) {
                targetClass.put("status", finalStatus);
            } else {
                targetClass.remove("status");
            }

            // Recalculate percentage if subjects_json exists
            String subjectsJsonStr = prefs.getString("subjects_json", "[]");
            if (subjectsJsonStr != null && !subjectsJsonStr.isEmpty()) {
                JSONArray subjects = new JSONArray(subjectsJsonStr);
                for (int s = 0; s < subjects.length(); s++) {
                    JSONObject sub = subjects.getJSONObject(s);
                    String subId = sub.optString("id", sub.optString("subjectId", ""));
                    if (subId.equals(targetSubjectId)) {
                        int attended = sub.optInt("attended", 0);
                        int total = sub.optInt("total", 0);

                        // Revert previous
                        if ("present".equals(currentStatus) || "attended".equals(currentStatus)) {
                            attended = Math.max(0, attended - 1);
                            total = Math.max(0, total - 1);
                        } else if ("absent".equals(currentStatus) || "missed".equals(currentStatus)) {
                            total = Math.max(0, total - 1);
                        }

                        // Apply new
                        if ("present".equals(finalStatus) || "attended".equals(finalStatus)) {
                            attended += 1;
                            total += 1;
                        } else if ("absent".equals(finalStatus) || "missed".equals(finalStatus)) {
                            total += 1;
                        }

                        sub.put("attended", attended);
                        sub.put("total", total);
                        break;
                    }
                }

                int totalAttended = 0;
                int totalClasses = 0;
                for (int s = 0; s < subjects.length(); s++) {
                    JSONObject sub = subjects.getJSONObject(s);
                    totalAttended += sub.optInt("attended", 0);
                    totalClasses += sub.optInt("total", 0);
                }

                if (totalClasses > 0) {
                    double pct = ((double) totalAttended / totalClasses) * 100.0;
                    prefs.edit()
                        .putString("attendance_stat", String.format(Locale.US, "%.1f%%", pct))
                        .putString("subjects_json", subjects.toString())
                        .apply();
                }
            }

            // Save updated classes JSON
            prefs.edit()
                .putString("today_classes_json", classes.toString())
                .apply();

            // Record offline mutation for AttendX app sync
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            String todayDate = sdf.format(new Date());

            JSONObject mutation = new JSONObject();
            mutation.put("subjectId", targetSubjectId);
            mutation.put("timetableSlotId", targetSlotId);
            mutation.put("date", todayDate);
            mutation.put("status", finalStatus != null ? finalStatus : "clear");
            mutation.put("timestamp", System.currentTimeMillis());

            String existingMutationsStr = prefs.getString("attendx_offline_mutations", "[]");
            JSONArray mutationsArray = new JSONArray(existingMutationsStr);
            mutationsArray.put(mutation);
            prefs.edit().putString("attendx_offline_mutations", mutationsArray.toString()).apply();

            // Update Both AppWidgets IMMEDIATELY on the home screen
            TodayWidgetProvider.updateAllWidgets(context);
            NextClassWidgetProvider.updateAllWidgets(context);
            scheduleNextWidgetRefresh(context);

            // Asynchronously dispatch HTTP request to backend to ensure data consistency
            String authToken = prefs.getString("auth_token", null);
            String apiBaseUrl = prefs.getString("api_base_url", "https://attendx.tech/api");
            if (authToken != null && !authToken.isEmpty()) {
                final String fStatus = finalStatus != null ? finalStatus : "clear";
                final String fSubId = targetSubjectId;
                final String fSlotId = targetSlotId;
                final String fToken = authToken;
                final String fUrl = apiBaseUrl + "/attendance/mark";

                new Thread(() -> {
                    try {
                        URL url = new URL(fUrl);
                        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                        conn.setRequestMethod("POST");
                        conn.setRequestProperty("Content-Type", "application/json");
                        conn.setRequestProperty("Authorization", "Bearer " + fToken);
                        conn.setConnectTimeout(6000);
                        conn.setReadTimeout(6000);
                        conn.setDoOutput(true);

                        JSONObject payload = new JSONObject();
                        payload.put("subjectId", fSubId);
                        payload.put("date", todayDate);
                        payload.put("status", fStatus);
                        if (fSlotId != null && !fSlotId.isEmpty()) {
                            payload.put("timetableSlotId", fSlotId);
                        }

                        byte[] out = payload.toString().getBytes(StandardCharsets.UTF_8);
                        try (OutputStream os = conn.getOutputStream()) {
                            os.write(out);
                        }

                        int code = conn.getResponseCode();
                        Log.d(TAG, "Background attendance mark dispatched to server: " + code);
                    } catch (Exception httpErr) {
                        Log.w(TAG, "Background attendance mark network sync deferred to app launch: " + httpErr.getMessage());
                    }
                }).start();
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to mark attendance from widget", e);
        }
    }

    private void handleNavigate(Context context, Intent intent) {
        int direction = intent.getIntExtra("direction", 3);
        SharedPreferences prefs = context.getSharedPreferences(TodayWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE);
        String classesJsonStr = prefs.getString("today_classes_json", "[]");

        try {
            JSONArray classes = new JSONArray(classesJsonStr);
            if (classes.length() <= 3) return;

            int currentOffset = prefs.getInt("widget_page_offset", 0);
            int newOffset = currentOffset + direction;
            if (newOffset >= classes.length()) {
                newOffset = 0;
            } else if (newOffset < 0) {
                int remainder = classes.length() % 3;
                newOffset = classes.length() - (remainder == 0 ? 3 : remainder);
                if (newOffset < 0) newOffset = 0;
            }

            prefs.edit().putInt("widget_page_offset", newOffset).apply();
            TodayWidgetProvider.updateAllWidgets(context);
        } catch (Exception e) {
            Log.e(TAG, "Failed to navigate widget classes", e);
        }
    }

    private void handleRefresh(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(TodayWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE);
        String classesJsonStr = prefs.getString("today_classes_json", "[]");

        try {
            JSONArray classes = new JSONArray(classesJsonStr);
            if (classes.length() > 0) {
                // Find currently active or upcoming class based on system clock
                int nowMins = TodayWidgetProvider.getCurrentMinutes();

                int bestIdx = 0;
                for (int i = 0; i < classes.length(); i++) {
                    JSONObject cls = classes.getJSONObject(i);
                    int startMins = TodayWidgetProvider.parseMinutes(cls.optString("startTime", "00:00"));
                    int endMins = TodayWidgetProvider.parseMinutes(cls.optString("endTime", "23:59"));
                    if (nowMins >= startMins && nowMins < endMins) {
                        bestIdx = i;
                        break;
                    } else if (nowMins < startMins) {
                        bestIdx = i;
                        break;
                    }
                }
                prefs.edit().putInt("selected_class_index", bestIdx).apply();
            }

            TodayWidgetProvider.updateAllWidgets(context);
            NextClassWidgetProvider.updateAllWidgets(context);
            scheduleNextWidgetRefresh(context);
        } catch (Exception e) {
            Log.e(TAG, "Failed to refresh widget", e);
        }
    }

    public static void scheduleNextWidgetRefresh(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(TodayWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE);
            String classesJsonStr = prefs.getString("today_classes_json", "[]");
            JSONArray classes = new JSONArray(classesJsonStr);

            long nowMs = System.currentTimeMillis();
            long nextTriggerMs = -1;

            int nowMins = TodayWidgetProvider.getCurrentMinutes();
            int earliestFutureMins = Integer.MAX_VALUE;

            for (int i = 0; i < classes.length(); i++) {
                JSONObject cls = classes.getJSONObject(i);
                int startMins = TodayWidgetProvider.parseMinutes(cls.optString("startTime", "00:00"));
                int endMins = TodayWidgetProvider.parseMinutes(cls.optString("endTime", "00:00"));

                if (startMins > nowMins && startMins < earliestFutureMins) {
                    earliestFutureMins = startMins;
                }
                if (endMins > nowMins && endMins < earliestFutureMins) {
                    earliestFutureMins = endMins;
                }
            }

            if (earliestFutureMins != Integer.MAX_VALUE) {
                int diffMins = earliestFutureMins - nowMins;
                nextTriggerMs = nowMs + (diffMins * 60L * 1000L) + 2000L;
            } else {
                nextTriggerMs = nowMs + (2L * 60L * 60L * 1000L);
            }

            Intent intent = new Intent(context, WidgetActionReceiver.class);
            intent.setAction(ACTION_REFRESH);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pi = PendingIntent.getBroadcast(context, 777, intent, flags);

            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextTriggerMs, pi);
                } else {
                    am.set(AlarmManager.RTC_WAKEUP, nextTriggerMs, pi);
                }
                Log.d(TAG, "Scheduled next widget refresh in " + ((nextTriggerMs - nowMs) / 1000) + " seconds");
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to schedule next widget refresh", e);
        }
    }
}
