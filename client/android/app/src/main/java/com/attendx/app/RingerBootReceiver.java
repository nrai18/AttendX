package com.attendx.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Catches device boot completion to restore active class auto-unmute alarms and pinned notifications.
 */
public class RingerBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        Intent forwardIntent = new Intent(context, RingerAlarmReceiver.class);
        forwardIntent.setAction(intent.getAction());
        context.sendBroadcast(forwardIntent);
    }
}
