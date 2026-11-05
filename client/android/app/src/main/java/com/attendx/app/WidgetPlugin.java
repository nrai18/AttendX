package com.attendx.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetPlugin extends Plugin {
    private static final String TAG = "WidgetPlugin";
    public static final String PREFS_NAME = "attendx_widget_prefs";

    @PluginMethod
    public void updateWidgetData(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();

            if (call.hasOption("date_formatted")) {
                editor.putString("date_formatted", call.getString("date_formatted"));
            }
            if (call.hasOption("attendance_stat")) {
                editor.putString("attendance_stat", call.getString("attendance_stat"));
            }
            if (call.hasOption("status_chip")) {
                editor.putString("status_chip", call.getString("status_chip"));
            }
            if (call.hasOption("room")) {
                editor.putString("room", call.getString("room"));
            }
            if (call.hasOption("subject_name")) {
                editor.putString("subject_name", call.getString("subject_name"));
            }
            if (call.hasOption("class_time")) {
                editor.putString("class_time", call.getString("class_time"));
            }
            if (call.hasOption("bunk_runway")) {
                editor.putString("bunk_runway", call.getString("bunk_runway"));
            }

            // Rich interactive widget data: today classes array & subjects
            if (call.hasOption("today_classes_json")) {
                editor.putString("today_classes_json", call.getString("today_classes_json"));
            }
            if (call.hasOption("subjects_json")) {
                editor.putString("subjects_json", call.getString("subjects_json"));
            }
            if (call.hasOption("auth_token")) {
                editor.putString("auth_token", call.getString("auth_token"));
            }
            if (call.hasOption("api_base_url")) {
                editor.putString("api_base_url", call.getString("api_base_url"));
            }

            // Next class specific options
            if (call.hasOption("next_room")) {
                editor.putString("next_room", call.getString("next_room"));
            }
            if (call.hasOption("next_countdown")) {
                editor.putString("next_countdown", call.getString("next_countdown"));
            }
            if (call.hasOption("next_subject")) {
                editor.putString("next_subject", call.getString("next_subject"));
            }
            if (call.hasOption("next_time")) {
                editor.putString("next_time", call.getString("next_time"));
            }
            if (call.hasOption("next_runway")) {
                editor.putString("next_runway", call.getString("next_runway"));
            }

            editor.apply();

            // Trigger updates to all placed widgets on the launcher
            TodayWidgetProvider.updateAllWidgets(context);
            NextClassWidgetProvider.updateAllWidgets(context);
            WidgetActionReceiver.scheduleNextWidgetRefresh(context);

            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        } catch (Exception e) {
            Log.e(TAG, "Failed to update widget preferences", e);
            call.reject("Failed to update widget: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getPendingMutations(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String rawMutations = prefs.getString("attendx_offline_mutations", "[]");
            JSONArray arr = new JSONArray(rawMutations);

            JSArray resultArr = new JSArray();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                JSObject jsObj = new JSObject();
                jsObj.put("subjectId", obj.optString("subjectId"));
                jsObj.put("timetableSlotId", obj.optString("timetableSlotId"));
                jsObj.put("date", obj.optString("date"));
                jsObj.put("status", obj.optString("status"));
                jsObj.put("timestamp", obj.optLong("timestamp"));
                resultArr.put(jsObj);
            }

            // Clear mutations after fetching to avoid duplicate reprocessing
            prefs.edit().remove("attendx_offline_mutations").apply();

            JSObject res = new JSObject();
            res.put("mutations", resultArr);
            call.resolve(res);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get pending widget mutations", e);
            JSObject res = new JSObject();
            res.put("mutations", new JSArray());
            call.resolve(res);
        }
    }

    @PluginMethod
    public void clearPendingMutations(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().remove("attendx_offline_mutations").apply();
            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Failed to clear mutations: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getBufferedAnnouncements(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String raw = prefs.getString("attendx_fcm_buffered_announcements", "[]");
            JSONArray arr = new JSONArray(raw);

            JSArray resultArr = new JSArray();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                JSObject item = JSObject.fromJSONObject(obj);
                resultArr.put(item);
            }

            // Clear buffer once retrieved to avoid duplicate reprocessing
            prefs.edit().remove("attendx_fcm_buffered_announcements").apply();

            JSObject res = new JSObject();
            res.put("announcements", resultArr);
            call.resolve(res);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get buffered announcements", e);
            JSObject res = new JSObject();
            res.put("announcements", new JSArray());
            call.resolve(res);
        }
    }
}
