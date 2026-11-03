package com.attendx.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.Log;
import android.widget.RemoteViews;

public class TodayWidgetProvider extends AppWidgetProvider {
    private static final String TAG = "TodayWidgetProvider";
    public static final String PREFS_NAME = "attendx_widget_prefs";

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

            String dateFormatted = prefs.getString("date_formatted", "Today");
            String attendanceStat = prefs.getString("attendance_stat", "--%");
            String statusChip = prefs.getString("status_chip", "⚡ SCHEDULE");
            String room = prefs.getString("room", "📍 Room --");
            String subjectName = prefs.getString("subject_name", "No upcoming classes");
            String classTime = prefs.getString("class_time", "--");
            String bunkRunway = prefs.getString("bunk_runway", "Attendance Safe");

            views.setTextViewText(R.id.text_today_date, dateFormatted);
            views.setTextViewText(R.id.text_attendance_stat, attendanceStat);
            views.setTextViewText(R.id.text_class_status_chip, statusChip);
            views.setTextViewText(R.id.text_class_room, room);
            views.setTextViewText(R.id.text_class_name, subjectName);
            views.setTextViewText(R.id.text_class_time, classTime);
            views.setTextViewText(R.id.text_bunk_runway, bunkRunway);

            // Set color for percentage if available
            double pct = 0;
            try {
                String cleanPct = attendanceStat.replace("%", "").trim();
                pct = Double.parseDouble(cleanPct);
                if (pct < 75.0) {
                    views.setTextColor(R.id.text_attendance_stat, 0xFFF43F5E); // Rose
                } else {
                    views.setTextColor(R.id.text_attendance_stat, 0xFF10B981); // Emerald
                }
            } catch (Exception ignored) {}

            // PendingIntent 1: Open Today / Spotlight Card
            Intent todayIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://attendx.tech/today"), context, MainActivity.class);
            todayIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            todayIntent.putExtra("widget_action", "open_today");
            PendingIntent todayPending = PendingIntent.getActivity(
                context, 101, todayIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.card_spotlight, todayPending);
            views.setOnClickPendingIntent(R.id.btn_open_today, todayPending);
            views.setOnClickPendingIntent(R.id.widget_today_root, todayPending);

            // PendingIntent 2: Quick Log Class Action
            Intent quickLogIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://attendx.tech/today?action=quick_log"), context, MainActivity.class);
            quickLogIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            quickLogIntent.putExtra("widget_action", "quick_log");
            PendingIntent quickLogPending = PendingIntent.getActivity(
                context, 102, quickLogIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.btn_quick_log, quickLogPending);

            // PendingIntent 3: Voice Copilot Action
            Intent voiceIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://attendx.tech/today?action=voice"), context, MainActivity.class);
            voiceIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            voiceIntent.putExtra("widget_action", "voice");
            PendingIntent voicePending = PendingIntent.getActivity(
                context, 103, voiceIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.btn_voice_copilot, voicePending);

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
