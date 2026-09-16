import assert from 'node:assert/strict';
import { AttendanceService } from '../services/attendance.service';
import prisma from '../lib/prisma';

console.log("=== Running Genuine Server Adversarial Challenge Tests ===");

async function testHighConcurrencyTempIdDeletions() {
  console.log("\n--- Adversarial Suite 1: High Concurrency Temp ID Deletions ---");

  const userId = "user-adv-concurrent";
  const testDate = "2026-09-19T00:00:00.000Z";
  const numRecords = 20;

  // Seed 20 distinct subject records
  for (let i = 0; i < numRecords; i++) {
    await prisma.attendance.create({
      data: {
        id: `real-db-adv-${i}`,
        userId,
        subjectId: `sub-adv-${i}`,
        date: new Date(testDate),
        status: "present",
        timetableSlotId: `slot-${i}`,
      },
    });
  }

  // Fire 20 concurrent deletion requests with temporary IDs
  const deletionPromises = Array.from({ length: numRecords }, (_, i) =>
    AttendanceService.markAttendance(userId, {
      subjectId: `sub-adv-${i}`,
      date: testDate,
      status: "not_marked",
      attendanceId: `temp-offline-bulk-${i}`,
      timetableSlotId: `slot-${i}`,
    })
  );

  const results = await Promise.all(deletionPromises);
  for (let i = 0; i < numRecords; i++) {
    assert.equal(results[i].status, "not_marked");
    assert.equal(results[i].count, 1, `Must delete record ${i}`);
  }

  // Verify all 20 records are deleted from the database
  const remaining = await prisma.attendance.findMany({
    where: { userId },
  });
  assert.equal(remaining.length, 0, "All 20 records must be deleted from the database");
  console.log("✓ High concurrency temp ID deletions passed");
}

async function testCrossUserDataSafety() {
  console.log("\n--- Adversarial Suite 2: Cross-User Data Safety ---");

  const victimUser = "user-victim";
  const attackerUser = "user-attacker";
  const testDate = "2026-09-19T00:00:00.000Z";
  const subjectId = "sub-secure-101";

  // Seed victim's record
  await prisma.attendance.create({
    data: {
      id: "victim-att-rec-1",
      userId: victimUser,
      subjectId,
      date: new Date(testDate),
      status: "present",
    },
  });

  // Attacker attempts to clear victim's record using temporary ID
  const attackResult = await AttendanceService.markAttendance(attackerUser, {
    subjectId,
    date: testDate,
    status: "not_marked",
    attendanceId: "temp-attacker-123",
  });

  assert.equal(attackResult.count, 0, "Attacker cannot delete victim's record");

  // Victim's record must still exist
  const victimRec = await prisma.attendance.findUnique({
    where: { id: "victim-att-rec-1" },
  });
  assert.ok(victimRec, "Victim record must remain intact in the database");
  assert.equal(victimRec.status, "present");
  console.log("✓ Cross-user data safety passed");
}

async function testNonExistentTempIdDeletion() {
  console.log("\n--- Adversarial Suite 3: Non-Existent Record Temp ID Handling ---");

  const userId = "user-ghost-check";
  const testDate = "2026-09-19T00:00:00.000Z";

  // Deleting a non-existent record with a temp ID should not crash or throw
  const result = await AttendanceService.markAttendance(userId, {
    subjectId: "sub-non-existent",
    date: testDate,
    status: "not_marked",
    attendanceId: "temp-ghost-id-999",
  });

  assert.equal(result.status, "not_marked");
  assert.equal(result.count, 0, "Count should be 0 when no matching record exists");
  console.log("✓ Non-existent record temp ID handling passed");
}

async function testNullSlotIdCompositeMatching() {
  console.log("\n--- Adversarial Suite 4: Null Slot ID Composite Matching ---");

  const userId = "user-null-slot";
  const testDate = "2026-09-19T00:00:00.000Z";
  const subjectId = "sub-adhoc-lecture";

  // Seed record without timetableSlotId (null)
  await prisma.attendance.create({
    data: {
      id: "adhoc-att-rec",
      userId,
      subjectId,
      date: new Date(testDate),
      status: "present",
      timetableSlotId: null,
    },
  });

  // Client clears with temp ID and no slot ID
  const clearResult = await AttendanceService.markAttendance(userId, {
    subjectId,
    date: testDate,
    status: "clear",
    attendanceId: "temp-adhoc-clear",
  });

  assert.equal(clearResult.count, 1, "Ad-hoc lecture with null slot must be cleared");

  const check = await prisma.attendance.findUnique({
    where: { id: "adhoc-att-rec" },
  });
  assert.equal(check, null, "Record must be deleted");
  console.log("✓ Null slot ID composite matching passed");
}

async function runAll() {
  await testHighConcurrencyTempIdDeletions();
  await testCrossUserDataSafety();
  await testNonExistentTempIdDeletion();
  await testNullSlotIdCompositeMatching();

  console.log("\n========================================================");
  console.log("ALL GENUINE SERVER ADVERSARIAL TESTS PASSED!");
  console.log("========================================================\n");
}

runAll().catch((err) => {
  console.error("Adversarial test failed:", err);
  process.exit(1);
});
