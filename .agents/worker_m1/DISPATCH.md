## 2026-09-19T17:41:43Z
<USER_REQUEST>
You are Worker M1 (Implementation Specialist for Offline-Sync & Store Race Conditions).

Working directory: c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\worker_m1
Workspace directory: c:\Users\Raina\OneDrive\Desktop\AttendX
Original Request: c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\ORIGINAL_REQUEST.md
Rules: c:\Users\Raina\OneDrive\Desktop\AttendX\AGENTS.md
Scope document: c:\Users\Raina\OneDrive\Desktop\AttendX\PROJECT.md
Explorer handoff: c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\explorer_survey_1\handoff.md
Explorer analysis: c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\explorer_survey_1\analysis.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your mission:
Implement surgical, high-reliability fixes for Requirement R1 (Offline-Sync Race Conditions and Store Deficiencies) as documented in the Explorer 1 handoff:

1. Payload Loss in Axios Interceptor (`client/src/lib/api.ts` lines ~213–221):
   - Safely extract request payload. If `originalRequest.data` is an object, use it directly (or clone it); only `JSON.parse` if it is a string. Ensure `enqueue` receives the genuine mutation payload.
   - Clean up stale/expired `Authorization` headers in queued requests so refreshed tokens are used during sync.

2. FIFO Order & Failure Handling in Offline Queue (`client/src/stores/offlineStore.ts` lines ~70–90):
   - Break out of the loop on network failure/timeout to guarantee strict FIFO causality (never execute request N+1 if request N failed due to offline/network drop).
   - Add retry limit (e.g. `retryCount >= 3`) and dequeue unrecoverable 500 errors to prevent permanent queue jamming.

3. Permanent Stats Freeze in `attendanceStore.ts` (`client/src/stores/attendanceStore.ts` lines ~149–165):
   - Ensure `isDirty` check does not permanently lock out fresh server statistics from `/attendance/stats`. Check only pending marks matching the active semester, and reconcile gracefully.

4. Cross-User Queue Leak on Logout (`client/src/stores/authStore.ts` lines ~71–89):
   - In `logout()`, remove `attendx-offline-queue` from Capacitor Preferences and localStorage, and call `useOfflineStore.getState().clearQueue()`.

5. Optimistic UI Reversion in SubjectDetailPage (`client/src/pages/subjects/SubjectDetailPage.tsx` lines ~248–255, 288–311):
   - In `handleMarkAttendance`, optimistically update `useCacheStore.getState().subject_logs` along with local state, so that when `attendance-updated` triggers `fetchLogsData()`, the fallback cache matches the optimistic state.

6. Stale Day Cells in CalendarPage (`client/src/pages/attendance/CalendarPage.tsx` lines ~79–88):
   - Preserve both `details` and `days` array cells when applying optimistic offline cache fallback.

7. Deletion with Temporary / Optimistic IDs (`server/src/services/attendance.service.ts` lines ~211–215):
   - When clearing attendance (`data.status === 'not_marked' || data.status === 'clear'`), if `data.attendanceId` starts with `temp-` or `optimistic-`, delete by `userId`, `subjectId`, and `date` rather than failing silently with `deleteMany({ where: { id } })`.

8. Assignment Store Offline Mutation State (`client/src/stores/assignmentStore.ts` lines ~59–82):
   - In `addAssignment`, keep the title, deadline, description, and priority fields on optimistic items instead of stripping them down to bare `{ id, _queued }`.
   - Add optimistic toggle support in `toggleCompletion` when offline.

9. Timetable Peer Sync Cache Invalidation (`client/src/components/sync/PeerSyncModal.tsx` lines ~135–151):
   - Invalidate cached timetable/today/calendar queries and dispatch `"attendance-updated"` upon import.

Operational Rules:
- Adhere strictly to AGENTS.md: NO `git commit`, NO `git push`. NO `git restore` or `git checkout`.
- Use targeted, surgical edits via `replace_file_content`.
- Verify your changes: run `npm run build` in `client` and `server` to ensure zero compilation or typecheck errors.
- Document every file changed, lines changed, build commands, and test results in `handoff.md`.
- Send a message to orchestrator upon completion.
</USER_REQUEST>
