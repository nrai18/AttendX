# Handoff Report: Notifications & Local Scheduling Audit (Requirement R2 Part A)
**Agent**: Survey Explorer 2  
**Date**: 2026-09-19  
**Type**: Hard Handoff  
**Working Directory**: `c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\explorer_survey_2`  
**Reference Analysis**: `c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\explorer_survey_2\analysis.md`

---

## 1. Observation

Direct code observations from inspecting the AttendX repository:

1. **Cold Start Hydration Race Condition**:
   - `client/src/App.tsx:142-143`:
     ```typescript
     await NotificationService.init();
     await NotificationService.autoScheduleFromTimetable();
     ```
   - `client/src/services/NotificationService.ts:222-224`:
     ```typescript
     const activeSemesterId = useAttendanceStore.getState().activeSemesterId;
     if (!activeSemesterId) return;
     ```
   - `client/src/stores/attendanceStore.ts:284`:
     `storage: createJSONStorage(() => capacitorStorage)` utilizes asynchronous `Preferences.get()`. When `App.tsx` runs `useEffect`, `_hasHydrated` is false and `activeSemesterId` is null. `autoScheduleFromTimetable()` silently returns without scheduling notifications.

2. **Timetable Edit / Import Race Condition**:
   - `client/src/pages/timetable/TimetablePage.tsx:248-250`:
     ```typescript
     resetForm();
     fetchData();
     window.dispatchEvent(new Event("attendance-updated"));
     ```
   - `client/src/pages/timetable/TimetablePage.tsx:282-283`:
     ```typescript
     fetchData();
     window.dispatchEvent(new Event("attendance-updated"));
     ```
   - `client/src/services/NotificationService.ts:227`:
     ```typescript
     let slots: any[] = useCacheStore.getState().timetable?.slots;
     ```
   - `fetchData()` is not awaited before dispatching `attendance-updated`. `autoScheduleFromTimetable()` reads `useCacheStore` while `fetchData()` is still in flight, rescheduling using stale cached slots.

3. **Background Auto-Unmute Timer Failure**:
   - `client/src/services/NotificationService.ts:169-175`:
     ```typescript
     const timeUntilEnd = endTime.getTime() - Date.now();
     if (timeUntilEnd > 0) {
       setTimeout(async () => {
         await unmutePhone();
         await LocalNotifications.cancel({ notifications: [{ id: 8888 }] });
       }, timeUntilEnd);
     }
     ```
   - In Android Capacitor WebViews, `setTimeout` is throttled or killed when the app is backgrounded or screen locked. Phone remains in DND indefinitely.

4. **Notification ID Collisions & Leakage**:
   - `client/src/services/NotificationService.ts:184, 204`:
     `id: Math.floor(Math.random() * 10000)` (Holiday & Birthday alerts generate random IDs in [0, 9999]).
   - `client/src/services/NotificationService.ts:153`: `id: 8888` (Pinned class mute).
   - `client/src/services/NotificationService.ts:446, 456`: `n.id >= 9000 && n.id <= 9999`, `let idCounter = 9000`.
   - `client/src/services/NotificationService.ts:242`:
     ```typescript
     const toCancel = pending.notifications.filter(n => n.id >= 100000);
     ```
   - Holiday and birthday notifications (`id < 10000`) are excluded from `toCancel`, accumulating duplicates on every reschedule.

5. **No Cleanup on User Logout**:
   - `client/src/stores/authStore.ts:71-89`:
     ```typescript
     logout: () => {
       const keysToRemove = [ ... ];
       keysToRemove.forEach(k => { ... });
       set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
     }
     ```
   - `LocalNotifications.cancelAll()` is never invoked. Previous user's pending alarms fire on the device after logout.

6. **Missing Android 13+ & Exact Alarm Handling**:
   - `client/src/services/NotificationService.ts:18-21`:
     ```typescript
     const perm = await LocalNotifications.checkPermissions();
     if (perm.display !== 'granted') {
       await LocalNotifications.requestPermissions();
     }
     ```
   - Ignored return value; missing exact alarm check (`checkExactNotificationSetting()`). If denied, alarms silently downgrade to inexact alarms or fail silently without user notice.

7. **Weekly & Monthly Summary Calculation Bugs**:
   - `client/src/services/NotificationService.ts:554-556`:
     ```typescript
     if (notifyDate.getTime() <= Date.now()) {
       notifyDate = setMinutes(setHours(addDays(nextTargetDay, (i+4) * 7), summaryHour), summaryMinute); 
     }
     ```
   - If `nextTargetDay` is today and the hour has passed, Week 0 is pushed by 28 days (`(0+4)*7`), corrupting the cadence.
   - `client/src/services/NotificationService.ts:591-594`: If `targetDate` is 31, February overflows into March 3 and April into May 1.

8. **Missing Attendance Threshold Alerts & Morning Summaries**:
   - `client/src/pages/marketing/PrivacyPage.tsx:37` advertises threshold alerts, but `NotificationService.ts` contains no logic for threshold warnings or morning daily agendas.

9. **Assignment Completion / Deletion Does Not Cancel Reminders**:
   - `client/src/stores/assignmentStore.ts:67-82`: `deleteAssignment` and `toggleCompletion` never invoke `scheduleAssignmentReminders()`. Completed assignments still trigger deadline alarms.
   - `client/src/services/NotificationService.ts:452`: Fails when offline with raw `api.get('/assignments')`.

10. **Single Channel & Missing Channel in `ringer.ts`**:
    - `client/src/services/NotificationService.ts:24-43`: Only `class_alerts` and `silent_mode` created. All notifications routed to `class_alerts`.
    - `client/src/lib/ringer.ts:20-27`: Schedules `id: 8080` without any `channelId`.

11. **Settings UI Inconsistencies**:
    - `client/src/pages/settings/SettingsPage.tsx:1125`: Timetable alerts card hidden when `reminderFrequency.type !== 'Daily'`.
    - `SettingsPage.tsx:1159, 1172, 1185`: Toggling `endOfDaySummary`, `showLocation`, `notifyNextClassOnEnd` does not call `autoScheduleFromTimetable()`.

12. **Navigation Reload Flaw**:
    - `client/src/services/NotificationService.ts:79`: `window.location.href = '/report'` forces a full page reload inside WebView instead of client-side navigation.

---

## 2. Logic Chain

1. **Cold Start Failure**:
   From (1), `App.tsx` calls `autoScheduleFromTimetable()` immediately during component mount.
   Because `useAttendanceStore` uses asynchronous `Preferences` storage, `activeSemesterId` is null at execution time.
   `autoScheduleFromTimetable()` hits `if (!activeSemesterId) return;` and exits.
   `AppShell.tsx` only calls `fetchStats()`, never triggering `autoScheduleFromTimetable()`.
   **Conclusion**: On app cold launch, local notifications are never scheduled.

2. **Stale Cache on Timetable Update**:
   From (2), `TimetablePage.tsx` fires `window.dispatchEvent(new Event("attendance-updated"))` synchronously without awaiting `fetchData()`.
   `autoScheduleFromTimetable()` reads `useCacheStore.getState().timetable?.slots`.
   Since `fetchData()` network calls are still pending, the cache has not updated.
   `autoScheduleFromTimetable()` wipes pending alarms and reschedules using the old slots.
   **Conclusion**: Any slot additions, edits, deletions, or JSON imports result in notifications scheduled for the old slots.

3. **Indefinite Phone Silence**:
   From (3), `triggerPinnedClassMute` silences the phone and schedules an unmute callback via `setTimeout`.
   Android suspends or kills WebView execution when backgrounded or locked.
   The `setTimeout` callback does not execute.
   **Conclusion**: The user's device remains in Do Not Disturb / Silent mode permanently after a class ends.

4. **Notification ID Collisions**:
   From (4), random generation in `[0, 9999]` for holidays/birthdays intersects static IDs `8888`, `8800-8829`, `9000-9999`, and `8080`.
   Additionally, line 242 excludes `< 10000` from cancellation.
   **Conclusion**: Collisions cause notifications to cancel or trigger wrong actions, and multiple duplicate holiday alerts accumulate.

5. **Multi-User Privacy Bleed**:
   From (5), `authStore.logout()` removes local preference keys and user state, but never invokes `LocalNotifications.cancelAll()`.
   **Conclusion**: Alarms remain registered in Android `AlarmManager` and pop up with the logged-out user's academic and room details.

6. **Summary Calculation Failures**:
   From (7), when a weekly summary is configured for the current day of the week after the scheduled time, `(i+4)*7` forces Week 0 to 28 days in the future, while Weeks 1-3 fire on days 7, 14, 21.
   `new Date(year, month, 31)` overflows into subsequent months.
   **Conclusion**: Weekly briefings skip weeks and monthly briefings fire on erratic dates or duplicate in subsequent months.

---

## 3. Caveats

1. **Android OEM Battery Optimizations**: Even with correct exact alarm permissions, extreme battery saver modes on certain Android OEMs (e.g. Xiaomi MIUI / HyperOS, Samsung OneUI aggressive app sleep) may defer background alarms unless the user disables battery optimization for AttendX.
2. **Capacitor Plugin Scope**: Custom native Android receiver code for auto-unmuting would require editing native Java/Kotlin files in `client/android/app/src/main/java/com/attendx/app/` rather than pure TypeScript.
3. **No Caveats on Codebase Investigation**: All notification paths, stores, pages, and plugin internals were directly inspected from repository source code.

---

## 4. Conclusion

The AttendX notification subsystem contains 13 specific vulnerabilities spanning lifecycle timing, cache races, WebView timer suspension, ID collisions, permission handling, and missing threshold/morning features.
Fixing these issues requires:
1. Orchestrating scheduling strictly after store rehydration and ensuring `fetchData()` is awaited prior to event dispatch.
2. Replacing `setTimeout` auto-unmute with app-resume reconciliation and native alarm triggers.
3. Establishing deterministic, partitioned notification ID ranges.
4. Calling `cancelAll()` on logout.
5. Implementing missing attendance threshold alerts and morning summaries.
6. Decoupling notification channels and fixing calculation bugs in academic summaries.

---

## 5. Verification Method

### Files to Inspect
1. `client/src/services/NotificationService.ts`: Check `init()`, `autoScheduleFromTimetable()`, `scheduleAcademicUpdates()`, `scheduleAssignmentReminders()`, `triggerPinnedClassMute()`.
2. `client/src/pages/timetable/TimetablePage.tsx`: Check lines 248-250 and 282-284 (`await fetchData()`).
3. `client/src/stores/authStore.ts`: Check `logout()`.
4. `client/src/stores/assignmentStore.ts`: Check `deleteAssignment()` and `toggleCompletion()`.
5. `client/src/pages/settings/SettingsPage.tsx`: Check line 1125 and toggle handlers.
6. `client/src/lib/ringer.ts`: Check line 20 (`channelId`).

### Verification Commands
1. Build verification:
   ```bash
   cd client
   npm run build
   ```
2. Unit / logic check:
   Verify schedule calculations (weekly day matching and monthly day clamping) by running node test script or Jest.
3. Invalidation Conditions:
   - If `autoScheduleFromTimetable()` is triggered when `activeSemesterId` is null, notifications fail to schedule.
   - If `fetchData()` is called without `await` before `attendance-updated`, notifications are scheduled with stale slots.
   - If `authStore.logout()` does not call `cancelAll()`, pending notifications survive logout.
