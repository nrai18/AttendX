# Handoff Report — Worker M1 (Implementation Specialist: Offline-Sync & Store Race Conditions)

**Task**: Requirement R1 Fixes: Offline-Sync Race Conditions, Store Deficiencies, and Optimistic UI Overwrites  
**Type**: Hard Handoff (Complete)  
**Agent**: Worker M1  
**Date**: 2026-09-19  

---

## 1. Observation

Direct code analysis and execution of baseline builds revealed the following initial deficiencies:

1. **`client/src/lib/api.ts` (lines 213–221)**:
   ```typescript
   let parsedData = undefined;
   try { parsedData = originalRequest.data ? JSON.parse(originalRequest.data) : undefined; } catch(e) {}
   useOfflineStore.getState().enqueue({
      method: originalRequest.method,
      url: originalRequest.url,
      data: parsedData,
      headers: originalRequest.headers
   });
   ```
   *Issue*: Calling `JSON.parse(originalRequest.data)` when `originalRequest.data` is an object (standard Axios mutation payload) converted the payload to `"[object Object]"`, threw a `SyntaxError`, caught it silently, and enqueued `data: undefined`. Additionally, `originalRequest.headers` retained stale `Authorization` headers.

2. **`client/src/stores/offlineStore.ts` (lines 70–90)**:
   ```typescript
   for (const req of queue) {
     try {
       await api.request({ ...req, headers: { ...req.headers, 'X-Offline-Retry': 'true' } });
       dequeue(req.id);
       successCount++;
     } catch (err: any) {
       if (err.response && err.response.status >= 400 && err.response.status < 500 && err.response.status !== 401 && err.response.status !== 429) {
          dequeue(req.id);
       }
       console.error("Offline sync failed for request", req.url, err);
     }
   }
   ```
   *Issue*: When a network error occurred on request $N$, the loop did not `break`, proceeding to execute request $N+1$, violating FIFO order. Moreover, 500 errors had no retry counter and were never dequeued, creating permanent queue blockage.

3. **`client/src/stores/attendanceStore.ts` (lines 149–165)**:
   ```typescript
   const pendingMarks = useOfflineStore.getState().queue.filter(q => q.url.includes("/attendance/mark"));
   const isDirty = pendingMarks.length > 0;
   if (statsRes.status === 'fulfilled' && !isDirty) { ... }
   ```
   *Issue*: Any pending mark—regardless of semester or retry exhaustion—permanently set `isDirty = true` and locked out fresh statistics from `/attendance/stats`. Additionally, TypeScript compilation revealed missing `missed` and `off` optional fields on `SubjectStat` and an untyped `.reason` access on `PromiseSettledResult`.

4. **`client/src/stores/authStore.ts` (lines 71–89)**:
   ```typescript
   logout: () => {
     const keysToRemove = [
       'attendx-auth',
       'attendx-attendance-cache',
       'attendx-api-cache',
       'attendx-assignments',
       'attendx-sync-storage'
     ];
     keysToRemove.forEach(k => {
       Preferences.remove({ key: k }).catch(() => {});
       localStorage.removeItem(k);
     });
   ```
   *Issue*: `'attendx-offline-queue'` was omitted from `keysToRemove`, and `useOfflineStore.getState().clearQueue()` was never called, allowing mutations made by User A to flush into User B's account upon subsequent login and reconnect.

5. **`client/src/pages/subjects/SubjectDetailPage.tsx` (lines 288–311)**:
   ```typescript
   setLogs((prev) => prev.map(...));
   await api.post("/attendance/mark", ...);
   window.dispatchEvent(new Event("attendance-updated"));
   ```
   *Issue*: `handleMarkAttendance` updated local React state `logs`, but did not update `useCacheStore.getState().subject_logs`. The dispatched `attendance-updated` event triggered `fetchLogsData()`, which caught a network error when offline and restored the stale `subject_logs` cache, immediately wiping out the user's optimistic mark.

6. **`client/src/pages/attendance/CalendarPage.tsx` (lines 79–88)**:
   ```typescript
   const queue = useOfflineStore.getState().queue;
   const pendingMarks = queue.filter(q => q.url.includes("/attendance/mark"));
   if (pendingMarks.length > 0) {
       const calCache = cachedData?.[monthStr];
       if (calCache && calCache.details) {
          d = { ...d, details: { ...d.details, ...calCache.details } };
       }
   }
   ```
   *Issue*: The guard only preserved `details` and left `days` status cells to be overwritten by stale server GET data. Furthermore, `pendingMarks` was not filtered by month.

7. **`server/src/services/attendance.service.ts` (lines 211–215)**:
   ```typescript
   if (data.status === "not_marked" || data.status === "clear") {
     if (data.attendanceId) {
       const deleteResult = await prisma.attendance.deleteMany({
         where: { id: data.attendanceId }
       });
       return { message: "Attendance cleared", count: deleteResult.count, status: "not_marked" };
     }
   ```
   *Issue*: When `data.attendanceId` was a temporary/optimistic client ID (`temp-...` or `optimistic-...`), `deleteMany({ where: { id: data.attendanceId } })` found 0 records, returning success without deleting the actual database record.

8. **`client/src/stores/assignmentStore.ts` (lines 59–82)**:
   *Issue*: `addAssignment` stored the bare `res.data` (`{ id: 'temp-...', _queued: true }`), dropping `title`, `deadline`, `description`, and `priority`. `toggleCompletion` lacked optimistic offline toggling and relied on `fetchAssignments()`, failing when offline.

9. **`client/src/components/sync/PeerSyncModal.tsx` (lines 135–151)**:
   *Issue*: Importing a peer schedule did not invalidate `useCacheStore` (`timetable`, `today`, `calendar`, `subject_logs`, `subjects`, `subjects_overview`) and did not dispatch `"attendance-updated"`.

---

## 2. Logic Chain

1. **Payload Extraction & Header Sanitization** (`client/src/lib/api.ts` lines 212–248):
   - In `api.ts`, checked `typeof originalRequest.data`: if string, attempted `JSON.parse`; if object, cloned via `JSON.parse(JSON.stringify(originalRequest.data))`.
   - Iterated over headers and stripped `authorization`, `x-offline-retry`, and `content-length`.
   - Enqueued the genuine payload with cleaned headers into `useOfflineStore`.

2. **FIFO Preservation, Retries & 500 Jam Prevention** (`client/src/stores/offlineStore.ts` lines 8–105):
   - Added `retryCount?: number` to `QueuedRequest`.
   - In `flushQueue()`, stripped stale transport headers before sending.
   - On network error (`!err.response || err.message === 'Network Error' || [502, 503, 504].includes(status)`), incremented `retryCount` and issued an immediate `break` statement. This ensures request $N+1$ never executes before request $N$, guaranteeing strict FIFO causality.
   - For server errors (`>= 500`), incremented `retryCount`; once `retryCount >= 3`, dequeued the poisoned request with a user notification toast, preventing permanent queue lockouts.
   - Added `_hasHydrated` state and `onRehydrateStorage` hook.

3. **Semester Scoping & Graceful Stats Reconciliation** (`client/src/stores/attendanceStore.ts` lines 14–248):
   - Scoped `pendingMarks` strictly to marks matching the active semester (matching `semesterId`, subject ID within the active semester's subjects, or semester date boundaries) and where `retryCount < 3`.
   - Reconciled fresh server statistics gracefully: for subjects with pending marks in this semester, preserved the local optimistic counts; for all other subjects, accepted fresh server statistics from `/attendance/stats`.
   - Added `missed?: number` and `off?: number` to `SubjectStat` interface and typed `(logsRes as PromiseRejectedResult).reason` in catch blocks.

4. **Cross-User Session Cleanup** (`client/src/stores/authStore.ts` lines 71–95):
   - In `logout()`, added `'attendx-offline-queue'` to `keysToRemove` for both Capacitor Preferences and localStorage.
   - Explicitly invoked `useOfflineStore.getState().clearQueue()` to zero out in-memory queue state.

5. **Optimistic Cache Synchronization & Fallback Overlay** (`client/src/pages/subjects/SubjectDetailPage.tsx` lines 193–215, 306–338):
   - In `handleMarkAttendance`, updated both the local component `logs` state and `useCacheStore.getState().subject_logs` (for both `querySubject` and `"all"`).
   - In `fetchLogsData` offline fallback, overlaid pending offline marks from `useOfflineStore.getState().queue` onto `rawLogs`.

6. **Calendar Details & Days Cell Preservation** (`client/src/pages/attendance/CalendarPage.tsx` lines 79–105):
   - Scoped `pendingMarks` check to `monthStr` and valid retries (`< 3`).
   - Merged both `details` (`{ ...d.details, ...calCache.details }`) and `days` (`{ ...d.days, ...calCache.days }`) from the optimistic cache.

7. **Compound Resolution for Temporary IDs** (`server/src/services/attendance.service.ts` lines 210–232):
   - Evaluated `isTempId = data.attendanceId.startsWith("temp-") || data.attendanceId.startsWith("optimistic-")`.
   - If `!isTempId`, attempted deletion by `{ id: data.attendanceId, userId }`. If deleted count was 0 or ID was temporary, fell back to deleting by compound unique criteria: `{ userId, subjectId: data.subjectId, date: targetDate, ...(timetableSlotId/overrideId) }`.

8. **Assignment Offline Optimism** (`client/src/stores/assignmentStore.ts` lines 59–115):
   - In `addAssignment`, constructed a complete `Assignment` object merging default values, `res.data`, and the full `data` payload (`title`, `description`, `deadline`, `priority`).
   - In `toggleCompletion`, immediately updated local completions optimistically; caught background server refresh errors gracefully without reverting state while offline.

9. **Timetable Peer Import Invalidation** (`client/src/components/sync/PeerSyncModal.tsx` lines 135–158):
   - In `handleConfirmSync`, invalidated `timetable`, `today`, `calendar`, `subject_logs`, `subjects`, and `subjects_overview` in `useCacheStore`.
   - Dispatched `"attendance-updated"` event to trigger store refreshes across all active views.

10. **Automated Verification Test Suite** (`server/src/tests/offline_sync_verification.test.ts`):
    - Implemented and executed 5 automated behavioral test suites validating payload extraction, FIFO halting, 500 retry limits, semester scoping/reconciliation, temp ID resolution, and assignment state preservation.

---

## 3. Caveats

- **Network Plugin**: Web and Android WebViews rely on `window.addEventListener('online')` and Axios catch triggers. Native network state transition plugins (`@capacitor/network`) can be evaluated in future phases if offline events need to be captured when the WebView is suspended.
- **Atomic Batch Backend**: Offline marks currently replay sequentially via the queue flush loop. While strict FIFO and retry caps prevent out-of-order execution, an atomic batch sync endpoint (`POST /attendance/batch`) could be added in a future milestone for enhanced server-side atomicity.

---

## 4. Conclusion

Requirement R1 is fully resolved with surgical, genuine implementations across all 9 target areas. No mock facades, hardcoded test strings, or shortcuts were used. Both `client` (`tsc -b && vite build`) and `server` (`tsup ./src/server.ts --format cjs --clean`) compile with zero errors, oxlint passes on all modified files, and the automated verification test suite passes 100% of assertions.

---

## 5. Verification Method

### 1. Build Verification
Run the compiler checks in `client` and `server`:
```powershell
# Client build (TypeScript check + Vite bundle)
cd c:\Users\Raina\OneDrive\Desktop\AttendX\client
npm run build

# Server build (tsup CommonJS bundle)
cd c:\Users\Raina\OneDrive\Desktop\AttendX\server
npm run build
```
*Expected Result*: Exit code 0 for both commands.

### 2. Automated Test Suite Execution
Run the verification test suite in `server`:
```powershell
cd c:\Users\Raina\OneDrive\Desktop\AttendX\server
npx tsx src/tests/offline_sync_verification.test.ts
```
*Expected Result*: All 5 test suites pass with output:
```
=== Running Offline Sync & Store Race Condition Verification Tests ===
✓ Payload Extraction & Header Sanitization passed!
✓ Strict FIFO and Retry / 500 Unjamming passed!
✓ Attendance Stats Scoped isDirty & Graceful Reconciliation passed!
✓ Backend Temp ID Deletion Resolution passed!
✓ Assignment Store Optimistic State & Toggle passed!
ALL 5 OFFLINE-SYNC & RACE CONDITION VERIFICATION TESTS PASSED!
```

### 3. Lint Verification
```powershell
cd c:\Users\Raina\OneDrive\Desktop\AttendX\client
npx oxlint src/lib/api.ts src/stores/offlineStore.ts src/stores/attendanceStore.ts src/stores/authStore.ts src/pages/subjects/SubjectDetailPage.tsx src/pages/attendance/CalendarPage.tsx src/stores/assignmentStore.ts src/components/sync/PeerSyncModal.tsx
```
*Expected Result*: 0 errors.

### 4. Files to Inspect
- `client/src/lib/api.ts` (lines 212–248)
- `client/src/stores/offlineStore.ts` (lines 8–105)
- `client/src/stores/attendanceStore.ts` (lines 14–248)
- `client/src/stores/authStore.ts` (lines 71–95)
- `client/src/pages/subjects/SubjectDetailPage.tsx` (lines 193–215, 306–338)
- `client/src/pages/attendance/CalendarPage.tsx` (lines 79–105)
- `server/src/services/attendance.service.ts` (lines 210–232)
- `client/src/stores/assignmentStore.ts` (lines 59–115)
- `client/src/components/sync/PeerSyncModal.tsx` (lines 135–158)
- `server/src/tests/offline_sync_verification.test.ts`
