# Milestone M2 Review Report: Notifications & Local Scheduling Audit

**Reviewer**: Reviewer M2 (High-Reliability Code Reviewer & Adversarial Critic)  
**Date**: 2026-09-20  
**Type**: Hard Handoff  
**Working Directory**: `c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\reviewer_m2`  
**Verdict**: **`APPROVE`**

---

## 1. Observation

Direct line-by-line inspection of the modified codebase files and verified tool outputs:

1. **Cold Start Store Hydration Race**:
   - In `client/src/services/NotificationService.ts` (lines 379–401), `waitForStoreHydration(timeoutMs: number = 2000)` was implemented. It returns immediately if `useAttendanceStore.getState()._hasHydrated` is true, or subscribes to Zustand until `state._hasHydrated` transitions to true, with an unshakeable 2-second timeout safety net to prevent hanging.
   - In `NotificationService.autoScheduleFromTimetable()` (lines 521–533), the service awaits `this.waitForStoreHydration(2000)` before inspecting `activeSemesterId`, and adds a fallback to `useCacheStore.getState().timetable?.activeSemester?.id`.
   - In `client/src/App.tsx` (lines 159–168), a reactive store subscription listens to `useAttendanceStore.subscribe((state, prevState) => { if (state._hasHydrated && !prevState._hasHydrated) NotificationService.autoScheduleFromTimetable().catch(() => {}); })` upon component mount and cleans up on unmount.

2. **Timetable Edit / Import Race Condition**:
   - In `client/src/pages/timetable/TimetablePage.tsx`:
     - `handleSaveSlot` (line 249): `await fetchData();` precedes `window.dispatchEvent(new Event("attendance-updated"));`.
     - `handleImportJsonFile` (line 282): `await fetchData();` precedes `window.dispatchEvent(new Event("attendance-updated"));`.
     - `handleMergeSlots` (line 389): `await fetchData();` precedes `window.dispatchEvent(new Event("attendance-updated"));`.
     - `handleConfirmDelete` (line 430): `await fetchData();` precedes `window.dispatchEvent(new Event("attendance-updated"));`.
     - `handleConfirmClearAll` (line 449): `await fetchData();` precedes `window.dispatchEvent(new Event("attendance-updated"));`.
   - All asynchronous network calls updating the server and synchronizing `useCacheStore.getState().setCache("timetable", ...)` complete before the event triggers `autoScheduleFromTimetable()`.

3. **Background Auto-Unmute Timer Robustness & Reconciliation**:
   - In `client/src/lib/ringer.ts`:
     - `UNMUTE_TIMESTAMP_STORAGE_KEY = 'attendx_scheduled_unmute_time'` is used to store scheduled epoch timestamps in `localStorage`.
     - `mutePhone(unmuteUntilMs)` (lines 34–58) records the target unmute timestamp, invokes native `RingerMode.setRingerMode({ mode: 'silent' })`, and falls back to scheduling permission warning notification `8080` on channel `system_alerts` if DND access is missing.
     - `unmutePhone()` (lines 61–71) clears the stored timestamp and restores ringer to `'normal'`.
     - `checkAndReconcileRinger()` (lines 73–88) verifies `Date.now() >= unmuteTime`, calls `unmutePhone()`, and cancels pinned notification `8888`.
   - In `client/src/services/NotificationService.ts`:
     - `init()` (lines 283–300) invokes `await checkAndReconcileRinger()` on startup, attaches a listener to `@capacitor/app` `appStateChange` for foreground transitions (`isActive: true`), and listens to `window.addEventListener('focus')`.
     - `triggerPinnedClassMute` (lines 440–473) persists the unmute timestamp to storage while keeping an in-memory `setTimeout` for foreground execution.
     - `MUTE_ACTION` handler (lines 336–338) safely defaults `endTime` to `addMinutes(new Date(), 30)` if the parsed end time has passed, preventing 24-hour rollover.

4. **Notification ID Non-Overlapping Band Partitioning & Clean Cancellation**:
   - In `client/src/services/NotificationService.ts`:
     - 9 discrete bands partitioned without overlap:
       - `permission`: `8080`
       - `morning`: `8800`
       - `pinned`: `8888`
       - `threshold`: `8900`
       - `assignment`: `9000..9999`
       - `holiday`: `70000..70999`
       - `birthday`: `71000..71999`
       - `summary`: `90000..90999`
       - `timetable`: `100000..899999` (via `100000 + (hash % 800000)`)
     - `isManagedNotificationId(id)` (lines 79–89) matches `id >= 100000`, `70000..71999`, `8800`, and `8900`.
     - `autoScheduleFromTimetable()` (lines 550–555) filters pending notifications by `isManagedNotificationId(Number(n.id))` and cancels them before rescheduling. Active DND (`8888`), permission warnings (`8080`), and assignment alarms (`9000..9999`) are strictly preserved.
     - Deterministic hashing for holidays, birthdays, and slots eliminates duplicate stacking across reschedules.

5. **Complete Notification Cancellation on Logout**:
   - In `client/src/stores/authStore.ts` (lines 85–87), `logout()` dynamically imports `NotificationService` and awaits `NotificationService.cancelAll()`.
   - `NotificationService.cancelAll()` (lines 939–952) inspects `LocalNotifications.getPending()` and cancels all pending notifications, preventing cross-user privacy leaks.

6. **Android 13+ Channel Registration and Exact Alarm Handling**:
   - In `client/src/services/NotificationService.ts`:
     - `init()` checks `LocalNotifications.checkPermissions()`, requests permissions if needed, logs descriptive warnings if display permission is ungranted, and checks `checkExactNotificationSetting()`.
     - Creates 5 dedicated channels: `class_alerts` (Importance 5, heads-up), `silent_mode` (Importance 3, pinned), `academic_briefings` (Importance 3), `assignment_alerts` (Importance 4), and `system_alerts` (Importance 4).
     - Public static `NotificationService.checkPermissionStatus()` (lines 358–377) inspects both `display` and `exactAlarm` permissions safely.

7. **Weekly & Monthly Summary Calculation Boundary Handling**:
   - `clampDateToMonth(year, monthIndex, targetDay)` (lines 16–20) clamps target days to `new Date(year, monthIndex + 1, 0).getDate()`, correctly handling February (28/29) and 30-day months without month overflow.
   - `calculateNextSummaryDates(frequency, summaryTimeStr, now)` (lines 95–171):
     - For `Weekly`: Advances `firstTargetDay` by 7 days if the scheduled time has passed today. Produces 4 successive occurrences spaced strictly by 7 days (604,800,000 ms), completely eliminating the 28-day skip bug.
     - For `Monthly`: Clamps each of the next 3 target months without month overflow.
     - For `Yearly`: Computes correct annual recap date.

8. **Settings Page Notification Toggles**:
   - In `client/src/pages/settings/SettingsPage.tsx` (lines 1104, 1125–1202):
     - Timetable Alerts section is permanently visible (removed `{reminderFrequency.type === 'Daily' && (`).
     - Summary Time input includes `'Daily'` in `['Daily', 'Weekly', 'Monthly', 'Yearly']`.
     - Toggles (`classReminderOffset`, `showLocation`, `notifyNextClassOnEnd`, `endOfDaySummary`) call `NotificationService.autoScheduleFromTimetable()`.

9. **Assignment Reminders Synchronization & Offline Fallback**:
   - In `client/src/stores/assignmentStore.ts` (lines 79, 88, 112, 121, 130), `NotificationService.scheduleAssignmentReminders()` is invoked across `addAssignment`, `deleteAssignment`, and `toggleCompletion`.
   - In `NotificationService.scheduleAssignmentReminders()` (lines 809–817), an offline fallback reads from `useAssignmentStore.getState().assignments`.

10. **Build and Test Verification Results**:
    - `npx tsx client/src/tests/notification_service.test.ts`: **Exit Code 0** (All 8 test suites passed).
    - `npm --prefix client run build`: **Exit Code 0** (`tsc -b && vite build` passed cleanly in 1.62s).
    - `npm --prefix server run build`: **Exit Code 0** (`tsup` passed cleanly in 76ms).
    - `npx tsx client/src/tests/offline_sync_verification.test.ts`: **Exit Code 0** (All 5 M1 regression tests passed).

---

## 2. Logic Chain

1. **Cold Start Store Hydration**:
   The application on cold launch mounts `App.tsx` and triggers `initServices()`. Simultaneously, `useAttendanceStore` begins asynchronous hydration from `@capacitor/preferences`.
   By awaiting `waitForStoreHydration(2000)`, `NotificationService.autoScheduleFromTimetable()` pauses until `_hasHydrated` is asserted true (typically ~50ms). Even if hydration completes before the wait or after, the reactive subscription in `App.tsx` guarantees a reschedule event fires. The fallback to `useCacheStore` ensures that even in degraded state, notifications schedule reliably.

2. **Cache Coherency on Timetable Modifications**:
   Because `fetchData()` performs the network requests and writes fresh slot data into `useCacheStore`, awaiting `fetchData()` in `TimetablePage.tsx` before dispatching `attendance-updated` creates a strict happens-before guarantee. When `autoScheduleFromTimetable()` runs, it reads the updated slot cache, preventing stale reminders from persisting.

3. **Background Auto-Unmute Recovery**:
   When the Android OS suspends or terminates the WebView process while the device is silenced during class, JavaScript `setTimeout` execution ceases. However, persisting `endTime.getTime()` in `localStorage` (`attendx_scheduled_unmute_time`) survives WebView destruction.
   Upon device wake, unlock, or app relaunch, Capacitor's `appStateChange` (`isActive: true`) and window `'focus'` invoke `checkAndReconcileRinger()`. Because `Date.now() >= unmuteTime`, the phone is restored to normal volume and pinned notification `8888` is cancelled.

4. **Zero Collisions via Mathematical Partitioning**:
   The 9 numerical ID intervals are disjoint sets:
   - $[8080, 8080]$
   - $[8800, 8800]$
   - $[8888, 8888]$
   - $[8900, 8900]$
   - $[9000, 9999]$
   - $[70000, 70999]$
   - $[71000, 71999]$
   - $[90000, 90999]$
   - $[100000, 899999]$
   Pairwise intersection between any two bands is empty ($\emptyset$). Furthermore, `isManagedNotificationId` cleanly isolates managed bands from user session alarms, preventing inadvertent cancellation.

5. **Integrity Audit**:
   Inspected for integrity violations:
   - Hardcoded outputs or mock bypasses: **None**. All functions use genuine mathematical algorithms and native API bindings.
   - Facade or dummy implementations: **None**. Genuine state management and storage persistence are used.
   - Shortcuts bypassing requirements: **None**.
   - Test results: **Independently executed and verified live via shell commands**.

---

## 3. Caveats

1. **OEM Battery Optimization**: On aggressive Android flavors (MIUI/HyperOS, ColorOS, OneUI), deep sleep battery restrictions may delay local notifications by a few minutes unless the user whitelists AttendX from battery optimization.
2. **Native Java DND Permission**: `RingerMode.setRingerMode` requires the user to grant Do Not Disturb access (`ACCESS_NOTIFICATION_POLICY`). If ungranted by the user, AttendX generates system notification `8080` guiding the user to phone settings.
3. **No Implementation Caveats**: All Milestone M2 requirements have been fully satisfied with zero regressions.

---

## 4. Conclusion

Worker M2 has delivered an exceptionally high-quality, robust, and mathematically sound implementation for Milestone M2 (Notifications & Local Scheduling Audit). All 8 defects and edge cases have been resolved cleanly. TypeScript compilation succeeds across `client` and `server` without errors, and the entire test suite passes with 100% success.

**Final Verdict**: **`APPROVE`**

---

## 5. Verification Method

To independently reproduce and verify this review:

1. **Run Unit and Scheduling Audit Test Suite**:
   ```powershell
   npx tsx client/src/tests/notification_service.test.ts
   ```
   *Expected*: Exit code 0, 8 test suites passing.

2. **Run M1 Offline Sync Regression Suite**:
   ```powershell
   npx tsx client/src/tests/offline_sync_verification.test.ts
   ```
   *Expected*: Exit code 0, 5 test suites passing.

3. **Verify Client Production Compilation**:
   ```powershell
   npm --prefix client run build
   ```
   *Expected*: Exit code 0, zero TypeScript errors.

4. **Verify Server Production Compilation**:
   ```powershell
   npm --prefix server run build
   ```
   *Expected*: Exit code 0, clean `tsup` bundle.
