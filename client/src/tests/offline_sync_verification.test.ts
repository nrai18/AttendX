import assert from 'node:assert/strict';

// Lightweight browser global shim for Node.js execution with Capacitor Preferences
if (typeof globalThis.window === 'undefined') {
  const memoryStorage = new Map<string, string>();
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => memoryStorage.get(k) ?? null,
      setItem: (k: string, v: string) => memoryStorage.set(k, String(v)),
      removeItem: (k: string) => memoryStorage.delete(k),
      clear: () => memoryStorage.clear(),
    },
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

import { extractOfflinePayload, sanitizeOfflineHeaders, api } from '../lib/api';
import { filterPendingMarksForSemester, reconcileSubjects, type SubjectStat } from '../stores/attendanceStore';
import { useOfflineStore } from '../stores/offlineStore';
import { useAssignmentStore } from '../stores/assignmentStore';

console.log("=== Running Genuine Client Offline Sync Verification Tests ===");

// ---------------------------------------------------------------------------
// 1. Test extractOfflinePayload from client/src/lib/api.ts
// ---------------------------------------------------------------------------
function testExtractOfflinePayload() {
  console.log("\n--- Test 1: extractOfflinePayload Edge Cases ---");

  // Case A: Valid JSON string
  const jsonStr = JSON.stringify({ subjectId: "sub-101", date: "2026-09-19", status: "present" });
  const parsedFromStr = extractOfflinePayload(jsonStr);
  assert.equal(typeof parsedFromStr, "object");
  assert.equal(parsedFromStr.subjectId, "sub-101");
  assert.equal(parsedFromStr.status, "present");

  // Case B: Plain object (deep clone verification)
  const originalObj = { subjectId: "sub-102", nested: { a: 1 } };
  const clonedObj = extractOfflinePayload(originalObj);
  assert.deepEqual(clonedObj, originalObj);
  assert.notEqual(clonedObj, originalObj, "Must be a distinct cloned object reference");
  assert.notEqual(clonedObj.nested, originalObj.nested, "Nested object must be deeply cloned");

  // Case C: Array payload
  const arrayPayload = [{ id: 1 }, { id: 2 }];
  const extractedArray = extractOfflinePayload(arrayPayload);
  assert.deepEqual(extractedArray, arrayPayload);
  assert.notEqual(extractedArray, arrayPayload);

  // Case D: Non-JSON raw string
  const rawString = "simple_plain_text_data";
  const stringResult = extractOfflinePayload(rawString);
  assert.equal(stringResult, "simple_plain_text_data", "Non-JSON string must be preserved");

  // Case E: Malformed JSON string
  const malformedJson = "{ subjectId: invalid_unquoted }";
  const malformedResult = extractOfflinePayload(malformedJson);
  assert.equal(malformedResult, malformedJson, "Malformed string should fallback to raw string without throwing");

  // Case F: Null / undefined
  assert.equal(extractOfflinePayload(null), null);
  assert.equal(extractOfflinePayload(undefined), undefined);

  // Case G: Circular reference object (must not throw unhandled exception)
  const circularObj: any = { subjectId: "sub-circ" };
  circularObj.self = circularObj;
  const circularResult = extractOfflinePayload(circularObj);
  assert.ok(circularResult, "Circular object must not crash extractOfflinePayload");
  assert.equal(circularResult.subjectId, "sub-circ");

  console.log("✓ extractOfflinePayload passed all edge cases");
}

// ---------------------------------------------------------------------------
// 2. Test sanitizeOfflineHeaders from client/src/lib/api.ts
// ---------------------------------------------------------------------------
function testSanitizeOfflineHeaders() {
  console.log("\n--- Test 2: sanitizeOfflineHeaders Edge Cases ---");

  // Case A: Volatile headers stripped (case-insensitively)
  const rawHeaders = {
    Authorization: "Bearer expired_jwt_token",
    "x-offline-retry": "2",
    "X-Offline-Retry": "2",
    "Content-Length": "256",
    "content-length": "256",
    "Content-Type": "application/json",
    "X-Attendx-Platform": "Mobile App",
    "X-Attendx-Version": "3.7.0",
  };

  const clean = sanitizeOfflineHeaders(rawHeaders);
  assert.equal(clean.Authorization, undefined, "Authorization must be stripped");
  assert.equal(clean.authorization, undefined);
  assert.equal(clean["x-offline-retry"], undefined, "x-offline-retry must be stripped");
  assert.equal(clean["X-Offline-Retry"], undefined);
  assert.equal(clean["Content-Length"], undefined, "Content-Length must be stripped");
  assert.equal(clean["content-length"], undefined);

  // Non-volatile headers preserved
  assert.equal(clean["Content-Type"], "application/json");
  assert.equal(clean["X-Attendx-Platform"], "Mobile App");
  assert.equal(clean["X-Attendx-Version"], "3.7.0");

  // Case B: Headers with .toJSON() method (AxiosHeaders simulation)
  const axiosHeadersLike = {
    toJSON() {
      return {
        authorization: "Bearer secret",
        accept: "application/json",
      };
    },
  };
  const fromAxiosLike = sanitizeOfflineHeaders(axiosHeadersLike);
  assert.equal(fromAxiosLike.authorization, undefined);
  assert.equal(fromAxiosLike.accept, "application/json");

  // Case C: Null / undefined headers
  assert.deepEqual(sanitizeOfflineHeaders(null), {});
  assert.deepEqual(sanitizeOfflineHeaders(undefined), {});

  console.log("✓ sanitizeOfflineHeaders passed all edge cases");
}

// ---------------------------------------------------------------------------
// 3. Test filterPendingMarksForSemester from client/src/stores/attendanceStore.ts
// ---------------------------------------------------------------------------
function testFilterPendingMarksForSemester() {
  console.log("\n--- Test 3: filterPendingMarksForSemester ---");

  const activeSemester = {
    id: "sem-spring-2026",
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: "2026-06-30T23:59:59.000Z",
  };
  const activeSubjectIds = new Set(["sub-algo", "sub-os"]);

  const mockQueue = [
    // 1. Matches active subject in semester
    {
      id: "q-1",
      url: "/attendance/mark",
      retryCount: 0,
      data: { subjectId: "sub-algo", date: "2026-03-10", status: "present" },
    },
    // 2. Matches active semester ID explicitly
    {
      id: "q-2",
      url: "/attendance/mark",
      retryCount: 1,
      data: { semesterId: "sem-spring-2026", subjectId: "sub-other", date: "2026-03-11" },
    },
    // 3. Matches date range
    {
      id: "q-3",
      url: "/attendance/mark",
      retryCount: 2,
      data: { subjectId: "sub-unlisted", date: "2026-04-15" },
    },
    // 4. Exhausted retry count (>= 3) -> MUST be excluded
    {
      id: "q-4",
      url: "/attendance/mark",
      retryCount: 3,
      data: { subjectId: "sub-algo", date: "2026-03-12" },
    },
    // 5. Non-attendance URL -> MUST be excluded
    {
      id: "q-5",
      url: "/assignment/create",
      retryCount: 0,
      data: { subjectId: "sub-algo" },
    },
    // 6. Outside semester date range and different subject -> MUST be excluded
    {
      id: "q-6",
      url: "/attendance/mark",
      retryCount: 0,
      data: { subjectId: "sub-fall-class", date: "2025-10-01" },
    },
  ];

  const filtered = filterPendingMarksForSemester(mockQueue, activeSemester, activeSubjectIds);
  assert.equal(filtered.length, 3, "Only q-1, q-2, and q-3 should match");
  assert.equal(filtered[0].id, "q-1");
  assert.equal(filtered[1].id, "q-2");
  assert.equal(filtered[2].id, "q-3");

  // Edge cases: null semester, empty queue
  assert.deepEqual(filterPendingMarksForSemester([], activeSemester, activeSubjectIds), []);
  assert.deepEqual(filterPendingMarksForSemester(mockQueue, null, activeSubjectIds), []);

  console.log("✓ filterPendingMarksForSemester passed");
}

// ---------------------------------------------------------------------------
// 4. Test reconcileSubjects from client/src/stores/attendanceStore.ts
// ---------------------------------------------------------------------------
function testReconcileSubjects() {
  console.log("\n--- Test 4: reconcileSubjects ---");

  const serverSubjects: SubjectStat[] = [
    {
      id: "sub-algo",
      subjectId: "sub-algo",
      name: "Algorithms",
      code: "CS201",
      attended: 10,
      total: 12,
      percentage: 83.3,
    },
    {
      id: "sub-os",
      subjectId: "sub-os",
      name: "Operating Systems",
      code: "CS202",
      attended: 15,
      total: 16,
      percentage: 93.8,
    },
    {
      id: "sub-db",
      subjectId: "sub-db",
      name: "Database Systems",
      code: "CS203",
      attended: 8,
      total: 10,
      percentage: 80.0,
    },
  ];

  // Local state with optimistic mark applied to Algorithms (attended: 11, total: 13)
  const localSubjects: SubjectStat[] = [
    {
      id: "sub-algo",
      subjectId: "sub-algo",
      name: "Algorithms",
      code: "CS201",
      attended: 11, // optimistic
      total: 13,   // optimistic
      percentage: 84.6,
    },
    {
      id: "sub-os",
      subjectId: "sub-os",
      name: "Operating Systems",
      code: "CS201",
      attended: 14, // stale local
      total: 15,
      percentage: 93.3,
    },
  ];

  // Only Algorithms has pending offline marks
  const pendingSubjectIds = new Set(["sub-algo"]);

  const reconciled = reconcileSubjects(serverSubjects, localSubjects, pendingSubjectIds);

  // Algorithms should retain optimistic local stats
  const algo = reconciled.find((s) => s.id === "sub-algo");
  assert.ok(algo);
  assert.equal(algo!.attended, 11, "Dirty subject must preserve local optimistic attended count");
  assert.equal(algo!.total, 13, "Dirty subject must preserve local optimistic total count");

  // Operating Systems had no pending marks: must accept fresh server stats
  const os = reconciled.find((s) => s.id === "sub-os");
  assert.ok(os);
  assert.equal(os!.attended, 15, "Clean subject must accept fresh server attended count");
  assert.equal(os!.total, 16, "Clean subject must accept fresh server total count");

  // Database Systems was not in local store: must accept server stats
  const db = reconciled.find((s) => s.id === "sub-db");
  assert.ok(db);
  assert.equal(db!.attended, 8);
  assert.equal(db!.total, 10);

  console.log("✓ reconcileSubjects passed");
}

// ---------------------------------------------------------------------------
// 5. Test Live Store State Transitions (useOfflineStore & useAssignmentStore)
// ---------------------------------------------------------------------------
async function testStoreStateTransitions() {
  console.log("\n--- Test 5: Live Store State Transitions ---");

  // Test useOfflineStore FIFO Enqueue & Clear
  const offlineStore = useOfflineStore.getState();
  offlineStore.clearQueue();
  assert.equal(useOfflineStore.getState().queue.length, 0);

  offlineStore.enqueue({ method: "POST", url: "/attendance/mark", data: { id: "item-1" } });
  offlineStore.enqueue({ method: "POST", url: "/attendance/mark", data: { id: "item-2" } });

  const q = useOfflineStore.getState().queue;
  assert.equal(q.length, 2);
  assert.equal(q[0].data.id, "item-1", "FIFO order strictly preserved");
  assert.equal(q[1].data.id, "item-2");

  offlineStore.clearQueue();
  assert.equal(useOfflineStore.getState().queue.length, 0);

  // Test useAssignmentStore optimistic creation via offline error interceptor
  api.defaults.baseURL = "http://localhost:59999/api";
  const assignmentStore = useAssignmentStore.getState();
  const testAssignment = {
    title: "Lab Assignment 3",
    description: "Implement Dijkstra algorithm",
    deadline: "2026-10-01T23:59:59.000Z",
    priority: "high" as const,
    subjectId: "sub-algo",
  };

  await assignmentStore.addAssignment(testAssignment);
  const assignments = useAssignmentStore.getState().assignments;
  const added = assignments.find((a) => a.title === testAssignment.title);
  assert.ok(added, "addAssignment should save optimistic item into store state");
  assert.equal(added!.title, testAssignment.title, "Must preserve user input title");
  assert.equal(added!.description, testAssignment.description, "Must preserve user input description");
  assert.equal(added!.priority, testAssignment.priority, "Must preserve priority");
  assert.ok(added!.id.startsWith("temp-"), "Must have generated temporary ID");

  console.log("✓ Live Store state transitions passed");
}

async function runAll() {
  testExtractOfflinePayload();
  testSanitizeOfflineHeaders();
  testFilterPendingMarksForSemester();
  testReconcileSubjects();
  await testStoreStateTransitions();

  console.log("\n========================================================");
  console.log("ALL GENUINE CLIENT OFFLINE SYNC VERIFICATION TESTS PASSED!");
  console.log("========================================================\n");
}

runAll().catch((err) => {
  console.error("Client verification test failed:", err);
  process.exit(1);
});
