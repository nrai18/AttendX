import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";
import { DocumentController } from "../controllers/document.controller";
import { TimetableService } from "../services/timetable.service";
import { DataService } from "../services/data.service";
import { prisma } from "../lib/prisma";

console.log("=== Running Genuine Backup Import/Export & Data Integrity Tests ===");

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
    send(data: any) {
      this.body = data;
      return this;
    },
    setHeader(key: string, val: string) {
      this.headers[key] = val;
      return this;
    },
  };
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite 1: Document Download BOLA / IDOR Ownership Enforcement
// ─────────────────────────────────────────────────────────────────────────────
async function testDocumentDownloadBOLA() {
  console.log("\n--- Test Suite 1: Document Download BOLA / IDOR Enforcement ---");

  const victimUser = "user-victim-101";
  const attackerUser = "user-attacker-202";

  // Seed documents owned by victim and attacker
  const victimDoc = await prisma.storedDocument.create({
    data: {
      id: "doc-victim-secret-1",
      userId: victimUser,
      name: "victim_backup.zip",
      fileUrl: "/uploads/victim_backup.zip",
      fileData: Buffer.from("CONFIDENTIAL_VICTIM_ATTENDANCE_DATA"),
      mimeType: "application/zip",
      type: "BACKUP",
    },
  });

  const attackerDoc = await prisma.storedDocument.create({
    data: {
      id: "doc-attacker-public-2",
      userId: attackerUser,
      name: "attacker_backup.zip",
      fileUrl: "/uploads/attacker_backup.zip",
      fileData: Buffer.from("ATTACKER_DATA"),
      mimeType: "application/zip",
      type: "BACKUP",
    },
  });

  // Scenario 1: Unauthenticated request
  const unauthReq: any = {
    params: { id: victimDoc.id },
    user: undefined,
  };
  const res1 = createMockResponse();
  await DocumentController.downloadDocument(unauthReq, res1);
  assert.equal(res1.statusCode, 401, "Unauthenticated download request must be rejected with 401");
  console.log("✓ Unauthenticated request rejected with 401");

  // Scenario 2: Attacker attempts to download victim's document (IDOR attempt)
  const attackerReq: any = {
    params: { id: victimDoc.id },
    user: { userId: attackerUser, role: "student" },
  };
  const res2 = createMockResponse();
  await DocumentController.downloadDocument(attackerReq, res2);
  assert.equal(res2.statusCode, 403, "Cross-user document access must be rejected with 403 Forbidden");
  assert.equal(res2.body?.message, "Forbidden: You do not own this document");
  assert.notEqual(res2.body, "CONFIDENTIAL_VICTIM_ATTENDANCE_DATA", "Document data must never leak to non-owner");
  console.log("✓ Cross-user IDOR attempt blocked with 403 Forbidden");

  // Scenario 3: Request for non-existent document
  const notFoundReq: any = {
    params: { id: "doc-non-existent-999" },
    user: { userId: attackerUser, role: "student" },
  };
  const res3 = createMockResponse();
  await DocumentController.downloadDocument(notFoundReq, res3);
  assert.equal(res3.statusCode, 404, "Non-existent document must return 404");
  console.log("✓ Non-existent document returns 404");

  // Scenario 4: Legitimate owner downloads their own document
  const victimReq: any = {
    params: { id: victimDoc.id },
    user: { userId: victimUser, role: "student" },
  };
  const res4 = createMockResponse();
  await DocumentController.downloadDocument(victimReq, res4);
  assert.equal(res4.statusCode, 200, "Owner must be allowed to download document with 200");
  assert.equal(res4.headers["Content-Type"], "application/zip");
  assert.equal(
    res4.body?.toString(),
    "CONFIDENTIAL_VICTIM_ATTENDANCE_DATA",
    "Owner receives genuine file content"
  );
  console.log("✓ Legitimate owner download verified successfully");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite 2: Compound Deduplication Key Preserving Multi-Slot Classes
// ─────────────────────────────────────────────────────────────────────────────
async function testCompoundDeduplicationKey() {
  console.log("\n--- Test Suite 2: Compound Deduplication Key Preserves Multi-Slot Lectures ---");

  const userId = "user-dedup-303";
  const semesterId = "sem-dedup-303";

  // Create active semester
  await prisma.semester.create({
    data: {
      id: semesterId,
      userId,
      name: "Spring 2026",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-05-31"),
      isActive: true,
    },
  });

  // Payload with two lectures on the SAME day for the SAME subject:
  // Lecture 1: Morning lecture (09:00 - 10:00)
  // Lecture 2: Afternoon practical lab (14:00 - 16:00)
  const payload = {
    subjects: [
      { code: "CS201", name: "Data Structures & Algorithms", credits: 4, colorHex: "#3b82f6" },
    ],
    slots: [
      {
        subjectCode: "CS201",
        dayOfWeek: 0, // Monday
        startTime: "09:00",
        endTime: "10:00",
        slotType: "lecture",
        room: "Hall-1",
      },
      {
        subjectCode: "CS201",
        dayOfWeek: 0, // Monday
        startTime: "14:00",
        endTime: "16:00",
        slotType: "practical",
        room: "Lab-3",
      },
    ],
    lectureLogs: [
      {
        date: "2026-09-21T00:00:00.000Z",
        subjectCode: "CS201",
        slotId: "slot-morning-1",
        startTime: "09:00",
        status: "present",
      },
      {
        date: "2026-09-21T00:00:00.000Z",
        subjectCode: "CS201",
        slotId: "slot-afternoon-2",
        startTime: "14:00",
        status: "present",
      },
    ],
  };

  const importResult = await TimetableService.importTimetable(userId, semesterId, payload);
  assert.equal(importResult.importedSubjects, 1, "Must import 1 subject");
  assert.equal(importResult.importedSlots, 2, "Must import 2 slots");
  assert.equal(
    importResult.importedLogs,
    2,
    "Must preserve BOTH multi-slot classes on the same date (deduplication key must not drop slot 2)"
  );

  // Verify records in DB
  const importedLogsInDb = await prisma.attendance.findMany({
    where: { userId, subject: { semesterId } },
  });
  assert.equal(importedLogsInDb.length, 2, "Both attendance records must be present in database");
  console.log("✓ Compound deduplication preserved multiple classes on the same day without data loss");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite 3: Timetable Import Atomic Transaction Rollback
// ─────────────────────────────────────────────────────────────────────────────
async function testImportTransactionRollback() {
  console.log("\n--- Test Suite 3: Timetable Import Atomic Transaction & Rollback ---");

  const userId = "user-rollback-404";
  const semesterId = "sem-rollback-404";

  await prisma.semester.create({
    data: {
      id: semesterId,
      userId,
      name: "Fall 2026",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-12-31"),
      isActive: true,
    },
  });

  // Seed baseline subject and slot
  const baseSub = await prisma.subject.create({
    data: {
      id: "sub-baseline-1",
      semesterId,
      userId,
      name: "Computer Networks",
      code: "CS301",
    },
  });

  await prisma.timetableSlot.create({
    data: {
      id: "slot-baseline-1",
      semesterId,
      subjectId: baseSub.id,
      dayOfWeek: 1,
      startTime: "10:00",
      endTime: "11:00",
      slotType: "lecture",
    },
  });

  // Create an invalid payload (missing subjects array)
  let threwValidationError = false;
  try {
    await TimetableService.importTimetable(userId, semesterId, { subjects: "not-an-array", slots: [] } as any);
  } catch (err: any) {
    threwValidationError = true;
  }
  assert.ok(threwValidationError, "Invalid payload must throw error before executing mutations");

  // Verify baseline schedule was untouched
  const slotsAfterValidationFail = await prisma.timetableSlot.findMany({
    where: { semesterId, validUntil: null },
  });
  assert.equal(slotsAfterValidationFail.length, 1, "Baseline slots must remain active after validation failure");
  assert.equal(slotsAfterValidationFail[0].id, "slot-baseline-1");

  console.log("✓ Validation pre-check prevented destructive operations on invalid payload");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite 4: Attendance Status Preservation in CSV Export & Import
// ─────────────────────────────────────────────────────────────────────────────
async function testCSVStatusPreservation() {
  console.log("\n--- Test Suite 4: Attendance Status Preservation (medical, od, cancelled) ---");

  const userId = "user-status-505";
  const semesterId = "sem-status-505";

  // Create active semester
  await prisma.semester.create({
    data: {
      id: semesterId,
      userId,
      name: "Semester 5",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-06-30"),
      isActive: true,
    },
  });

  const subject = await prisma.subject.create({
    data: {
      id: "sub-status-os",
      semesterId,
      userId,
      name: "Operating Systems",
      code: "CS501",
      targetAttendance: 80,
    },
  });

  await prisma.timetableSlot.create({
    data: {
      id: "slot-status-os",
      semesterId,
      subjectId: subject.id,
      dayOfWeek: 0,
      startTime: "09:00",
      endTime: "10:00",
      slotType: "lecture",
    },
  });

  // Seed logs with every distinct status enum
  const statusesToTest = ["present", "absent", "medical", "od", "cancelled", "off"] as const;
  for (let i = 0; i < statusesToTest.length; i++) {
    const st = statusesToTest[i];
    await prisma.attendance.create({
      data: {
        id: `att-status-${st}-${i}`,
        userId,
        subjectId: subject.id,
        date: new Date(`2026-02-0${i + 1}T00:00:00.000Z`),
        status: st as any,
        remarks: `Testing status ${st}`,
      },
    });
  }

  // 1. Export Data to ZIP
  const zipBuffer = await DataService.exportData(userId);
  assert.ok(zipBuffer && zipBuffer.length > 0, "ZIP buffer must be non-empty");

  const zip = new AdmZip(zipBuffer);
  const logsEntry = zip.getEntry("attendance_logs.csv");
  assert.ok(logsEntry, "attendance_logs.csv must be present in export ZIP");

  const csvContent = logsEntry.getData().toString("utf8");
  const parsedRows = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true }) as any[];

  // Verify exact statuses in exported CSV
  const exportedStatuses = parsedRows.map((r: any) => r["Attendance"]);
  for (const st of statusesToTest) {
    assert.ok(
      exportedStatuses.includes(st),
      `Exported CSV must contain genuine status string '${st}', found: ${JSON.stringify(exportedStatuses)}`
    );
  }
  console.log("✓ Exported CSV successfully preserved genuine statuses:", exportedStatuses);

  // 2. Import Data back and verify restoration
  await DataService.importData(userId, zipBuffer);

  const restoredLogs = await prisma.attendance.findMany({
    where: { userId },
  });

  const restoredStatuses = restoredLogs.map((l: any) => l.status);
  for (const st of statusesToTest) {
    assert.ok(
      restoredStatuses.includes(st),
      `Restored database logs must contain status '${st}', found: ${JSON.stringify(restoredStatuses)}`
    );
  }
  console.log("✓ Re-imported database records successfully retained exact statuses:", restoredStatuses);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite 5: Foreign Key Violation Prevention on Semester Wipe
// ─────────────────────────────────────────────────────────────────────────────
async function testForeignKeyViolationPrevention() {
  console.log("\n--- Test Suite 5: Foreign Key Violation Prevention on Semester Wipe ---");

  const userId = "user-fk-606";
  const semesterId = "sem-fk-606";

  await prisma.semester.create({
    data: {
      id: semesterId,
      userId,
      name: "Semester 6",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-12-31"),
      isActive: true,
    },
  });

  const subject = await prisma.subject.create({
    data: {
      id: "sub-fk-algo",
      semesterId,
      userId,
      name: "Advanced Algorithms",
      code: "CS601",
    },
  });

  // Create a TimetableOverride referencing subject (no cascade relation in schema)
  const override = await prisma.timetableOverride.create({
    data: {
      id: "ov-fk-1",
      semesterId,
      date: new Date("2026-08-15"),
      overrideType: "extra_class",
      subjectId: subject.id,
    },
  });

  // Create an Attendance log referencing the override
  await prisma.attendance.create({
    data: {
      id: "att-fk-1",
      userId,
      subjectId: subject.id,
      date: new Date("2026-08-15"),
      status: "present",
      overrideId: override.id,
    },
  });

  // Export current data
  const zipBuffer = await DataService.exportData(userId);

  // Re-importing triggers the semester wipe (wipes subjects, slots, overrides, attendance)
  // Under the old code, deleting subject before override caused a Foreign Key constraint crash
  let wipeFailed = false;
  try {
    await DataService.importData(userId, zipBuffer);
  } catch (err) {
    wipeFailed = true;
    console.error("Wipe failed with error:", err);
  }

  assert.equal(
    wipeFailed,
    false,
    "Semester wipe must succeed without foreign key constraint violations when overrides exist"
  );
  console.log("✓ Semester wipe cleanly deleted overrides and logs before subjects without FK violations");
}

// ─────────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────────
async function runAllTests() {
  try {
    await testDocumentDownloadBOLA();
    await testCompoundDeduplicationKey();
    await testImportTransactionRollback();
    await testCSVStatusPreservation();
    await testForeignKeyViolationPrevention();

    console.log("\n========================================================");
    console.log("ALL GENUINE BACKUP IMPORT/EXPORT & DATA INTEGRITY TESTS PASSED!");
    console.log("========================================================\n");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ TEST SUITE FAILED:", err);
    process.exit(1);
  }
}

runAllTests();
