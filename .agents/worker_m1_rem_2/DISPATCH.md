## 2026-09-19T18:20:15Z

You are Worker M1 Remediation 2 (Replacement Specialist).

Working directory: c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\worker_m1_rem_2
Workspace directory: c:\Users\Raina\OneDrive\Desktop\AttendX
Original Request: c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\ORIGINAL_REQUEST.md
Rules: c:\Users\Raina\OneDrive\Desktop\AttendX\AGENTS.md
Scope document: c:\Users\Raina\OneDrive\Desktop\AttendX\PROJECT.md
Auditor Report: c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\auditor_m1_1\handoff.md
Remediation Explorer 1 Handoff: c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\explorer_m1_rem_1\handoff.md
Remediation Explorer 2 Handoff: c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\explorer_m1_rem_2\handoff.md
Remediation Explorer 3 Handoff: c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\explorer_m1_rem_3\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your mission:
Remediate the Forensic Audit failure on Milestone M1 by replacing self-certifying tests with genuine, authentic verification tests that directly import and verify application code.

Follow the blueprint provided by the Remediation Explorers:
1. Pure Export Refinements in Production Code:
   - `client/src/lib/api.ts`:
     - Safely guard `import.meta.env` so that it doesn't crash in Node runtime (`typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL ? import.meta.env.VITE_API_URL : ''`).
     - Export pure helper functions: `extractOfflinePayload(data: any): any` and `sanitizeOfflineHeaders(headers: any): Record<string, any>`, used internally by the interceptor.
   - `client/src/stores/attendanceStore.ts`:
     - Export pure helper functions used for offline sync reconciliation: `filterPendingMarksForSemester(...)` and `reconcileSubjects(...)`.

2. Genuine Verification Test Suite in `server`:
   - Rewrite `server/src/tests/offline_sync_verification.test.ts`:
     - MUST `import { AttendanceService } from '../services/attendance.service';`
     - MUST `import prisma from '../lib/prisma';`
     - Directly call `AttendanceService.markAttendance(...)` with temporary/optimistic IDs (`temp-...`, `optimistic-...`) to verify that the service executes genuine deletion logic against the database (or in-memory Prisma store) and resolves records by composite criteria (`userId`, `subjectId`, `date`).
     - Zero inline mock algorithms!

3. Genuine Client Verification Test Suite:
   - Create `client/src/tests/offline_sync_verification.test.ts`:
     - Directly import `extractOfflinePayload` and `sanitizeOfflineHeaders` from `../lib/api`.
     - Directly import `filterPendingMarksForSemester` and `reconcileSubjects` from `../stores/attendanceStore`.
     - Directly test these exported functions against real edge cases (objects, strings, arrays, circular references, stale Authorization headers, dirty semester marks, clean vs dirty subject reconciliation).
     - Run and verify with `npx tsx` or node runner.

4. Decommission Fabricated Challenger Tests:
   - Remove or replace `server/src/tests/adversarial_challenge.test.ts` and `server/src/tests/challenger_stress_test.ts` so no self-certifying inline algorithm copies remain in the repository.

5. Build & Quality Verification:
   - Run `npm run build` in `client` (`tsc -b && vite build`).
   - Run `npm run build` in `server` (`tsup`).
   - Run all genuine test suites and ensure exit code 0.
   - Run `npx oxlint` on modified files.
   - Adhere strictly to AGENTS.md: NO `git commit`, NO `git push`, NO `git checkout/restore`.

Deliverables:
- Write full report in `handoff.md` with exact file diffs and test execution outputs.
- Send message to orchestrator upon completion.
