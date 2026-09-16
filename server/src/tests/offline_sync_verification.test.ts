import assert from 'node:assert/strict';
import { AttendanceService } from '../services/attendance.service';
import prisma from '../lib/prisma';

console.log("=== Running Genuine Server Offline Sync Verification Tests ===");

async function testTempIdDeletionResolution() {
  console.log("\n--- Test 1: AttendanceService Temp ID Deletion Resolution ---");

  const userId = "user-m1-audit-temp";
  const subjectId = "sub-cs-101";
  const testDate = "2026-09-19T00:00:00.000Z";
  const slotId = "slot-cs-1";

  // Seed real attendance record in database
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

  // Client queued an offline unmark/clear with a temporary ID ("temp-offline-123")
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
  console.log("✓ Temp ID composite deletion passed");
}

async function testOptimisticIdDeletionResolution() {
  console.log("\n--- Test 2: AttendanceService Optimistic ID Deletion Resolution ---");

  const userId = "user-m1-audit-opt";
  const subjectId = "sub-cs-102";
  const testDate = "2026-09-19T00:00:00.000Z";
  const slotId = "slot-cs-2";

  // Seed real attendance record
  await prisma.attendance.create({
    data: {
      id: "real-db-att-8888",
      userId,
      subjectId,
      date: new Date(testDate),
      status: "absent",
      timetableSlotId: slotId,
    },
  });

  // Client clears with "optimistic-offline-456"
  const optIdResult = await AttendanceService.markAttendance(userId, {
    subjectId,
    date: testDate,
    status: "clear",
    attendanceId: "optimistic-offline-456",
    timetableSlotId: slotId,
  });

  assert.equal(optIdResult.status, "not_marked");
  assert.equal(optIdResult.count, 1, "Must delete 1 record via composite criteria for optimistic- ID");

  const deletedCheckOpt = await prisma.attendance.findUnique({
    where: { id: "real-db-att-8888" },
  });
  assert.equal(deletedCheckOpt, null, "Database record must be deleted for optimistic- ID");
  console.log("✓ Optimistic ID composite deletion passed");
}

async function testRealDatabaseIdDeletion() {
  console.log("\n--- Test 3: AttendanceService Real Primary ID Deletion ---");

  const userId = "user-m1-audit-real";
  const subjectId = "sub-cs-103";
  const testDate = "2026-09-19T00:00:00.000Z";
  const slotId = "slot-cs-3";

  // Seed record
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

  assert.equal(realIdResult.status, "not_marked");
  assert.equal(realIdResult.count, 1);

  const deletedCheckReal = await prisma.attendance.findUnique({
    where: { id: "real-db-att-7777" },
  });
  assert.equal(deletedCheckReal, null, "Database record must be deleted via primary ID path");
  console.log("✓ Real ID direct deletion passed");
}

async function testIsolationAndBoundaryCriteria() {
  console.log("\n--- Test 4: Subject & Date Boundary Isolation ---");

  const userId = "user-m1-audit-iso";
  const testDate = "2026-09-19T00:00:00.000Z";

  // Seed two distinct subjects
  await prisma.attendance.create({
    data: {
      id: "real-att-subject-a",
      userId,
      subjectId: "subject-A",
      date: new Date(testDate),
      status: "present",
    },
  });

  await prisma.attendance.create({
    data: {
      id: "real-att-subject-b",
      userId,
      subjectId: "subject-B",
      date: new Date(testDate),
      status: "present",
    },
  });

  // Clear subject-A with temp ID
  await AttendanceService.markAttendance(userId, {
    subjectId: "subject-A",
    date: testDate,
    status: "not_marked",
    attendanceId: "temp-offline-a",
  });

  // Subject A must be deleted
  const subjectACheck = await prisma.attendance.findUnique({
    where: { id: "real-att-subject-a" },
  });
  assert.equal(subjectACheck, null, "Subject A record must be deleted");

  // Subject B must remain intact
  const subjectBCheck = await prisma.attendance.findUnique({
    where: { id: "real-att-subject-b" },
  });
  assert.ok(subjectBCheck, "Subject B record must remain untouched");
  assert.equal(subjectBCheck.status, "present");
  console.log("✓ Subject boundary isolation passed");
}

async function testOfflineSyncRecordUpdate() {
  console.log("\n--- Test 5: Offline Sync Existing Record Status Update ---");

  const userId = "user-m1-audit-update";
  const subjectId = "sub-cs-105";
  const testDate = "2026-09-19T00:00:00.000Z";
  const slotId = "slot-cs-5";

  // Seed existing record as absent
  const initial = await prisma.attendance.create({
    data: {
      id: "real-att-existing-105",
      userId,
      subjectId,
      date: new Date(testDate),
      status: "absent",
      timetableSlotId: slotId,
    },
  });
  assert.equal(initial.status, "absent");

  // Client marks it 'present' while offline and syncs with a temp attendanceId
  const updateResult = await AttendanceService.markAttendance(userId, {
    subjectId,
    date: testDate,
    status: "present",
    attendanceId: "temp-offline-mark-105",
    timetableSlotId: slotId,
  });

  assert.equal(updateResult.id, "real-att-existing-105", "Must update existing record, not create duplicate");
  assert.equal(updateResult.status, "present", "Status must be updated to present");

  const updatedCheck = await prisma.attendance.findUnique({
    where: { id: "real-att-existing-105" },
  });
  assert.equal(updatedCheck?.status, "present");
  console.log("✓ Record status update passed");
}

async function runAll() {
  await testTempIdDeletionResolution();
  await testOptimisticIdDeletionResolution();
  await testRealDatabaseIdDeletion();
  await testIsolationAndBoundaryCriteria();
  await testOfflineSyncRecordUpdate();

  console.log("\n========================================================");
  console.log("ALL GENUINE SERVER OFFLINE SYNC VERIFICATION TESTS PASSED!");
  console.log("========================================================\n");
}

runAll().catch((err) => {
  console.error("Server verification test failed:", err);
  process.exit(1);
});
