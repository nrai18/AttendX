# Handoff Report — Challenger M1-2 (Adversarial Stress Tester)

**Milestone**: M1 (Offline-Sync & Store Race Conditions)  
**Agent**: Challenger M1-2  
**Role**: Empirical Challenger (critic, specialist)  
**Date**: 2026-09-19  
**Verdict**: **`APPROVE`**  

---

## 1. Observation

Direct empirical investigation and adversarial execution across the codebase revealed the following verified behaviors:

1. **`SubjectDetailPage.tsx` Rapid Toggling & Offline Overlay**:
   - Lines 306–331 update local state `logs` and both `querySubject` and `"all"` caches in `useCacheStore`.
   - Lines 195–209 in `fetchLogsData`:
     ```typescript
     const queue = useOfflineStore.getState().queue;
     const pendingMarks = queue.filter((q) => q.url.includes("/attendance/mark"));
     if (pendingMarks.length > 0) {
       rawLogs = rawLogs.map((l) => {
         const match = pendingMarks.slice().reverse().find((q) =>
           (q.data?.attendanceId && q.data.attendanceId === l.id) ||
           (q.data?.date === l.date && q.data?.subjectId === l.subjectId &&
            q.data?.timetableSlotId === l.timetableSlotId && q.data?.overrideId === l.overrideId)
         );
         if (match && match.data?.status) {
           return { ...l, status: match.data.status };
         }
         return l;
       });
     }
     ```
   - Direct execution in `challenger_stress_test.ts` confirmed that during rapid-fire clicks (`present -> absent -> present -> off`), the reverse find (`slice().reverse().find(...)`) guarantees the latest queued user intent wins, preventing any clobbering by intermediate stale GET responses.

2. **`CalendarPage.tsx` Optimistic Preservation & Month Scoping**:
   - Lines 79–102:
     ```typescript
     const queue = useOfflineStore.getState().queue;
     const pendingMarks = queue.filter(q => 
       q.url.includes("/attendance/mark") &&
       (q.data?.date ? q.data.date.startsWith(monthStr) : true) &&
       (q.retryCount || 0) < 3
     );
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
   - Empirical stress tests confirmed that:
     - Stale server calendar GETs do not overwrite optimistic day cells or details.
     - Marks belonging to other months (e.g. October) do not accidentally preserve September cache.
     - Marks with exhausted retries (`retryCount >= 3`) are safely ignored, preventing frozen optimistic states.

3. **`assignmentStore.ts` Offline Additions & Toggle State Machine**:
   - Lines 59–78 in `addAssignment` properly construct full `Assignment` objects merging default fields, `res.data`, and user payload (`title`, `description`, `deadline`, `priority`).
   - Lines 91–126 in `toggleCompletion` toggle state immediately via local completions array (`[{ id: temp-..., ... }]` <-> `[]`), gracefully catch network errors without reverting, and only roll back upon genuine fatal API failures.
   - Empirical tests verified 100% state consistency across rapid toggle cycles.

4. **`offlineStore.ts` FIFO Causality & 500 Unjamming**:
   - Lines 98–107 break execution immediately upon network error, preserving strict FIFO ordering.
   - Lines 117–131 track retry count for server errors (`>= 500`); upon reaching 3 retries, poisoned requests are dequeued with a toast notification, allowing downstream requests to proceed.

5. **`attendance.service.ts` Temp ID Resolution**:
   - Lines 210–235 inspect `attendanceId` for prefix `temp-` or `optimistic-`; when detected or when deletion count is 0, the query falls back to composite deletion criteria (`userId`, `subjectId`, `date`, `timetableSlotId`, `overrideId`), reliably clearing offline-created records.

6. **Build & Lint Verification**:
   - `client` build (`tsc -b && vite build`): Exit code 0, 0 compilation errors.
   - `server` build (`tsup ./src/server.ts --format cjs --clean`): Exit code 0, bundled in 105ms.
   - Automated test suite (`server/src/tests/offline_sync_verification.test.ts`): 5 of 5 suites passed.
   - Challenger adversarial test suite (`server/src/tests/challenger_stress_test.ts`): 6 of 6 suites passed.
   - `oxlint` check: 0 errors on all modified files.

---

## 2. Logic Chain

1. **Hypothesis: Rapid clicking on SubjectDetailPage could result in out-of-order state or overwrite cache with stale records.**
   - *Test*: Created test harness simulating millisecond-spaced clicks changing status between present, absent, and off.
   - *Finding*: Because `handleMarkAttendance` immediately writes to `logs`, `useCacheStore.getState().subject_logs[id]`, and `useCacheStore.getState().subject_logs["all"]`, the UI updates synchronously. When offline fallback runs, `pendingMarks.slice().reverse().find(...)` searches from newest to oldest queued mutation, guaranteeing the latest user intent is preserved.
   - *Deduction*: Concurrency resilience holds under rapid interactions.

2. **Hypothesis: CalendarPage could clobber optimistic state or cross-contaminate months.**
   - *Test*: Constructed adversarial scenario with stale server GET payload returning empty details and `"off"` badges while the client had pending marks. Tested cross-month scoping and retry exhaustion.
   - *Finding*: Scoping to `monthStr` and checking `(q.retryCount || 0) < 3` prevents cross-month contamination and zombie preservation. Merging both `details` and `days` preserves the user's optimistic badge.
   - *Deduction*: CalendarPage is robust against stale server responses.

3. **Hypothesis: Assignment store offline additions lose metadata or fail on toggle.**
   - *Test*: Simulated multiple rapid additions and 3-cycle toggle flips (`unfinished -> finished -> unfinished -> finished`) under simulated offline conditions.
   - *Finding*: Full assignment fields (`title`, `description`, `priority`, `deadline`) are retained. Optimistic toggling succeeds offline and cleanly rolls back if a fatal rejection occurs.
   - *Deduction*: Assignment store offline state machine is sound.

4. **Hypothesis: Queue flush could violate FIFO order or jam on 500 errors.**
   - *Test*: Flushed a multi-item queue under simulated transient network drops and repeated 500 errors.
   - *Finding*: Network error triggers an immediate `break`, preventing request $N+1$ from executing before request $N$. At retry count 3, the poisoned 500 error request is dropped and remaining items execute.
   - *Deduction*: Strict causality and jam prevention are guaranteed.

---

## 3. Caveats

- **Native Network State Transitions**: In production Android WebViews, network state transitions are listened to via `window.addEventListener('online')` and Axios interceptors. If an app is backgrounded while the network transitions, synchronization resumes when the app returns to foreground.
- **Batch Endpoint Optimization**: Although sequential FIFO queue playback is causality-safe and retry-bounded, a future milestone could consider a batch sync endpoint (`POST /attendance/batch`) to reduce HTTP request overhead when reconnecting with large queues.

---

## 4. Conclusion

**Verdict: `APPROVE`**

Worker M1's implementations for Milestone M1 (Offline-Sync & Store Race Conditions) are structurally sound, concurrency-resilient, and empirically verified. All 6 adversarial stress test suites passed without a single failure or regression. The build succeeds cleanly across both client and server targets.

---

## 5. Verification Method

### 1. Execute Adversarial Stress Test Suite
```powershell
cd c:\Users\Raina\OneDrive\Desktop\AttendX\server
npx tsx src/tests/challenger_stress_test.ts
```
*Expected Output*: Exit code 0, 6 of 6 suites passed.

### 2. Execute Worker M1 Verification Suite
```powershell
cd c:\Users\Raina\OneDrive\Desktop\AttendX\server
npx tsx src/tests/offline_sync_verification.test.ts
```
*Expected Output*: Exit code 0, 5 of 5 suites passed.

### 3. Production Compilation Checks
```powershell
# Client TypeScript & Vite bundle
cd c:\Users\Raina\OneDrive\Desktop\AttendX\client
npm run build

# Server tsup CommonJS bundle
cd c:\Users\Raina\OneDrive\Desktop\AttendX\server
npm run build
```
*Expected Output*: Both commands exit with code 0.
