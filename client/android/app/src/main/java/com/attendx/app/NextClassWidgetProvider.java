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
import org.json.JSONArray;
import org.json.JSONObject;

public class NextClassWidgetProvider extends AppWidgetProvider {
    private static final String TAG = "NextClassWidget";
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
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_next_class_1x2);

            String room = prefs.getString("next_room", prefs.getString("room", "📍 ROOM --"));
            String countdown = prefs.getString("next_countdown", "⏱️ NEXT");
            String subjectName = prefs.getString("next_subject", prefs.getString("subject_name", "No upcoming classes"));
            String classTime = prefs.getString("next_time", prefs.getString("class_time", "--"));
            String runway = prefs.getString("next_runway", prefs.getString("bunk_runway", "Safe"));

            String classesJsonStr = prefs.getString("today_classes_json", "[]");
            JSONArray classes = new JSONArray(classesJsonStr);

            if (classes.length() > 0) {
                int nowMins = TodayWidgetProvider.getCurrentMinutes();
                JSONObject activeCls = null;
                JSONObject nextCls = null;

                for (int i = 0; i < classes.length(); i++) {
                    JSONObject cls = classes.getJSONObject(i);
                    String startTimeStr = cls.optString("startTime", "");
                    String endTimeStr = cls.optString("endTime", "");
                    int startMins = TodayWidgetProvider.parseMinutes(startTimeStr);
                    int endMins = TodayWidgetProvider.parseMinutes(endTimeStr);

                    if (nowMins >= startMins && nowMins < endMins) {
                        activeCls = cls;
                        break;
                    } else if (nowMins < startMins && nextCls == null) {
                        nextCls = cls;
                    }
                }

                JSONObject spotlight = (activeCls != null) ? activeCls : nextCls;
                if (spotlight != null) {
                    boolean isOngoing = (spotlight == activeCls);
                    subjectName = spotlight.optString("subjectName", subjectName);
                    String rawRoom = spotlight.optString("room", "");
                    room = rawRoom.isEmpty() ? "📍 ROOM TBA" : (rawRoom.startsWith("Room") ? "📍 " + rawRoom.toUpperCase() : "📍 ROOM " + rawRoom.toUpperCase());
                    classTime = spotlight.optString("timeRange", classTime);
                    runway = spotlight.optString("bunkRunway", runway);

                    if (isOngoing) {
                        countdown = "⚡ ONGOING";
                    } else {
                        int diff = TodayWidgetProvider.parseMinutes(spotlight.optString("startTime", "00:00")) - nowMins;
                        if (diff <= 60) {
                            countdown = "⏱️ IN " + diff + "M";
                        } else {
                            countdown = "⏱️ AT " + TodayWidgetProvider.formatTime12h(spotlight.optString("startTime", "00:00"));
                        }
                    }
                } else {
                    room = "📍 COMPLETED";
                    countdown = "🎉 ALL DONE";
                    subjectName = "All classes completed today";
                    classTime = "Free for the day";
                    runway = "Safe";
                }
            }

            views.setTextViewText(R.id.text_next_room_badge, room.toUpperCase());
            views.setTextViewText(R.id.text_next_countdown, countdown.toUpperCase());
            views.setTextViewText(R.id.text_next_subject, subjectName);
            views.setTextViewText(R.id.text_next_time, classTime);
            views.setTextViewText(R.id.text_next_runway, runway);

            // On click anywhere on the glance widget, open today schedule
            Intent openIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://attendx.tech/today?view=next"), context, MainActivity.class);
            openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            openIntent.putExtra("widget_action", "next_class_glance");
            PendingIntent pending = PendingIntent.getActivity(
                context, 201, openIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_next_class_root, pending);

            appWidgetManager.updateAppWidget(appWidgetId, views);
        } catch (Exception e) {
            Log.e(TAG, "Error updating Next Class widget " + appWidgetId, e);
        }
    }

    public static void updateAllWidgets(Context context) {
        try {
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            ComponentName thisWidget = new ComponentName(context, NextClassWidgetProvider.class);
            int[] allWidgetIds = manager.getAppWidgetIds(thisWidget);
            for (int id : allWidgetIds) {
                updateWidget(context, manager, id);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to broadcast update for Next Class widgets", e);
        }
    }
}
