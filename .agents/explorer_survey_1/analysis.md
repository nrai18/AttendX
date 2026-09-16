# AttendX Offline Sync & Store Race Conditions Audit Report (R1)

**Working Directory**: `.agents/explorer_survey_1`  
**Focus Area**: Requirement R1 — Offline-Sync Race Conditions, Zustand Stores, API Interceptors, Optimistic UI Overwrites, and Backend Synchronization  
**Audit Date**: 2026-09-19  
**Investigator**: Survey Explorer 1  

---

## Executive Summary

A deep audit of the AttendX offline synchronization engine, Zustand store architectures (`attendanceStore`, `offlineStore`, `cacheStore`, `authStore`, `assignmentStore`, `syncStore`), Axios interceptors, page components (`TodayPage`, `CalendarPage`, `SubjectDetailPage`, `TimetablePage`, `SubjectsPage`, `AssignmentsPage`, `PeerSyncModal`), and backend controllers/services revealed **15 distinct race conditions, data loss bugs, and state corruption vectors**.

The most critical vulnerabilities include:
1. **Total Payload Loss on Offline Mutations**: A fatal `JSON.parse` bug in `client/src/lib/api.ts` turns all JSON request payloads into `undefined`, causing the backend to reject all offline marks with `400 Bad Request` and silently drop them forever.
2. **Permanent Queue Jam & Stats Freeze**: 500 errors (caused by Prisma unique constraint violations) are never dequeued from `offlineStore`. Because the queue never clears, `attendanceStore` permanently flags itself as `isDirty`, permanently refusing to accept fresh attendance statistics from the server.
3. **Cross-User Session Queue Leak**: Logging out fails to purge `attendx-offline-queue`, allowing User A's offline attendance mutations to synchronize into User B's account upon reconnect.
4. **Optimistic UI Clobbering in `SubjectDetailPage` & `CalendarPage`**: Missing cache synchronization and un-scoped dirty queue checks cause stale local or server caches to immediately overwrite optimistic UI updates.
5. **PostgreSQL NULL Constraint Failure & Duplicate Class Spawning**: `@@unique([userId, subjectId, date, timetableSlotId])` does not enforce uniqueness when `timetableSlotId` is `NULL` (extra lectures/manual marks), allowing concurrent or retried offline requests to spawn duplicate attendance records.

---

## Detailed Vulnerability Analysis

---

### 1. Fatal Payload Destruction in Axios Offline Mutation Interceptor
- **File**: `client/src/lib/api.ts`
- **Lines**: 205–228
- **Code Snippet**:
```typescript
// client/src/lib/api.ts:212-228
let parsedData = undefined;
try { parsedData = originalRequest.data ? JSON.parse(originalRequest.data) : undefined; } catch(e) {}

useOfflineStore.getState().enqueue({
   method: originalRequest.method,
   url: originalRequest.url,
   data: parsedData,
   headers: originalRequest.headers
});

import("sonner").then(({ toast }) => {
  toast.success("Saved offline. Will sync when reconnected.", { id: "offline-save" });
});

return Promise.resolve({ data: { id: 'temp-' + Date.now(), _queued: true } });
```
- **Root Cause**: When calling mutations like `api.post("/attendance/mark", { subjectId, date, status })`, `originalRequest.data` is an object. `JSON.parse(originalRequest.data)` attempts to parse `String(originalRequest.data)` (`"[object Object]"`), which throws a `SyntaxError`. The catch block swallows this and assigns `parsedData = undefined`. The offline queue persists `data: undefined`.
- **Failure Scenario**:
  1. User marks attendance while offline.
  2. The action is enqueued with `data: undefined`.
  3. In `TodayPage.tsx` line 326: `const pendingMarks = queue.filter(q => q.url.includes("/attendance/mark") && q.data?.date === targetDateStr)`. Because `q.data` is undefined, `pendingMarks` is `[]`. The protection against stale server responses immediately fails, and the optimistic UI is wiped out on the next GET request.
  4. When reconnected, `flushQueue()` sends `POST /attendance/mark` with empty body `{}`.
  5. The server responds with `400 Bad Request: "subjectId, date, and status are required"`.
  6. `offlineStore.ts` line 84 drops 4xx errors. The request is deleted and lost forever without any user feedback.
- **Proposed Fix Strategy**:
```typescript
let parsedData = originalRequest.data;
if (typeof parsedData === "string") {
  try { parsedData = JSON.parse(parsedData); } catch (e) { /* keep as string */ }
}
```

---

### 2. Out-of-Order Queue Execution on Transient Failures
- **File**: `client/src/stores/offlineStore.ts`
- **Lines**: 70–90
- **Code Snippet**:
```typescript
// Process in order
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
- **Root Cause**: When an HTTP request encounters a network timeout or 5xx server error, it is caught in the `catch` block, logged, and NOT dequeued. Crucially, the `for` loop does NOT `break`; it continues to execute the next requests in the queue.
- **Failure Scenario**:
  1. Queue contains `[Req1: Mark Present, Req2: Mark Absent]`.
  2. `Req1` times out due to spotty cell service.
  3. Cell service reconnects 400ms later. `Req2` executes and succeeds on the backend.
  4. Later, `flushQueue()` runs again and executes `Req1`.
  5. The user's final state on the backend is "Present" instead of "Absent".
- **Proposed Fix Strategy**: If `err` is a connection error or 5xx, STOP the queue loop immediately (`break;`). Retain strict FIFO causality.

---

### 3. Permanent 500 Queue Poisoning and Frozen Stats
- **File**: `client/src/stores/offlineStore.ts` (line 84), `client/src/stores/attendanceStore.ts` (lines 149–165)
- **Code Snippet**:
```typescript
// offlineStore.ts:84
if (err.response && err.response.status >= 400 && err.response.status < 500 && err.response.status !== 401 && err.response.status !== 429) {
   dequeue(req.id);
}

// attendanceStore.ts:149-152
const pendingMarks = useOfflineStore.getState().queue.filter(q => q.url.includes("/attendance/mark"));
const isDirty = pendingMarks.length > 0;

if (statsRes.status === 'fulfilled' && !isDirty) { ... }
```
- **Root Cause**: `offlineStore` only drops 4xx errors (excluding 401 and 429). If the backend returns 500 (e.g. Prisma unique key violation `P2002`, uncaught database exception), the request is never dequeued. There is no `retryCount` limit.
- **Failure Scenario**:
  1. A duplicate or conflicting request generates a 500 error on the server.
  2. The poisoned request remains in `queue` forever.
  3. Every subsequent sync attempts the request, gets 500, and leaves it in `queue`.
  4. `pendingMarks.length > 0` remains permanently `true`.
  5. `attendanceStore.fetchStats()` permanently ignores fresh server stats!
- **Proposed Fix Strategy**:
  1. Track `retryCount` on `QueuedRequest`.
  2. If `retryCount >= 3`, dequeue or move to a `failedQueue` and alert the user.
  3. In `attendance.service.ts`, handle conflicts and wrap operations to return 409 Conflict rather than throwing unhandled 500s.

---

### 4. Cross-User Session Queue Leak on Logout
- **File**: `client/src/stores/authStore.ts`
- **Lines**: 71–89
- **Code Snippet**:
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
  set({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: false,
  });
},
```
- **Root Cause**: `attendx-offline-queue` is completely missing from `keysToRemove`. Furthermore, `useOfflineStore.getState().clearQueue()` is never invoked.
- **Failure Scenario**:
  1. Student A marks attendance offline on a shared/lab tablet or friend's phone.
  2. Student A logs out.
  3. Student B logs in on the same device.
  4. Device reconnects to the network. `offlineStore.flushQueue()` runs with Student B's active auth token.
  5. Student A's attendance actions are committed into Student B's account.
- **Proposed Fix Strategy**: Add `'attendx-offline-queue'` to `keysToRemove` and call `useOfflineStore.getState().clearQueue()` in `logout()`.

---

### 5. Stale Transport Headers Clashing with Fresh Tokens
- **File**: `client/src/stores/offlineStore.ts`
- **Lines**: 74–79
- **Code Snippet**:
```typescript
await api.request({
  method: req.method,
  url: req.url,
  data: req.data,
  headers: { ...req.headers, 'X-Offline-Retry': 'true' },
});
```
- **Root Cause**: `req.headers` contains the original headers at time of enqueue, including the stale, expired `Authorization: Bearer <old_token>`. When spreading `...req.headers`, Axios applies this expired token, overriding or interfering with the refreshed token attached by `api.interceptors.request`.
- **Proposed Fix Strategy**: Strip volatile headers (`Authorization`, `Host`, `Content-Length`, `User-Agent`) when enqueuing, and let the Axios request interceptor attach the current valid `Authorization` token at execution time.

---

### 6. Missing Hydration Gate in `offlineStore`
- **File**: `client/src/stores/offlineStore.ts` (lines 39–106), `client/src/App.tsx` (lines 27–37)
- **Code Snippet**:
```typescript
// App.tsx:31
if (isLoading || !authHydrated || !attHydrated || !cacheHydrated) { ... }
```
- **Root Cause**: `offlineStore` uses asynchronous `@capacitor/preferences` storage but does not expose a `_hasHydrated` boolean or `onRehydrateStorage` callback.
- **Failure Scenario**: On cold start, `offlineStore.getState().queue` is `[]`. `TodayPage` and `attendanceStore` mount and query `queue.length` before Capacitor finishes reading `attendx-offline-queue` from disk. `isDirty` evaluates to `false`, allowing stale initial GET responses to overwrite unsynced local mutations.
- **Proposed Fix Strategy**: Add `_hasHydrated` and `onRehydrateStorage` to `offlineStore.ts`, and add `offlineHydrated` to the guard in `App.tsx`.

---

### 7. Optimistic UI Reversion in `SubjectDetailPage.tsx`
- **File**: `client/src/pages/subjects/SubjectDetailPage.tsx`
- **Lines**: 248–255, 288–311
- **Code Snippet**:
```typescript
// lines 288-307
setLogs((prev) => prev.map(...));
await api.post("/attendance/mark", ...);
window.dispatchEvent(new Event("attendance-updated"));

// lines 248-254
const handleUpdate = () => {
  fetchLogsData();
};
window.addEventListener("attendance-updated", handleUpdate);
```
- **Root Cause**: `handleMarkAttendance` updates local state `logs`, but does NOT update `useCacheStore.getState().subject_logs`. It then dispatches `attendance-updated`. Its own listener triggers `fetchLogsData()`.
- **Failure Scenario**: In offline mode, `fetchLogsData()` network request fails, catches error, and falls back to `useCacheStore.getState().subject_logs`. Because `handleMarkAttendance` never updated `subject_logs`, the stale cache is reloaded and calls `setLogs(rawLogs)`, instantly wiping out the optimistic update.
- **Proposed Fix Strategy**: Update `useCacheStore.getState().subject_logs` optimistically before firing the mutation, and check `offlineStore.queue` in `fetchLogsData()` before replacing state with cached data.

---

### 8. Stale Calendar Day Cells Clobbering in `CalendarPage.tsx`
- **File**: `client/src/pages/attendance/CalendarPage.tsx`
- **Lines**: 76–89
- **Code Snippet**:
```typescript
const res = await api.get(`/attendance/calendar?month=${monthStr}${force ? '&force=true' : ''}`);
let d = typeof res.data === 'string' ? { ... } : res.data;

const queue = useOfflineStore.getState().queue;
const pendingMarks = queue.filter(q => q.url.includes("/attendance/mark"));
if (pendingMarks.length > 0) {
    const calCache = cachedData?.[monthStr];
    if (calCache && calCache.details) {
       d = { ...d, details: { ...d.details, ...calCache.details } };
    }
}
```
- **Root Cause**: The flaky connection guard in `fetchCalendar` only preserves `d.details`, but completely ignores `d.days` (the dictionary mapping dates to status badges).
- **Failure Scenario**: When returning online, `d.days` is overwritten with the server's stale days map. Calendar dates show old colors (e.g. absent instead of present), even though clicking the date shows the updated details. Furthermore, `pendingMarks` does not filter by month, causing mutations in December to taint calendar fetches in July.
- **Proposed Fix Strategy**: Filter `pendingMarks` by `q.data?.date?.startsWith(monthStr)`, and compute/merge `d.days` optimistically from `d.details`.

---

### 9. Triple Concurrent `fetchStats()` Storm & Out-of-Order Overwrites
- **File**: `client/src/stores/attendanceStore.ts` (lines 91–121), `client/src/components/layout/AppShell.tsx` (lines 32–40), `client/src/pages/attendance/TodayPage.tsx` (lines 544–548, 762–764)
- **Root Cause**: When attendance is marked, `TodayPage` calls `fetchStats()`, then dispatches `attendance-updated`. `TodayPage`'s listener calls `fetchStats()` again. `AppShell`'s listener calls `fetchStats()` a third time. Each call makes 4 HTTP requests concurrently.
- **Failure Scenario**: 12 HTTP requests hit the server at once. Due to variable network latency, Call 1's response can arrive AFTER Call 3's response, overwriting fresh statistics with older ones.
- **Proposed Fix Strategy**:
  1. Add an in-flight deduplication promise to `fetchStats()`.
  2. Implement an incremental `requestId` counter in `attendanceStore` so stale promises cannot overwrite newer state.

---

### 10. Missing Rollback on Permanent 4xx Failures
- **File**: `client/src/stores/offlineStore.ts`
- **Lines**: 83–86
- **Root Cause**: When a queued request fails with a 4xx code (e.g. subject deleted, permission denied, validation failure), it is silently removed via `dequeue(req.id)`. No rollback event is fired, and local stores remain mutated optimistically.
- **Proposed Fix Strategy**: Emit a `sync-rejected` event with the request context, trigger store re-fetch, and notify the user with an error toast indicating the action failed validation.

---

### 11. PostgreSQL NULL Semantics & Duplicate Class Records
- **File**: `server/prisma/schema.prisma` (line 301), `server/src/services/attendance.service.ts` (lines 190–253)
- **Code Snippet**:
```prisma
@@unique([userId, subjectId, date, timetableSlotId])
```
```typescript
// attendance.service.ts:195-207
existing = await prisma.attendance.findFirst({
  where: {
    userId,
    subjectId: data.subjectId,
    date: targetDate,
    ...(data.timetableSlotId ? { OR: [{ timetableSlotId: data.timetableSlotId }, { timetableSlotId: null }] } : {}),
    ...(data.overrideId ? { OR: [{ overrideId: data.overrideId }, { overrideId: null }] } : {}),
  },
});
...
return prisma.attendance.create({ ... });
```
- **Root Cause**:
  1. In PostgreSQL, `NULL != NULL`. When `timetableSlotId` is `null` (extra lectures, manual attendance), the composite unique index does NOT prevent duplicate rows.
  2. `findFirst` followed by `create` is a non-transactional TOCTOU race.
- **Failure Scenario**: Rapid double-tapping or offline queue retries insert multiple rows for the same subject and date. In `getTodayAgenda`, each orphan attendance record spawns a new extra lecture card, distorting total classes and attendance percentage.
- **Proposed Fix Strategy**: Enforce single-flight upsert or database transaction with serializable isolation, and handle `timetableSlotId: null` explicitly.

---

### 12. Zombie Records Due to Fake `temp-...` IDs
- **File**: `client/src/lib/api.ts` (line 227), `server/src/services/attendance.service.ts` (lines 211–215)
- **Code Snippet**:
```typescript
// api.ts:227
return Promise.resolve({ data: { id: 'temp-' + Date.now(), _queued: true } });

// attendance.service.ts:211-215
if (data.status === "not_marked" || data.status === "clear") {
  if (data.attendanceId) {
    const deleteResult = await prisma.attendance.deleteMany({
      where: { id: data.attendanceId }
    });
    return { message: "Attendance cleared", count: deleteResult.count, status: "not_marked" };
  }
```
- **Root Cause**: The client assigns `item.attendanceId = "temp-..."`. If the user clears attendance while offline or before the real ID is received, the client sends `attendanceId: "temp-..."`. The server deletes `where: { id: data.attendanceId }`, which deletes 0 rows and returns success without clearing the real record.
- **Proposed Fix Strategy**: In `attendance.service.ts`, if `data.attendanceId` starts with `temp-` or `optimistic-`, or if `deleteResult.count === 0`, fall back to deleting by `userId, subjectId, date, timetableSlotId, overrideId`.

---

### 13. Blank Assignment Cards on Offline Creation
- **File**: `client/src/stores/assignmentStore.ts`
- **Lines**: 59–82
- **Code Snippet**:
```typescript
addAssignment: async (data) => {
  try {
    const res = await api.post("/assignments", data);
    set({ assignments: [...get().assignments, res.data] });
  } catch (err) { ... }
},
toggleCompletion: async (id) => {
  try {
    await api.post(`/assignments/${id}/toggle`);
    await get().fetchAssignments();
  } catch (err) { ... }
}
```
- **Root Cause**: `api.post` returns `{ id: 'temp-...', _queued: true }`. `addAssignment` appends this bare object, stripping `title`, `deadline`, and `description`. `toggleCompletion` has no optimistic toggle and depends on `fetchAssignments()`, which fails offline.
- **Proposed Fix Strategy**: Merge `data` with `res.data` in `addAssignment`, and optimistically toggle completion in `toggleCompletion`.

---

### 14. Un-debounced Rapid Double-Tap on Status Buttons
- **File**: `client/src/pages/attendance/TodayPage.tsx`
- **Lines**: 1139–1171
- **Root Cause**: Buttons lack `disabled` states and debounce guards. Users double-tapping dispatch multiple parallel mutations, queuing duplicates.
- **Proposed Fix Strategy**: Maintain an in-flight set `markingItemIds: Set<string>` and disable buttons while mutations are processing.

---

### 15. Stale Cache Persistence on Peer Timetable Import
- **File**: `client/src/components/sync/PeerSyncModal.tsx`
- **Lines**: 135–151
- **Root Cause**: After importing a timetable via `/timetable/import/:id`, `useCacheStore`'s `timetable`, `today`, and `calendar` keys are not invalidated, and `"attendance-updated"` is not emitted.
- **Failure Scenario**: The user successfully mirrors a peer's timetable, but the application continues displaying the previous semester schedule from cache.
- **Proposed Fix Strategy**: Clear `timetable`, `today`, and `calendar` in `useCacheStore` and dispatch `"attendance-updated"`.

---

## Verification & Independent Audit Methods

1. **Bug 1 (Payload Loss)**:
   - In browser DevTools Network tab, set status to "Offline".
   - Mark an attendance slot on `/today`.
   - Inspect `Preferences` or `localStorage.getItem("attendx-offline-queue")`.
   - Notice `data` is `undefined`.
   - Set status to "Online" and observe `POST /attendance/mark` payload is empty `{}` and returns HTTP 400.
2. **Bug 3 (Out-of-Order Execution)**:
   - Queue two marks offline: Slot A (Mark Present), Slot B (Mark Absent).
   - Mock a network error on Slot A.
   - Observe Slot B is processed and dequeued while Slot A remains, reversing execution order.
3. **Bug 4 (Permanent 500 Jam)**:
   - Send an invalid payload that triggers a 500 on the server.
   - Observe `queue` retains the item forever and `attendanceStore.isDirty` remains true indefinitely.
4. **Bug 9 (Logout Queue Leak)**:
   - Queue an offline mark under User A.
   - Call `useAuthStore.getState().logout()`.
   - Read `Preferences.get({ key: 'attendx-offline-queue' })`. Observe it is NOT empty.
