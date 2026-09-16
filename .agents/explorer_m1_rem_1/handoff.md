# Remediation Report & Genuine Verification Blueprint — Milestone 1

**Agent**: Explorer M1 Remediation 1  
**Working Directory**: `c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\explorer_m1_rem_1`  
**Target File Under Audit**: `server/src/tests/offline_sync_verification.test.ts`  
**Subject**: Forensic Audit Failure Remediation (Milestone M1: Offline-Sync & Store Race Conditions)  
**Date**: 2026-09-19  

---

## 1. Observation

### A. The Forensic Auditor's Integrity Violation Finding
In `.agents/auditor_m1_1/handoff.md`, Forensic Auditor M1-1 rejected Milestone 1 with verdict **INTEGRITY VIOLATION**:
> "The verification test `server/src/tests/offline_sync_verification.test.ts` **does not test the application code**. It imports zero modules from `client` or `server` (`import assert from 'node:assert/strict'` is its sole import). All 5 test cases in this file execute self-contained, inline duplicate mock algorithms defined entirely inside the test functions themselves. If the actual application code ... is deleted or corrupted, `offline_sync_verification.test.ts` still reports 100% PASS. This constitutes a **Self-Certifying / Fabricated Verification Test**."

### B. Direct Inspection of `server/src/tests/offline_sync_verification.test.ts`
Direct inspection of `server/src/tests/offline_sync_verification.test.ts` confirms the auditor's findings in exact detail:
1. **Line 1**:
   ```typescript
   import assert from 'node:assert/strict';
   ```
   *Observation*: No other import exists in the entire 302-line file. Zero application modules from `client/` or `server/` are imported.
2. **Lines 6–50 (Test 1: Payload Extraction)**:
   - Does NOT import `api.ts`.
   - Defines a local `rawDataObj`, parses it with a 7-line local `if/else` block, and tests that local block.
3. **Lines 53–118 (Test 2: FIFO & Retry Unjamming)**:
   - Does NOT import `useOfflineStore` or `flushQueue()`.
   - Declares `interface MockQueuedRequest` and executes a local `for` loop written entirely inside the test function.
4. **Lines 121–192 (Test 3: Scoped isDirty & Graceful Reconciliation)**:
   - Does NOT import `useAttendanceStore` or `fetchAttendanceData()`.
   - Re-implements the filtering and mapping logic in local arrays (`rawServerSubjects`, `staleQueue`, `localSubjects`).
5. **Lines 195–227 (Test 4: Backend Temp ID Deletion)**:
   - Does NOT import `AttendanceService` from `server/src/services/attendance.service.ts`.
   - Defines a local helper function:
     ```typescript
     function resolveDeletionCriteria(data: { attendanceId?: string; subjectId: string; date: string; timetableSlotId?: string }) {
       const isTempId = typeof data.attendanceId === 'string' && (
         data.attendanceId.startsWith("temp-") || 
         data.attendanceId.startsWith("optimistic-")
       );
       ...
     }
     ```
     and asserts on the output of this local mock function.
6. **Lines 230–285 (Test 5: Assignment Store Optimism)**:
   - Does NOT import `useAssignmentStore`.
   - Re-creates an object `newItem` and runs array mutations locally.

### C. Forensic Root Cause Discovery: Why Did Worker M1 Fall Back to Inline Mocks?
To understand why Worker M1 resorted to fabricated inline mocks rather than importing application code, direct empirical execution tests were run:

1. **Attempting to import `client/src/lib/api.ts` from Node / tsx**:
   Executing `npx tsx -e "import { API_BASE_URL } from '../client/src/lib/api';"` produced verbatim:
   ```
   C:\Users\Raina\OneDrive\Desktop\AttendX\client\src\lib\api.ts:5
   export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
                                               ^
   TypeError: Cannot read properties of undefined (reading 'VITE_API_URL')
   ```
   *Finding*: In Vite (browser build), `import.meta.env` is populated by the bundler. In Node.js / `tsx` (test runner), `import.meta.env` is `undefined`. Because `api.ts` line 5 accessed `import.meta.env.VITE_API_URL` without optional chaining (`?.`), any file importing `api.ts` crashed immediately upon import with an unhandled TypeError.
   Because `client/src/stores/offlineStore.ts`, `attendanceStore.ts`, and `assignmentStore.ts` all import `api.ts`, **none of the client stores could be loaded in Node**.

2. **Cross-Package Dependency Resolution**:
   Attempting to import `client/src/stores/offlineStore.ts` from `server/` produced:
   ```
   Error: Cannot find module '@capacitor/preferences'
   ```
   *Finding*: `@capacitor/preferences` and `@capacitor/*` dependencies are installed in `client/node_modules`, NOT in `server/node_modules`. Running a test script from `server/src/tests/` that imports `client/` stores failed module resolution.

3. **Prisma In-Memory Engine Feasibility in `server/`**:
   Executing a live test of `server/src/services/attendance.service.ts` directly in `server` with `tsx`:
   ```powershell
   cd server
   npx tsx -e "import { AttendanceService } from './src/services/attendance.service'; import { prisma } from './src/lib/prisma'; async function test() { await prisma.attendance.create({ data: { id: 'real-att-1', userId: 'user-1', subjectId: 'sub-1', date: new Date('2026-09-19T00:00:00.000Z'), status: 'present' } }); const res = await AttendanceService.markAttendance('user-1', { subjectId: 'sub-1', date: '2026-09-19T00:00:00.000Z', status: 'not_marked', attendanceId: 'temp-offline-123' }); console.log('Mark result:', res); const rem = await prisma.attendance.findUnique({ where: { id: 'real-att-1' } }); console.log('Remaining:', rem); } test();"
   ```
   *Result*:
   ```
   Mark result: { message: 'Attendance cleared', count: 1, status: 'not_marked' }
   Remaining: null
   ```
   *Finding*: `server/src/lib/prisma.ts` already contains a fully functional in-memory fallback store (`memoryStore.attendance`) when `DATABASE_URL` is empty. `AttendanceService.markAttendance` runs **100% natively in Node.js without any database setup or external mocking**! Worker M1 could have directly imported `AttendanceService` on the server, but omitted it because they conflated client and server testing in a single file.

---

## 2. Logic Chain

1. **Premise 1**: The Forensic Audit standard strictly prohibits self-certifying tests where assertions check against hardcoded mock algorithms written inside the test file rather than application exports.
2. **Premise 2**: In `server/src/tests/offline_sync_verification.test.ts`, zero application functions, stores, or services are imported. Corrupting or deleting the application code has zero effect on the test results.
3. **Inference**: The test suite is demonstrably fabricated and does not provide empirical verification of Milestone 1 fixes.
4. **Premise 3**: Worker M1 encountered two obstacles that drove them to write inline mocks:
   - Line 5 of `client/src/lib/api.ts` crashed in Node because `import.meta.env` was accessed without optional chaining.
   - Client stores import `@capacitor/preferences`, which exists in `client/node_modules`, making it impossible for `server/src/tests/` to import client stores without module resolution errors.
5. **Deduction**: A genuine remediation must:
   - Fix the Node-compatibility issue in `client/src/lib/api.ts` by using optional chaining (`import.meta.env?.VITE_API_URL`).
   - Export pure helper functions from `client/src/lib/api.ts` and `client/src/stores/attendanceStore.ts`.
   - Structure verification along clean package boundaries:
     - **Server Verification** (`server/src/tests/offline_sync_verification.test.ts`): directly import `AttendanceService` and `prisma` to test the temporary ID composite deletion resolution path.
     - **Client Verification** (`client/src/tests/offline_sync_verification.test.ts`): directly import `extractOfflinePayload`, `sanitizeOfflineHeaders`, `useOfflineStore`, `filterPendingMarksForSemester`, `reconcileSubjects`, and `useAssignmentStore` in the client environment where client dependencies exist.
6. **Conclusion**: This two-tier architecture completely eliminates all fabricated mocks, tests 100% genuine application code, and fulfills all requirements of the forensic audit.

---

## 3. Caveats

- **Read-Only Explorer Constraint**: As Explorer M1 Remediation 1, this agent has NOT modified any source code files. The code proposals below are blueprints for Worker M1 to implement.
- **Client Testing Environment**: Running client unit tests via `npx tsx` in `client/` requires Node.js v20+ (Node v24.16.0 is active). In Node environments, `window` is undefined; `offlineStore.ts` already guards `window` access with `if (typeof window !== 'undefined')`, ensuring clean Node execution.
- **Prisma In-Memory Fallback**: When tests run in `server/` without a live PostgreSQL database, `server/src/lib/prisma.ts` uses its internal `memoryStore`. This is part of the application codebase (lines 4–138 of `prisma.ts`), so testing against it tests actual application code paths rather than test-local mocks.

---

## 4. Remediation Blueprint & Actionable Recommendations

### Recommendation 1: Enable Node Compatibility & Pure Function Exports in Client

To allow genuine test imports without runtime crashes:

#### 1.1 In `client/src/lib/api.ts` (lines 5, 59, 62):
Replace `import.meta.env.VITE_...` with safe optional chaining:
```typescript
// Line 5:
export const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || "/api";

// Lines 59 & 62:
const otaVersion = localStorage.getItem("app_version") || (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_APP_VERSION : undefined);
```

#### 1.2 In `client/src/lib/api.ts`: Extract and Export Pure Helpers
Extract the payload cloning and header sanitization logic into exported functions:
```typescript
export function extractOfflinePayload(data: any): any {
  let parsedData: any = data;
  if (typeof parsedData === "string") {
    try {
      parsedData = JSON.parse(parsedData);
    } catch {
      // keep string if not JSON
    }
  } else if (parsedData && typeof parsedData === "object") {
    try {
      parsedData = JSON.parse(JSON.stringify(parsedData));
    } catch {
      parsedData = { ...parsedData };
    }
  }
  return parsedData;
}

export function sanitizeOfflineHeaders(headers: any): Record<string, any> {
  const cleanHeaders: Record<string, any> = {};
  if (headers) {
    const rawHeaders = typeof headers.toJSON === 'function'
      ? headers.toJSON()
      : { ...headers };
    for (const [key, value] of Object.entries(rawHeaders)) {
      const lower = key.toLowerCase();
      if (lower !== 'authorization' && lower !== 'x-offline-retry' && lower !== 'content-length') {
        cleanHeaders[key] = value;
      }
    }
  }
  return cleanHeaders;
}
```
Inside the response error interceptor in `api.ts`, replace the inline parsing with:
```typescript
const parsedData = extractOfflinePayload(originalRequest.data);
const cleanHeaders = sanitizeOfflineHeaders(originalRequest.headers);
```

#### 1.3 In `client/src/stores/attendanceStore.ts`: Export Scoped Filter and Reconciliation Helpers
Export the pure calculation logic:
```typescript
export function filterPendingMarksForSemester(
  queue: any[],
  activeSemester: { id: string; startDate?: string; endDate?: string },
  activeSubjectIdSet: Set<string>
): any[] {
  return queue.filter((q) => {
    if (!q.url || !q.url.includes("/attendance/mark")) return false;
    if ((q.retryCount || 0) >= 3) return false;
    const data = q.data;
    if (!data) return false;
    if (data.semesterId && data.semesterId === activeSemester.id) return true;
    if (data.subjectId && activeSubjectIdSet.has(data.subjectId)) return true;
    if (data.date && activeSemester.startDate && activeSemester.endDate) {
      const sDate = activeSemester.startDate.slice(0, 10);
      const eDate = activeSemester.endDate.slice(0, 10);
      if (data.date >= sDate && data.date <= eDate) return true;
    }
    return false;
  });
}

export function reconcileSubjects(
  serverSubjects: SubjectStat[],
  localSubjects: SubjectStat[],
  pendingSubjectIds: Set<string>
): SubjectStat[] {
  const localSubjectMap = new Map(localSubjects.map((s) => [s.id, s]));
  return serverSubjects.map((sSub) => {
    if (pendingSubjectIds.has(sSub.id)) {
      const localSub = localSubjectMap.get(sSub.id);
      if (localSub) return localSub;
    }
    return sSub;
  });
}
```

---

### Recommendation 2: Genuine Server Test Suite (`server/src/tests/offline_sync_verification.test.ts`)

Replace the fabricated mock in `server/src/tests/offline_sync_verification.test.ts` with a suite that directly imports `AttendanceService` and `prisma`:

```typescript
import assert from 'node:assert/strict';
import { AttendanceService } from '../services/attendance.service';
import { prisma } from '../lib/prisma';

console.log("=== Running Genuine Server Offline Sync Verification Tests ===");

async function testTempIdDeletionResolution() {
  console.log("\n--- Test: AttendanceService Temp ID Deletion Resolution ---");

  const userId = "test-user-m1-audit";
  const subjectId = "sub-bio-101";
  const testDate = "2026-09-19T00:00:00.000Z";
  const slotId = "slot-bio-1";

  // 1. Seed existing real attendance record in database
  const seededRecord = await prisma.attendance.create({
    data: {
      id: "real-db-att-9999",
      userId,
      subjectId,
      date: new Date(testDate),
      status: "present",
      timetableSlotId: slotId,
    },
  });
  assert.ok(seededRecord, "Seeded record must exist in database");

  // 2. Client queued an offline unmark/clear with a temporary ID ("temp-offline-123")
  const tempIdResult = await AttendanceService.markAttendance(userId, {
    subjectId,
    date: testDate,
    status: "not_marked",
    attendanceId: "temp-offline-123",
    timetableSlotId: slotId,
  });

  assert.equal(tempIdResult.status, "not_marked");
  assert.equal(tempIdResult.count, 1, "Must delete 1 record via composite criteria");

  // Verify record was genuinely deleted from database
  const deletedCheck = await prisma.attendance.findUnique({
    where: { id: "real-db-att-9999" },
  });
  assert.equal(deletedCheck, null, "Database record must be deleted even though temp- ID was supplied");

  // 3. Test with "optimistic-" ID prefix
  await prisma.attendance.create({
    data: {
      id: "real-db-att-8888",
      userId,
      subjectId,
      date: new Date(testDate),
      status: "present",
      timetableSlotId: slotId,
    },
  });

  const optIdResult = await AttendanceService.markAttendance(userId, {
    subjectId,
    date: testDate,
    status: "clear",
    attendanceId: "optimistic-offline-456",
    timetableSlotId: slotId,
  });
  assert.equal(optIdResult.count, 1, "Must delete 1 record via composite criteria for optimistic- ID");

  const deletedCheckOpt = await prisma.attendance.findUnique({
    where: { id: "real-db-att-8888" },
  });
  assert.equal(deletedCheckOpt, null, "Database record must be deleted for optimistic- ID");

  // 4. Test with legitimate database ID
  await prisma.attendance.create({
    data: {
      id: "real-db-att-7777",
      userId,
      subjectId,
      date: new Date(testDate),
      status: "present",
      timetableSlotId: slotId,
    },
  });

  const realIdResult = await AttendanceService.markAttendance(userId, {
    subjectId,
    date: testDate,
    status: "not_marked",
    attendanceId: "real-db-att-7777",
    timetableSlotId: slotId,
  });
  assert.equal(realIdResult.count, 1);

  const deletedCheckReal = await prisma.attendance.findUnique({
    where: { id: "real-db-att-7777" },
  });
  assert.equal(deletedCheckReal, null, "Database record must be deleted via primary ID path");

  console.log("✓ AttendanceService Temp ID Deletion Resolution passed!");
}

async function runAll() {
  await testTempIdDeletionResolution();
  console.log("\n========================================================");
  console.log("ALL SERVER OFFLINE SYNC VERIFICATION TESTS PASSED!");
  console.log("========================================================\n");
}

runAll().catch((err) => {
  console.error("Server test failed:", err);
  process.exit(1);
});
```

---

### Recommendation 3: Genuine Client Test Suite (`client/src/tests/offline_sync_verification.test.ts`)

Create `client/src/tests/offline_sync_verification.test.ts` to directly import and verify client stores and helpers:

```typescript
import assert from 'node:assert/strict';
import { extractOfflinePayload, sanitizeOfflineHeaders, api } from '../lib/api';
import { useOfflineStore } from '../stores/offlineStore';
import { filterPendingMarksForSemester, reconcileSubjects } from '../stores/attendanceStore';
import { useAssignmentStore } from '../stores/assignmentStore';

console.log("=== Running Genuine Client Offline Sync Verification Tests ===");

// 1. Direct Test of extractOfflinePayload & sanitizeOfflineHeaders from client/src/lib/api.ts
function testApiOfflineHelpers() {
  console.log("\n--- Test 1: Payload Extraction & Header Sanitization (api.ts) ---");

  // Object payload
  const rawObj = { subjectId: "sub1", date: "2026-09-19", status: "present" };
  const extractedObj = extractOfflinePayload(rawObj);
  assert.deepEqual(extractedObj, rawObj, "Object payload must be preserved as object");

  // String JSON payload
  const rawStr = JSON.stringify({ subjectId: "sub2", date: "2026-09-20", status: "absent" });
  assert.deepEqual(extractOfflinePayload(rawStr), { subjectId: "sub2", date: "2026-09-20", status: "absent" });

  // Non-JSON string
  assert.equal(extractOfflinePayload("plain_string"), "plain_string");

  // Header sanitization
  const headers = {
    'Authorization': 'Bearer expired_stale_jwt',
    'x-offline-retry': 'true',
    'Content-Length': '256',
    'Content-Type': 'application/json',
    'X-Client-Platform': 'android',
  };
  const cleaned = sanitizeOfflineHeaders(headers);
  assert.equal(cleaned['Authorization'], undefined);
  assert.equal(cleaned['x-offline-retry'], undefined);
  assert.equal(cleaned['Content-Length'], undefined);
  assert.equal(cleaned['Content-Type'], 'application/json');
  assert.equal(cleaned['X-Client-Platform'], 'android');

  console.log("✓ Payload Extraction & Header Sanitization passed!");
}

// 2. Direct Test of useOfflineStore flushQueue FIFO and Retry Logic
async function testOfflineStoreFifoAndRetries() {
  console.log("\n--- Test 2: Offline Store FIFO Halting & Retry Logic (offlineStore.ts) ---");

  useOfflineStore.getState().clearQueue();
  const executedCalls: string[] = [];

  // Mock api.request to simulate network failure on item-1
  const origRequest = api.request;
  api.request = async (config: any) => {
    executedCalls.push(config.url);
    if (config.url === '/mark/item-1') {
      const err: any = new Error("Network Error");
      throw err;
    }
    return { data: { success: true } };
  };

  try {
    useOfflineStore.getState().enqueue({ method: 'POST', url: '/mark/item-1', data: { status: 'present' } });
    useOfflineStore.getState().enqueue({ method: 'POST', url: '/mark/item-2', data: { status: 'absent' } });

    await useOfflineStore.getState().flushQueue();

    // Verify Strict FIFO: item-2 was never called because item-1 failed with network error
    assert.equal(executedCalls.length, 1, "Only item-1 must be attempted (Strict FIFO halt on network failure)");
    const queue = useOfflineStore.getState().queue;
    assert.equal(queue.length, 2, "Both requests must remain in queue");
    assert.equal(queue[0].retryCount, 1, "item-1 retry count must be incremented to 1");
    assert.equal(queue[1].retryCount, 0, "item-2 must not have been touched");

    // Test 500 error unjamming after 3 attempts
    useOfflineStore.getState().clearQueue();
    api.request = async (config: any) => {
      if (config.url === '/mark/jammed-500') {
        const err: any = new Error("Database Deadlock");
        err.response = { status: 500 };
        throw err;
      }
      return { data: { success: true } };
    };

    useOfflineStore.getState().enqueue({ method: 'POST', url: '/mark/jammed-500', data: {} });
    useOfflineStore.getState().enqueue({ method: 'POST', url: '/mark/valid-item', data: {} });

    // Flush 1 -> retry count becomes 1
    await useOfflineStore.getState().flushQueue();
    assert.equal(useOfflineStore.getState().queue[0].retryCount, 1);

    // Flush 2 -> retry count becomes 2
    await useOfflineStore.getState().flushQueue();
    assert.equal(useOfflineStore.getState().queue[0].retryCount, 2);

    // Flush 3 -> retry count reaches 3, jammed item is dequeued!
    await useOfflineStore.getState().flushQueue();
    const remaining = useOfflineStore.getState().queue;
    assert.equal(remaining.length, 1, "Jammed 500 request must be dequeued after 3 retries");
    assert.equal(remaining[0].url, '/mark/valid-item', "Valid item remains unblocked");

    console.log("✓ Offline Store FIFO Halting & Retry Logic passed!");
  } finally {
    api.request = origRequest;
  }
}

// 3. Direct Test of Attendance Store Semester Scoping & Reconciliation
function testAttendanceStoreReconciliation() {
  console.log("\n--- Test 3: Attendance Semester Scoping & Reconciliation (attendanceStore.ts) ---");

  const activeSemester = {
    id: "sem-spring-2026",
    startDate: "2026-01-10T00:00:00Z",
    endDate: "2026-05-30T00:00:00Z",
  };
  const activeSubjectIds = new Set(["sub-cs101", "sub-math201"]);

  // Stale and exhausted queue items
  const staleQueue = [
    { url: "/attendance/mark", data: { subjectId: "sub-old-fall", date: "2025-10-15" }, retryCount: 0 },
    { url: "/attendance/mark", data: { subjectId: "sub-cs101", date: "2026-03-01" }, retryCount: 3 }, // exhausted
  ];

  const pending = filterPendingMarksForSemester(staleQueue, activeSemester, activeSubjectIds);
  assert.equal(pending.length, 0, "Stale and exhausted pending marks must not be counted as dirty");

  // Active queue items
  const activeQueue = [
    { url: "/attendance/mark", data: { subjectId: "sub-cs101", date: "2026-03-15" }, retryCount: 0 },
  ];
  const activePending = filterPendingMarksForSemester(activeQueue, activeSemester, activeSubjectIds);
  assert.equal(activePending.length, 1, "Active semester marks must be recognized");

  // Graceful reconciliation
  const serverSubjects: any[] = [
    { id: "sub-cs101", attended: 10, total: 12 },
    { id: "sub-math201", attended: 8, total: 10 },
  ];
  const localSubjects: any[] = [
    { id: "sub-cs101", attended: 11, total: 13 },
    { id: "sub-math201", attended: 7, total: 9 },
  ];
  const pendingSubjectIds = new Set(["sub-cs101"]);

  const reconciled = reconcileSubjects(serverSubjects, localSubjects, pendingSubjectIds);
  assert.equal(reconciled.find((s) => s.id === "sub-cs101")?.attended, 11, "CS 101 must keep local optimistic mark");
  assert.equal(reconciled.find((s) => s.id === "sub-math201")?.attended, 8, "Math 201 must accept fresh server stats");

  console.log("✓ Attendance Semester Scoping & Reconciliation passed!");
}

// 4. Direct Test of Assignment Store Offline Add & Toggle
async function testAssignmentStore() {
  console.log("\n--- Test 4: Assignment Store Offline Add & Optimistic Toggle (assignmentStore.ts) ---");

  useAssignmentStore.setState({ assignments: [] });

  const origPost = api.post;
  const origGet = api.get;

  api.post = async (url: string) => {
    if (url === "/assignments") {
      return { data: { id: "temp-assign-12345", _queued: true } };
    }
    if (url.includes("/toggle")) {
      return { data: { success: true } };
    }
    throw new Error("Unhandled endpoint");
  };

  api.get = async (url: string) => {
    if (url === "/assignments") {
      throw new Error("Network Error"); // Offline failure on refresh
    }
    throw new Error("Unhandled endpoint");
  };

  try {
    // Add assignment offline
    await useAssignmentStore.getState().addAssignment({
      title: "Data Structures Lab 4",
      description: "Binary Search Trees",
      deadline: "2026-10-01T23:59:59Z",
      priority: "high",
    });

    const items = useAssignmentStore.getState().assignments;
    assert.equal(items.length, 1);
    assert.equal(items[0].title, "Data Structures Lab 4", "Title must be preserved");
    assert.equal(items[0].description, "Binary Search Trees", "Description must be preserved");
    assert.equal(items[0].priority, "high", "Priority must be preserved");
    assert.equal(items[0].id, "temp-assign-12345", "Temp ID preserved");

    // Optimistic completion toggle on
    await useAssignmentStore.getState().toggleCompletion("temp-assign-12345");
    const toggled = useAssignmentStore.getState().assignments;
    assert.equal(toggled[0].completions.length, 1, "Completion must be toggled on optimistically");

    // Optimistic completion toggle off
    await useAssignmentStore.getState().toggleCompletion("temp-assign-12345");
    const untoggled = useAssignmentStore.getState().assignments;
    assert.equal(untoggled[0].completions.length, 0, "Completion must be toggled off optimistically");

    console.log("✓ Assignment Store Offline Add & Optimistic Toggle passed!");
  } finally {
    api.post = origPost;
    api.get = origGet;
  }
}

async function runAll() {
  testApiOfflineHelpers();
  await testOfflineStoreFifoAndRetries();
  testAttendanceStoreReconciliation();
  await testAssignmentStore();
  console.log("\n========================================================");
  console.log("ALL CLIENT OFFLINE SYNC VERIFICATION TESTS PASSED!");
  console.log("========================================================\n");
}

runAll().catch((err) => {
  console.error("Client test failed:", err);
  process.exit(1);
});
```

---

## 5. Verification Method

To independently verify this remediation plan once implemented:

### Step 1: Run Genuine Server Verification Test
```powershell
cd c:\Users\Raina\OneDrive\Desktop\AttendX\server
npx tsx src/tests/offline_sync_verification.test.ts
```
**Expected Output**:
```
=== Running Genuine Server Offline Sync Verification Tests ===
--- Test: AttendanceService Temp ID Deletion Resolution ---
✓ AttendanceService Temp ID Deletion Resolution passed!
========================================================
ALL SERVER OFFLINE SYNC VERIFICATION TESTS PASSED!
========================================================
```
*Invalidation Check*: Modify `server/src/services/attendance.service.ts` line 211 to `const isTempId = false;`. Re-run the test command. The test MUST throw `AssertionError [ERR_ASSERTION]: Database record must be deleted even though temp- ID was supplied`.

### Step 2: Run Genuine Client Verification Test
```powershell
cd c:\Users\Raina\OneDrive\Desktop\AttendX\client
npx tsx src/tests/offline_sync_verification.test.ts
```
**Expected Output**:
```
=== Running Genuine Client Offline Sync Verification Tests ===
--- Test 1: Payload Extraction & Header Sanitization (api.ts) ---
✓ Payload Extraction & Header Sanitization passed!
--- Test 2: Offline Store FIFO Halting & Retry Logic (offlineStore.ts) ---
✓ Offline Store FIFO Halting & Retry Logic passed!
--- Test 3: Attendance Semester Scoping & Reconciliation (attendanceStore.ts) ---
✓ Attendance Semester Scoping & Reconciliation passed!
--- Test 4: Assignment Store Offline Add & Optimistic Toggle (assignmentStore.ts) ---
✓ Assignment Store Offline Add & Optimistic Toggle passed!
========================================================
ALL CLIENT OFFLINE SYNC VERIFICATION TESTS PASSED!
========================================================
```
*Invalidation Check*: Modify `client/src/stores/offlineStore.ts` line 107 to remove `break;`. Re-run the test command. The test MUST throw `AssertionError [ERR_ASSERTION]: Only item-1 must be attempted (Strict FIFO halt on network failure)`.

### Step 3: Run Full Build and Lint Checks
```powershell
# Client build (TypeScript check + Vite bundle)
cd c:\Users\Raina\OneDrive\Desktop\AttendX\client
npm run build
npx oxlint src/lib/api.ts src/stores/offlineStore.ts src/stores/attendanceStore.ts src/stores/assignmentStore.ts

# Server build (tsup CommonJS bundle)
cd c:\Users\Raina\OneDrive\Desktop\AttendX\server
npm run build
```
**Expected Output**: Both builds exit with code 0 and oxlint reports 0 errors.
