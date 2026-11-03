package com.attendx.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

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

            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        } catch (Exception e) {
            Log.e(TAG, "Failed to update widget preferences", e);
            call.reject("Failed to update widget: " + e.getMessage());
        }
    }
}
