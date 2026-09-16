# Handoff Report — Survey Explorer 1 (Offline Sync & Store Race Conditions)

**Task**: Requirement R1 Investigation: Offline-Sync Race Conditions, Zustand Stores, API Interceptors, Optimistic UI Overwrites  
**Type**: Hard Handoff (Complete)  
**Agent**: Survey Explorer 1  
**Date**: 2026-09-19  

---

## 1. Observation

Direct code inspection of the AttendX client stores, interceptors, pages, and server services identified the following verbatim code locations:

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
   When `originalRequest.data` is an object, `JSON.parse(originalRequest.data)` coerces it to `"[object Object]"` and throws `SyntaxError`. The catch block swallows the error, causing `parsedData` to be set to `undefined`.

2. **`client/src/stores/offlineStore.ts` (lines 70–90)**:
   ```typescript
   for (const req of queue) {
     try {
       await api.request({
         method: req.method,
         url: req.url,
         data: req.data,
         headers: { ...req.headers, 'X-Offline-Retry': 'true' },
       });
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
   If `req` fails due to a network drop, it is not dequeued, but the loop does not break; it proceeds to execute subsequent requests in `queue`, executing operations out of order. Furthermore, if a 500 status is returned, the request is never dequeued and has no retry count limit.

3. **`client/src/stores/attendanceStore.ts` (lines 149–165)**:
   ```typescript
   const pendingMarks = useOfflineStore.getState().queue.filter(q => q.url.includes("/attendance/mark"));
   const isDirty = pendingMarks.length > 0;
   
   if (statsRes.status === 'fulfilled' && !isDirty) { ... }
   ```
   If any mark request in `useOfflineStore` remains in the queue (e.g. from an unhandled 500 error), `isDirty` is permanently true, and fresh attendance statistics from `/attendance/stats` are permanently discarded.

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
   `attendx-offline-queue` is omitted from `keysToRemove`, and `useOfflineStore.getState().clearQueue()` is not called.

5. **`client/src/pages/subjects/SubjectDetailPage.tsx` (lines 248–255, 288–311)**:
   ```typescript
   setLogs((prev) => prev.map(...));
   await api.post("/attendance/mark", ...);
   window.dispatchEvent(new Event("attendance-updated"));
   ...
   const handleUpdate = () => { fetchLogsData(); };
   window.addEventListener("attendance-updated", handleUpdate);
   ```
   `handleMarkAttendance` updates local state `logs` but does not update `useCacheStore.getState().subject_logs`. The dispatched event immediately runs `fetchLogsData()`, which falls back to the un-updated, stale `subject_logs` cache in offline mode, instantly reverting the optimistic update.

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
   The guard preserves `d.details`, but leaves `d.days` to be overwritten by the stale server GET response. Additionally, `pendingMarks` has no month scoping.

7. **`server/prisma/schema.prisma` (line 301) and `server/src/services/attendance.service.ts` (lines 195–252)**:
   ```prisma
   @@unique([userId, subjectId, date, timetableSlotId])
   ```
   In PostgreSQL, `NULL != NULL`. When `timetableSlotId` is `null` (extra lectures/manual marks), the unique constraint is bypassed, allowing duplicate rows to be created during concurrent retries.

8. **`server/src/services/attendance.service.ts` (lines 211–215)**:
   ```typescript
   if (data.status === "not_marked" || data.status === "clear") {
     if (data.attendanceId) {
       const deleteResult = await prisma.attendance.deleteMany({
         where: { id: data.attendanceId }
       });
       return { message: "Attendance cleared", count: deleteResult.count, status: "not_marked" };
     }
   ```
   If `data.attendanceId` is a temporary ID (`temp-...` or `optimistic-...`), `deleteMany` deletes 0 rows and returns success without deleting the actual database record.

9. **`client/src/stores/assignmentStore.ts` (lines 59–66, 75–82)**:
   `addAssignment` blindly appends `res.data` (`{ id: 'temp-...', _queued: true }`), stripping all title, deadline, and description fields. `toggleCompletion` has no optimistic toggle and fails when offline.

10. **`client/src/components/sync/PeerSyncModal.tsx` (lines 135–151)**:
    After importing timetable data via `/timetable/import/:id`, `useCacheStore` caches (`timetable`, `today`, `calendar`) are not invalidated, and `"attendance-updated"` is not fired.

---

## 2. Logic Chain

1. **Chain 1: Payload Loss to 400 Bad Request to Silent Data Loss**  
   - Observation (1) establishes that `api.ts` sets `parsedData = undefined` whenever `originalRequest.data` is an object.
   - Observation (2) establishes that `offlineStore` sends `req.data` (`undefined`) to `api.request`.
   - The server endpoint `POST /attendance/mark` checks `if (!subjectId || !date || !status)` and returns 400 Bad Request.
   - Observation (2) shows `offlineStore` drops all 4xx errors (`dequeue(req.id)`).
   - **Result**: Every offline attendance mark is wiped out and permanently lost.

2. **Chain 2: Network Glitch to Out-of-Order Execution**  
   - Observation (2) demonstrates that when request $N$ in the queue encounters a transient network timeout, the `catch` block logs the error and the loop continues to request $N+1$.
   - When request $N+1$ succeeds, it commits on the server.
   - Request $N$ is retained and runs on the subsequent flush, inverting the intended order of operations.

3. **Chain 3: 500 Error to Unbounded Queue to Permanent Stats Lock**  
   - Observation (2) shows that 500 errors are never dequeued.
   - Observation (3) shows that as long as any `/attendance/mark` request exists in `queue`, `isDirty` is true.
   - Observation (3) shows that `attendanceStore.fetchStats()` explicitly skips server stats updates when `isDirty` is true.
   - **Result**: A single 500 error permanently freezes the user's attendance stats and percentage calculation.

4. **Chain 4: Stale Cache Inversion in `SubjectDetailPage`**  
   - Observation (5) shows `handleMarkAttendance` sets local `logs` state optimistically, but leaves `useCacheStore.subject_logs` unchanged.
   - Observation (5) shows `attendance-updated` triggers `fetchLogsData()`, which catches network failure when offline and sets `logs` to `useCacheStore.subject_logs`.
   - **Result**: The UI immediately flips back to the pre-optimistic state.

5. **Chain 5: Logout to Account Contamination**  
   - Observation (4) shows `logout()` clears specific keys but leaves `attendx-offline-queue` in storage.
   - When a new user logs in and the app goes online, Observation (2) runs `flushQueue()` with the new user's active bearer token.
   - **Result**: User A's pending attendance modifications are committed to User B's database records.

---

## 3. Caveats

- **Network Plugin**: The codebase does not include `@capacitor/network`. Offline detection relies on `window.addEventListener('online')` and Axios interceptor catches. On Android WebViews, `window.ononline` may not fire immediately upon waking from background.
- **Backend Batch Endpoint**: Currently, AttendX does not have a dedicated atomic batch endpoint (`POST /attendance/batch`) for offline sync; each queued mutation is flushed as an individual HTTP request in a sequential loop. Implementing an atomic batch sync endpoint in Phase 2 would offer superior transaction guarantees.

---

## 4. Conclusion

Requirement R1 is fully investigated. 15 concrete race conditions and failure vectors were identified across the frontend stores, interceptors, page components, and backend database logic. The root causes have been traced to specific lines of code, and surgical fix strategies compliant with AGENTS.md rules have been formulated.

All findings and detailed recommendations are fully documented in `.agents/explorer_survey_1/analysis.md`.

---

## 5. Verification Method

To independently verify these findings:

1. **Verify Bug 1 (Payload Loss)**:
   - Inspect `client/src/lib/api.ts` lines 213–221.
   - In browser DevTools, switch to Offline mode, mark any class on `/today`, and run in console:
     ```javascript
     const q = JSON.parse(await (await window.Capacitor.Plugins.Preferences.get({ key: 'attendx-offline-queue' })).value);
     console.log(q.state.queue[0].data); // Output: undefined
     ```
2. **Verify Bug 4 (Permanent Stats Lock)**:
   - Inspect `client/src/stores/offlineStore.ts` line 84 and `client/src/stores/attendanceStore.ts` lines 149–165.
   - Notice lack of 500 handling in `offlineStore.ts` and `if (!isDirty)` check in `attendanceStore.ts`.
3. **Verify Bug 5 (SubjectDetailPage Optimistic Revert)**:
   - Inspect `client/src/pages/subjects/SubjectDetailPage.tsx` lines 250–254 and 288–311.
   - Notice missing update to `useCacheStore.subject_logs` and immediate trigger of `fetchLogsData()`.
4. **Verify Bug 9 (Logout Queue Leak)**:
   - Inspect `client/src/stores/authStore.ts` lines 71–89.
   - Notice `'attendx-offline-queue'` is absent from `keysToRemove`.
