# Requirement R2 (Part A): Notifications & Local Scheduling Audit
**Author**: Survey Explorer 2  
**Date**: 2026-09-19  
**Target Codebase**: AttendX (`client/src/services/NotificationService.ts`, `client/src/lib/ringer.ts`, `client/src/stores/`, `client/src/pages/`, `client/android/`)

---

## 1. Executive Summary

A comprehensive, line-by-line audit of the local notification scheduling, lifecycle handling, background execution, and permission architecture in AttendX was conducted. The audit revealed **13 critical architectural and logic flaws** that cause silent failures, notifications failing to fire on app cold boots, stale reminders firing after classes or assignments are deleted/completed, phone ringer remaining permanently silenced after class, random notification ID collisions, multi-user privacy leaks on logout, and hard-refresh UX disruption.

---

## 2. Notification System Inventory

The local notifications system relies on `@capacitor/local-notifications` (v7) and native Android `AlarmManager` APIs.

| Notification Category | Notification ID Scheme | Channels Used | Trigger Type | Action Types Registered |
|---|---|---|---|---|
| **Class Reminders** | `Math.floor(Math.random() * 900000) + 100000` | `class_alerts` | `schedule.at` (One-shot) | `CLASS_REMINDER_ACTIONS` (`MUTE_ACTION`) |
| **Heads-up Alerts** | `Math.floor(Math.random() * 900000) + 100000` | `class_alerts` | `schedule.at` (One-shot) | `CLASS_REMINDER_ACTIONS` (`MUTE_ACTION`) |
| **Active Silent Mode (Pinned)** | `8888` (Static) | `silent_mode` | `schedule.at` (immediate + 1s) | `CLASS_SILENT_ACTIONS` (`UNMUTE_ACTION`) |
| **Holiday Alerts** | `Math.floor(Math.random() * 10000)` | `class_alerts` | `schedule.at` (One-shot, 08:00) | None |
| **Birthday Alerts** | `Math.floor(Math.random() * 10000)` | `class_alerts` | `schedule.at` (One-shot, 09:00) | None |
| **End of Day Summary** | `Math.floor(Math.random() * 900000) + 100000` | `class_alerts` | `schedule.at` (One-shot, class end) | None |
| **Assignment Reminders** | `9000 + counter` (9000-9999) | `class_alerts` | `schedule.at` (Cascades: 24h, 2h, 15m) | `ACADEMIC_UPDATE_OPEN` |
| **Academic Briefing (Daily)** | `8800 + i` (8800-8807) | `class_alerts` | `schedule.at` (7 days) | `ACADEMIC_UPDATE_OPEN` |
| **Academic Briefing (Weekly)** | `8810 + i` (8810-8813) | `class_alerts` | `schedule.at` (4 weeks) | `ACADEMIC_UPDATE_OPEN` |
| **Academic Briefing (Monthly)** | `8820 + i` (8820-8822) | `class_alerts` | `schedule.at` (3 months) | `ACADEMIC_UPDATE_OPEN` |
| **DND Permission Warning** | `8080` (Static) | None (`DEFAULT_CHANNEL`) | `schedule.at` (+1s) | None |
| **Attendance Threshold Alerts** | **MISSING** (Not implemented) | N/A | N/A | N/A |
| **Morning Class Summary** | **MISSING** (Not implemented) | N/A | N/A | N/A |

---

## 3. Detailed Vulnerability & Logic Flaw Analysis

---

### Issue 1: Asynchronous Store Hydration Race on App Cold Start (Notifications Never Scheduled on Launch)
- **Files**: `client/src/App.tsx:142-143`, `client/src/services/NotificationService.ts:222-224`, `client/src/stores/attendanceStore.ts:281-299`
- **Code Snippet**:
  ```typescript
  // client/src/App.tsx
  useEffect(() => {
    const initServices = async () => {
      try {
        await NotificationService.init();
        await NotificationService.autoScheduleFromTimetable();
      ...
  ```
  ```typescript
  // client/src/services/NotificationService.ts
  static async autoScheduleFromTimetable() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const activeSemesterId = useAttendanceStore.getState().activeSemesterId;
      if (!activeSemesterId) return; // <-- Silent exit!
  ```
- **Root Cause & Failure Scenario**:
  `useAttendanceStore` and `useCacheStore` persist data to `@capacitor/preferences` using asynchronous storage bridge (`capacitorStorage`). When `App.tsx` mounts, `useEffect` executes immediately. At that moment, `attendanceStore` has not finished asynchronous hydration (`_hasHydrated` is false, `activeSemesterId` is `null`).
  `NotificationService.autoScheduleFromTimetable()` executes, checks `activeSemesterId`, finds it null, and **immediately returns without scheduling anything**.
  When the store finishes hydrating moments later, `initServices` does not re-run (its dependency array is `[]`). Furthermore, when `AppShell.tsx` mounts and runs `fetchStats()`, it does NOT trigger `autoScheduleFromTimetable()` unless an attendance event is dispatched.
  **Result**: On a cold start of the application, **no timetable notifications are ever scheduled**. If the user simply opens the app and closes it, all local class reminders remain un-scheduled.
- **Proposed Fix**:
  1. Trigger `NotificationService.autoScheduleFromTimetable()` once `_hasHydrated` becomes true or inside `AppShell.tsx` immediately after `fetchStats()` resolves.
  2. If `activeSemesterId` is not yet in Zustand, attempt to read directly from `Preferences.get({ key: 'attendx-attendance-cache' })` before bailing out.

---

### Issue 2: Stale Cache Race Condition on Timetable Add / Edit / Import
- **Files**: `client/src/pages/timetable/TimetablePage.tsx:248-250, 282-284`, `client/src/services/NotificationService.ts:227-236`
- **Code Snippet**:
  ```typescript
  // client/src/pages/timetable/TimetablePage.tsx
  if (editingSlotId) {
    await api.patch(`/timetable/slots/${editingSlotId}`, payload);
  } else {
    await api.post("/timetable/slots", payload);
  }
  resetForm();
  fetchData(); // <-- NOT AWAITED!
  window.dispatchEvent(new Event("attendance-updated"));
  ```
  ```typescript
  // client/src/services/NotificationService.ts
  let slots: any[] = useCacheStore.getState().timetable?.slots;
  if (!slots) { ... api.get ... }
  ```
- **Root Cause & Failure Scenario**:
  `fetchData()` in `TimetablePage.tsx` is an asynchronous function that fetches `/subjects` and `/timetable/${semester.id}` and then calls `setCache('timetable', ...)`. However, lines 249 and 282 call `fetchData()` **without awaiting it**, and synchronously dispatch `attendance-updated`.
  In `AppShell.tsx`, the event listener catches `attendance-updated` and immediately calls `NotificationService.autoScheduleFromTimetable()`.
  `autoScheduleFromTimetable()` checks `useCacheStore.getState().timetable?.slots`. Because `fetchData()` network requests are still in-flight, `useCacheStore` contains the **old stale timetable slots**. `autoScheduleFromTimetable()` cancels existing alarms and reschedules the old slots!
  When `fetchData()` finally completes and updates the cache, no new event is dispatched.
  **Result**: When a user changes a class time (e.g. from 9:00 AM to 2:00 PM) or deletes a class, the notifications remain scheduled for the OLD slot time.
- **Proposed Fix**:
  1. In `TimetablePage.tsx`, `await fetchData()` before dispatching `attendance-updated`.
  2. In `NotificationService.autoScheduleFromTimetable()`, support an optional parameter `slotsOverride?: any[]` so callers can pass freshly resolved slots directly.

---

### Issue 3: Fatal Auto-Unmute Timer Using `setTimeout` in Backgrounded WebView
- **File**: `client/src/services/NotificationService.ts:169-175, 101-109`
- **Code Snippet**:
  ```typescript
  // client/src/services/NotificationService.ts
  const timeUntilEnd = endTime.getTime() - Date.now();
  if (timeUntilEnd > 0) {
    setTimeout(async () => {
      await unmutePhone();
      await LocalNotifications.cancel({ notifications: [{ id: 8888 }] });
    }, timeUntilEnd);
  }
  ```
- **Root Cause & Failure Scenario**:
  When a user taps "🔕 Mute Phone for Class", `triggerPinnedClassMute` silences the phone via `RingerPlugin` and sets a JavaScript `setTimeout` to call `unmutePhone()` when `endTime` is reached.
  In Capacitor on Android, JavaScript runs inside a Chrome WebView. When the screen is turned off or the app is moved to the background, Android's process scheduler freezes the WebView and throttles/suspends timers. If the user swipes AttendX away from recent apps, the WebView process is immediately killed.
  **Result**: `setTimeout` never executes. The phone remains permanently muted in Do Not Disturb / Silent mode indefinitely. The user misses critical phone calls and alarms.
  Additionally, line 104 computes `endTime = addDays(endTime, 1)` if `endTime.getTime() < Date.now()`, which can set a 24-hour mute timer if a class was muted near its end time!
- **Proposed Fix**:
  1. Schedule a native one-shot alarm / notification with an explicit unmute intent or schedule unmuting through a persistent Android background mechanism / AlarmManager action.
  2. When the app resumes (`onResume` / `appStateChange`), inspect whether an active mute has expired and immediately trigger `unmutePhone()`.
  3. Ensure `endTime` calculation never wraps to the next day inappropriately.

---

### Issue 4: Dangerous Notification ID Collisions & Leakage
- **Files**: `client/src/services/NotificationService.ts:125, 184, 204, 242, 420, 446, 456, 501, 527, 570, 597`, `client/src/lib/ringer.ts:22`
- **Code Snippet**:
  ```typescript
  // Holiday & Birthday:
  id: Math.floor(Math.random() * 10000)

  // Timetable cancellation filter:
  const toCancel = pending.notifications.filter(n => n.id >= 100000);

  // Assignment cancellation filter & assignment IDs:
  const toCancel = pending.notifications.filter(n => n.id >= 9000 && n.id <= 9999);
  let idCounter = 9000;

  // Pinned mute & Academic Updates:
  id: 8888; 8800 + i; 8810 + i; 8820 + i; 8080
  ```
- **Root Cause & Failure Scenario**:
  1. `scheduleHolidayNotification` and `scheduleBirthdayNotification` generate random IDs between `0` and `9999`. This conflicts directly with:
     - `8888`: Pinned class silent mode notification.
     - `8800 - 8829`: Academic update briefings.
     - `9000 - 9999`: Assignment reminders.
     - `8080`: Missing DND permission notification.
     If a holiday gets ID 8888, it overwrites the pinned mute notification. If it gets ID 9005, running `scheduleAssignmentReminders()` cancels it!
  2. `autoScheduleFromTimetable()` only cancels `n.id >= 100000`. Holiday and Birthday notifications (`id < 10000`) are **never cancelled**. Every time `autoScheduleFromTimetable()` runs (on every attendance update or launch), new holiday/birthday notifications are scheduled with new random IDs. Over a few days, users accumulate dozens of duplicate notifications for the same holiday.
  3. Timetable slot IDs use `Math.random() * 900000 + 100000` instead of a deterministic hash of `(slotId + date)`. Individual slots cannot be targeted or updated; everything must be cancelled en masse.
  4. Assignments use `idCounter++` starting at 9000. If an active semester has multiple assignments with cascade reminders (3 per assignment), having >333 items overflows past 9999 into 10000+, escaping the cancellation filter `[9000, 9999]`.
- **Proposed Fix**:
  Define strict, non-overlapping deterministic ID partitions:
  - `1000 - 1999`: Static System Alerts (8080 -> 1001, 8888 -> 1002).
  - `2000 - 2999`: Academic Updates (Daily/Weekly/Monthly).
  - `3000 - 3999`: Events, Holidays & Birthdays (using deterministic hash of event ID).
  - `4000 - 9999`: Assignments (deterministic hash of `assignment.id + reminderIndex`).
  - `100000 - 999999`: Timetable Slots (deterministic hash of `slot.id + dateString`).

---

### Issue 5: No Notification Cancellation on User Logout (Privacy & Multi-User Bleed)
- **File**: `client/src/stores/authStore.ts:71-89`
- **Code Snippet**:
  ```typescript
  logout: () => {
    const keysToRemove = [ ... ];
    keysToRemove.forEach(k => {
      Preferences.remove({ key: k }).catch(() => {});
      localStorage.removeItem(k);
    });
    set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
  }
  ```
- **Root Cause & Failure Scenario**:
  `LocalNotifications.cancelAll()` is never called when the user logs out.
  Android `AlarmManager` stores alarms at the system level. When User A logs out, all scheduled class reminders (including subject names, classroom numbers, and teacher details), assignment alerts, and academic summaries remain in `AlarmManager` and `NotificationStorage`.
  **Result**: The phone continues to trigger notifications for the logged-out account. If another student logs in, or if the device is shared, the previous user's academic and attendance data is exposed via notifications.
- **Proposed Fix**:
  Add `NotificationService.cancelAllNotifications()` and invoke it inside `authStore.logout()`.

---

### Issue 6: Android 13+ (`POST_NOTIFICATIONS`) and Android 12+ (`SCHEDULE_EXACT_ALARM`) Missing Checks & Silent Failures
- **Files**: `client/src/services/NotificationService.ts:18-21, 218-245`, `client/android/app/src/main/AndroidManifest.xml:50-53`
- **Code Snippet**:
  ```typescript
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') {
    await LocalNotifications.requestPermissions();
  }
  this.isInitialized = true;
  ```
- **Root Cause & Failure Scenario**:
  1. `perm.display` is checked, but the return value of `requestPermissions()` is ignored. If the user taps "Don't allow", `LocalNotifications.schedule()` subsequently fails with `LocalNotificationsError.NOTIFICATIONS_DISABLED`, which is swallowed in `autoScheduleFromTimetable()`'s `catch` block with only `console.error`. The user is never informed that notifications are disabled.
  2. On Android 12+ (API 31+), exact alarm scheduling requires the `SCHEDULE_EXACT_ALARM` setting. If denied (by system policy or power saver), `@capacitor/local-notifications` silently downgrades to inexact alarms (`alarmManager.setAndAllowWhileIdle`), causing alarms to be delayed by up to 45 minutes in Doze mode. AttendX never calls `checkExactNotificationSetting()` or `changeExactNotificationSetting()`.
  3. No permission status indicator or "Enable Notifications" recovery button exists in `SettingsPage.tsx`.
- **Proposed Fix**:
  1. In `NotificationService.init()`, evaluate the result of `requestPermissions()`.
  2. Implement `checkPermissionsStatus()` returning `{ display: boolean, exactAlarm: boolean }`.
  3. Expose a Settings UI banner or toggle allowing the user to view status and trigger `changeExactNotificationSetting()` or open system app settings if permanently denied.

---

### Issue 7: Calculation Bugs in Weekly & Monthly Academic Summaries
- **File**: `client/src/services/NotificationService.ts:541-557, 590-595`
- **Code Snippet**:
  ```typescript
  // Weekly:
  for (let i = 0; i < 4; i++) {
    let notifyDate = setMinutes(setHours(addDays(nextTargetDay, i * 7), summaryHour), summaryMinute);
    if (notifyDate.getTime() <= Date.now()) {
      notifyDate = setMinutes(setHours(addDays(nextTargetDay, (i+4) * 7), summaryHour), summaryMinute); 
    }
  ...
  // Monthly:
  for (let i = 0; i < 3; i++) {
    let notifyDate = setMinutes(setHours(new Date(today.getFullYear(), today.getMonth() + i, targetDate), summaryHour), summaryMinute);
    if (notifyDate.getTime() <= Date.now()) {
      notifyDate = setMinutes(setHours(new Date(today.getFullYear(), today.getMonth() + i + 3, targetDate), summaryHour), summaryMinute);
    }
  ```
- **Root Cause & Failure Scenario**:
  1. **Weekly Skip Bug**: If today is the target day (e.g., Monday) and the scheduled time has passed (e.g. 7:00 PM when time is 6:00 PM), `nextTargetDay` remains today. For `i = 0`, `notifyDate.getTime() <= Date.now()` triggers and adds `(0 + 4) * 7 = 28` days! The notifications are scheduled for: Day 7 (Week 1), Day 14 (Week 2), Day 21 (Week 3), and Day 28 (Week 0). The cadence is broken.
  2. **Monthly Date Overflow Bug**: If `targetDate` is 31, in February (28/29 days) `new Date(year, 1, 31)` overflows into March 3. In April (30 days), `new Date(year, 3, 31)` overflows into May 1. The user receives two summaries in March and May, and none in February and April.
  3. **Expiring One-Shots**: Daily (7 days), Weekly (4 weeks), and Monthly (3 months) schedules are one-shot notifications. Once the period elapses, no more summaries fire unless the user visits SettingsPage.
  4. `'Yearly'` frequency is selectable in Settings UI (`SettingsPage.tsx:1104`), but has no branch in `NotificationService.ts` and is completely ignored.
- **Proposed Fix**:
  1. Advance `nextTargetDay` by 7 days immediately if `nextTargetDay` is today and `summaryHour:summaryMinute` has passed.
  2. In monthly calculation, clamp `targetDate` to `Math.min(targetDate, getDaysInMonth(targetMonth))`.
  3. Re-schedule academic summaries on app startup alongside timetable scheduling.

---

### Issue 8: Attendance Threshold Alerts & Morning Summaries Completely Missing
- **Files**: `client/src/services/NotificationService.ts`, `client/src/pages/marketing/PrivacyPage.tsx:37`
- **Root Cause & Failure Scenario**:
  Requirement R2 and PrivacyPage specify:
  *"We use this data strictly to calculate your attendance percentages, alert you before you drop below the 75% threshold, and manage your academic schedule."*
  However, there is zero code in `NotificationService.ts` for attendance threshold alerts. If attendance in any subject drops below `targetAttendance` (e.g., 75%), or if a student has 0 safe skips remaining for an upcoming lecture, no local notification alert is ever produced.
  Similarly, there is no morning briefing notification (e.g. 7:30 AM summary: "Today's Schedule: 3 lectures starting at 9:00 AM in Room 204").
- **Proposed Fix**:
  1. Implement `scheduleAttendanceThresholdAlerts()` in `NotificationService.ts`: when attendance in any subject drops below the target percentage or has critical safe skips (= 0), schedule a high-priority warning notification.
  2. Implement an optional daily morning briefing alert (e.g. 7:30 AM or 8:00 AM) summarizing today's agenda.

---

### Issue 9: Assignment Reminders Stale on Completion/Deletion & Offline Failure
- **Files**: `client/src/services/NotificationService.ts:441-494`, `client/src/stores/assignmentStore.ts:67-82`
- **Code Snippet**:
  ```typescript
  // assignmentStore.ts
  deleteAssignment: async (id) => {
    try {
      await api.delete(`/assignments/${id}`);
      set({ assignments: get().assignments.filter(a => a.id !== id) });
      // NotificationService.scheduleAssignmentReminders() is NOT called!
  ...
  toggleCompletion: async (id) => {
    try {
      await api.post(`/assignments/${id}/toggle`);
      await get().fetchAssignments();
      // NotificationService.scheduleAssignmentReminders() is NOT called!
  ```
  ```typescript
  // NotificationService.ts
  const res = await api.get('/assignments'); // Fails if offline!
  ```
- **Root Cause & Failure Scenario**:
  1. When a user marks an assignment complete or deletes it, `scheduleAssignmentReminders()` is never called. Pending cascade reminders (at 24h, 2h, 15m before deadline) remain active and fire even though the assignment was already finished.
  2. `scheduleAssignmentReminders()` makes a raw `api.get('/assignments')` call. If offline, it throws and aborts completely without falling back to `useAssignmentStore.getState().assignments` (which is already cached in Preferences).
  3. `scheduleAssignmentReminders()` is never called on app startup in `App.tsx`.
- **Proposed Fix**:
  1. In `assignmentStore.ts`, call `NotificationService.scheduleAssignmentReminders()` inside `deleteAssignment` and `toggleCompletion`.
  2. In `NotificationService.scheduleAssignmentReminders()`, fall back to `useAssignmentStore.getState().assignments` if offline.
  3. Call `NotificationService.scheduleAssignmentReminders()` in `App.tsx` during initial startup.

---

### Issue 10: Single Notification Channel Anti-Pattern & Missing Channel in `ringer.ts`
- **Files**: `client/src/services/NotificationService.ts:24-43`, `client/src/lib/ringer.ts:20-27`
- **Code Snippet**:
  ```typescript
  // ringer.ts:
  await LocalNotifications.schedule({
    notifications: [{
      id: 8080,
      title: "Action Required: Permission Missing",
      body: "AttendX needs 'Do Not Disturb' access...",
      schedule: { at: new Date(Date.now() + 1000) }
      // Missing channelId!
    }]
  });
  ```
- **Root Cause & Failure Scenario**:
  1. On Android 8.0+ (API 26+), notifications without an explicit `channelId` fall back to the default channel (`com.capacitorjs.plugins.localnotifications.default`), which may not have high-priority heads-up display or vibration enabled.
  2. All other notifications in `NotificationService.ts` use the same channel: `class_alerts`. If a user adjusts notification settings in Android for `class_alerts` (e.g. mutes sound because of frequent weekly/monthly updates), **they lose sound and vibration for urgent upcoming class reminders and assignment deadlines**.
- **Proposed Fix**:
  Create dedicated notification channels in `NotificationService.init()`:
  - `class_alerts`: Importance High (5), sound & vibration (pre-class reminders).
  - `academic_briefings`: Importance Default (3), sound, no vibration (daily/weekly summaries).
  - `assignment_alerts`: Importance High (4), sound & vibration (deadlines).
  - `silent_mode`: Importance Low (2), ongoing pinned notification (active class DND).
  - `system_alerts`: Importance High (4) (permission reminders).
  Assign `channelId: 'system_alerts'` to `ringer.ts`.

---

### Issue 11: Settings Page UI Disconnects & Isolated Toggles
- **File**: `client/src/pages/settings/SettingsPage.tsx:1125, 1141, 1159, 1172, 1185`
- **Code Snippet**:
  ```typescript
  {reminderFrequency.type === 'Daily' && (
    <div className="space-y-3">
      <h2>Timetable Alerts</h2>
      ...
  ```
  ```typescript
  onClick={() => updateConfig({ endOfDaySummary: !notifConfig.endOfDaySummary })}
  // autoScheduleFromTimetable() NOT called!
  ```
- **Root Cause & Failure Scenario**:
  1. Line 1125 hides the entire "Timetable Alerts" card (Class Reminders offset, Show Location, Next Class Heads-up, End of Day Summary) if `reminderFrequency.type !== 'Daily'`. If a user selects "Weekly" summary or "Never", they can no longer configure their class reminder lead time or room location!
  2. Toggling `endOfDaySummary`, `showLocation`, or `notifyNextClassOnEnd` only mutates the Zustand config; it does not call `autoScheduleFromTimetable()`. The actual scheduled notifications on the phone do not update to reflect the toggle until the app restarts or an offset button is tapped.
  3. Line 1104 hides the time picker for 'Daily' summaries, locking it permanently to 18:00.
- **Proposed Fix**:
  1. Remove `{reminderFrequency.type === 'Daily' && (` condition so Timetable Alerts are always visible regardless of summary report frequency.
  2. Trigger `NotificationService.autoScheduleFromTimetable()` when any notification config toggle changes.
  3. Include `'Daily'` in the time picker condition (`['Daily', 'Weekly', 'Monthly'].includes(...)`).

---

### Issue 12: Notification Tap Action Forces Full Page Browser Reload
- **File**: `client/src/services/NotificationService.ts:73-82`
- **Code Snippet**:
  ```typescript
  if (action.actionId === 'tap' || action.actionId === 'ACADEMIC_UPDATE_OPEN') {
    const id = action.notification.id;
    if (id >= 8800 && id < 8900) {
       window.location.href = '/report';
       return;
    }
  }
  ```
- **Root Cause & Failure Scenario**:
  `window.location.href = '/report'` bypasses React Router and causes a full browser page reload. This causes a flash of blank screen, replays the splash animation, and forces re-fetching of all global state.
  Furthermore, tapping class reminders or assignment notifications has no route mapping and leaves the user on whatever page was currently active.
- **Proposed Fix**:
  Replace `window.location.href` with client-side navigation or a custom navigation event (e.g. `window.dispatchEvent(new CustomEvent('app-navigate', { detail: route }))` handled by React Router), and map class reminders to `/today` and assignments to `/assignments`.

---

### Issue 13: Timezone Shift & Device Reboot Alarm Stacking
- **File**: `client/src/services/NotificationService.ts:136-139, 252-358`
- **Root Cause & Failure Scenario**:
  1. Scheduled dates are passed as UTC timestamps (`schedule: { at: notifyTime }`). If a student crosses a timezone (e.g. traveling during vacation or Daylight Saving shift), Android `AlarmManager` fires at the absolute UTC time rather than the new local wall-clock time.
  2. In `@capacitor/local-notifications`, `LocalNotificationRestoreReceiver.kt` lines 42-49 re-schedules any notification whose `at` was in the past while the phone was off to fire 15 seconds after reboot. If duplicate holiday/birthday notifications accumulated due to Issue 4, all of them fire simultaneously on device startup.
- **Proposed Fix**:
  1. Add an app resume listener to check timezone offset and re-sync notifications if timezone changed.
  2. Implement strict deterministic IDs and clear expired notifications so no backlog can stack on reboot.

---

## 4. Architectural Summary Table of Required Changes

| Area | Component | Nature of Fix |
|---|---|---|
| **Cold Start** | `App.tsx` & `AppShell.tsx` | Re-trigger scheduling after stores hydrate and `fetchStats()` completes |
| **Race Conditions** | `TimetablePage.tsx` | Await `fetchData()` before dispatching `attendance-updated` |
| **Auto-Mute** | `NotificationService.ts` | Eliminate unsafe `setTimeout`; inspect expired mute on app resume |
| **ID Allocation** | `NotificationService.ts` | Deterministic range partitioning per domain; purge old IDs properly |
| **Logout** | `authStore.ts` | Call `cancelAll()` on logout |
| **Permissions** | `NotificationService.ts` | Check `requestPermissions()` return value; support exact alarms |
| **Summary Math** | `NotificationService.ts` | Fix weekly 28-day skip & monthly day-31 overflow; handle Yearly |
| **Threshold Alerts** | `NotificationService.ts` | Add threshold alert evaluation method |
| **Assignments** | `assignmentStore.ts` & `NotificationService.ts` | Re-schedule on complete/delete; fall back to local store when offline |
| **Channels** | `NotificationService.ts` & `ringer.ts` | Create dedicated channels for class, assignments, summaries, and system |
| **Settings UI** | `SettingsPage.tsx` | Unhide timetable alerts; trigger re-scheduling on toggle |
| **Navigation** | `NotificationService.ts` | Replace `window.location.href` with router navigation |
