# Project: AttendX Code Review, Offline-Sync, Notifications & Backup Audit

## Architecture
- **Client**: React 18, TypeScript, TailwindCSS, Zustand stores, Capacitor 6 (Android native runtime), Axios HTTP client.
- **Server**: Node.js, Express, TypeScript, Prisma ORM 7.9, PostgreSQL.
- **Data Flow**:
  - Offline mutations are intercepted in `client/src/lib/api.ts` and queued in `offlineStore.ts` via Capacitor Preferences.
  - When online, `offlineStore.ts` flushes requests to Express backend and updates Zustand caches.
  - Notifications are scheduled via `@capacitor/local-notifications` in `NotificationService.ts`.
  - Backups and data exports are handled via `client/src/lib/download.ts`, `data.service.ts`, and `timetable.service.ts`.

## Feature Inventory
| # | Feature / Defect | Description | Milestone | Source |
|---|---|---|---|---|
| 1 | Axios Interceptor Payload Loss | `JSON.parse` crashes on objects in `api.ts`, enqueueing `undefined` data | M1 | Survey Explorer 1 |
| 2 | Out-of-Order Queue & 500 Lock | Network retry loop doesn't break; 500 errors never dequeue | M1 | Survey Explorer 1 |
| 3 | Attendance Stats Permanent Freeze | `isDirty` flag permanently locks stats updates if queue is stuck | M1 | Survey Explorer 1 |
| 4 | Cross-User Queue Leak on Logout | `logout()` does not clear offline queue, leaking mutations to next user | M1 | Survey Explorer 1 |
| 5 | SubjectDetailPage Optimistic Clobber | `handleMarkAttendance` doesn't update cache, causing instant revert | M1 | Survey Explorer 1 |
| 6 | CalendarPage Day Cells Overwrite | Offline guard preserves details but lets stale GET overwrite days | M1 | Survey Explorer 1 |
| 7 | Backend Temp ID Deletion Failure | `deleteMany` with `temp-...` ID fails to delete record | M1 | Survey Explorer 1 |
| 8 | Assignment Store Offline Corruption | Bare temporary items stripped of title/due date; toggle fails | M1 | Survey Explorer 1 |
| 9 | Timetable Peer Sync Cache Invalidation | Peer sync does not invalidate cache or fire update events | M1 | Survey Explorer 1 |
| 10 | Cold Start Notification Hydration Race | App startup runs before async storage hydration, skipping timetable alerts | M2 | Survey Explorer 2 |
| 11 | Timetable Edit/Import Race Condition | Event dispatched before `fetchData` completes, scheduling stale slots | M2 | Survey Explorer 2 |
| 12 | Background Auto-Unmute Timer Failure | `setTimeout` dies when WebView is backgrounded, leaving phone muted | M2 | Survey Explorer 2 |
| 13 | Notification ID Collisions & Leakage | Random IDs collide with static IDs; reschedule leaks holiday/birthday alarms | M2 | Survey Explorer 2 |
| 14 | Missing Notification Cancel on Logout | User alarms remain active on device after account logout | M2 | Survey Explorer 2 |
| 15 | Android 13+ & Exact Alarm Handling | Missing permissions check and exact alarm settings handling | M2 | Survey Explorer 2 |
| 16 | Weekly/Monthly Summary Boundary Bugs | Week 0 offset skips 28 days; 31st overflow corrupts monthly calendar | M2 | Survey Explorer 2 |
| 17 | Settings Notification Toggles & Visibility | Hiding timetable alerts and toggles failing to trigger reschedule | M2 | Survey Explorer 2 |
| 18 | Document Download BOLA / IDOR | `downloadDocument` lacks user ownership check | M3 | Survey Explorer 3 |
| 19 | Timetable Import Missing Transaction | Deactivation without transaction causes permanent corruption on error | M3 | Survey Explorer 3 |
| 20 | Timetable Deduplication Data Loss | Deduplication key drops valid multi-slot classes on same day | M3 | Survey Explorer 3 |
| 21 | Multi-Store Desync Post-Import | `SettingsPage` doesn't invalidate API caches, causing stale views | M3 | Survey Explorer 3 |
| 22 | Foreign Key Violation on Semester Wipe | `Subject` deletion fails on `TimetableOverride.subjectId` FK constraint | M3 | Survey Explorer 3 |
| 23 | Status Type Loss in CSV Export/Import | `medical`, `od`, `cancelled` collapsed to "present" | M3 | Survey Explorer 3 |
| 24 | Download Helper Unawaited Promise & Leak | `FileReader` promise not awaited; `URL.createObjectURL` leaked | M3 | Survey Explorer 3 |
| 25 | File Input Reset & Android SAF MIME Filter | Inability to re-select same file and `.json` filter grayed out on Android | M3 | Survey Explorer 3 |
| 26 | Master Audit Report Compilation | Comprehensive Markdown report `audit_report.md` documenting all bugs & fixes | M4 | Master Request R3 |
| 27 | Build & Capacitor Verification | Verify `client` and `server` compile cleanly with no regressions | M4 | Master Request R3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M1 | Offline-Sync & Store Race Conditions | Fixes for items 1–9 (api.ts, offlineStore.ts, attendanceStore.ts, authStore.ts, SubjectDetailPage.tsx, CalendarPage.tsx, attendance.service.ts, assignmentStore.ts, PeerSyncModal.tsx) | none | DONE |
| M2 | Notifications & Local Scheduling Audit | Fixes for items 10–17 (NotificationService.ts, App.tsx, TimetablePage.tsx, ringer.ts, authStore.ts, SettingsPage.tsx) | M1 | DONE |
| M3 | Backup Import/Export & Data Integrity | Fixes for items 18–25 (document.controller.ts, timetable.service.ts, data.service.ts, SettingsPage.tsx, download.ts) | M1, M2 | DONE |
| M4 | Master Audit Report & Build Verification | Generate `audit_report.md` with root cause analyses, code snippets, checklist of modified files; compile & test verification | M1, M2, M3 | DONE |

## Interface Contracts
### Offline Queue ↔ API Client
- `enqueue({ method, url, data, headers })`: `data` MUST preserve actual payload object or string (never `undefined`).
- `flushQueue()`: Must break on transient network errors, discard or limit retries on 500 errors, and keep FIFO order.
- `attendanceStore.fetchStats()`: `isDirty` must only block stats if active pending marks for the active semester exist and queue has not permanently failed.
- `authStore.logout()`: MUST purge `attendx-offline-queue` from Capacitor Preferences and localStorage.

### Timetable / App ↔ NotificationService
- `NotificationService.autoScheduleFromTimetable()`: MUST wait for store hydration or accept explicit activeSemesterId and slots.
- `NotificationService.cancelAll()`: MUST be called on `authStore.logout()`.
- Notification ID ranges:
  - Timetable class reminders: `100000 + hash(slotId)`
  - Morning class summary: `8800`
  - Attendance low threshold: `8900`
  - Periodic summary (Daily/Weekly/Monthly): `9000..9099`
  - Auto-mute DND pinned notice: `8888`
  - Holidays: `70000..70999`
  - Birthdays: `71000..71999`

### Document & Data Service ↔ Backup / Export
- `downloadDocument`: MUST verify `doc.userId === req.user.userId`.
- `importTimetable`: MUST execute inside `prisma.$transaction`.
- Deduplication key: `${dateStr}_${subjectId}_${slotId || 'extra'}_${startTime || ''}`.

## Code Layout
- `client/src/lib/api.ts` — Axios instance, request/response interceptors, offline interceptor
- `client/src/lib/download.ts` — Capacitor filesystem / browser download helper
- `client/src/stores/offlineStore.ts` — Offline mutation queue and background sync
- `client/src/stores/attendanceStore.ts` — Attendance tracking and statistics state
- `client/src/stores/authStore.ts` — Authentication state, tokens, logout logic
- `client/src/stores/assignmentStore.ts` — Assignments state and optimistic updates
- `client/src/services/NotificationService.ts` — Local notifications scheduling and lifecycle
- `client/src/services/ringer.ts` — DND auto-mute / unmute helper
- `client/src/pages/attendance/CalendarPage.tsx` — Monthly attendance calendar
- `client/src/pages/subjects/SubjectDetailPage.tsx` — Subject attendance logs
- `client/src/pages/timetable/TimetablePage.tsx` — Timetable management
- `client/src/pages/settings/SettingsPage.tsx` — Settings, notifications toggles, backup import/export
- `client/src/components/sync/PeerSyncModal.tsx` — P2P timetable sync
- `server/src/controllers/document.controller.ts` — Document download / access control
- `server/src/services/attendance.service.ts` — Attendance marks and deletions
- `server/src/services/timetable.service.ts` — Timetable import/export and transactions
- `server/src/services/data.service.ts` — Full data backup and restore
