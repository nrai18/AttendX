package com.attendx.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    public static final String PREFS_LAUNCH = "attendx_launch_prefs";
    public static final String KEY_PENDING_ROUTE = "pending_notification_route";
    public static final String KEY_PENDING_ROUTE_TS = "pending_notification_route_ts";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RingerPlugin.class);
        registerPlugin(WidgetPlugin.class);
        registerPlugin(ApkUpdaterPlugin.class);
        registerPlugin(BiometricPlugin.class);
        captureLaunchRoute(getIntent());
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String route = captureLaunchRoute(intent);
        if (route != null && !route.isEmpty() && getBridge() != null) {
            try {
                String safeRoute = route.replace("\\", "\\\\").replace("'", "\\'");
                getBridge().eval(
                    "(function(){try{sessionStorage.setItem('pending_push_route','" + safeRoute + "');window.dispatchEvent(new CustomEvent('push_route',{detail:'" + safeRoute + "'}));}catch(e){}})();",
                    null
                );
            } catch (Exception ignored) {}
        }
    }

    private String captureLaunchRoute(Intent intent) {
        if (intent == null || intent.getExtras() == null) return null;
        Bundle extras = intent.getExtras();
        String resolvedRoute = null;

        String rawRoute = extras.getString("route");
        if (rawRoute == null || rawRoute.trim().isEmpty()) {
            rawRoute = extras.getString("url");
        }
        if (rawRoute != null && !rawRoute.trim().isEmpty()) {
            resolvedRoute = rawRoute.trim();
        } else {
            String type = extras.getString("type");
            if (type == null) type = extras.getString("notification_type");
            if (type != null) {
                String t = type.trim().toLowerCase();
                if ("classroom_announcement".equals(t)
                        || "classroom_broadcast".equals(t)
                        || "announcement".equals(t)
                        || "classroom_poll_created".equals(t)
                        || "classroom_poll_closed".equals(t)
                        || "classroom_poll_stopped".equals(t)
                        || "classroom_poll".equals(t)
                        || "classroom_access_updated".equals(t)
                        || "broadcast_permission_updated".equals(t)) {
                    String cid = extras.getString("classroomId");
                    if (cid == null || cid.isEmpty()) cid = extras.getString("classroom_id");
                    resolvedRoute = (cid != null && !cid.isEmpty()) ? ("/classrooms/" + cid) : "/classrooms";
                } else if ("classroom_deleted".equals(t) || "classroom_disbanded".equals(t)) {
                    resolvedRoute = "/classrooms";
                } else if ("assignment_reminder".equals(t) || "assignment".equals(t)) {
                    resolvedRoute = "/assignments";
                } else if ("semester_transition".equals(t)) {
                    resolvedRoute = "/today?promptSemesterTransition=true";
                } else if ("semester_wrap".equals(t) || "wrap".equals(t) || "replay".equals(t)) {
                    resolvedRoute = "/wrap";
                } else if ("monthly_summary".equals(t) || "weekly_summary".equals(t) || "academic_update".equals(t)) {
                    resolvedRoute = "/report";
                } else if ("daily_summary".equals(t) || "morning_summary".equals(t) || "class_reminder".equals(t) || "birthday".equals(t) || "holiday".equals(t) || "peer_sync_redeemed".equals(t) || "peer_sync".equals(t) || "share_transfer".equals(t)) {
                    resolvedRoute = "/today";
                }
            }
        }

        if (resolvedRoute == null || resolvedRoute.isEmpty()) {
            // Also inspect Capacitor LocalNotification source JSON if present
            String sourceJson = extras.getString("LocalNotificationObject");
            if (sourceJson != null && !sourceJson.isEmpty()) {
                try {
                    org.json.JSONObject obj = new org.json.JSONObject(sourceJson);
                    org.json.JSONObject extraObj = obj.optJSONObject("extra");
                    if (extraObj != null) {
                        String exRoute = extraObj.optString("route", "");
                        if (exRoute.isEmpty()) exRoute = extraObj.optString("url", "");
                        if (!exRoute.isEmpty()) {
                            resolvedRoute = exRoute;
                        } else {
                            String exType = extraObj.optString("type", "").trim().toLowerCase();
                            if ("dnd_permission".equals(exType)) resolvedRoute = "/settings";
                            else if ("monthly_summary".equals(exType) || "weekly_summary".equals(exType) || "academic_update".equals(exType)) resolvedRoute = "/report";
                            else if ("assignment".equals(exType)) resolvedRoute = "/assignments";
                            else if ("wrap".equals(exType) || "replay".equals(exType)) resolvedRoute = "/wrap";
                            else if ("class_reminder".equals(exType) || "morning_summary".equals(exType) || "daily_summary".equals(exType) || "holiday".equals(exType)) resolvedRoute = "/today";
                        }
                    }
                    if (resolvedRoute == null || resolvedRoute.isEmpty()) {
                        int notifId = obj.optInt("id", -1);
                        if (notifId >= 8800 && notifId <= 8809) resolvedRoute = "/today";
                        else if (notifId >= 8810 && notifId <= 8899) resolvedRoute = "/report";
                        else if (notifId >= 9000 && notifId <= 69999) resolvedRoute = "/assignments";
                        else if (notifId >= 70000 && notifId <= 899999) resolvedRoute = "/today";
                    }
                } catch (Exception ignored) {}
            }
        }

        if (resolvedRoute != null && resolvedRoute.startsWith("/")) {
            SharedPreferences prefs = getSharedPreferences(PREFS_LAUNCH, Context.MODE_PRIVATE);
            prefs.edit()
                .putString(KEY_PENDING_ROUTE, resolvedRoute)
                .putLong(KEY_PENDING_ROUTE_TS, System.currentTimeMillis())
                .apply();
            return resolvedRoute;
        }
        return null;
    }
}
