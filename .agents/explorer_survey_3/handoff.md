# Handoff Report: Requirement R2 (Part B) - Data Export, Import & Backup Audit

**Author**: Survey Explorer 3 (Data Export, Import & Backup Audit)  
**Date**: 2026-09-19  
**Recipient**: Orchestrator (Conversation ID: 17083f67-30c8-42ae-a6b8-cc73bd7ae680)  
**Status**: Complete (Hard Handoff)

---

## 1. Observation

Direct observations from source code inspections:

### Obs 1: Document Download Authorization Bypass (IDOR / BOLA)
- **Path**: `server/src/controllers/document.controller.ts:28-43`
- **Verbatim Code**:
  ```typescript
  static async downloadDocument(req: Request, res: Response) {
    try {
      const id = (req.params.id as string) as string;
      const doc = await prisma.storedDocument.findUnique({ where: { id } });
      
      if (!doc) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // We stored the URL as /uploads/filename
      if (doc.fileData) {
        res.setHeader('Content-Disposition', `attachment; filename="${doc.name}"`);
        res.setHeader('Content-Type', doc.mimeType);
        return res.send(doc.fileData);
      }
  ```
  In `deleteDocument` (`server/src/controllers/document.controller.ts:70`):
  `if (!doc || doc.userId !== req.user.userId) return res.status(404).json({ message: 'Document not found' });`

### Obs 2: Timetable Import Lacks Database Transaction Rollback
- **Path**: `server/src/services/timetable.service.ts:725-773`
- **Verbatim Code**:
  ```typescript
  static async importTimetable(userId: string, semesterId: string, payload: any) {
    if (!payload || !Array.isArray(payload.subjects) || !Array.isArray(payload.slots)) {
      throw new Error("Invalid timetable payload. Must contain 'subjects' and 'slots' arrays.");
    }

    await this.safeDeleteTimetable(userId, semesterId);

    // ── 1. Subjects (small set, sequential is fine) ────────────────────────
    const subjectMap = new Map<string, string>();
    for (const subData of payload.subjects) { ... }

    // ── 2. Timetable Slots — single batch insert ───────────────────────────
    const slotRows = payload.slots ...
    if (slotRows.length > 0) {
      await prisma.timetableSlot.createMany({ data: slotRows, skipDuplicates: true });
    }
  ```
  `safeDeleteTimetable` mutates existing slots at lines 670-673:
  `await prisma.timetableSlot.updateMany({ where: { ...whereCond, validUntil: null }, data: { validUntil: new Date() } });`
  All operations execute without `prisma.$transaction`.

### Obs 3: Deduplication Drops Multi-Slot Lectures on the Same Day
- **Path**: `server/src/services/timetable.service.ts:809-834`
- **Verbatim Code**:
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

### Obs 4: Foreign Key Crash on Deleting Subjects in DataService.importData
- **Path**: `server/src/services/data.service.ts:138-142` & `server/prisma/schema.prisma:273`
- **Verbatim Code**:
  ```typescript
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. Wipe current semester data
    await tx.subject.deleteMany({ where: { semesterId: activeSem.id } });
  ```
  In `schema.prisma`:
  `model TimetableOverride { ... subject Subject? @relation(fields: [subjectId], references: [id]) }` (no cascade).

### Obs 5: Post-Import Store Desynchronization in SettingsPage
- **Path**: `client/src/pages/settings/SettingsPage.tsx:410-421`
- **Verbatim Code**:
  ```typescript
  action: {
    label: "Import",
    onClick: async () => {
      try {
        await api.post(`/timetable/import/${activeSem.id}`, payload);
        toast.success("Backup imported successfully!");
      } catch (err) {
        console.error(err);
        toast.error("Failed to import backup.");
      }
    }
  },
  ```
  `useCacheStore.getState().clearCache()` and `useAttendanceStore.getState().fetchStats()` are not invoked.

### Obs 6: Settings ZIP Import Targets Python ML Server on Localhost
- **Path**: `client/src/pages/settings/SettingsPage.tsx:467-474` & `ml-server/tasks.py:139-142`
- **Verbatim Code**:
  ```typescript
  const mlApiUrl = import.meta.env.VITE_ML_API_URL || "http://localhost:8000";
  const res = await fetch(`${mlApiUrl}/upload/zip?user_id=${user.id}`, {
    method: "POST",
    body: formData,
  });
  ```
  ```python
  start_hour = 9 + day_slot_counts[day_idx]
  start_str = f"{start_hour:02d}:00"
  end_str = f"{start_hour:02d}:50"
  ```
  Meanwhile, `server/src/routes/data.routes.ts:15` (`router.post("/import", upload.single("file"), DataController.importData)`) exists on Express but is never used by the client.

### Obs 7: Attendance Status Loss in CSV Export/Import
- **Path**: `server/src/services/data.service.ts:23-28, 92-95, 215-218`
- **Verbatim Code**:
  ```typescript
  // Export
  let attStatus = "Attended";
  if (log.status === "absent") attStatus = "Missed";
  if (log.status === "off") attStatus = "Off";
  // Import
  const attStr = row["Attendance"];
  let status: any = "present";
  if (attStr === "Missed") status = "absent";
  if (attStr === "Off") status = "off";
  ```
  Enum in `schema.prisma:45-52`: `present, absent, off, cancelled, medical, od`.

### Obs 8: Unawaited Share Promise and Unrevoked URLs in Download Helper
- **Path**: `client/src/lib/download.ts:6-48`
- **Verbatim Code**:
  ```typescript
  export const downloadBlob = async (blob: Blob, filename: string) => {
    if (Capacitor.isNativePlatform()) {
      try {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          try {
            const base64data = (reader.result as string).split(',')[1];
            const result = await Filesystem.writeFile({ ... });
            await Share.share({ ... });
          } catch (innerErr) {
            toast.error("Failed to share file.");
          }
        };
      } catch (e) { ... }
    } else {
      const url = window.URL.createObjectURL(blob);
      ...
      link.click();
      link.parentNode?.removeChild(link);
    }
  };
  ```

---

## 2. Logic Chain

1. **Obs 1 → Critical Data Breach**: `StoredDocument` persists full semester backup ZIPs and CSV files in Postgres bytea (`fileData`) and on disk. `downloadDocument` takes an arbitrary `id` from the URL parameter and streams the document without testing `doc.userId === req.user.userId`. Therefore, any logged-in user can steal any other user's backup archive simply by providing a UUID.
2. **Obs 2 → Unrecoverable Partial Corruption**: When `importTimetable` runs, step 1 marks all current slots as ended (`validUntil = new Date()`). Because no Prisma transaction wraps the function, any exception during subject, slot, event, or log creation leaves the previous schedule archived while the new schedule is incomplete. The user cannot revert without manual database intervention.
3. **Obs 3 → Corrupted Attendance Statistics**: Academic courses routinely have multi-hour blocks or extra lectures on the same date. The deduplication set is keyed solely on `${dateStr}_${subjectId}`. If a subject has two lectures on a date, the second lecture is dropped. When computing total attendance, attendance statistics will be distorted.
4. **Obs 4 → 100% Failure Rate for Users with Overrides**: If a user creates an extra class, an entry in `TimetableOverride` references the subject. Because foreign key cascade delete is absent from `TimetableOverride.subjectId`, executing `tx.subject.deleteMany` violates relational integrity, aborting `DataService.importData`.
5. **Obs 5 → Stale Client State and Spurious Notifications**: Zustand stores `useCacheStore` and `useAttendanceStore` persist to `@capacitor/preferences`. When `SettingsPage` imports a timetable, it neither clears `useCacheStore` nor calls `fetchStats()`. Consequently, UI views read cached subjects and old slots, and `NotificationService` fires class alarms for deleted lectures.
6. **Obs 6 → Dead Mobile Feature & Time Corruption**: Routing ZIP uploads to `http://localhost:8000` causes an immediate `ERR_CONNECTION_REFUSED` in production web and mobile APK environments. If tested locally, `ml-server/tasks.py` replaces actual class times with fabricated 09:00, 10:00 slots. The existing Express `POST /api/data/import` endpoint remains unutilized.
7. **Obs 7 → Loss of Medical / Official Duty Exemptions**: Excused absences (`medical`, `od`) and cancelled classes are converted to standard `"Attended"` during CSV export and imported back as ordinary `"present"`. The student's official attendance records lose legal/academic validity.
8. **Obs 8 → Race Conditions & Uncaught Errors**: `downloadBlob` returns before `FileReader.onloadend` executes, rendering caller UI state inaccurate. Dismissing the Android share sheet triggers an unintended error toast. Browser downloads leak memory.

---

## 3. Caveats

1. **OCR / Gemini Model Inspection**: The ML server has Gemini Vision / OCR endpoints (`/upload/calendar-ocr`), but since current user guidelines require `gemini-3.8-flash` for multimodal parsing and the ML server still references legacy LangChain models, OCR parsing in `ml-server` was evaluated only in the context of data ingestion.
2. **Google Drive Integration**: UI buttons for Google Drive backup are pure stubs (`setTimeout` and mock toasts). No actual Google Drive OAuth or cloud sync code exists in `server/src` or `client/src`.
3. **Network Mode**: Investigation was executed under read-only explorer constraints; no production database mutations or source edits were performed.

---

## 4. Conclusion

The AttendX backup, export, import, and data synchronization subsystem contains severe architectural and security defects:
1. **Security**: An urgent BOLA / IDOR vulnerability allows unauthorized document download across user boundaries.
2. **Reliability**: Timetable import lacks transactional rollback, and ZIP restore crashes whenever overrides exist.
3. **Integrity**: Attendance deduplication silently discards multiple classes on the same day, and CSV export/import erases medical/OD statuses.
4. **State Management**: Client stores (`useCacheStore`, `useAttendanceStore`) fail to update post-import, leading to stale dashboards and errant notification alarms.
5. **Architecture**: Settings ZIP import targets an unhosted Python ML server with buggy faked timings, leaving Express backend's native importer orphaned.

---

## 5. Verification Method

To independently verify all findings:

### Step 1: Verify IDOR Vulnerability
- Inspect `server/src/controllers/document.controller.ts`, lines 28–43. Compare with line 70.
- Execute:
  `grep -n "findUnique" server/src/controllers/document.controller.ts`
  Verify that `downloadDocument` only filters by `where: { id }` and omits `userId`.

### Step 2: Verify Missing Transaction in Timetable Import
- Inspect `server/src/services/timetable.service.ts`, lines 725–847.
- Search for `$transaction`:
  `grep -n "\$transaction" server/src/services/timetable.service.ts`
  Confirm that `importTimetable` does not appear in transaction grep results.

### Step 3: Verify Attendance Deduplication Key
- Inspect `server/src/services/timetable.service.ts`, lines 813 and 827:
  `grep -n "existingSet.has(key)" server/src/services/timetable.service.ts`
  Observe that `key` is `${dateStr}_${subjectId}`, dropping any subsequent slot on the same day.

### Step 4: Verify Missing Cascade in Prisma Schema
- Inspect `server/prisma/schema.prisma`, line 273:
  `grep -n "subject.*Subject?" server/prisma/schema.prisma`
  Observe that `TimetableOverride` lacks `onDelete: Cascade`.

### Step 5: Verify Client Store Desynchronization
- Inspect `client/src/pages/settings/SettingsPage.tsx`, lines 405–422.
  Observe absence of `useCacheStore.getState().clearCache()` and `useAttendanceStore.getState().fetchStats()`.

### Step 6: Verify Localhost 8000 Divergence
- Inspect `client/src/pages/settings/SettingsPage.tsx`, line 467:
  `grep -n "mlApiUrl" client/src/pages/settings/SettingsPage.tsx`
  Observe `VITE_ML_API_URL || "http://localhost:8000"`.

### Invalidation Conditions
- The conclusions would be invalidated if:
  - An Express middleware intercepts `/api/documents/:id/download` and enforces document ownership outside `document.controller.ts` (verified false via `server/src/routes/document.routes.ts`).
  - An underlying Prisma client extension wraps all mutations in automatic transactions (verified false via `server/src/lib/prisma.ts`).
