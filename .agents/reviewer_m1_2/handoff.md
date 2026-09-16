# Handoff Report — Reviewer M1-2 (Milestone M1 Code Review & Adversarial Audit)

**Task**: High-Reliability Code Review & Adversarial Audit of Milestone M1 (Offline-Sync & Store Race Conditions)  
**Agent**: Reviewer M1-2  
**Roles**: Reviewer, Adversarial Critic  
**Date**: 2026-09-19  
**Verdict**: **APPROVE**  

---

## 1. Observation

Direct inspection of code diffs, compiler runs, and test executions confirmed the following facts:

1. **Client Build Cleanliness**:
   - Command: `npm run build` in `c:\Users\Raina\OneDrive\Desktop\AttendX\client` (`tsc -b && vite build`)
   - Result: Exit code 0.
   - Vite compiled 4,370 modules cleanly into `dist/assets/index-C-ZMlnQb.js` and assets.

2. **Server Build Cleanliness**:
   - Command: `npm run build` in `c:\Users\Raina\OneDrive\Desktop\AttendX\server` (`tsup ./src/server.ts --format cjs --clean`)
   - Result: Exit code 0.
   - CommonJS bundle `dist/server.js` (244.10 KB) compiled successfully in 81ms without module resolution or syntax errors.

3. **Automated Verification Test Suite**:
   - Command: `npx tsx src/tests/offline_sync_verification.test.ts` in `c:\Users\Raina\OneDrive\Desktop\AttendX\server`
   - Result: Exit code 0.
   - All 5 test suites passed:
     - `✓ Payload Extraction & Header Sanitization passed!`
     - `✓ Strict FIFO and Retry / 500 Unjamming passed!`
     - `✓ Attendance Stats Scoped isDirty & Graceful Reconciliation passed!`
     - `✓ Backend Temp ID Deletion Resolution passed!`
     - `✓ Assignment Store Optimistic State & Toggle passed!`

4. **Lint Status on Modified Files**:
   - Command: `npx oxlint src/lib/api.ts src/stores/offlineStore.ts src/stores/attendanceStore.ts src/stores/authStore.ts src/pages/subjects/SubjectDetailPage.tsx src/pages/attendance/CalendarPage.tsx src/stores/assignmentStore.ts src/components/sync/PeerSyncModal.tsx` in `client`
   - Result: Exit code 0, 0 errors.

5. **Code Implementations Inspected Directly**:
   - **`client/src/lib/api.ts` (lines 213–248)**:
     ```typescript
     let parsedData: any = originalRequest.data;
     if (typeof parsedData === "string") {
       try { parsedData = JSON.parse(parsedData); } catch (e) {}
     } else if (parsedData && typeof parsedData === "object") {
       try { parsedData = JSON.parse(JSON.stringify(parsedData)); } catch (e) { parsedData = { ...parsedData }; }
     }
     ```
     Volatile transport headers (`Authorization`, `x-offline-retry`, `content-length`) are explicitly stripped before enqueuing.
   - **`client/src/stores/offlineStore.ts` (lines 72–134)**:
     On network error (`!err.response || err.message === 'Network Error' || [502, 503, 504].includes(status)`), updates `retryCount` and calls `break;` immediately, ensuring request $N+1$ never executes out of order.
     On unrecoverable 500 server errors, limits retries to 3; once `currentRetries >= 3`, dequeues with `toast.error()`, preventing permanent queue blockades.
   - **`client/src/stores/attendanceStore.ts` (lines 165–235)**:
     Scopes `pendingMarks` strictly to marks matching the active semester ID, subjects within the active semester, or semester date ranges, filtering out retries $\ge 3$.
     Reconciles statistics gracefully: preserves optimistic counts only for subjects with pending marks in the active semester, while accepting fresh server data for clean subjects.
   - **`client/src/stores/authStore.ts` (lines 71–86)**:
     Purges `'attendx-offline-queue'` from both Capacitor Preferences and `localStorage` on `logout()`, and explicitly executes `useOfflineStore.getState().clearQueue()`.
   - **`client/src/pages/subjects/SubjectDetailPage.tsx` (lines 194–209, 306–331)**:
     In `handleMarkAttendance`, optimistically updates both component state and `useCacheStore.getState().subject_logs` (for specific subject and "all").
     In `fetchLogsData` offline fallback, overlays pending offline marks from `useOfflineStore.getState().queue` onto `rawLogs`.
   - **`client/src/pages/attendance/CalendarPage.tsx` (lines 79–102)**:
     Scopes `pendingMarks` check to `monthStr` and retries $< 3$.
     Merges both `details` and `days` badge cells from `calCache` onto the calendar state.
   - **`server/src/services/attendance.service.ts` (lines 211–235)**:
     Evaluates `isTempId = data.attendanceId.startsWith("temp-") || data.attendanceId.startsWith("optimistic-")`.
     If real ID, deletes by `{ id: data.attendanceId, userId }`. If deleted == 0 or temp ID, falls back to deleting by compound criteria `{ userId, subjectId, date: targetDate, ...(timetableSlotId/overrideId) }`.
   - **`client/src/stores/assignmentStore.ts` (lines 59–122)**:
     In `addAssignment`, constructs a full `Assignment` object preserving user input (`title`, `description`, `deadline`, `priority`).
     In `toggleCompletion`, optimistically toggles `completions` immediately, handling offline network errors without reverting state.
   - **`client/src/components/sync/PeerSyncModal.tsx` (lines 142–152)**:
     Invalidates `timetable`, `today`, `calendar`, `subject_logs`, `subjects`, and `subjects_overview` in `useCacheStore` upon schedule mirror, refreshes stats, and dispatches `"attendance-updated"`.

---

## 2. Logic Chain

1. **Integrity Verification**:
   - Every modified line was compared against raw baseline source files.
   - No hardcoded test responses, dummy stubs, bypasses, or fake mocks were found in the codebase. All logic branches execute dynamic operations on runtime data.
   - Result: No integrity violations detected.

2. **Causality & Concurrency in Queue Synchronization**:
   - In `offlineStore.ts`, the loop processes requests sequentially. If request $N$ encounters a network failure, the loop breaks immediately. Because subsequent iterations are aborted, request $N+1$ is never sent before $N$, preserving strict causal FIFO ordering.
   - The queue is guarded by `isSyncing = true` at entry, preventing concurrent execution from redundant network events.
   - Header stripping ensures expired tokens are not resent; the Axios request interceptor attaches the currently active token dynamically.

3. **Data Loss & UI Glitch Elimination**:
   - In `api.ts`, branching on `typeof originalRequest.data` prevents `JSON.parse` from throwing on JavaScript objects, ensuring the actual payload is preserved in `enqueue()`.
   - In `SubjectDetailPage.tsx` and `CalendarPage.tsx`, optimistic store caches (`subject_logs`, `calendar.days`, `calendar.details`) are updated synchronously with user interactions, preventing background re-fetches from flashing or reverting state during offline periods.
   - In `assignmentStore.ts`, assigning a temporary ID while keeping all user fields prevents assignments from rendering as blank cards offline.

4. **Backend Compound Resolution**:
   - When clearing attendance for an item marked offline, the client does not yet possess the server-generated primary key. Falling back to the composite key (`userId`, `subjectId`, `date`, `timetableSlotId`, `overrideId`) ensures the correct attendance row is deleted from the PostgreSQL database once synced.

5. **Invariants Compliance**:
   - `AGENTS.md` rules strictly respected: no automatic `git commit` or `git push` executed; no files deleted; no global CSS overrides in `index.css`; no deprecated GenAI models referenced; and CommonJS build compatibility maintained in `server`.

---

## 3. Caveats

- **WebView Lifecycle & Network State**: The frontend relies on `window.addEventListener('online')` and Axios error triggers for queue flushing. While sufficient for in-app browser sessions, background OS transitions when the app is suspended can be augmented in a future milestone by integrating native listeners from `@capacitor/network`.
- **Pre-existing Oxlint Warnings**: Running a full-repository `oxlint` reveals 2 pre-existing hook order errors in `HolidayIconRenderer.tsx` and `EventWizardModal.tsx`. These files were not part of M1 and do not affect the client TypeScript build (`tsc -b` passes with 0 errors).

---

## 4. Conclusion

**Verdict**: **APPROVE**

Worker M1's modifications for Milestone M1 (Defects 1–9) have been independently inspected, executed, and validated. The implementations are genuine, robust, and correctly resolve all offline-sync race conditions, store locks, and optimistic UI regressions without introducing side effects.

---

## 5. Verification Method

To independently reproduce the verification:

1. **Verify Client Compilation**:
   ```powershell
   cd c:\Users\Raina\OneDrive\Desktop\AttendX\client
   npm run build
   ```
   *Expected*: Exit code 0 (`tsc -b && vite build` succeeds).

2. **Verify Server Compilation**:
   ```powershell
   cd c:\Users\Raina\OneDrive\Desktop\AttendX\server
   npm run build
   ```
   *Expected*: Exit code 0 (`tsup` bundles `dist/server.js` in <100ms).

3. **Execute Behavioral Verification Test Suite**:
   ```powershell
   cd c:\Users\Raina\OneDrive\Desktop\AttendX\server
   npx tsx src/tests/offline_sync_verification.test.ts
   ```
   *Expected*: All 5 test suites pass with `ALL 5 OFFLINE-SYNC & RACE CONDITION VERIFICATION TESTS PASSED!`.

4. **Inspect Source Diffs**:
   - `client/src/lib/api.ts` (lines 213–248)
   - `client/src/stores/offlineStore.ts` (lines 72–134)
   - `client/src/stores/attendanceStore.ts` (lines 165–235)
   - `client/src/stores/authStore.ts` (lines 71–86)
   - `client/src/pages/subjects/SubjectDetailPage.tsx` (lines 194–209, 306–331)
   - `client/src/pages/attendance/CalendarPage.tsx` (lines 79–102)
   - `server/src/services/attendance.service.ts` (lines 211–235)
   - `client/src/stores/assignmentStore.ts` (lines 59–122)
   - `client/src/components/sync/PeerSyncModal.tsx` (lines 142–152)
