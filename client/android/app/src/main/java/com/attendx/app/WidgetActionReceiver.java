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
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class WidgetActionReceiver extends BroadcastReceiver {
    private static final String TAG = "WidgetActionReceiver";
    public static final String ACTION_MARK_ATTENDANCE = "com.attendx.app.ACTION_WIDGET_MARK_ATTENDANCE";
    public static final String ACTION_NAVIGATE = "com.attendx.app.ACTION_WIDGET_NAVIGATE";
    public static final String ACTION_REFRESH = "com.attendx.app.ACTION_WIDGET_REFRESH";
    public static final Object MUTATION_LOCK = new Object();
    private static final ExecutorService SYNC_EXECUTOR = Executors.newSingleThreadExecutor();

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
                   Intent.ACTION_TIME_CHANGED.equals(action) ||
                   Intent.ACTION_TIMEZONE_CHANGED.equals(action) ||
                   Intent.ACTION_DATE_CHANGED.equals(action) ||
                   "android.appwidget.action.APPWIDGET_UPDATE".equals(action)) {
            handleRefresh(context);
        }
    }

    private static String computeRunwayForSubject(JSONArray subjects, String subjectId) {
        if (subjects == null || subjectId == null || subjectId.isEmpty()) return "Safe";
        for (int i = 0; i < subjects.length(); i++) {
            JSONObject sub = subjects.optJSONObject(i);
            if (sub == null) continue;
            if (subjectId.equals(sub.optString("id", "")) || subjectId.equals(sub.optString("subjectId", ""))) {
                double target = sub.has("targetPercentage")
                    ? sub.optDouble("targetPercentage", 75.0)
                    : sub.optDouble("target", 75.0);
                int attended = sub.optInt("attended", 0);
                int total = sub.optInt("total", 0);
                if (total <= 0 || target <= 0) return "Safe";
                double ratio = target / 100.0;
                int canMiss = (int) Math.floor((attended - ratio * total) / ratio);
                if (canMiss > 1) return canMiss + " Bunks Safe";
                if (canMiss == 1) return "1 Bunk Safe";
                if (canMiss == 0) return "Can't Miss Next";
                int need = (int) Math.ceil((ratio * total - attended) / (1.0 - ratio));
                return "Need " + Math.max(1, need) + " Classes";
            }
        }
        return "Safe";
    }

    public static boolean checkAndPerformDayRollover(Context context, SharedPreferences prefs) {
        try {
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            String todayIso = sdf.format(new Date());
            String scheduleDate = prefs.getString("schedule_date", "");

            if (todayIso.equals(scheduleDate)) {
                return false; // Same day, no rollover needed
            }

            Log.d(TAG, "Day rollover detected: from [" + scheduleDate + "] to [" + todayIso + "]");

            // Check cached calendar events / semester end date / Last Teaching Day
            boolean isHoliday = false;
            String holidayTitle = "";
            String lastTeachingDay = null;
            String eventsJsonStr = prefs.getString("events_json", "[]");
            JSONArray eventsArr = new JSONArray(eventsJsonStr);
            for (int i = 0; i < eventsArr.length(); i++) {
                JSONObject ev = eventsArr.optJSONObject(i);
                if (ev == null) continue;
                String title = ev.optString("title", "");
                String typeLower = ev.optString("type", "").toLowerCase(Locale.US);
                String lowerTitle = title.toLowerCase(Locale.US);
                String rawStart = ev.optString("date", "");
                String startIso = rawStart.length() >= 10 ? rawStart.substring(0, 10) : "";
                String rawEnd = ev.optString("endDate", "");
                String endIso = rawEnd.length() >= 10 ? rawEnd.substring(0, 10) : startIso;

                if (lowerTitle.contains("last teaching day") || lowerTitle.contains("last working day")) {
                    String ltd = endIso.isEmpty() ? startIso : endIso;
                    if (!ltd.isEmpty() && (lastTeachingDay == null || ltd.compareTo(lastTeachingDay) > 0)) {
                        lastTeachingDay = ltd;
                    }
                }

                if (!startIso.isEmpty() && todayIso.compareTo(startIso) >= 0 && todayIso.compareTo(endIso) <= 0) {
                    boolean isRestricted = "restricted".equals(typeLower) || "restricted_holiday".equals(typeLower) || lowerTitle.contains("restricted");
                    boolean cancels = !isRestricted && (
                        "holiday".equals(typeLower) || "exam".equals(typeLower) ||
                        lowerTitle.contains("holiday") || lowerTitle.contains("vacation") ||
                        lowerTitle.contains("break") || lowerTitle.contains("exam") ||
                        lowerTitle.contains("midsem") || lowerTitle.contains("endsem")
                    );
                    if (cancels) {
                        isHoliday = true;
                        holidayTitle = title.isEmpty() ? "Holiday / Institute Closed" : title;
                        break;
                    }
                }
            }

            if (!isHoliday && lastTeachingDay != null && todayIso.compareTo(lastTeachingDay) > 0) {
                isHoliday = true;
                holidayTitle = "Classes Concluded (Past Last Teaching Day)";
            }
            if (!isHoliday) {
                String semEndRaw = prefs.getString("semester_end_date", "");
                String semEndIso = semEndRaw.length() >= 10 ? semEndRaw.substring(0, 10) : "";
                if (!semEndIso.isEmpty() && todayIso.compareTo(semEndIso) > 0) {
                    isHoliday = true;
                    holidayTitle = "Semester Concluded";
                }
            }

            JSONArray newTodayClasses = new JSONArray();
            if (!isHoliday) {
                java.util.Calendar cal = java.util.Calendar.getInstance();
                int javaDay = cal.get(java.util.Calendar.DAY_OF_WEEK);
                int dbDay = (javaDay == java.util.Calendar.SUNDAY) ? 6 : (javaDay - 2);

                String weeklySlotsStr = prefs.getString("weekly_slots_json", "[]");
                JSONArray weeklySlots = new JSONArray(weeklySlotsStr);

                java.util.List<JSONObject> todayList = new java.util.ArrayList<>();
                for (int i = 0; i < weeklySlots.length(); i++) {
                    JSONObject s = weeklySlots.getJSONObject(i);
                    if (s.optInt("dayOfWeek", -1) == dbDay && (s.isNull("validUntil") || s.optString("validUntil", "").isEmpty())) {
                        todayList.add(s);
                    }
                }

                // Sort numerically by start minutes so unpadded times like "9:00" sort before "10:00"
                java.util.Collections.sort(todayList, (a, b) -> Integer.compare(
                    TodayWidgetProvider.parseMinutes(a.optString("startTime", "00:00")),
                    TodayWidgetProvider.parseMinutes(b.optString("startTime", "00:00"))
                ));

                JSONArray subjectsArr = new JSONArray(prefs.getString("subjects_json", "[]"));
                for (int i = 0; i < todayList.size(); i++) {
                    JSONObject s = todayList.get(i);
                    JSONObject item = new JSONObject();
                    String sId = s.optString("id", "slot_" + i);
                    String subId = s.optString("subjectId", "");
                    item.put("id", sId);
                    item.put("slotId", sId);
                    item.put("subjectId", subId);

                    String subName = "";
                    if (s.has("subject") && !s.isNull("subject")) {
                        subName = s.optJSONObject("subject").optString("name", "");
                    }
                    if (subName.isEmpty()) {
                        subName = s.optString("subjectName", "Scheduled Class");
                    }
                    item.put("subjectName", subName);
                    String sTime = s.optString("startTime", "00:00");
                    String eTime = s.optString("endTime", "00:00");
                    item.put("startTime", sTime);
                    item.put("endTime", eTime);
                    item.put("timeRange", TodayWidgetProvider.formatTime12h(sTime) + " – " + TodayWidgetProvider.formatTime12h(eTime));
                    item.put("room", s.optString("room", ""));
                    item.put("bunkRunway", computeRunwayForSubject(subjectsArr, subId));
                    item.put("status", JSONObject.NULL);
                    item.put("type", "slot");
                    newTodayClasses.put(item);
                }
            }

            SimpleDateFormat dayFormat = new SimpleDateFormat("EEE, d MMM", Locale.US);
            String dateFormatted = dayFormat.format(new Date());

            SharedPreferences.Editor editor = prefs.edit();
            editor.putString("schedule_date", todayIso);
            editor.putString("date_formatted", dateFormatted);
            editor.putString("today_classes_json", newTodayClasses.toString());
            editor.putBoolean("today_is_holiday", isHoliday);
            editor.putString("today_holiday_title", holidayTitle);
            editor.putInt("widget_page_offset", 0);
            editor.putInt("selected_class_index", 0);

            if (isHoliday) {
                editor.putString("status_chip", "🌴 HOLIDAY");
                editor.putString("room", "Campus Closed");
                editor.putString("subject_name", holidayTitle);
                editor.putString("class_time", "No classes today");
                editor.putString("bunk_runway", "Safe");
                editor.putString("next_countdown", "🌴 NO CLASS");
                editor.putString("next_room", "📍 HOLIDAY");
                editor.putString("next_subject", holidayTitle);
                editor.putString("next_time", "Campus Closed");
                editor.putString("next_runway", "Safe");
            } else if (newTodayClasses.length() == 0) {
                editor.putString("status_chip", "☕ FREE");
                editor.putString("room", "No Classes");
                editor.putString("subject_name", "No lectures scheduled today");
                editor.putString("class_time", "Enjoy your day");
                editor.putString("bunk_runway", "Safe");
                editor.putString("next_countdown", "☕ RELAX");
                editor.putString("next_room", "📍 FREE DAY");
                editor.putString("next_subject", "No classes scheduled today");
                editor.putString("next_time", "Free schedule");
                editor.putString("next_runway", "Safe");
            }
            editor.apply();
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Error performing day rollover", e);
            return false;
        }
    }

    private void handleMarkAttendance(Context context, Intent intent) {
        String targetStatus = intent.getStringExtra("status");
        String slotId = intent.getStringExtra("slot_id");
        String subjectId = intent.getStringExtra("subject_id");
        int slotIndex = intent.getIntExtra("slot_index", -1);

        if (targetStatus == null) return;

        SharedPreferences prefs = context.getSharedPreferences(TodayWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE);
        checkAndPerformDayRollover(context, prefs);

        String classesJsonStr = prefs.getString("today_classes_json", "[]");

        try {
            JSONArray classes = new JSONArray(classesJsonStr);
            if (classes.length() == 0) return;

            // Robust target class resolution: Match by slotId/overrideId first; never silently fall back if an explicit slotId didn't match
            int targetIdx = -1;
            if (slotId != null && !slotId.isEmpty()) {
                for (int i = 0; i < classes.length(); i++) {
                    JSONObject c = classes.getJSONObject(i);
                    if (slotId.equals(c.optString("id")) || slotId.equals(c.optString("slotId")) || slotId.equals(c.optString("overrideId"))) {
                        targetIdx = i;
                        break;
                    }
                }
                if (targetIdx < 0) {
                    Log.w(TAG, "Ignoring stale widget tap for unmatched slotId=" + slotId);
                    TodayWidgetProvider.updateAllWidgets(context);
                    NextClassWidgetProvider.updateAllWidgets(context);
                    return;
                }
            }
            if (targetIdx < 0) {
                targetIdx = slotIndex;
            }
            if (targetIdx < 0 || targetIdx >= classes.length()) {
                targetIdx = prefs.getInt("selected_class_index", 0);
            }
            if (targetIdx < 0 || targetIdx >= classes.length()) targetIdx = 0;

            JSONObject targetClass = classes.getJSONObject(targetIdx);
            String currentStatus = TodayWidgetProvider.optNullableString(targetClass, "status");
            String targetSubjectId = targetClass.optString("subjectId", subjectId);

            // Differentiate regular slots, overrides/extra classes, and manual rows (null-safe)
            String itemType = targetClass.optString("type", "slot");
            String rawOverrideId = TodayWidgetProvider.optNullableString(targetClass, "overrideId");
            String rawSlotId = TodayWidgetProvider.optNullableString(targetClass, "slotId");
            String rawId = TodayWidgetProvider.optNullableString(targetClass, "id");
            boolean isOverride = "override".equalsIgnoreCase(itemType) || rawOverrideId != null;
            boolean isSlot = "slot".equalsIgnoreCase(itemType) && !isOverride;
            String targetOverrideId = isOverride ? (rawOverrideId != null ? rawOverrideId : rawId) : null;
            String targetSlotId = isSlot ? (rawSlotId != null ? rawSlotId : (rawId != null ? rawId : slotId)) : null;

            // CASE-INSENSITIVE TOGGLE: If clicked on current status, toggle to null (clear)
            String finalStatus = (currentStatus != null && targetStatus.equalsIgnoreCase(currentStatus)) ? null : targetStatus;
            if (finalStatus != null) {
                targetClass.put("status", finalStatus.toLowerCase(Locale.US));
            } else {
                targetClass.put("status", JSONObject.NULL);
            }

            // Recalculate percentage & subject runway cleanly (including medical/od and 0-class clears)
            String subjectsJsonStr = prefs.getString("subjects_json", "[]");
            if (subjectsJsonStr != null && !subjectsJsonStr.isEmpty()) {
                JSONArray subjects = new JSONArray(subjectsJsonStr);
                for (int s = 0; s < subjects.length(); s++) {
                    JSONObject sub = subjects.getJSONObject(s);
                    String subId = sub.optString("id", "");
                    String subSubjectId = sub.optString("subjectId", "");
                    if (targetSubjectId.equals(subId) || targetSubjectId.equals(subSubjectId)) {
                        int attended = sub.optInt("attended", 0);
                        int total = sub.optInt("total", 0);

                        // Revert previous state
                        if ("present".equalsIgnoreCase(currentStatus) || "attended".equalsIgnoreCase(currentStatus)
                                || "medical".equalsIgnoreCase(currentStatus) || "od".equalsIgnoreCase(currentStatus)) {
                            attended = Math.max(0, attended - 1);
                            total = Math.max(0, total - 1);
                        } else if ("absent".equalsIgnoreCase(currentStatus) || "missed".equalsIgnoreCase(currentStatus)) {
                            total = Math.max(0, total - 1);
                        }

                        // Apply new state
                        if ("present".equalsIgnoreCase(finalStatus) || "attended".equalsIgnoreCase(finalStatus)
                                || "medical".equalsIgnoreCase(finalStatus) || "od".equalsIgnoreCase(finalStatus)) {
                            attended += 1;
                            total += 1;
                        } else if ("absent".equalsIgnoreCase(finalStatus) || "missed".equalsIgnoreCase(finalStatus)) {
                            total += 1;
                        }

                        sub.put("attended", attended);
                        sub.put("total", total);
                        break;
                    }
                }

                targetClass.put("bunkRunway", computeRunwayForSubject(subjects, targetSubjectId));

                int totalAttended = 0;
                int totalClasses = 0;
                for (int s = 0; s < subjects.length(); s++) {
                    JSONObject sub = subjects.getJSONObject(s);
                    totalAttended += sub.optInt("attended", 0);
                    totalClasses += sub.optInt("total", 0);
                }

                if (subjects.length() > 0) {
                    double pct = totalClasses > 0 ? (((double) totalAttended / totalClasses) * 100.0) : 0.0;
                    prefs.edit()
                        .putString("attendance_stat", String.format(Locale.US, "%.1f%%", pct))
                        .putString("subjects_json", subjects.toString())
                        .apply();
                }
            }

            prefs.edit().putString("today_classes_json", classes.toString()).apply();

            // Record mutation with unique id & synced=false under lock
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            String todayDate = sdf.format(new Date());
            final String mutId = UUID.randomUUID().toString();

            JSONObject mutation = new JSONObject();
            mutation.put("id", mutId);
            mutation.put("subjectId", targetSubjectId);
            if (targetSlotId != null && !targetSlotId.isEmpty() && !targetSlotId.startsWith("slot_")) {
                mutation.put("timetableSlotId", targetSlotId);
            }
            if (targetOverrideId != null && !targetOverrideId.isEmpty()) {
                mutation.put("overrideId", targetOverrideId);
            }
            mutation.put("date", todayDate);
            mutation.put("status", finalStatus != null ? finalStatus.toLowerCase(Locale.US) : "clear");
            mutation.put("timestamp", System.currentTimeMillis());
            mutation.put("synced", false);

            synchronized (MUTATION_LOCK) {
                String existingMutationsStr = prefs.getString("attendx_offline_mutations", "[]");
                JSONArray mutationsArray = new JSONArray(existingMutationsStr);
                mutationsArray.put(mutation);
                prefs.edit().putString("attendx_offline_mutations", mutationsArray.toString()).apply();
            }

            // Update Both AppWidgets IMMEDIATELY on the home screen
            TodayWidgetProvider.updateAllWidgets(context);
            NextClassWidgetProvider.updateAllWidgets(context);
            scheduleNextWidgetRefresh(context);

            // Dispatch HTTP sequentially on single-thread executor so fast taps never race out of order
            final Context appCtx = context.getApplicationContext();
            String authToken = prefs.getString("auth_token", null);
            String apiBaseUrl = prefs.getString("api_base_url", "https://attendx.tech/api");
            if (authToken != null && !authToken.isEmpty()) {
                final String fStatus = finalStatus != null ? finalStatus.toLowerCase(Locale.US) : "clear";
                final String fSubId = targetSubjectId;
                final String fSlotId = targetSlotId;
                final String fOverrideId = targetOverrideId;
                final String fToken = authToken;
                final String fUrl = apiBaseUrl + "/attendance/mark";

                final PendingResult pendingResult = goAsync();
                try {
                    SYNC_EXECUTOR.execute(() -> {
                        HttpURLConnection conn = null;
                        try {
                            URL url = new URL(fUrl);
                            conn = (HttpURLConnection) url.openConnection();
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
                            if (fSlotId != null && !fSlotId.isEmpty() && !fSlotId.startsWith("slot_")) {
                                payload.put("timetableSlotId", fSlotId);
                            }
                            if (fOverrideId != null && !fOverrideId.isEmpty()) {
                                payload.put("overrideId", fOverrideId);
                            }

                            byte[] out = payload.toString().getBytes(StandardCharsets.UTF_8);
                            try (OutputStream os = conn.getOutputStream()) {
                                os.write(out);
                            }

                            int code = conn.getResponseCode();
                            Log.d(TAG, "Background attendance mark response: " + code);
                            if (code >= 200 && code < 300) {
                                synchronized (MUTATION_LOCK) {
                                    SharedPreferences p = appCtx.getSharedPreferences(TodayWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE);
                                    JSONArray arr = new JSONArray(p.getString("attendx_offline_mutations", "[]"));
                                    boolean changed = false;
                                    for (int i = 0; i < arr.length(); i++) {
                                        JSONObject item = arr.optJSONObject(i);
                                        if (item != null && mutId.equals(item.optString("id"))) {
                                            item.put("synced", true);
                                            changed = true;
                                            break;
                                        }
                                    }
                                    if (changed) {
                                        p.edit().putString("attendx_offline_mutations", arr.toString()).apply();
                                    }
                                }
                            }
                        } catch (Exception httpErr) {
                            Log.w(TAG, "Background attendance mark network deferred to app launch: " + httpErr.getMessage());
                        } finally {
                            if (conn != null) conn.disconnect();
                            pendingResult.finish();
                        }
                    });
                } catch (Throwable execErr) {
                    Log.w(TAG, "Failed to enqueue widget background sync", execErr);
                    pendingResult.finish();
                }
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
        checkAndPerformDayRollover(context, prefs);
        String classesJsonStr = prefs.getString("today_classes_json", "[]");

        try {
            JSONArray classes = new JSONArray(classesJsonStr);
            if (classes.length() > 0) {
                int nowMins = TodayWidgetProvider.getCurrentMinutes();
                int bestIdx = 0;
                for (int i = 0; i < classes.length(); i++) {
                    JSONObject cls = classes.getJSONObject(i);
                    int startMins = TodayWidgetProvider.parseMinutes(cls.optString("startTime", "00:00"));
                    int endMins = TodayWidgetProvider.parseMinutes(cls.optString("endTime", "23:59"));
                    boolean isOngoing = (endMins > startMins)
                        ? (nowMins >= startMins && nowMins < endMins)
                        : (endMins != startMins && (nowMins >= startMins || nowMins < endMins));
                    if (isOngoing || nowMins < startMins) {
                        bestIdx = i;
                        break;
                    }
                }
                int pageOffset = (classes.length() > 3) ? ((bestIdx / 3) * 3) : 0;
                prefs.edit()
                    .putInt("selected_class_index", bestIdx)
                    .putInt("widget_page_offset", pageOffset)
                    .apply();
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
                if (endMins > nowMins && endMins > startMins && endMins < earliestFutureMins) {
                    earliestFutureMins = endMins;
                }
            }

            if (earliestFutureMins != Integer.MAX_VALUE) {
                int diffMins = earliestFutureMins - nowMins;
                nextTriggerMs = nowMs + (diffMins * 60L * 1000L) + 2000L;
            } else {
                // Schedule refresh for 5 seconds past midnight for auto day-rollover
                java.util.Calendar midnight = java.util.Calendar.getInstance();
                midnight.set(java.util.Calendar.HOUR_OF_DAY, 0);
                midnight.set(java.util.Calendar.MINUTE, 0);
                midnight.set(java.util.Calendar.SECOND, 5);
                midnight.set(java.util.Calendar.MILLISECOND, 0);
                midnight.add(java.util.Calendar.DAY_OF_YEAR, 1);
                nextTriggerMs = midnight.getTimeInMillis();
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
                boolean canExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms();
                if (canExact && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextTriggerMs, pi);
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
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
