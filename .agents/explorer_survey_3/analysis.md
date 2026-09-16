# AttendX Data Export, Import & Backup Audit Report (Requirement R2 - Part B)

**Survey Explorer**: Explorer Survey 3 (Data Export, Import & Backup Audit)  
**Date**: 2026-09-19  
**Scope**: Client (`client/src/`) and Server (`server/src/`), Database Schema (`server/prisma/schema.prisma`), ML Server (`ml-server/`)  
**Investigation Mode**: Read-Only Architecture & Code Integrity Audit

---

## Executive Summary

A comprehensive, end-to-end investigation of the AttendX backup, export, import, and data integrity systems was conducted. The audit uncovered **15 critical flaws** spanning:
1. **Critical Security Vulnerabilities**: Broken Object-Level Authorization (IDOR / BOLA) permitting arbitrary document and backup theft, and predictable PRNG in Peer Sync codes.
2. **Data Loss & Corruption Risks**: Unchecked absence of database transactions in timetable restoration, foreign key constraint crashes during semester wipes, and faulty deduplication logic that silently drops multi-slot lectures on the same day.
3. **Multi-Store State Desynchronization**: Persistent client stores (`useCacheStore` and `useAttendanceStore` in `@capacitor/preferences`) remaining stale post-import, leading to UI ghost data and incorrect notification scheduling.
4. **Platform & Mobile Failures**: Unawaited asynchronous share promises in Capacitor Filesystem, lack of proper MIME types for Android Storage Access Framework (SAF) pickers, and missing file input resets.
5. **Architectural Disconnects**: Settings ZIP import routing to an unreachable local Python ML server (`http://localhost:8000`) that fabricates class timings, while the Express server's native ZIP import endpoint remains orphaned.

---

## Detailed Vulnerability & Issue Analysis

### 1. Broken Object-Level Authorization (IDOR / BOLA) on Document Download
- **Severity**: **Critical (CVSS 8.6)**
- **File & Lines**: `server/src/controllers/document.controller.ts:28-60`, `server/src/routes/document.routes.ts:7`
- **Flawed Code**:
  ```typescript
  static async downloadDocument(req: Request, res: Response) {
    try {
      const id = (req.params.id as string) as string;
      const doc = await prisma.storedDocument.findUnique({ where: { id } });
      
      if (!doc) {
        return res.status(404).json({ message: 'Document not found' });
      }

      if (doc.fileData) {
        res.setHeader('Content-Disposition', `attachment; filename="${doc.name}"`);
        res.setHeader('Content-Type', doc.mimeType);
        return res.send(doc.fileData);
      }
  ```
- **Root Cause**:
  Although the route is protected by `authenticate` middleware, `downloadDocument` takes `req.params.id` and queries `StoredDocument` without validating that `doc.userId === req.user!.userId`. 
- **Failure Scenario**:
  Any authenticated student can supply any valid UUID for a document and download another student's full attendance backup ZIP, subject stats CSV, timetable documents, or uploaded academic documents. `deleteDocument` in the same controller correctly verifies ownership at line 70 (`if (!doc || doc.userId !== req.user.userId)`), proving this was an oversight in `downloadDocument`.
- **Proposed Surgical Fix**:
  Cast `req` to `AuthenticatedRequest` and enforce tenant ownership:
  ```typescript
  const authReq = req as AuthenticatedRequest;
  if (!doc || doc.userId !== authReq.user?.userId) {
    return res.status(404).json({ message: 'Document not found' });
  }
  ```

---

### 2. Missing Database Transaction & Rollback in Timetable Import
- **Severity**: **High (Data Loss / Irrecoverable Corruption)**
- **File & Lines**: `server/src/services/timetable.service.ts:725-847`
- **Flawed Code**:
  ```typescript
  static async importTimetable(userId: string, semesterId: string, payload: any) {
    if (!payload || !Array.isArray(payload.subjects) || !Array.isArray(payload.slots)) {
      throw new Error("Invalid timetable payload. Must contain 'subjects' and 'slots' arrays.");
    }

    await this.safeDeleteTimetable(userId, semesterId);

    // ── 1. Subjects (sequential queries) ────────────────────────
    for (const subData of payload.subjects) { ... }

    // ── 2. Timetable Slots (batch query) ─────────────────────────
    if (slotRows.length > 0) {
      await prisma.timetableSlot.createMany({ data: slotRows, skipDuplicates: true });
    }

    // ── 3. Academic Calendar Events (batch query) ────────────────
    ...
    // ── 4. Attendance Logs (batch query) ─────────────────────────
    ...
  ```
- **Root Cause**:
  `importTimetable` performs destructive modifications outside of a Prisma transaction (`prisma.$transaction`). At line 730, `safeDeleteTimetable` deactivates all active slots (`validUntil = new Date()`).
- **Failure Scenario**:
  If a network blip occurs, or if payload contains an invalid date, unmapped slot type, or constraint error during subject, slot, event, or log creation, execution throws an uncaught error. The user's active timetable has already been archived, subjects are half-created, but slots/logs are missing. The user is left with an unusable semester and no automated rollback.
- **Proposed Surgical Fix**:
  Wrap all steps in `prisma.$transaction(async (tx) => { ... })`, pass `tx` to `safeDeleteTimetable`, and ensure all mutations use `tx`.

---

### 3. Silent Attendance Data Loss from Incomplete Deduplication Key
- **Severity**: **High (Silent Data Loss)**
- **File & Lines**: `server/src/services/timetable.service.ts:808-834`
- **Flawed Code**:
  ```typescript
  const existingLogs = await prisma.attendance.findMany({
    where: { userId, subject: { semesterId } },
    select: { date: true, subjectId: true }
  });
  const existingSet = new Set(existingLogs.map((l: any) => `${l.date.toISOString().split('T')[0]}_${l.subjectId}`));

  const logRows = payload.lectureLogs
    .map((log: any) => {
      ...
      const dateStr = new Date(log.date).toISOString().split('T')[0];
      const key = `${dateStr}_${subjectId}`;
      if (existingSet.has(key)) return null;
      existingSet.add(key);

      return { userId, subjectId, date: new Date(log.date), status: mappedStatus };
    })
    .filter(Boolean);
  ```
- **Root Cause**:
  Deduplication uniquely identifies logs solely by `${dateStr}_${subjectId}`. 
- **Failure Scenario**:
  In college academic schedules, subjects frequently have multiple classes in a single day (e.g. 2 lecture hours, or a morning lecture plus afternoon practical lab, or an extra lecture). The database schema constraint (`@@unique([userId, subjectId, date, timetableSlotId])`) supports multiple classes per date across different slots. However, this deduplication key drops all classes after the first one for any given date and subject. Users lose valid attended/missed records, corrupting overall percentage.
- **Proposed Surgical Fix**:
  Include slot or occurrence index in deduplication:
  `const key = `${dateStr}_${subjectId}_${log.timetableSlotId || log.slot || log.lectureNo || idx}`;`
  Alternatively, align with database index by deduplicating against `timetableSlotId`.

---

### 4. Foreign Key Violation Crash in DataService.importData
- **Severity**: **High (System Crash / Import Blocking)**
- **File & Lines**: `server/src/services/data.service.ts:138-142` & `server/prisma/schema.prisma:273`
- **Flawed Code**:
  ```typescript
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. Wipe current semester data
    await tx.subject.deleteMany({ where: { semesterId: activeSem.id } });
    // The deletion cascades to TimetableSlot and Attendance logs automatically
  ```
- **Root Cause**:
  In `server/prisma/schema.prisma` line 273:
  `model TimetableOverride { ... subject Subject? @relation(fields: [subjectId], references: [id]) }`
  The relation lacks `onDelete: Cascade`.
- **Failure Scenario**:
  If a student has any extra classes or overrides in `TimetableOverride` referencing their subjects, executing `tx.subject.deleteMany` triggers an immediate PostgreSQL foreign key constraint violation. The transaction aborts with a 500 error. The user is completely unable to import full ZIP backups.
- **Proposed Surgical Fix**:
  In `DataService.importData`, delete `timetableOverride` records before deleting `subject`:
  ```typescript
  await tx.timetableOverride.deleteMany({ where: { semesterId: activeSem.id } });
  await tx.subject.deleteMany({ where: { semesterId: activeSem.id } });
  ```

---

### 5. Multi-Store State Desynchronization Post-Import
- **Severity**: **High (UI Inconsistency / Erroneous Reminders)**
- **File & Lines**: `client/src/pages/settings/SettingsPage.tsx:410-418`
- **Flawed Code**:
  ```typescript
  action: {
    label: "Import",
    onClick: async () => {
      try {
        await api.post(`/timetable/import/${activeSem.id}`, payload);
        toast.success("Backup imported successfully!");
      } catch (err) { ... }
    }
  }
  ```
- **Root Cause**:
  `SettingsPage` does not clear `useCacheStore` (`attendx-api-cache`), does not call `useAttendanceStore.getState().fetchStats()`, and does not emit `"attendance-updated"`.
- **Failure Scenario**:
  Upon import, the database contains new subjects and slots, but the client continues to read cached subjects, percentages, logs, and calendar events from `@capacitor/preferences`. When navigating to Dashboard or Today view, the student sees pre-import data. Furthermore, `NotificationService` continues reading `useCacheStore.getState().timetable?.slots`, firing class alarms for deleted timetable slots.
- **Proposed Surgical Fix**:
  Execute post-import store synchronization:
  ```typescript
  useCacheStore.getState().clearCache();
  await useAttendanceStore.getState().fetchStats();
  window.dispatchEvent(new CustomEvent("attendance-updated"));
  ```

---

### 6. ZIP Import Feature Diverted to Localhost Python ML Server
- **Severity**: **Medium-High (Broken Functionality in Production)**
- **File & Lines**: `client/src/pages/settings/SettingsPage.tsx:467-476`, `ml-server/tasks.py:139-142`
- **Flawed Code**:
  ```typescript
  // SettingsPage.tsx
  const mlApiUrl = import.meta.env.VITE_ML_API_URL || "http://localhost:8000";
  const res = await fetch(`${mlApiUrl}/upload/zip?user_id=${user.id}`, {
    method: "POST",
    body: formData,
  });
  ```
  ```python
  # ml-server/tasks.py
  start_hour = 9 + day_slot_counts[day_idx]
  start_str = f"{start_hour:02d}:00"
  end_str = f"{start_hour:02d}:50"
  ```
- **Root Cause**:
  The UI's "Import data from ZIP" button targets an external Python server on `localhost:8000`. The Python Celery task ignores the `Timing` column in `timetable.csv` and generates fake sequential times (09:00, 10:00...). Meanwhile, Express has a fully built `POST /api/data/import` endpoint (`DataController.importData`) with true time parsing and Prisma transactions that is completely orphaned.
- **Failure Scenario**:
  On mobile APK and production web deployments, `http://localhost:8000` is unreachable, resulting in failed uploads. If run locally, user class timings are destroyed and replaced with fake 09:00–09:50 slots.
- **Proposed Surgical Fix**:
  Update `SettingsPage.tsx` `handleImportCSV` to call the Express backend:
  `await api.post("/data/import", formData, { headers: { "Content-Type": "multipart/form-data" } });`

---

### 7. Loss of Attendance Status Granularity (`medical`, `od`, `cancelled`) in CSV Export/Import
- **Severity**: **Medium-High (Data Degradation)**
- **File & Lines**: `server/src/services/data.service.ts:23-28, 92-95, 215-218`
- **Flawed Code**:
  ```typescript
  // Export:
  let attStatus = "Attended";
  if (log.status === "absent") attStatus = "Missed";
  if (log.status === "off") attStatus = "Off";
  // Import:
  const attStr = row["Attendance"];
  let status: any = "present";
  if (attStr === "Missed") status = "absent";
  if (attStr === "Off") status = "off";
  ```
- **Root Cause**:
  `AttendanceStatus` enum supports `present`, `absent`, `off`, `cancelled`, `medical`, and `od`. The CSV generator collapses `medical`, `od`, and `cancelled` into `"Attended"`. The importer converts `"Attended"` into `"present"`.
- **Failure Scenario**:
  After exporting and importing a backup, all excused medical leaves, approved official duty (OD) exemptions, and cancelled classes are converted into standard present attendances.
- **Proposed Surgical Fix**:
  Preserve exact enum values in CSV export (`attStatus = log.status`) and map them during import:
  `if (["present", "absent", "off", "cancelled", "medical", "od"].includes(statusStr)) status = statusStr;`

---

### 8. Misleading / Incomplete JSON Export
- **Severity**: **Medium (User Data Loss on False Assumption)**
- **File & Lines**: `client/src/pages/settings/SettingsPage.tsx:360-387`, `server/src/services/timetable.service.ts:678-723`
- **Flawed Code**:
  `TimetableService.exportTimetable` only returns `{ version, app, semester, subjects, slots }`.
- **Root Cause**:
  The UI states: "Export backup file: Generates a backup file that can be imported back... contains your timetable, subjects, and attendance settings." The filename is `attendance_backup_<date>.json`. But zero attendance logs, overrides, or events are exported. If no active semester exists, `SettingsPage` exports `{ subjects }` without `slots`, causing `importTimetable` to reject the file on restore.
- **Failure Scenario**:
  Students trust this button as an "attendance backup", reset their app, and restore the JSON only to find 100% of their attendance records gone.
- **Proposed Surgical Fix**:
  Include `academicCalendar`, `timetableOverrides`, and `lectureLogs` in the exported JSON payload, or clearly label the action as "Export Timetable Schedule (Slots Only)". Ensure fallback payload includes empty arrays for `subjects: []` and `slots: []`.

---

### 9. Asynchronous Unawaited Share in Mobile Native Download Helper
- **Severity**: **Medium (Platform-Specific Failure)**
- **File & Lines**: `client/src/lib/download.ts:6-48`
- **Flawed Code**:
  ```typescript
  export const downloadBlob = async (blob: Blob, filename: string) => {
    if (Capacitor.isNativePlatform()) {
      try {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          ...
          await Share.share(...);
        };
      } catch (e) { ... }
    } else {
      const url = window.URL.createObjectURL(blob);
      ...
    }
  };
  ```
- **Root Cause**:
  `downloadBlob` does not return a Promise wrapping `reader.onloadend`. The function returns immediately. User share dismissal causes an error toast. In browser mode, `URL.createObjectURL` is never revoked.
- **Failure Scenario**:
  On Android, caller indicators (e.g. `RunActionButton` step "Downloading -> Saved") resolve while the file is still reading. If a user cancels the Android share sheet, an error toast appears: "Failed to share file."
- **Proposed Surgical Fix**:
  Wrap `FileReader` in `new Promise<void>((resolve, reject) => ...)`, handle `reader.onerror`, catch and ignore user cancellation in `Share.share`, and call `setTimeout(() => URL.revokeObjectURL(url), 1000)` in web mode.

---

### 10. Missing Reset of File Input Element Breaks Re-Import
- **Severity**: **Medium (UX Bug)**
- **File & Lines**: `client/src/pages/settings/SettingsPage.tsx:390-428`
- **Flawed Code**:
  `handleImportBackup` never sets `e.target.value = ""`.
- **Root Cause & Failure Scenario**:
  If a student selects a file, cancels or encounters a validation error, modifies the file, and selects the same file again, the browser's `change` event fails to fire because `input.value` is unchanged.
- **Proposed Surgical Fix**:
  Add `if (e.target) e.target.value = "";` in `handleImportBackup`.

---

### 11. Android Capacitor WebView SAF File Filtering Failure
- **Severity**: **Medium (Mobile Accessibility Bug)**
- **File & Lines**: `client/src/pages/settings/SettingsPage.tsx:621`, `client/src/pages/timetable/TimetablePage.tsx:835`
- **Flawed Code**:
  `<input type="file" accept=".json" ... />`
- **Root Cause & Failure Scenario**:
  On Android Capacitor WebViews, the Storage Access Framework (SAF) document picker relies on MIME types. Passing extension `.json` without `application/json` causes JSON files to be disabled or grayed out on several Android OEM ROMs.
- **Proposed Surgical Fix**:
  Use `accept=".json,application/json,text/json"` and `accept=".zip,application/zip,application/x-zip-compressed,multipart/x-zip,application/octet-stream"`.

---

### 12. Predictable Random Codes & Non-Atomic Peer Sync Retrieval
- **Severity**: **Medium (Security & Concurrency Bug)**
- **File & Lines**: `server/src/controllers/transfer.controller.ts:32, 73-91`
- **Flawed Code**:
  ```typescript
  const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();
  ...
  const transfer = await prisma.shareTransfer.findUnique({ where: { code } });
  ...
  await prisma.shareTransfer.delete({ where: { code } });
  ```
- **Root Cause & Failure Scenario**:
  `Math.random()` is not cryptographically secure. Furthermore, `findUnique` followed by `delete` without a transaction allows race conditions where two concurrent requests retrieve the same transfer code before deletion.
- **Proposed Surgical Fix**:
  Use `crypto.randomInt(100000, 1000000).toString()` and wrap code consumption in an atomic transaction or atomic deletion query.

---

### 13. Sequential Interactive Transaction Timeout in DataService.importData
- **Severity**: **Medium (Scalability Bottleneck)**
- **File & Lines**: `server/src/services/data.service.ts:151-246`
- **Flawed Code**:
  Sequential `await tx.attendance.create(...)` inside `prisma.$transaction(..., { timeout: 30000 })`.
- **Root Cause & Failure Scenario**:
  A semester containing 400 attendance logs executed one by one over cloud network latency exceeds the 30-second timeout, causing the transaction to abort and roll back.
- **Proposed Surgical Fix**:
  Batch insert using `await tx.attendance.createMany({ data: logRows })`.

---

### 14. Dead / Unrendered Export & Import Handlers in TimetablePage
- **Severity**: **Low-Medium (Dead Code / Missing Feature)**
- **File & Lines**: `client/src/pages/timetable/TimetablePage.tsx:256-298`
- **Flawed Code**:
  `handleExportTimetable` and `handleImportJsonFile` are defined but never bound to any JSX button or element.
- **Root Cause & Failure Scenario**:
  Users on the Timetable page cannot export or import JSON schedules directly from the Timetable UI.
- **Proposed Surgical Fix**:
  Add Export Schedule and Import Schedule buttons to the Timetable toolbar.

---

### 15. Mock Google Drive Backup UI
- **Severity**: **Low-Medium (Deceptive UI / User Confusion)**
- **File & Lines**: `client/src/pages/settings/SettingsPage.tsx:703-720, 756-768`
- **Flawed Code**:
  ```typescript
  onClick={() => {
    setIsBackupNowLoading(true);
    setTimeout(() => {
      setIsBackupNowLoading(false);
      setBackupStatusMessage("Google Drive backup completed!");
      setTimeout(() => setBackupStatusMessage(""), 3000);
    }, 1500);
  }}
  ```
- **Root Cause & Failure Scenario**:
  UI pretends to backup to Google Drive using a 1.5s timer with zero backend or API integration. Users assume their data is in Google Drive when nothing has been backed up.
- **Proposed Surgical Fix**:
  Add a "Coming Soon" badge or disable the button with an informative tooltip until cloud integration is built.

---

## Summary Matrix

| ID | Issue Description | Component | Severity | Root Cause | Impact |
|---|---|---|---|---|---|
| 1 | BOLA/IDOR on Document Download | Server Controller | Critical | Missing `doc.userId === req.user.userId` check | Arbitrary document/backup theft across users |
| 2 | Missing DB Transaction in Import | Server Service | High | Sequential mutations without `$transaction` | Irrecoverable half-wiped state on error |
| 3 | Attendance Deduplication Data Loss | Server Service | High | Deduplication key `${dateStr}_${subjectId}` | Silently drops multi-slot lectures on same day |
| 4 | Foreign Key Crash on Semester Wipe | Server Service / Prisma | High | `TimetableOverride.subject` lacks cascade delete | ZIP restore crashes 100% if overrides exist |
| 5 | Multi-Store State Desynchronization | Client Stores / UI | High | Failure to clear cache or refresh attendance store | Stale dashboard data & phantom notification alarms |
| 6 | Broken ZIP Import via Localhost ML Server | Client UI / ML Server | Medium-High | Calls `localhost:8000` with faked times | Fails in production; corrupts class times locally |
| 7 | Loss of Medical / OD / Cancelled Status | Server Service | Medium-High | Status collapsed to "Attended" in CSV export | Excuses/cancellations permanently become present |
| 8 | Incomplete JSON Backup | Client / Server | Medium | `exportTimetable` omits attendance logs and events | User loses all attendance on JSON restore |
| 9 | Unawaited Share & Leaked Object URLs | Client Helper | Medium | Unwrapped `FileReader` callback & no revoke | Race conditions and false error toasts |
| 10 | Missing File Input Reset | Client UI | Medium | `e.target.value` never cleared | Re-selecting same file fails to trigger |
| 11 | SAF MIME Type Filter Missing | Client UI | Medium | `accept=".json"` without MIME types | File grayed out on Android file picker |
| 12 | Insecure Random & Non-Atomic Peer Sync | Server Controller | Medium | `Math.random()` and non-atomic code consumption | Predictable codes; concurrent consumption race |
| 13 | Sequential Transaction Timeout | Server Service | Medium | 400+ sequential inserts in 30s transaction | Transaction expiration failure on large data |
| 14 | Dead Timetable Import/Export Handlers | Client UI | Low-Medium | Handlers defined but omitted from JSX | Unreachable functionality on Timetable page |
| 15 | Mock Google Drive Backup UI | Client UI | Low-Medium | Simulated `setTimeout` without implementation | False confidence in data safety |
