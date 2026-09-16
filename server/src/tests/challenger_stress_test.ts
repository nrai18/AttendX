import assert from 'node:assert/strict';
import { AttendanceService } from '../services/attendance.service';
import prisma from '../lib/prisma';

console.log("=== Running Genuine Server Challenger Stress Tests ===");

async function testRapidFireStatusToggling() {
  console.log("\n--- Stress Suite 1: Rapid-Fire Status Toggling on Same Slot ---");

  const userId = "user-stress-toggle";
  const subjectId = "sub-toggle-101";
  const testDate = "2026-09-19T00:00:00.000Z";
  const slotId = "slot-toggle-1";

  // 1. Initial mark: present
  const res1 = await AttendanceService.markAttendance(userId, {
    subjectId,
    date: testDate,
    status: "present",
    timetableSlotId: slotId,
  });
  assert.equal(res1.status, "present");

  // 2. Toggle to absent
  const res2 = await AttendanceService.markAttendance(userId, {
    subjectId,
    date: testDate,
    status: "absent",
    timetableSlotId: slotId,
    attendanceId: res1.id,
  });
  assert.equal(res2.status, "absent");
  assert.equal(res2.id, res1.id, "Should update the same record");

  // 3. Toggle to present with temp ID (simulating offline replay)
  const res3 = await AttendanceService.markAttendance(userId, {
    subjectId,
    date: testDate,
    status: "present",
    timetableSlotId: slotId,
    attendanceId: "temp-toggle-replay-99",
  });
  assert.equal(res3.status, "present");
  assert.equal(res3.id, res1.id, "Should find and update existing record by composite criteria");

  // 4. Clear attendance with temp ID
  const res4 = await AttendanceService.markAttendance(userId, {
    subjectId,
    date: testDate,
    status: "clear",
    timetableSlotId: slotId,
    attendanceId: "temp-toggle-clear-100",
  });
  assert.equal(res4.status, "not_marked");
  assert.equal(res4.count, 1);

  // Final check: record deleted
  const finalCheck = await prisma.attendance.findUnique({
    where: { id: res1.id },
  });
  assert.equal(finalCheck, null, "Record must be deleted after final clear");

  console.log("✓ Rapid-fire status toggling passed");
}

async function testMultiSubjectBatchIsolation() {
  console.log("\n--- Stress Suite 2: Multi-Subject Batch Isolation ---");

  const userId = "user-stress-batch";
  const testDate = "2026-09-19T00:00:00.000Z";
  const subjectIds = Array.from({ length: 10 }, (_, i) => `sub-batch-${i}`);

  // Create marks for all 10 subjects
  for (const subId of subjectIds) {
    await AttendanceService.markAttendance(userId, {
      subjectId: subId,
      date: testDate,
      status: "present",
    });
  }

  // Clear only subject 3 with a temporary ID
  const targetSub = subjectIds[3];
  const clearRes = await AttendanceService.markAttendance(userId, {
    subjectId: targetSub,
    date: testDate,
    status: "not_marked",
    attendanceId: "temp-clear-sub-3",
  });
  assert.equal(clearRes.count, 1);

  // Verify remaining 9 subjects are still present
  const allUserRecords = await prisma.attendance.findMany({
    where: { userId },
  });
  assert.equal(allUserRecords.length, 9, "Exactly 9 records must remain");

  const targetCheck = allUserRecords.find((r) => r.subjectId === targetSub);
  assert.equal(targetCheck, undefined, "Target subject 3 must be deleted");

  console.log("✓ Multi-subject batch isolation passed");
}

async function testOverrideIdHandling() {
  console.log("\n--- Stress Suite 3: Override ID Deletion Resolution ---");

  const userId = "user-stress-override";
  const subjectId = "sub-override-202";
  const testDate = "2026-09-19T00:00:00.000Z";
  const overrideId = "override-holiday-comp-1";

  // Mark attendance on an override slot
  const marked = await AttendanceService.markAttendance(userId, {
    subjectId,
    date: testDate,
    status: "present",
    overrideId,
  });
  assert.equal(marked.status, "present");

  // Clear attendance using temporary ID and matching overrideId
  const cleared = await AttendanceService.markAttendance(userId, {
    subjectId,
    date: testDate,
    status: "clear",
    attendanceId: "temp-override-unmark",
    overrideId,
  });
  assert.equal(cleared.count, 1);

  const check = await prisma.attendance.findUnique({
    where: { id: marked.id },
  });
  assert.equal(check, null, "Record on override slot must be deleted");

  console.log("✓ Override ID deletion resolution passed");
}

async function runAll() {
  await testRapidFireStatusToggling();
  await testMultiSubjectBatchIsolation();
  await testOverrideIdHandling();

  console.log("\n========================================================");
  console.log("ALL GENUINE SERVER CHALLENGER STRESS TESTS PASSED!");
  console.log("========================================================\n");
}

runAll().catch((err) => {
  console.error("Stress test failed:", err);
  process.exit(1);
});
