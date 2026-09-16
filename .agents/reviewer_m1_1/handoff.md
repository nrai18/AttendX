# Handoff Report — Reviewer M1-1 (High-Reliability Code Reviewer)

**Task**: Critical & Adversarial Review of Worker M1 Fixes (Milestone M1: Offline-Sync & Store Race Conditions)  
**Type**: Hard Handoff (Complete)  
**Agent**: Reviewer M1-1 (reviewer, critic)  
**Date**: 2026-09-19  
**Verdict**: **APPROVE**  

---

## 1. Observation

Direct inspection of the codebase, git diffs, independent build logs, and test execution yielded the following observations across the 9 modified files:

### 1.1 `client/src/lib/api.ts` (lines 213–248)
- **Code Change**:
  ```typescript
  let parsedData: any = originalRequest.data;
  if (typeof parsedData === "string") {
    try {
      parsedData = JSON.parse(parsedData);
    } catch (e) {}
  } else if (parsedData && typeof parsedData === "object") {
    try {
      parsedData = JSON.parse(JSON.stringify(parsedData));
    } catch (e) {
      parsedData = { ...parsedData };
    }
  }

  const cleanHeaders: Record<string, any> = {};
  if (originalRequest.headers) {
    const rawHeaders = typeof originalRequest.headers.toJSON === 'function'
      ? originalRequest.headers.toJSON()
      : { ...originalRequest.headers };
    for (const [key, value] of Object.entries(rawHeaders)) {
      const lower = key.toLowerCase();
      if (lower !== 'authorization' && lower !== 'x-offline-retry' && lower !== 'content-length') {
        cleanHeaders[key] = value;
      }
    }
  }
  ```
- **Observation**: Calling `JSON.parse(originalRequest.data)` directly on an object originally resulted in `"[object Object]"`, throwing a `SyntaxError` that silently defaulted `parsedData` to `undefined`. The new implementation safely type-checks: if `typeof parsedData === "string"`, it attempts `JSON.parse`; if it is already an object, it deep-clones it via `JSON.parse(JSON.stringify(parsedData))`. Furthermore, volatile headers (`Authorization`, `x-offline-retry`, `content-length`) are pruned, ensuring fresh authentication tokens attach when the queue replays.

### 1.2 `client/src/stores/offlineStore.ts` (lines 8–105, 144–149)
- **Code Change**:
  - `QueuedRequest` extended with `retryCount?: number`.
  - Added `_hasHydrated: boolean` and `onRehydrateStorage` hook.
  - In `flushQueue()`:
    - Stripped stale `Authorization` and `X-Offline-Retry` headers prior to dispatch.
    - On network errors (`!err.response || err.message === 'Network Error' || [502, 503, 504].includes(status)`), updates `retryCount` and issues an immediate `break` statement:
      ```typescript
      if (isNetworkError) {
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === req.id ? { ...item, retryCount: currentRetries } : item
          ),
        }));
        console.warn(`[offlineStore] Network failure syncing ${req.url}. Halting queue to maintain FIFO order.`);
        break;
      }
      ```
    - On 4xx errors (`status >= 400 && status < 500 && status !== 401 && status !== 429`), dequeues immediately (`dequeue(req.id)`).
    - On 500 server errors, tracks `currentRetries`; when `currentRetries >= 3`, dequeues the unrecoverable request with an alert toast (`toast.error(...)`); otherwise increments `retryCount` and breaks until the next flush cycle.

### 1.3 `client/src/stores/attendanceStore.ts` (lines 14–248)
- **Code Change**:
  - `SubjectStat` interface updated with `missed?: number; off?: number;`.
  - `pendingMarks` filter narrowed to active semester:
    ```typescript
    const pendingMarks = useOfflineStore.getState().queue.filter((q) => {
      if (!q.url.includes("/attendance/mark")) return false;
      if ((q.retryCount || 0) >= 3) return false;
      const data = q.data;
      if (!data) return false;
      if (data.semesterId && data.semesterId === activeSemRes.data.id) return true;
      if (data.subjectId && activeSubjectIdSet.has(data.subjectId)) return true;
      if (data.date && activeSemRes.data.startDate && activeSemRes.data.endDate) {
        const sDate = activeSemRes.data.startDate.slice(0, 10);
        const eDate = activeSemRes.data.endDate.slice(0, 10);
        if (data.date >= sDate && data.date <= eDate) return true;
      }
      return false;
    });
    ```
  - Graceful per-subject reconciliation:
    ```typescript
    if (isDirty && get().subjects.length > 0) {
      const pendingSubjectIds = new Set(
        pendingMarks.map((p) => p.data?.subjectId).filter(Boolean)
      );
      const localSubjectMap = new Map(get().subjects.map((s) => [s.id, s]));
      subjects = serverSubjects.map((sSub) => {
        if (pendingSubjectIds.has(sSub.id)) {
          const localSub = localSubjectMap.get(sSub.id);
          if (localSub) return localSub;
        }
        return sSub;
      });
    } else {
      subjects = serverSubjects;
    }
    ```
  - Catch block typed `logsRes.status === 'rejected'` instead of untyped `logsRes.reason`.

### 1.4 `client/src/stores/authStore.ts` (lines 68–95)
- **Code Change**:
  - In `logout()`:
    ```typescript
    const keysToRemove = [
      'attendx-auth',
      'attendx-attendance-cache',
      'attendx-api-cache',
      'attendx-assignments',
      'attendx-sync-storage',
      'attendx-offline-queue',
    ];
    keysToRemove.forEach(k => {
      Preferences.remove({ key: k }).catch(() => {});
      localStorage.removeItem(k);
    });
    useOfflineStore.getState().clearQueue();
    ```
  - Purges persistent queue from Capacitor Preferences, `localStorage`, and in-memory Zustand store.

### 1.5 `client/src/pages/subjects/SubjectDetailPage.tsx` (lines 191–215, 304–338)
- **Code Change**:
  - In `handleMarkAttendance`:
    ```typescript
    const updateLogItem = (l: AttendanceLogItem) =>
      l.id === item.id || (l.date === item.date && l.subjectId === item.subjectId && l.timetableSlotId === item.timetableSlotId && l.overrideId === item.overrideId)
        ? { ...l, status: newStatus }
        : l;

    setLogs((prev) => prev.map(updateLogItem));

    const querySubject = isOverall ? "all" : id;
    const existingCache = useCacheStore.getState().subject_logs || {};
    const updatedCache = { ...existingCache };
    if (querySubject && updatedCache[querySubject]?.logs) {
      updatedCache[querySubject] = {
        ...updatedCache[querySubject],
        logs: updatedCache[querySubject].logs.map(updateLogItem),
      };
    }
    if (querySubject !== "all" && updatedCache["all"]?.logs) {
      updatedCache["all"] = {
        ...updatedCache["all"],
        logs: updatedCache["all"].logs.map(updateLogItem),
      };
    }
    useCacheStore.getState().setCache("subject_logs", updatedCache);
    ```
  - In `fetchLogsData`: overlays pending offline marks from `useOfflineStore.getState().queue` in reverse order over `rawLogs`.

### 1.6 `client/src/pages/attendance/CalendarPage.tsx` (lines 79–105)
- **Code Change**:
  - Scoped `pendingMarks` by `monthStr` and valid retries (`< 3`).
  - Preserves both `details` AND `days` cells:
    ```typescript
    if (pendingMarks.length > 0) {
      const calCache = cachedData?.[monthStr];
      if (calCache) {
        if (calCache.details) {
          d = { ...d, details: { ...(d.details || {}), ...calCache.details } };
        }
        if (calCache.days) {
          if (Array.isArray(d.days) && Array.isArray(calCache.days)) {
            d = { ...d, days: [...d.days, ...calCache.days] };
          } else {
            d = { ...d, days: { ...(d.days || {}), ...calCache.days } };
          }
        }
      }
    }
    ```

### 1.7 `server/src/services/attendance.service.ts` (lines 210–235)
- **Code Change**:
  - Differentiates real UUIDs from client-generated temporary IDs (`temp-` or `optimistic-`):
    ```typescript
    const isTempId = typeof data.attendanceId === 'string' && (
      data.attendanceId.startsWith("temp-") || 
      data.attendanceId.startsWith("optimistic-")
    );

    if (data.attendanceId && !isTempId) {
      const deleteResult = await prisma.attendance.deleteMany({
        where: { id: data.attendanceId, userId }
      });
      if (deleteResult.count > 0) {
        return { message: "Attendance cleared", count: deleteResult.count, status: "not_marked" };
      }
    }

    const deleteResult = await prisma.attendance.deleteMany({
      where: {
        userId,
        subjectId: data.subjectId,
        date: targetDate,
        ...(data.timetableSlotId ? { timetableSlotId: data.timetableSlotId } : {}),
        ...(data.overrideId ? { overrideId: data.overrideId } : {}),
      }
    });
    ```

### 1.8 `client/src/stores/assignmentStore.ts` (lines 59–115)
- **Code Change**:
  - In `addAssignment`, constructs complete `Assignment` object preserving user fields (`title`, `description`, `deadline`, `priority`, `subjectId`) even when `res.data` is an offline queue stub `{ id: 'temp-...', _queued: true }`.
  - In `toggleCompletion`, optimistically toggles completion state immediately; catches offline background refresh errors gracefully; rolls back state only on unhandled/permanent rejection.

### 1.9 `client/src/components/sync/PeerSyncModal.tsx` (lines 137–158)
- **Code Change**:
  - On schedule import, invalidates `timetable`, `today`, `calendar`, `subject_logs`, `subjects`, and `subjects_overview` in `useCacheStore`.
  - Calls `useAttendanceStore.getState().fetchStats()` and dispatches `"attendance-updated"`.

### 1.10 Independent Tool Executions & Outputs
1. `npm run build` in `client`: Exited with code 0 (`tsc -b && vite build` passed cleanly, 4370 modules transformed).
2. `npm run build` in `server`: Exited with code 0 (`tsup ./src/server.ts --format cjs --clean` generated `dist/server.js` 244.10 KB in 125ms).
3. `npx tsx src/tests/offline_sync_verification.test.ts` in `server`: Exited with code 0, all 5 test suites passed.
4. `npx oxlint` across modified client files: 0 errors reported.

---

## 2. Logic Chain

1. **Payload Extraction & Queue Safety** (Observation 1.1, 1.2):
   - The bug where mutations enqueued `data: undefined` was caused by `JSON.parse` failing on already-parsed object payloads.
   - The fix preserves object payloads through deep cloning while supporting stringified JSON, restoring payload fidelity.
   - The removal of stale `Authorization` headers prevents token expiration failures when offline mutations flush after a session refresh.

2. **FIFO Preservation & Jam Prevention** (Observation 1.2):
   - In offline queues, continuing the flush loop after a network failure executes subsequent actions out-of-order.
   - Adding an explicit `break` upon encountering network drops (`isNetworkError`) guarantees that request $N+1$ cannot execute before request $N$, preserving causal consistency.
   - Adding a retry threshold ($\ge 3$) for 500 server errors prevents bad payloads from permanently locking the queue.

3. **Stats Scoping & Graceful Reconciliation** (Observation 1.3):
   - Previously, any pending mark permanently set `isDirty = true` and blocked statistics recalculation for all subjects across all semesters.
   - Filtering pending marks by the active semester boundaries and active subject IDs ensures that pending mutations in other semesters do not stall the active view.
   - Preserving optimistic counts solely for dirty subjects while accepting fresh server stats for clean subjects prevents stale UI without clobbering optimistic state.

4. **Multi-User Security & Clean Isolation** (Observation 1.4):
   - Previously, logging out left `'attendx-offline-queue'` in Preferences and memory, allowing User A's pending marks to replay into User B's account upon login.
   - Adding `'attendx-offline-queue'` to `keysToRemove` and explicitly calling `clearQueue()` eliminates cross-tenant data leakage.

5. **Optimistic Cache Reversion Prevention** (Observation 1.5, 1.6):
   - In `SubjectDetailPage`, optimistic UI marks were clobbered because the dispatched `attendance-updated` event triggered a re-fetch that fell back to the stale `subject_logs` cache.
   - Updating both React state and `useCacheStore.subject_logs` alongside the offline queue overlay ensures that re-fetches read the optimistic mark.
   - In `CalendarPage`, preserving both `details` and `days` badge cells prevents the calendar grid cells from reverting to stale server states during offline marks.

6. **Temporary ID Compound Resolution** (Observation 1.7):
   - Temporary IDs (`temp-...`, `optimistic-...`) do not exist in the database; attempting `deleteMany({ where: { id: tempId } })` deleted 0 rows.
   - Detecting `isTempId` and falling back to compound unique keys (`userId`, `subjectId`, `date`, `timetableSlotId`, `overrideId`) ensures the target attendance record is correctly cleared on the backend.

7. **Assignment Offline Integrity** (Observation 1.8):
   - In `assignmentStore.ts`, merging the user's input `data` with the offline queue stub `{ id: 'temp-...', _queued: true }` prevents newly created offline assignments from displaying with empty/missing properties.
   - Optimistic completion toggling with rollback on genuine errors ensures seamless offline task management.

8. **Peer Sync Cache Invalidation** (Observation 1.9):
   - Clearing cached queries (`timetable`, `today`, `calendar`, `subject_logs`, `subjects`, `subjects_overview`) and dispatching `attendance-updated` prevents stale timetable views from persisting after importing a peer schedule.

---

## 3. Adversarial & Integrity Audit

### 3.1 Integrity Audit (Zero Violations)
- **Hardcoded Test Outputs**: Verified. No dummy return values or hardcoded test expectations exist in source files.
- **Facade Implementations**: Verified. All implementations perform actual state mutations, cache updates, database queries, and queue processing.
- **Shortcuts / Bypasses**: Verified. No external delegators or shortcuts were used; all 9 target areas were addressed directly in the codebase.
- **Verification Authenticity**: Independently verified by running `npm run build` (client & server), `oxlint`, and `offline_sync_verification.test.ts`. All completed successfully with exit code 0.

### 3.2 Adversarial Stress Testing
1. **Circular Queue Flushes**:
   - *Test*: Does `flushQueue` re-enqueue failing requests into an infinite loop?
   - *Result*: No. Requests dispatched in `flushQueue` pass `'X-Offline-Retry': 'true'`. The response interceptor in `api.ts` explicitly ignores requests where `originalRequest.headers['X-Offline-Retry']` is present, rejecting them cleanly into `flushQueue`'s catch block.
2. **500 Server Error Flooding**:
   - *Test*: What if an offline action triggers a permanent 500 error (e.g. unique constraint collision)?
   - *Result*: The request increments `retryCount` on each flush attempt. Once `retryCount >= 3`, it is dequeued with an error toast, preventing permanent queue deadlock.
3. **Compound Deletion Fallback**:
   - *Test*: What if a user creates an attendance mark offline (`temp-` ID) and subsequently clears it before reconnecting?
   - *Result*: The queue flushes the create request first (strict FIFO), inserting the DB record. The subsequent delete request recognizes `isTempId`, bypasses the temporary ID lookup, matches on `(userId, subjectId, date, timetableSlotId)`, and deletes the newly created record.

---

## 4. Caveats

1. **Native Sleep Network State Transitions**:
   - The client queue currently triggers on browser `online` events and Axios network error catches. While effective in standard Web and Android WebView foreground usage, testing background-to-foreground transitions with `@capacitor/network` may be explored in later milestones.
2. **Sequential Queue Flush vs Batch Mutation Endpoint**:
   - Offline marks replay sequentially in strict FIFO order. While this guarantees causal consistency, a dedicated server endpoint (`POST /attendance/batch`) could be introduced in a future release to enable atomic multi-mark transactions.

---

## 5. Conclusion

**Verdict**: **APPROVE**

Worker M1's implementations for Milestone M1 (Offline-Sync & Store Race Conditions) are correct, comprehensive, well-architected, and free of regressions or integrity violations. All 9 defects identified in the requirements and survey have been completely resolved. Both `client` and `server` compile cleanly with zero errors, and all automated verification checks pass.

---

## 6. Verification Method

To independently reproduce and verify this review:

1. **Client Build Verification**:
   ```powershell
   cd c:\Users\Raina\OneDrive\Desktop\AttendX\client
   npm run build
   ```
   *Expected*: Exit code 0 (`tsc -b && vite build` succeeds).

2. **Server Build Verification**:
   ```powershell
   cd c:\Users\Raina\OneDrive\Desktop\AttendX\server
   npm run build
   ```
   *Expected*: Exit code 0 (`tsup ./src/server.ts --format cjs --clean` succeeds).

3. **Automated Verification Test Suite**:
   ```powershell
   cd c:\Users\Raina\OneDrive\Desktop\AttendX\server
   npx tsx src/tests/offline_sync_verification.test.ts
   ```
   *Expected*: All 5 test suites pass with exit code 0.

4. **Client Lint Verification**:
   ```powershell
   cd c:\Users\Raina\OneDrive\Desktop\AttendX\client
   npx oxlint src/lib/api.ts src/stores/offlineStore.ts src/stores/attendanceStore.ts src/stores/authStore.ts src/pages/subjects/SubjectDetailPage.tsx src/pages/attendance/CalendarPage.tsx src/stores/assignmentStore.ts src/components/sync/PeerSyncModal.tsx
   ```
   *Expected*: 0 errors.

5. **Files Inspected**:
   - `client/src/lib/api.ts` (lines 213–248)
   - `client/src/stores/offlineStore.ts` (lines 8–105, 144–149)
   - `client/src/stores/attendanceStore.ts` (lines 14–248)
   - `client/src/stores/authStore.ts` (lines 68–95)
   - `client/src/pages/subjects/SubjectDetailPage.tsx` (lines 191–215, 304–338)
   - `client/src/pages/attendance/CalendarPage.tsx` (lines 79–105)
   - `server/src/services/attendance.service.ts` (lines 210–235)
   - `client/src/stores/assignmentStore.ts` (lines 59–115)
   - `client/src/components/sync/PeerSyncModal.tsx` (lines 137–158)
