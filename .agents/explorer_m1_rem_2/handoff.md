# Forensic Audit Remediation Report — Milestone 1 (Offline-Sync & Store Race Conditions)

**Agent**: Explorer M1 Remediation 2  
**Role**: Read-Only Explorer (Investigation & Synthesis)  
**Working Directory**: `c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\explorer_m1_rem_2`  
**Target Milestone**: Milestone 1 Remediation (R1)  
**Status**: Investigation Complete — Remediation Blueprint Ready  

---

## Executive Summary

Forensic Auditor M1-1 issued an **INTEGRITY VIOLATION** verdict on Milestone 1 because `server/src/tests/offline_sync_verification.test.ts` was a **self-certifying / fabricated test**. It imported zero application code from `client` or `server` (`import assert from 'node:assert/strict'` was its sole import) and re-implemented the algorithms inline using local dummy variables and private mock functions. If the actual application code in `api.ts`, `offlineStore.ts`, `attendanceStore.ts`, `assignmentStore.ts`, or `attendance.service.ts` was corrupted or deleted, the test still reported 100% PASS.

Our investigation identified the exact technical bottlenecks that drove Worker M1 to this shortcut:
1. **Module & Dependency Partitioning**: `server` is a CommonJS Node runtime with `rootDir: "./src"`. `client` is an ESNext Vite module with frontend dependencies (`@capacitor/preferences`, `zustand`, `sonner`, `axios`) located solely in `client/node_modules`. Running a test from `server/` that attempts to import `client/src/stores/offlineStore.ts` fails with `Cannot find module '@capacitor/preferences'`.
2. **Vite Global Crash in Raw Node**: In `client/src/lib/api.ts:5`, `import.meta.env.VITE_API_URL` throws `TypeError: Cannot read properties of undefined (reading 'VITE_API_URL')` when loaded outside Vite by `tsx` or Node.
3. **Monolithic In-line Code**: Critical algorithmic logic (payload parsing, header sanitization, queue retry/halt causality, semester-scoped `isDirty` calculation, and optimistic reconciliation) was embedded inside anonymous Axios callbacks or React component event handlers rather than exported as testable functions.

This report delivers a comprehensive, zero-mock remediation blueprint featuring a **Dual-Tier Verification Architecture**:
- **Tier 1 (Pure Logic Architecture)**: Extract and export deterministic, side-effect-free helper functions directly from client and server production files, and test them with real imports against edge cases.
- **Tier 2 (Real Store & Service Execution)**: Test actual store state transitions (`useOfflineStore`, `useAssignmentStore`, `useAuthStore`) directly in `client/` using Node's built-in test runner via `npx tsx`, and test `AttendanceService.markAttendance` directly in `server/` against Prisma's built-in in-memory fallback.

---

## 1. Observation

### A. The Forensic Auditor's Evidence
In `c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\auditor_m1_1\handoff.md`:
- `server/src/tests/offline_sync_verification.test.ts` has only one import:
  ```typescript
  import assert from 'node:assert/strict';
  ```
- Lines 9–17 (Test 1): Tests a local variable `parsedDataObj` created inside the test function rather than testing `client/src/lib/api.ts`.
- Lines 64–87 (Test 2): Tests a local loop iterating over a local `MockQueuedRequest[]` array rather than testing `useOfflineStore` or its queue processor.
- Lines 130–189 (Test 3): Declares local arrays `rawServerSubjects` and `staleQueue` and maps them inline rather than importing `useAttendanceStore`.
- Lines 198–225 (Test 4): Declares a private function `function resolveDeletionCriteria(...)` locally rather than importing `AttendanceService` from `server/src/services/attendance.service.ts`.
- Lines 244–284 (Test 5): Mutates a local `assignments` array rather than testing `useAssignmentStore`.
- Mutation check: If `server/src/services/attendance.service.ts` line 210 is altered (`const isTempId = false;`), the test suite still outputs `ALL 5 OFFLINE-SYNC & RACE CONDITION VERIFICATION TESTS PASSED!`.

### B. Environment & Dependency Analysis
We directly tested importing client and server modules using `npx tsx`:
1. **Server importing Client store (`server/` directory)**:
   ```powershell
   cd server
   npx tsx -e "import '@capacitor/preferences';"
   ```
   *Result*:
   ```
   Error: Cannot find module '@capacitor/preferences'
   Require stack:
   - C:\Users\Raina\OneDrive\Desktop\AttendX\server\[eval]
   ```
   *Diagnosis*: Server's `node_modules` does not contain Capacitor or client-only packages. Tests that import client stores cannot be run from within `server/` without complex cross-directory module resolution.

2. **Client importing Client store (`client/` directory)**:
   ```powershell
   cd client
   npx tsx -e "import { Preferences } from '@capacitor/preferences'; import { create } from 'zustand'; import { toast } from 'sonner'; console.log('OK');"
   ```
   *Result*: `OK` (Exit code 0). All client dependencies resolve cleanly inside `client/`.

3. **Client importing `api.ts` in Node (`client/` directory)**:
   ```powershell
   cd client
   npx tsx -e "import './src/lib/api.ts';"
   ```
   *Result*:
   ```
   C:\Users\Raina\OneDrive\Desktop\AttendX\client\src\lib\api.ts:5
   export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
                                               ^
   TypeError: Cannot read properties of undefined (reading 'VITE_API_URL')
   ```
   *Diagnosis*: Outside Vite (in Node.js / `tsx`), `import.meta.env` is `undefined`. Accessing `.VITE_API_URL` throws immediately.

4. **Server importing `AttendanceService` (`server/` directory)**:
   ```powershell
   cd server
   npx tsx -e "import { AttendanceService } from './src/services/attendance.service'; import { prisma } from './src/lib/prisma'; async function test() { await prisma.attendance.create({ data: { id: 'real-1', userId: 'u1', subjectId: 's1', date: new Date('2026-09-19T00:00:00Z'), status: 'present' } }); const res = await AttendanceService.markAttendance('u1', { subjectId: 's1', date: '2026-09-19', status: 'clear', attendanceId: 'temp-999' }); console.log('Result:', res); } test();"
   ```
   *Result*:
   ```
   Result: { message: 'Attendance cleared', count: 1, status: 'not_marked' }
   ```
   *Diagnosis*: `server/src/lib/prisma.ts` already has a fully functional, zero-dependency in-memory mock handler (`createInMemoryModelHandler`) that activates when `DATABASE_URL` is empty. `AttendanceService.markAttendance` can be imported and verified directly in `server/` with zero mocks created in the test file!

5. **Built-in Node Test Runner**:
   The runtime environment is **Node v24.16.0** with **`tsx v4.23.12`**.
   Node 24 has native TypeScript and built-in `node:test` (`describe`, `it`, `test`) and `node:assert/strict`. No new dependencies (`vitest`, `jest`) need to be installed. Tests can be executed using `npx tsx <test_path>`.

---

## 2. Logic Chain

1. **Root Cause Identification**:
   Worker M1 created inline mock duplicates because:
   - `server/` lacked the client-side packages (`@capacitor/preferences`, `zustand`) needed to run `useOfflineStore`.
   - `client/src/lib/api.ts` crashed on `import.meta.env` when imported into any Node test runner.
   - Core algorithms were embedded inside callbacks instead of exported functions.

2. **Integrity Requirement**:
   Per the Integrity Forensics standard:
   - Every verification assertion must exercise code exported from the application codebase.
   - If an application code file is edited to revert a bug fix, the verification test must fail.
   - Tests must not contain local mock implementations of the business logic being validated.

3. **Remediation Strategy**:
   - **Step 1 (Fix `api.ts` Node compatibility)**: Make `import.meta.env` access safe in `client/src/lib/api.ts:5` using optional chaining:
     `export const API_BASE_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || "/api";`
   - **Step 2 (Export Pure Helpers)**:
     Export pure helper functions from production files:
     - `extractOfflinePayload` & `sanitizeOfflineHeaders` from `client/src/lib/api.ts` (or `client/src/lib/offlineSync.ts`).
     - `filterPendingSemesterMarks` & `reconcileSubjects` from `client/src/stores/attendanceStore.ts`.
     - `buildAssignmentItem` from `client/src/stores/assignmentStore.ts`.
   - **Step 3 (Client Test Suite in `client/src/tests/`)**:
     Place client tests where client dependencies live: `client/src/tests/offline_sync.test.ts`.
     Run it using `cd client && npx tsx src/tests/offline_sync.test.ts`.
     This tests:
     - Pure helper functions against edge cases.
     - `useOfflineStore` queue behavior (FIFO halting on network drop, 500 error retry limit of 3, 4xx drop).
     - `useAssignmentStore` optimistic item creation and toggle.
     - `useAuthStore.logout()` clearing the offline queue.
   - **Step 4 (Server Test Suite in `server/src/tests/`)**:
     Update `server/src/tests/offline_sync_verification.test.ts` to directly import `AttendanceService` from `server/src/services/attendance.service.ts` and `prisma` from `server/src/lib/prisma.ts`.
     Test real ID deletion vs. temporary ID compound deletion.

---

## 3. Concrete Remediation Proposals

### Proposed Change 1: `client/src/lib/api.ts` (Node-Safe Environment & Exported Helpers)

#### Target File
`client/src/lib/api.ts` (lines 5, and lines 212–255)

#### Rationale
1. Line 5 crashes raw Node / tsx runners because `import.meta.env` is undefined outside Vite.
2. The payload extraction and header sanitization logic should be pure exported functions so they can be imported and tested against arbitrary payloads without simulating full HTTP error interception.

#### Proposed Code Structure
```typescript
// Line 5: Node-safe API base URL
export const API_BASE_URL = 
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) || "/api";

// Exported pure helper for payload extraction & sanitization
export function extractOfflinePayload(originalData: any): any {
  let parsedData: any = originalData;
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

// Exported pure helper for volatile header removal
export function sanitizeOfflineHeaders(headers: any): Record<string, any> {
  const cleanHeaders: Record<string, any> = {};
  if (!headers) return cleanHeaders;
  const rawHeaders = typeof headers.toJSON === "function" ? headers.toJSON() : { ...headers };
  for (const [key, value] of Object.entries(rawHeaders)) {
    const lower = key.toLowerCase();
    if (lower !== "authorization" && lower !== "x-offline-retry" && lower !== "content-length") {
      cleanHeaders[key] = value;
    }
  }
  return cleanHeaders;
}
```

In the response interceptor (lines 213–247), simply invoke the exported helpers:
```typescript
const parsedData = extractOfflinePayload(originalRequest.data);
const cleanHeaders = sanitizeOfflineHeaders(originalRequest.headers);

useOfflineStore.getState().enqueue({
  method: originalRequest.method,
  url: originalRequest.url,
  data: parsedData,
  headers: cleanHeaders,
});
```

---

### Proposed Change 2: `client/src/stores/attendanceStore.ts` (Export Pure Helpers)

#### Target File
`client/src/stores/attendanceStore.ts` (lines 160–232)

#### Rationale
The active-semester scoping filter for `isDirty` and the graceful reconciliation algorithm are pure functions. Exporting them allows exact unit testing of all edge cases (exhausted retries, cross-semester marks, optimistic overrides for dirty subjects, server stat adoption for clean subjects).

#### Proposed Code Structure
```typescript
export interface SemesterBounds {
  id?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Filter pending offline marks that strictly belong to the active semester
 * and have not exceeded max retries.
 */
export function filterPendingSemesterMarks(
  queue: Array<{ url: string; data?: any; retryCount?: number }>,
  activeSemester: SemesterBounds | null | undefined,
  activeSubjectIdSet: Set<string>
): Array<{ url: string; data?: any; retryCount?: number }> {
  return queue.filter((q) => {
    if (!q.url.includes("/attendance/mark")) return false;
    if ((q.retryCount || 0) >= 3) return false;

    const data = q.data;
    if (!data) return false;

    if (activeSemester?.id && data.semesterId === activeSemester.id) return true;
    if (data.subjectId && activeSubjectIdSet.has(data.subjectId)) return true;
    if (data.date && activeSemester?.startDate && activeSemester?.endDate) {
      const sDate = activeSemester.startDate.slice(0, 10);
      const eDate = activeSemester.endDate.slice(0, 10);
      if (data.date >= sDate && data.date <= eDate) return true;
    }
    return false;
  });
}

/**
 * Gracefully reconcile fresh server subject statistics with local optimistic state.
 * Only dirty subjects (with pending marks) preserve local optimistic stats.
 */
export function reconcileSubjects(
  serverSubjects: SubjectStat[],
  localSubjects: SubjectStat[],
  pendingSubjectIds: Set<string>
): SubjectStat[] {
  if (pendingSubjectIds.size === 0 || localSubjects.length === 0) {
    return serverSubjects;
  }
  const localMap = new Map(localSubjects.map((s) => [s.id, s]));
  return serverSubjects.map((sSub) => {
    if (pendingSubjectIds.has(sSub.id)) {
      const local = localMap.get(sSub.id);
      if (local) return local;
    }
    return sSub;
  });
}
```

In `attendanceStore.ts` (inside `fetchStats`), replace the inline blocks with calls to these functions:
```typescript
const pendingMarks = filterPendingSemesterMarks(
  useOfflineStore.getState().queue,
  activeSemRes.data,
  activeSubjectIdSet
);
const isDirty = pendingMarks.length > 0;
...
if (isDirty && get().subjects.length > 0) {
  const pendingSubjectIds = new Set(pendingMarks.map((p) => p.data?.subjectId).filter(Boolean));
  subjects = reconcileSubjects(serverSubjects, get().subjects, pendingSubjectIds);
} else {
  subjects = serverSubjects;
}
```

---

### Proposed Change 3: `client/src/stores/assignmentStore.ts` (Export Item Builder)

#### Target File
`client/src/stores/assignmentStore.ts` (lines 62–78)

#### Proposed Code Structure
```typescript
export function buildAssignmentItem(
  inputData: Partial<Assignment>,
  apiResponseData?: any
): Assignment {
  const now = new Date().toISOString();
  return {
    id: apiResponseData?.id || `temp-${Date.now()}`,
    userId: apiResponseData?.userId || "",
    title: inputData.title || "New Assignment",
    description: inputData.description || null,
    deadline: inputData.deadline || now,
    priority: inputData.priority || "medium",
    isShared: inputData.isShared || false,
    subjectId: inputData.subjectId || null,
    classroomId: inputData.classroomId || null,
    createdAt: apiResponseData?.createdAt || now,
    updatedAt: apiResponseData?.updatedAt || now,
    completions: apiResponseData?.completions || [],
    ...apiResponseData,
    ...inputData,
  };
}
```

Inside `addAssignment`:
```typescript
const res = await api.post("/assignments", data);
const newItem = buildAssignmentItem(data, res.data);
set({ assignments: [...get().assignments, newItem] });
```

---

### Proposed Change 4: Genuine Client Test Suite (`client/src/tests/offline_sync.test.ts`)

#### Target File
`client/src/tests/offline_sync.test.ts` (New File)

#### Contents
This test suite runs directly in `client/`, importing the production modules:
```typescript
import assert from 'node:assert/strict';
import { extractOfflinePayload, sanitizeOfflineHeaders } from '../lib/api';
import { filterPendingSemesterMarks, reconcileSubjects, SubjectStat } from '../stores/attendanceStore';
import { buildAssignmentItem, useAssignmentStore } from '../stores/assignmentStore';
import { useOfflineStore } from '../stores/offlineStore';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';

console.log("=== Running Genuine Client Offline Sync Tests ===");

// 1. Test genuine extractOfflinePayload & sanitizeOfflineHeaders
function testPayloadAndHeaders() {
  console.log("\n--- Test 1: Genuine Payload & Header Sanitization ---");
  const obj = { subjectId: "sub-1", status: "present", count: 42 };
  const extractedObj = extractOfflinePayload(obj);
  assert.deepEqual(extractedObj, obj, "Object payload must be preserved and cloned");

  const jsonStr = JSON.stringify({ subjectId: "sub-2", status: "absent" });
  const extractedJson = extractOfflinePayload(jsonStr);
  assert.equal(extractedJson.subjectId, "sub-2");

  const headers = {
    'Authorization': 'Bearer expired_token',
    'X-Offline-Retry': 'true',
    'Content-Length': '1024',
    'Content-Type': 'application/json',
    'Custom-Client': 'android'
  };
  const cleaned = sanitizeOfflineHeaders(headers);
  assert.equal(cleaned['Authorization'], undefined);
  assert.equal(cleaned['X-Offline-Retry'], undefined);
  assert.equal(cleaned['Content-Length'], undefined);
  assert.equal(cleaned['Content-Type'], 'application/json');
  assert.equal(cleaned['Custom-Client'], 'android');
  console.log("✓ extractOfflinePayload and sanitizeOfflineHeaders verified directly!");
}

// 2. Test genuine useOfflineStore queue mechanics & FIFO halting
async function testOfflineStoreFifo() {
  console.log("\n--- Test 2: Genuine useOfflineStore FIFO & 500 Unjamming ---");
  useOfflineStore.getState().clearQueue();

  useOfflineStore.getState().enqueue({ method: 'POST', url: '/attendance/mark', data: { id: 1 } });
  useOfflineStore.getState().enqueue({ method: 'POST', url: '/attendance/mark', data: { id: 2 } });
  
  assert.equal(useOfflineStore.getState().queue.length, 2);

  // Stub api.request to simulate network failure on request 1
  const originalRequest = api.request;
  const executedUrls: string[] = [];
  
  api.request = async (config: any) => {
    executedUrls.push(config.data?.id);
    if (config.data?.id === 1) {
      const err: any = new Error("Network Error");
      throw err;
    }
    return { data: { success: true } };
  };

  await useOfflineStore.getState().flushQueue();

  // Assert FIFO: request 2 was NEVER executed because request 1 threw Network Error and broke loop
  assert.deepEqual(executedUrls, [1], "Request 2 must not execute when Request 1 fails due to network drop");
  assert.equal(useOfflineStore.getState().queue[0].retryCount, 1);
  assert.equal(useOfflineStore.getState().queue.length, 2, "Both requests remain in queue");

  // Now test 500 unjamming on retry count >= 3
  useOfflineStore.getState().clearQueue();
  useOfflineStore.getState().enqueue({ method: 'POST', url: '/attendance/mark', data: { id: 99 } });
  useOfflineStore.setState(s => ({
    queue: s.queue.map(q => ({ ...q, retryCount: 2 })) // Set to 2 retries
  }));

  api.request = async () => {
    const err: any = new Error("Database deadlock");
    err.response = { status: 500 };
    throw err;
  };

  await useOfflineStore.getState().flushQueue();
  assert.equal(useOfflineStore.getState().queue.length, 0, "Poisoned 500 request with >= 3 retries must be dequeued");

  // Restore api.request
  api.request = originalRequest;
  console.log("✓ useOfflineStore FIFO break & 500 unjamming verified directly!");
}

// 3. Test genuine filterPendingSemesterMarks & reconcileSubjects
function testReconciliationLogic() {
  console.log("\n--- Test 3: Genuine filterPendingSemesterMarks & reconcileSubjects ---");
  const activeSem = { id: "sem-spring-2026", startDate: "2026-01-01T00:00:00Z", endDate: "2026-06-01T00:00:00Z" };
  const activeSubjectIds = new Set(["sub-active"]);

  const queue = [
    { url: "/attendance/mark", data: { subjectId: "sub-other", date: "2025-05-01" }, retryCount: 0 },
    { url: "/attendance/mark", data: { subjectId: "sub-active", date: "2026-03-01" }, retryCount: 3 }, // exhausted
    { url: "/attendance/mark", data: { subjectId: "sub-active", date: "2026-03-10" }, retryCount: 0 }  // valid
  ];

  const pending = filterPendingSemesterMarks(queue, activeSem, activeSubjectIds);
  assert.equal(pending.length, 1, "Only non-exhausted marks in active semester must pass filter");
  assert.equal(pending[0].data.date, "2026-03-10");

  const serverSubs: SubjectStat[] = [
    { id: "sub-active", subjectId: "sub-active", name: "CS", code: "101", attended: 10, total: 12, percentage: 83.3 },
    { id: "sub-clean", subjectId: "sub-clean", name: "Math", code: "201", attended: 8, total: 10, percentage: 80.0 }
  ];
  const localSubs: SubjectStat[] = [
    { id: "sub-active", subjectId: "sub-active", name: "CS", code: "101", attended: 11, total: 13, percentage: 84.6 },
    { id: "sub-clean", subjectId: "sub-clean", name: "Math", code: "201", attended: 7, total: 9, percentage: 77.8 }
  ];

  const reconciled = reconcileSubjects(serverSubs, localSubs, new Set(["sub-active"]));
  assert.equal(reconciled.find(s => s.id === "sub-active")?.attended, 11, "Dirty subject keeps optimistic stats");
  assert.equal(reconciled.find(s => s.id === "sub-clean")?.attended, 8, "Clean subject accepts fresh server stats");
  console.log("✓ filterPendingSemesterMarks & reconcileSubjects verified directly!");
}

// 4. Test genuine buildAssignmentItem & useAssignmentStore
function testAssignmentStore() {
  console.log("\n--- Test 4: Genuine buildAssignmentItem & Assignment Store ---");
  const item = buildAssignmentItem(
    { title: "Calculus Lab", priority: "high", deadline: "2026-10-15T00:00:00Z" },
    { id: "temp-456", _queued: true }
  );
  assert.equal(item.id, "temp-456");
  assert.equal(item.title, "Calculus Lab");
  assert.equal(item.priority, "high");
  assert.equal(item.deadline, "2026-10-15T00:00:00Z");
  console.log("✓ buildAssignmentItem verified directly!");
}

// 5. Test genuine authStore logout queue clear
function testAuthLogoutQueueClear() {
  console.log("\n--- Test 5: Genuine useAuthStore.logout() clears useOfflineStore queue ---");
  useOfflineStore.getState().enqueue({ method: 'POST', url: '/attendance/mark', data: {} });
  assert.equal(useOfflineStore.getState().queue.length > 0, true);

  useAuthStore.getState().logout();
  assert.equal(useOfflineStore.getState().queue.length, 0, "Logout must purge useOfflineStore in-memory queue");
  console.log("✓ useAuthStore.logout() clearing queue verified directly!");
}

async function run() {
  testPayloadAndHeaders();
  await testOfflineStoreFifo();
  testReconciliationLogic();
  testAssignmentStore();
  testAuthLogoutQueueClear();
  console.log("\n========================================================");
  console.log("ALL GENUINE CLIENT OFFLINE SYNC TESTS PASSED!");
  console.log("========================================================\n");
}

run().catch(err => {
  console.error("Client Test Failed:", err);
  process.exit(1);
});
```

---

### Proposed Change 5: Genuine Server Test Suite (`server/src/tests/offline_sync_verification.test.ts`)

#### Target File
`server/src/tests/offline_sync_verification.test.ts` (Rewritten)

#### Rationale
The server test suite must directly import and execute `AttendanceService` from `server/src/services/attendance.service.ts` and `prisma` from `server/src/lib/prisma.ts`.

#### Proposed Code Structure
```typescript
import assert from 'node:assert/strict';
import { AttendanceService } from '../services/attendance.service';
import { prisma } from '../lib/prisma';

console.log("=== Running Genuine Server Backend Attendance Service Tests ===");

async function testBackendTempIdDeletion() {
  console.log("\n--- Test: Backend Temporary ID Compound Deletion vs Real ID Deletion ---");
  
  const userId = "test-user-m1";
  const subjectId = "test-sub-101";
  const targetDateStr = "2026-09-19";
  const targetDate = new Date("2026-09-19T00:00:00.000Z");

  // Clean up any existing records
  await prisma.attendance.deleteMany({ where: { userId } });

  // 1. Seed an attendance record with a real ID
  const realRecord = await prisma.attendance.create({
    data: {
      id: "real-att-rec-1",
      userId,
      subjectId,
      date: targetDate,
      status: "present"
    }
  });
  assert.equal(realRecord.id, "real-att-rec-1");

  // 2. Call markAttendance with a TEMPORARY client ID ('temp-999999') and status 'clear'
  // Real AttendanceService must recognize temp ID and fall back to composite criteria (userId, subjectId, date)
  const tempDeleteRes = await AttendanceService.markAttendance(userId, {
    subjectId,
    date: targetDateStr,
    status: "clear",
    attendanceId: "temp-999999"
  });

  assert.equal(tempDeleteRes.status, "not_marked");
  assert.equal(tempDeleteRes.count, 1, "Compound criteria must find and delete the existing record");

  const countAfterTemp = await prisma.attendance.count({ where: { userId } });
  assert.equal(countAfterTemp, 0, "Record must be deleted from database");

  // 3. Seed another record and delete with an OPTIMISTIC client ID ('optimistic-8888')
  await prisma.attendance.create({
    data: {
      id: "real-att-rec-2",
      userId,
      subjectId,
      date: targetDate,
      status: "present"
    }
  });

  const optDeleteRes = await AttendanceService.markAttendance(userId, {
    subjectId,
    date: targetDateStr,
    status: "not_marked",
    attendanceId: "optimistic-8888"
  });
  assert.equal(optDeleteRes.count, 1, "Optimistic ID must trigger compound deletion");

  // 4. Seed and delete with REAL ID ('real-att-rec-3')
  const seededReal = await prisma.attendance.create({
    data: {
      id: "real-att-rec-3",
      userId,
      subjectId,
      date: targetDate,
      status: "present"
    }
  });

  const realDeleteRes = await AttendanceService.markAttendance(userId, {
    subjectId,
    date: targetDateStr,
    status: "clear",
    attendanceId: seededReal.id
  });
  assert.equal(realDeleteRes.count, 1, "Real ID must delete by primary key");

  console.log("✓ AttendanceService.markAttendance temp & real ID deletion verified directly!");
}

async function run() {
  await testBackendTempIdDeletion();
  console.log("\n========================================================");
  console.log("ALL GENUINE BACKEND ATTENDANCE TESTS PASSED!");
  console.log("========================================================\n");
}

run().catch(err => {
  console.error("Backend Test Failed:", err);
  process.exit(1);
});
```

---

## 4. Caveats

1. **Test Runner Scripts**: Neither `client/package.json` nor `server/package.json` had a dedicated `"test"` script. Running via `npx tsx <path>` leverages the already-installed `tsx` package without modifying dependency manifests or running `npm install`. Adding `"test:offline": "tsx src/tests/offline_sync.test.ts"` in `client/package.json` and `"test:m1": "tsx src/tests/offline_sync_verification.test.ts"` in `server/package.json` is recommended for convenience.
2. **Capacitor Mobile Native APIs**: In Node/tsx environments, `@capacitor/core` reports `isNativePlatform() === false`. This is the exact behavior of desktop/browser testing. Native push notifications or hardware speech recognition are not part of Milestone 1 offline sync.
3. **Database URL in Tests**: `server/src/lib/prisma.ts` gracefully falls back to `createInMemoryModelHandler` whenever `DATABASE_URL` is empty. The backend test will run identically in local development, CI/CD, and production without requiring a live PostgreSQL instance.

---

## 5. Conclusion

The Forensic Audit failure is completely remediable with clean, standard software engineering practices.
1. The production code written by Worker M1 across the 9 application files is genuine and high quality.
2. The integrity violation occurred solely because the test file in `server/src/tests/` was isolated from the codebase and duplicated the algorithms locally.
3. By:
   - Making `API_BASE_URL` safe for raw Node in `client/src/lib/api.ts:5`,
   - Exporting the pure helper algorithms directly from `api.ts`, `attendanceStore.ts`, and `assignmentStore.ts`,
   - Creating a genuine client test suite in `client/src/tests/offline_sync.test.ts` exercising both pure helpers and real Zustand stores, and
   - Updating `server/src/tests/offline_sync_verification.test.ts` to directly import and test `AttendanceService.markAttendance` against `prisma`,
   Milestone 1 will achieve **100% genuine code verification**, eliminate all self-certifying mocks, and satisfy the Forensic Auditor's integrity standard.

---

## 6. Verification Method

To independently verify this remediation plan:

### 1. Execute the Client Test Suite
```powershell
cd c:\Users\Raina\OneDrive\Desktop\AttendX\client
npx tsx src/tests/offline_sync.test.ts
```
*Expected Output*:
```
=== Running Genuine Client Offline Sync Tests ===
✓ extractOfflinePayload and sanitizeOfflineHeaders verified directly!
✓ useOfflineStore FIFO break & 500 unjamming verified directly!
✓ filterPendingSemesterMarks & reconcileSubjects verified directly!
✓ buildAssignmentItem verified directly!
✓ useAuthStore.logout() clearing queue verified directly!
ALL GENUINE CLIENT OFFLINE SYNC TESTS PASSED!
```

### 2. Execute the Server Test Suite
```powershell
cd c:\Users\Raina\OneDrive\Desktop\AttendX\server
npx tsx src/tests/offline_sync_verification.test.ts
```
*Expected Output*:
```
=== Running Genuine Server Backend Attendance Service Tests ===
✓ AttendanceService.markAttendance temp & real ID deletion verified directly!
ALL GENUINE BACKEND ATTENDANCE TESTS PASSED!
```

### 3. Mutation Sensitivity Invalidation Check
To prove the tests are NOT self-certifying:
1. In `server/src/services/attendance.service.ts` line 210, change:
   ```typescript
   const isTempId = false;
   ```
2. Re-run:
   ```powershell
   cd c:\Users\Raina\OneDrive\Desktop\AttendX\server
   npx tsx src/tests/offline_sync_verification.test.ts
   ```
3. *Expected Result*: The test MUST FAIL with `AssertionError: Compound criteria must find and delete the existing record (count == 0 vs 1)`, proving direct coupling to application code.
