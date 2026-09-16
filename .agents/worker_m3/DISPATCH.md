## 2026-09-20T00:20:00Z
You are Worker M3 (Implementation Specialist for Backup Import/Export & Data Integrity - Milestone M3).

Working directory: c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\worker_m3
Workspace directory: c:\Users\Raina\OneDrive\Desktop\AttendX
Original Request: c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\ORIGINAL_REQUEST.md
Rules: c:\Users\Raina\OneDrive\Desktop\AttendX\AGENTS.md
Scope document: c:\Users\Raina\OneDrive\Desktop\AttendX\PROJECT.md
Explorer Survey 3 Handoff: c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\explorer_survey_3\handoff.md
Explorer Survey 3 Analysis: c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\explorer_survey_3\analysis.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your mission:
Implement surgical, robust fixes for Requirement R2 (Part B: Backup Import/Export & Data Integrity) based on Explorer Survey 3 findings:

1. BOLA / IDOR in Document Download Controller (`server/src/controllers/document.controller.ts` lines ~28–60):
   - In `downloadDocument`, verify that `doc.userId === (req.user as any)?.userId` (or `doc.userId === req.user.id`).
   - If user does not own the document, reject immediately with HTTP 403 Forbidden.

2. Database Transaction & Rollback in Timetable Import (`server/src/services/timetable.service.ts` lines ~725–847):
   - Wrap timetable import (`safeDeleteTimetable`, subject creation, slot creation, attendance logs) inside `prisma.$transaction(async (tx) => { ... })`.
   - Ensure that if any step throws an error, all changes roll back so the existing semester is never left corrupt or empty.

3. Timetable Deduplication Key Data Loss (`server/src/services/timetable.service.ts` lines ~809–834):
   - Replace key `${dateStr}_${subjectId}` with a compound key including slot ID / time:
     `${dateStr}_${subjectId}_${slotId || 'extra'}_${startTime || ''}` so valid multi-slot classes, practical labs, and extra lectures on the same date are not discarded.

4. Multi-Store Desynchronization Post-Import (`client/src/pages/settings/SettingsPage.tsx` lines ~410–418):
   - In the import file handler (`handleImportFile` / JSON / ZIP import), invalidate `useCacheStore` (`timetable`, `today`, `calendar`, `subject_logs`, `subjects`, `subjects_overview`), refresh `useAttendanceStore`, and dispatch `"attendance-updated"`.

5. Foreign Key Violation on Full Semester Wipe (`server/src/services/data.service.ts` lines ~138–142):
   - In `importData` wipe logic, delete `TimetableOverride` records (`tx.timetableOverride.deleteMany({ where: { subject: { semester: { userId } } } })`) before deleting `Subject`, preventing FK constraint violations.

6. Loss of Attendance Status Types in CSV Export/Import (`server/src/services/data.service.ts` lines ~23–28, 92–95, 215–218):
   - Export genuine status strings (`present`, `absent`, `medical`, `od`, `cancelled`).
   - On import, restore exact statuses rather than collapsing everything into "present".

7. Download Helper Unawaited Promise & Leaked Object URLs (`client/src/lib/download.ts` lines ~6–48):
   - In `downloadFile`, wrap FileReader in a `new Promise` so the caller awaits complete file writing.
   - Clean up browser object URLs with `URL.revokeObjectURL(url)` in a `finally` block or after a timeout.
   - Catch Share sheet dismissal gracefully as a non-fatal user cancellation.

8. File Input Reset & Android SAF MIME Filters (`client/src/pages/settings/SettingsPage.tsx` lines ~390–428, 621):
   - Reset `e.target.value = ''` in file input `onChange` handlers.
   - Add standard MIME types (`application/json`, `application/zip`, `text/csv`) alongside extensions to `accept` attribute so Android Storage Access Framework (SAF) does not disable file selection.

9. Genuine Verification Test Suite:
   - Create `server/src/tests/backup_import_export.test.ts`:
     - Directly import `TimetableService`, `DataService`, `prisma`, and relevant controllers/helpers.
     - Test BOLA ownership rejection (403 on mismatched user ID).
     - Test compound deduplication key preserving multi-slot classes.
     - Test status preservation (`medical`, `od`, `cancelled`) in CSV.
     - Zero duplicate mock algorithms or self-certifying tests!
