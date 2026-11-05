package com.attendx.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

public class TodayWidgetProvider extends AppWidgetProvider {
    private static final String TAG = "TodayWidgetProvider";
    public static final String PREFS_NAME = "attendx_widget_prefs";

    public static int parseMinutes(String timeStr) {
        if (timeStr == null || !timeStr.contains(":")) return 0;
        try {
            String[] parts = timeStr.trim().split(":");
            return Integer.parseInt(parts[0]) * 60 + Integer.parseInt(parts[1]);
        } catch (Exception e) {
            return 0;
        }
    }

    public static int getCurrentMinutes() {
        Calendar cal = Calendar.getInstance();
        return cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE);
    }

    public static String formatTime12h(String timeStr) {
        if (timeStr == null || !timeStr.contains(":")) return timeStr != null ? timeStr : "--";
        try {
            String[] parts = timeStr.trim().split(":");
            int h = Integer.parseInt(parts[0]);
            String m = parts[1];
            String ampm = h >= 12 ? "PM" : "AM";
            int h12 = h % 12;
            if (h12 == 0) h12 = 12;
            return h12 + ":" + m + " " + ampm;
        } catch (Exception e) {
            return timeStr;
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today_4x2);

            SimpleDateFormat dayFormat = new SimpleDateFormat("EEE, d MMM", Locale.US);
            String dateFormatted = prefs.getString("date_formatted", dayFormat.format(new Date()));
            String attendanceStat = prefs.getString("attendance_stat", "--%");

            views.setTextViewText(R.id.text_today_date, dateFormatted);
            views.setTextViewText(R.id.text_attendance_stat, attendanceStat);

            // Set color for percentage badge
            try {
                String cleanPct = attendanceStat.replace("%", "").trim();
                double pct = Double.parseDouble(cleanPct);
                if (pct < 75.0) {
                    views.setTextColor(R.id.text_attendance_stat, 0xFFF43F5E); // Rose
                } else {
                    views.setTextColor(R.id.text_attendance_stat, 0xFF10B981); // Emerald
                }
            } catch (Exception ignored) {}

            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                piFlags |= PendingIntent.FLAG_IMMUTABLE;
            }

            // 1. Refresh Button Broadcast PendingIntent
            Intent refreshIntent = new Intent(context, WidgetActionReceiver.class);
            refreshIntent.setAction(WidgetActionReceiver.ACTION_REFRESH);
            PendingIntent refreshPI = PendingIntent.getBroadcast(context, 201, refreshIntent, piFlags);
            views.setOnClickPendingIntent(R.id.btn_widget_refresh, refreshPI);

            // 2. Open Today Page on App hint click
            Intent todayAppIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://attendx.tech/today"), context, MainActivity.class);
            todayAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            todayAppIntent.putExtra("widget_action", "open_today");
            PendingIntent todayAppPI = PendingIntent.getActivity(context, 101, todayAppIntent, piFlags);
            views.setOnClickPendingIntent(R.id.text_open_app_hint, todayAppPI);

            // 3. Populate Multi-Class Agenda Rows
            String classesJsonStr = prefs.getString("today_classes_json", "[]");
            JSONArray classes = new JSONArray(classesJsonStr);
            int totalClasses = classes.length();

            int pageOffset = prefs.getInt("widget_page_offset", 0);
            if (pageOffset >= totalClasses && totalClasses > 0) {
                pageOffset = 0;
                prefs.edit().putInt("widget_page_offset", 0).apply();
            }

            if (totalClasses == 0) {
                views.setViewVisibility(R.id.layout_classes_container, View.GONE);
                views.setViewVisibility(R.id.layout_empty_classes, View.VISIBLE);
                views.setViewVisibility(R.id.layout_pager_controls, View.GONE);
                views.setOnClickPendingIntent(R.id.layout_empty_classes, todayAppPI);
            } else {
                views.setViewVisibility(R.id.layout_classes_container, View.VISIBLE);
                views.setViewVisibility(R.id.layout_empty_classes, View.GONE);

                // Row View & Button Resource IDs mapping for 3 slots
                int[] rowLayoutIds = { R.id.row_class_1, R.id.row_class_2, R.id.row_class_3 };
                int[] dividerIds = { R.id.divider_row_1, R.id.divider_row_2 };
                int[] rowContentIds = { R.id.layout_row1_content, R.id.layout_row2_content, R.id.layout_row3_content };
                int[] nameTextIds = { R.id.text_row1_name, R.id.text_row2_name, R.id.text_row3_name };
                int[] infoTextIds = { R.id.text_row1_info, R.id.text_row2_info, R.id.text_row3_info };
                int[] presentBtnIds = { R.id.btn_row1_present, R.id.btn_row2_present, R.id.btn_row3_present };
                int[] absentBtnIds = { R.id.btn_row1_absent, R.id.btn_row2_absent, R.id.btn_row3_absent };
                int[] offBtnIds = { R.id.btn_row1_off, R.id.btn_row2_off, R.id.btn_row3_off };

                int nowMins = getCurrentMinutes();

                for (int i = 0; i < 3; i++) {
                    int classIdx = pageOffset + i;
                    if (classIdx < totalClasses) {
                        JSONObject cls = classes.getJSONObject(classIdx);
                        views.setViewVisibility(rowLayoutIds[i], View.VISIBLE);

                        if (i < 2) {
                            views.setViewVisibility(dividerIds[i], (classIdx + 1 < totalClasses) ? View.VISIBLE : View.GONE);
                        }

                        String subName = cls.optString("subjectName", "Class " + (classIdx + 1));
                        String rawRoom = cls.optString("room", "");
                        String roomStr = rawRoom.isEmpty() ? "TBA" : (rawRoom.startsWith("Room") ? rawRoom : "Rm " + rawRoom);
                        String timeStr = cls.optString("timeRange", "--");
                        String status = cls.optString("status", null);
                        String slotId = cls.optString("id", "");
                        String subjectId = cls.optString("subjectId", "");
                        String startTimeStr = cls.optString("startTime", "");
                        String endTimeStr = cls.optString("endTime", "");

                        // Dynamic status badge calculation
                        String timingChip = "";
                        if (!startTimeStr.isEmpty() && !endTimeStr.isEmpty()) {
                            int sMins = parseMinutes(startTimeStr);
                            int eMins = parseMinutes(endTimeStr);
                            if (nowMins >= sMins && nowMins < eMins) {
                                timingChip = "🟢 ONGOING • ";
                            } else if (nowMins < sMins) {
                                int diff = sMins - nowMins;
                                if (diff <= 60) {
                                    timingChip = "⏱️ IN " + diff + "M • ";
                                }
                            }
                        }

                        views.setTextViewText(nameTextIds[i], subName);
                        views.setTextViewText(infoTextIds[i], timingChip + timeStr + " • " + roomStr);

                        // Configure 1-Tap Attendance Buttons visual states
                        if ("present".equalsIgnoreCase(status) || "attended".equalsIgnoreCase(status)) {
                            views.setInt(presentBtnIds[i], "setBackgroundResource", R.drawable.widget_btn_present_selected);
                            views.setTextColor(presentBtnIds[i], 0xFFFFFFFF);

                            views.setInt(absentBtnIds[i], "setBackgroundResource", R.drawable.widget_btn_absent_default);
                            views.setTextColor(absentBtnIds[i], 0xFFFB7185);

                            views.setInt(offBtnIds[i], "setBackgroundResource", R.drawable.widget_btn_off_default);
                            views.setTextColor(offBtnIds[i], 0xFFFBBF24);
                        } else if ("absent".equalsIgnoreCase(status) || "missed".equalsIgnoreCase(status)) {
                            views.setInt(presentBtnIds[i], "setBackgroundResource", R.drawable.widget_btn_present_default);
                            views.setTextColor(presentBtnIds[i], 0xFF34D399);

                            views.setInt(absentBtnIds[i], "setBackgroundResource", R.drawable.widget_btn_absent_selected);
                            views.setTextColor(absentBtnIds[i], 0xFFFFFFFF);

                            views.setInt(offBtnIds[i], "setBackgroundResource", R.drawable.widget_btn_off_default);
                            views.setTextColor(offBtnIds[i], 0xFFFBBF24);
                        } else if ("off".equalsIgnoreCase(status) || "cancelled".equalsIgnoreCase(status)) {
                            views.setInt(presentBtnIds[i], "setBackgroundResource", R.drawable.widget_btn_present_default);
                            views.setTextColor(presentBtnIds[i], 0xFF34D399);

                            views.setInt(absentBtnIds[i], "setBackgroundResource", R.drawable.widget_btn_absent_default);
                            views.setTextColor(absentBtnIds[i], 0xFFFB7185);

                            views.setInt(offBtnIds[i], "setBackgroundResource", R.drawable.widget_btn_off_selected);
                            views.setTextColor(offBtnIds[i], 0xFFFFFFFF);
                        } else {
                            // Unmarked default states
                            views.setInt(presentBtnIds[i], "setBackgroundResource", R.drawable.widget_btn_present_default);
                            views.setTextColor(presentBtnIds[i], 0xFF34D399);

                            views.setInt(absentBtnIds[i], "setBackgroundResource", R.drawable.widget_btn_absent_default);
                            views.setTextColor(absentBtnIds[i], 0xFFFB7185);

                            views.setInt(offBtnIds[i], "setBackgroundResource", R.drawable.widget_btn_off_default);
                            views.setTextColor(offBtnIds[i], 0xFFFBBF24);
                        }

                        // Direct 1-Tap Attendance PendingIntents (DOES NOT OPEN APP)
                        Intent pIntent = new Intent(context, WidgetActionReceiver.class);
                        pIntent.setAction(WidgetActionReceiver.ACTION_MARK_ATTENDANCE);
                        pIntent.putExtra("status", "present");
                        pIntent.putExtra("slot_index", classIdx);
                        pIntent.putExtra("slot_id", slotId);
                        pIntent.putExtra("subject_id", subjectId);
                        PendingIntent pPI = PendingIntent.getBroadcast(context, 1000 + (classIdx * 10) + 1, pIntent, piFlags);
                        views.setOnClickPendingIntent(presentBtnIds[i], pPI);

                        Intent aIntent = new Intent(context, WidgetActionReceiver.class);
                        aIntent.setAction(WidgetActionReceiver.ACTION_MARK_ATTENDANCE);
                        aIntent.putExtra("status", "absent");
                        aIntent.putExtra("slot_index", classIdx);
                        aIntent.putExtra("slot_id", slotId);
                        aIntent.putExtra("subject_id", subjectId);
                        PendingIntent aPI = PendingIntent.getBroadcast(context, 1000 + (classIdx * 10) + 2, aIntent, piFlags);
                        views.setOnClickPendingIntent(absentBtnIds[i], aPI);

                        Intent oIntent = new Intent(context, WidgetActionReceiver.class);
                        oIntent.setAction(WidgetActionReceiver.ACTION_MARK_ATTENDANCE);
                        oIntent.putExtra("status", "off");
                        oIntent.putExtra("slot_index", classIdx);
                        oIntent.putExtra("slot_id", slotId);
                        oIntent.putExtra("subject_id", subjectId);
                        PendingIntent oPI = PendingIntent.getBroadcast(context, 1000 + (classIdx * 10) + 3, oIntent, piFlags);
                        views.setOnClickPendingIntent(offBtnIds[i], oPI);

                        // Tap Row Content -> Opens App Today Page
                        views.setOnClickPendingIntent(rowContentIds[i], todayAppPI);
                    } else {
                        // Class index beyond bounds -> hide row
                        views.setViewVisibility(rowLayoutIds[i], View.GONE);
                        if (i < 2) {
                            views.setViewVisibility(dividerIds[i], View.GONE);
                        }
                    }
                }

                // Configure Pager Controls if more than 3 classes
                if (totalClasses > 3) {
                    views.setViewVisibility(R.id.layout_pager_controls, View.VISIBLE);
                    int endIdx = Math.min(pageOffset + 3, totalClasses);
                    views.setTextViewText(R.id.text_page_indicator, (pageOffset + 1) + "–" + endIdx + " of " + totalClasses);

                    Intent prevIntent = new Intent(context, WidgetActionReceiver.class);
                    prevIntent.setAction(WidgetActionReceiver.ACTION_NAVIGATE);
                    prevIntent.putExtra("direction", -3);
                    PendingIntent prevPI = PendingIntent.getBroadcast(context, 501, prevIntent, piFlags);
                    views.setOnClickPendingIntent(R.id.btn_prev_page, prevPI);

                    Intent nextIntent = new Intent(context, WidgetActionReceiver.class);
                    nextIntent.setAction(WidgetActionReceiver.ACTION_NAVIGATE);
                    nextIntent.putExtra("direction", 3);
                    PendingIntent nextPI = PendingIntent.getBroadcast(context, 502, nextIntent, piFlags);
                    views.setOnClickPendingIntent(R.id.btn_next_page, nextPI);
                } else {
                    views.setViewVisibility(R.id.layout_pager_controls, View.GONE);
                }
            }

            appWidgetManager.updateAppWidget(appWidgetId, views);
        } catch (Exception e) {
            Log.e(TAG, "Error updating Today widget " + appWidgetId, e);
        }
    }

    public static void updateAllWidgets(Context context) {
        try {
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            ComponentName thisWidget = new ComponentName(context, TodayWidgetProvider.class);
            int[] allWidgetIds = manager.getAppWidgetIds(thisWidget);
            for (int id : allWidgetIds) {
                updateWidget(context, manager, id);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to broadcast update for Today widgets", e);
        }
    }
}
