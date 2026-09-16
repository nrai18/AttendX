## 2026-09-20T00:08:00Z
You are Worker M2 (Implementation Specialist for Notifications & Local Scheduling Audit).

Working directory: c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\worker_m2
Workspace directory: c:\Users\Raina\OneDrive\Desktop\AttendX
Original Request: c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\ORIGINAL_REQUEST.md
Rules: c:\Users\Raina\OneDrive\Desktop\AttendX\AGENTS.md
Scope document: c:\Users\Raina\OneDrive\Desktop\AttendX\PROJECT.md
Explorer handoff: c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\explorer_survey_2\handoff.md
Explorer analysis: c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\explorer_survey_2\analysis.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your mission:
Implement surgical, robust fixes for Requirement R2 (Part A: Notifications & Local Scheduling Audit) based on the Explorer Survey 2 blueprint:

1. Cold Start Store Hydration Race (`client/src/App.tsx` and `client/src/services/NotificationService.ts`):
   - In `NotificationService.autoScheduleFromTimetable()`, ensure it waits for `useAttendanceStore` hydration (or polls briefly / checks `_hasHydrated` before bailing).
   - In `App.tsx`, schedule notifications after hydration completes or trigger reschedule on hydration event.

2. Timetable Edit / Import Race Condition (`client/src/pages/timetable/TimetablePage.tsx` lines ~248–250, 282–283):
   - Ensure `await fetchData()` completes before dispatching `"attendance-updated"`, so `NotificationService` does not read stale cached slots from `useCacheStore`.

3. Background Auto-Unmute Timer Robustness (`client/src/services/NotificationService.ts` & `client/src/services/ringer.ts`):
   - In `ringer.ts` / `NotificationService.ts`, store the scheduled unmute timestamp in storage/memory.
   - When the app is resumed from background or when checking ringer status, check if the unmute time has passed, and execute `unmutePhone()` if still muted.

4. Notification ID Partitioning & Accumulation Bug (`client/src/services/NotificationService.ts`):
   - Replace random ID generation with distinct non-overlapping ID bands:
     - Timetable classes: `100000 + hash(slotId)`
     - Summary alerts: `90000..90999`
     - Morning class summary: `8800`
     - Low attendance threshold: `8900`
     - Pinned DND notice: `8888`
     - Holiday alerts: `70000..70999`
     - Birthday alerts: `71000..71999`
   - In `autoScheduleFromTimetable()`, cancel all managed notification bands (timetable, summaries, holidays, birthdays) instead of only `id >= 100000`.

5. Missing Notification Cleanup on Logout (`client/src/stores/authStore.ts`):
   - In `logout()`, call `NotificationService.cancelAll()` or cancel all pending local notifications to prevent previous user's academic schedule from alarming on device.

6. Android 13+ & Exact Alarm Handling (`client/src/services/NotificationService.ts` lines ~18–21):
   - Properly inspect the result of `LocalNotifications.requestPermissions()`.
   - Check exact notification permissions (`LocalNotifications.checkExactNotificationSetting()`) if available, logging or falling back safely.

7. Weekly & Monthly Summary Calculation Boundary Bugs (`client/src/services/NotificationService.ts` lines ~554–594):
   - Fix Week 0 skipping 28 days ahead (`(i+4)*7` bug).
   - Fix 31st overflow bug: clamp date to the last day of the target month (e.g. Feb 28/29, Apr 30).

8. Settings Page Notification Toggles (`client/src/pages/settings/SettingsPage.tsx`):
   - Ensure timetable notification toggles remain visible and functional regardless of summary frequency selection, and trigger rescheduling when toggled.

9. Genuine Verification Test Suite:
   - Export pure helper functions for schedule calculation (e.g. `calculateNextSummaryDate`, `getNotificationIdForSlot`, `clampDateToMonth`) from `NotificationService.ts`.
   - Create `client/src/tests/notification_service.test.ts` directly importing `NotificationService` and the exported calculation helpers.
   - Test ID collision freedom, month boundary clamping, weekly cadence, and permission handling with genuine assertions.

Operational Rules:
- Adhere strictly to AGENTS.md: NO `git commit`, NO `git push`, NO `git restore` or `git checkout`.
- Use surgical edits via `replace_file_content`.
- Run `npm run build` in `client` and `server` to ensure clean compilation.
- Run tests to verify exit code 0.
- Document changes and verification commands in `handoff.md`.
- Send message to orchestrator upon completion.
