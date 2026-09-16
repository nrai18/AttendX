import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Lightweight Browser Global Shim for Node.js test execution
// ---------------------------------------------------------------------------
const memoryStorage = new Map<string, string>();
if (typeof globalThis.window === 'undefined') {
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
    location: { href: '' },
  };
}
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = (globalThis as any).window.localStorage;
}

import {
  clampDateToMonth,
  hashStringToNumber,
  getNotificationIdForSlot,
  getNotificationIdBand,
  isManagedNotificationId,
  calculateNextSummaryDates,
  NotificationService,
} from '../services/NotificationService';
import {
  setScheduledUnmuteTime,
  getScheduledUnmuteTime,
  checkAndReconcileRinger,
  UNMUTE_TIMESTAMP_STORAGE_KEY,
} from '../lib/ringer';
import { useAttendanceStore } from '../stores/attendanceStore';

console.log("===================================================================");
console.log("=== Running Notification & Local Scheduling Audit Verification Tests ===");
console.log("===================================================================\n");

// ---------------------------------------------------------------------------
// 1. Test clampDateToMonth Edge Cases
// ---------------------------------------------------------------------------
function testClampDateToMonth() {
  console.log("--- Test 1: clampDateToMonth Month Boundary Clamping ---");

  // Non-leap year February (2026): 31st clamps to Feb 28
  const feb2026 = clampDateToMonth(2026, 1, 31);
  assert.equal(feb2026.getFullYear(), 2026);
  assert.equal(feb2026.getMonth(), 1, "Month must strictly remain February (1)");
  assert.equal(feb2026.getDate(), 28, "February 2026 must clamp 31st to 28th");

  // Leap year February (2024): 31st clamps to Feb 29
  const feb2024 = clampDateToMonth(2024, 1, 31);
  assert.equal(feb2024.getFullYear(), 2024);
  assert.equal(feb2024.getMonth(), 1, "Month must strictly remain February (1)");
  assert.equal(feb2024.getDate(), 29, "February 2024 (leap year) must clamp 31st to 29th");

  // 30-day months: April, June, September, November
  const apr = clampDateToMonth(2026, 3, 31);
  assert.equal(apr.getMonth(), 3);
  assert.equal(apr.getDate(), 30, "April 31st must clamp to April 30th");

  const jun = clampDateToMonth(2026, 5, 31);
  assert.equal(jun.getMonth(), 5);
  assert.equal(jun.getDate(), 30, "June 31st must clamp to June 30th");

  const sep = clampDateToMonth(2026, 8, 31);
  assert.equal(sep.getMonth(), 8);
  assert.equal(sep.getDate(), 30, "September 31st must clamp to September 30th");

  const nov = clampDateToMonth(2026, 10, 31);
  assert.equal(nov.getMonth(), 10);
  assert.equal(nov.getDate(), 30, "November 31st must clamp to November 30th");

  // 31-day months: January, March, May, July, August, October, December
  const jan = clampDateToMonth(2026, 0, 31);
  assert.equal(jan.getDate(), 31, "January 31st must remain 31");

  const mar = clampDateToMonth(2026, 2, 31);
  assert.equal(mar.getDate(), 31, "March 31st must remain 31");

  // Day below 1 boundary: clamps to 1
  const zeroDay = clampDateToMonth(2026, 0, 0);
  assert.equal(zeroDay.getDate(), 1, "Day 0 must clamp to 1");

  console.log("✓ clampDateToMonth passed all month boundary and leap year tests");
}

// ---------------------------------------------------------------------------
// 2. Test hashStringToNumber
// ---------------------------------------------------------------------------
function testHashStringToNumber() {
  console.log("\n--- Test 2: hashStringToNumber Determinism and Properties ---");

  const hash1 = hashStringToNumber("slot-101_2026-09-20_standard");
  const hash2 = hashStringToNumber("slot-101_2026-09-20_standard");
  const hashDiff = hashStringToNumber("slot-102_2026-09-20_standard");

  assert.equal(hash1, hash2, "Identical input must produce identical hash");
  assert.notEqual(hash1, hashDiff, "Different input should produce distinct hash");
  assert(Number.isInteger(hash1), "Hash must be an integer");
  assert(hash1 >= 0, "Hash must be non-negative");

  console.log("✓ hashStringToNumber passed determinism tests");
}

// ---------------------------------------------------------------------------
// 3. Test getNotificationIdForSlot
// ---------------------------------------------------------------------------
function testGetNotificationIdForSlot() {
  console.log("\n--- Test 3: getNotificationIdForSlot Deterministic Allocation ---");

  const idStd = getNotificationIdForSlot("slot-a", "2026-09-20", "standard");
  const idHeadsUp = getNotificationIdForSlot("slot-a", "2026-09-20", "headsup");
  const idEndOfDay = getNotificationIdForSlot("endofday", "2026-09-20", "endofday");
  const idSlotB = getNotificationIdForSlot("slot-b", "2026-09-20", "standard");

  // Verify band range: 100000 <= id < 900000
  assert(idStd >= 100000 && idStd < 900000, `idStd (${idStd}) must be in [100000, 899999]`);
  assert(idHeadsUp >= 100000 && idHeadsUp < 900000, `idHeadsUp (${idHeadsUp}) must be in [100000, 899999]`);
  assert(idEndOfDay >= 100000 && idEndOfDay < 900000, `idEndOfDay (${idEndOfDay}) must be in [100000, 899999]`);
  assert(idSlotB >= 100000 && idSlotB < 900000, `idSlotB (${idSlotB}) must be in [100000, 899999]`);

  // Verify uniqueness across types and slots on the same day
  assert.notEqual(idStd, idHeadsUp, "Standard and Heads-up reminders for the same slot must not collide");
  assert.notEqual(idStd, idSlotB, "Distinct slots on the same day must not collide");

  console.log("✓ getNotificationIdForSlot passed range and distinction tests");
}

// ---------------------------------------------------------------------------
// 4. Test Notification ID Band Partitioning & Zero Cross-Band Collisions
// ---------------------------------------------------------------------------
function testNotificationIdBands() {
  console.log("\n--- Test 4: Notification ID Band Partitioning & Zero Cross-Band Collisions ---");

  const bands = {
    permission: { min: 8080, max: 8080 },
    morning: { min: 8800, max: 8800 },
    pinned: { min: 8888, max: 8888 },
    threshold: { min: 8900, max: 8900 },
    assignment: { min: 9000, max: 9999 },
    holiday: { min: 70000, max: 70999 },
    birthday: { min: 71000, max: 71999 },
    summary: { min: 90000, max: 90999 },
    timetable: { min: 100000, max: 899999 },
  };

  // Test static IDs
  assert.equal(getNotificationIdBand('permission'), 8080);
  assert.equal(getNotificationIdBand('morning'), 8800);
  assert.equal(getNotificationIdBand('pinned'), 8888);
  assert.equal(getNotificationIdBand('threshold'), 8900);

  // Generate 500 samples per dynamic band and verify strict boundary compliance
  const sampleKeys = Array.from({ length: 500 }, (_, i) => `item_test_key_${i}_${Date.now()}`);

  for (const key of sampleKeys) {
    const holidayId = getNotificationIdBand('holiday', key);
    assert(
      holidayId >= bands.holiday.min && holidayId <= bands.holiday.max,
      `Holiday ID ${holidayId} out of range [${bands.holiday.min}, ${bands.holiday.max}]`
    );

    const birthdayId = getNotificationIdBand('birthday', key);
    assert(
      birthdayId >= bands.birthday.min && birthdayId <= bands.birthday.max,
      `Birthday ID ${birthdayId} out of range [${bands.birthday.min}, ${bands.birthday.max}]`
    );

    const summaryId = getNotificationIdBand('summary', key);
    assert(
      summaryId >= bands.summary.min && summaryId <= bands.summary.max,
      `Summary ID ${summaryId} out of range [${bands.summary.min}, ${bands.summary.max}]`
    );

    const assignmentId = getNotificationIdBand('assignment', key);
    assert(
      assignmentId >= bands.assignment.min && assignmentId <= bands.assignment.max,
      `Assignment ID ${assignmentId} out of range [${bands.assignment.min}, ${bands.assignment.max}]`
    );

    const timetableId = getNotificationIdBand('timetable', key);
    assert(
      timetableId >= bands.timetable.min && timetableId <= bands.timetable.max,
      `Timetable ID ${timetableId} out of range [${bands.timetable.min}, ${bands.timetable.max}]`
    );
  }

  // Cross-band mutual exclusion check: verify ranges never overlap
  const bandEntries = Object.entries(bands);
  for (let i = 0; i < bandEntries.length; i++) {
    for (let j = i + 1; j < bandEntries.length; j++) {
      const [nameA, rangeA] = bandEntries[i];
      const [nameB, rangeB] = bandEntries[j];
      const overlaps = rangeA.min <= rangeB.max && rangeB.min <= rangeA.max;
      assert(!overlaps, `Band ${nameA} [${rangeA.min}..${rangeA.max}] overlaps with ${nameB} [${rangeB.min}..${rangeB.max}]`);
    }
  }

  console.log("✓ All 9 notification bands are strictly non-overlapping and collision-free");
}

// ---------------------------------------------------------------------------
// 5. Test isManagedNotificationId
// ---------------------------------------------------------------------------
function testIsManagedNotificationId() {
  console.log("\n--- Test 5: isManagedNotificationId Classification ---");

  // Managed IDs (cancelled and refreshed by autoScheduleFromTimetable)
  assert.equal(isManagedNotificationId(100050), true, "Timetable slot must be managed");
  assert.equal(isManagedNotificationId(70123), true, "Holiday alert must be managed");
  assert.equal(isManagedNotificationId(71050), true, "Birthday alert must be managed");
  assert.equal(isManagedNotificationId(8800), true, "Morning summary must be managed");
  assert.equal(isManagedNotificationId(8900), true, "Threshold alert must be managed");

  // Unmanaged IDs (must NOT be wiped by autoScheduleFromTimetable)
  assert.equal(isManagedNotificationId(8888), false, "Active DND pinned mute must NOT be wiped by timetable scheduler");
  assert.equal(isManagedNotificationId(8080), false, "DND permission warning must NOT be wiped by timetable scheduler");
  assert.equal(isManagedNotificationId(9005), false, "Assignment reminders must NOT be wiped by timetable scheduler");
  assert.equal(isManagedNotificationId(9999), false, "Assignment reminders must NOT be wiped by timetable scheduler");

  console.log("✓ isManagedNotificationId correctly preserves unmanaged system & assignment alarms");
}

// ---------------------------------------------------------------------------
// 6. Test calculateNextSummaryDates (Weekly Bug & Monthly Bug Fixes)
// ---------------------------------------------------------------------------
function testCalculateNextSummaryDates() {
  console.log("\n--- Test 6: calculateNextSummaryDates Weekly & Monthly Boundary Calculations ---");

  // Scenario A: Weekly Cadence when today is the target day but the time has ALREADY PASSED.
  // Example: Today is Monday 2026-09-21 at 19:00, targetDay is Mon (1), summaryTime is 18:00.
  // Before fix: Week 0 skipped by (0+4)*7 = 28 days!
  // After fix: Week 0 fires on next Monday (7 days in future), Week 1 on 14 days, Week 2 on 21 days, Week 3 on 28 days.
  const mondayEvening = new Date("2026-09-21T19:00:00.000Z"); // A Monday evening
  const weeklyDatesPast = calculateNextSummaryDates({ type: 'Weekly', subValue: 'Mon' }, "18:00", mondayEvening);

  assert.equal(weeklyDatesPast.length, 4, "Must schedule 4 weekly occurrences");
  for (let i = 0; i < weeklyDatesPast.length; i++) {
    assert(weeklyDatesPast[i].getTime() > mondayEvening.getTime(), `Occurrence ${i} must be strictly in the future`);
    assert.equal(weeklyDatesPast[i].getDay(), 1, `Occurrence ${i} must be on Monday`);
  }

  // Check that the first occurrence is 7 days ahead (NOT 28 days!)
  const msInWeek = 7 * 24 * 60 * 60 * 1000;
  const diffFirstOcc = weeklyDatesPast[0].getTime() - mondayEvening.getTime();
  assert(diffFirstOcc < 8 * 24 * 60 * 60 * 1000, `First weekly occurrence must be within 7-8 days, got ${diffFirstOcc / (24*3600*1000)} days`);

  // Check constant 7-day interval between all successive weekly notifications
  for (let i = 1; i < weeklyDatesPast.length; i++) {
    const delta = weeklyDatesPast[i].getTime() - weeklyDatesPast[i - 1].getTime();
    assert.equal(delta, msInWeek, `Weekly interval between occurrence ${i-1} and ${i} must be exactly 7 days`);
  }

  // Scenario B: Weekly Cadence when today is target day and the time has NOT passed.
  // Example: Today is Monday 2026-09-21 at 10:00, summary is at 18:00.
  const mondayMorning = new Date("2026-09-21T10:00:00.000Z");
  const weeklyDatesFuture = calculateNextSummaryDates({ type: 'Weekly', subValue: 'Mon' }, "18:00", mondayMorning);
  assert.equal(weeklyDatesFuture.length, 4);
  assert.equal(weeklyDatesFuture[0].getDate(), 21, "First occurrence should be today (Sep 21) when summary time is ahead");
  assert.equal(weeklyDatesFuture[1].getDate(), 28, "Second occurrence should be Sep 28");

  // Scenario C: Monthly Cadence with Day 31 (Feb 28/29 and Apr 30 clamping)
  // Starting Jan 15, 2026: Next 3 occurrences must be Jan 31, Feb 28, Mar 31
  const midJan = new Date("2026-01-15T12:00:00.000Z");
  const monthlyDates = calculateNextSummaryDates({ type: 'Monthly', subValue: '31' }, "18:00", midJan);
  assert.equal(monthlyDates.length, 3);
  assert.equal(monthlyDates[0].getMonth(), 0, "First occurrence in January");
  assert.equal(monthlyDates[0].getDate(), 31, "January occurrence on 31st");

  assert.equal(monthlyDates[1].getMonth(), 1, "Second occurrence MUST strictly be February");
  assert.equal(monthlyDates[1].getDate(), 28, "February 2026 occurrence must clamp to 28th (not overflow to March 3!)");

  assert.equal(monthlyDates[2].getMonth(), 2, "Third occurrence in March");
  assert.equal(monthlyDates[2].getDate(), 31, "March occurrence on 31st");

  // Starting on Feb 1, 2026 with Day 31: Next 3 occurrences must be Feb 28, Mar 31, Apr 30
  const febFirst = new Date("2026-02-01T12:00:00.000Z");
  const monthlyDatesFeb = calculateNextSummaryDates({ type: 'Monthly', subValue: '31' }, "18:00", febFirst);
  assert.equal(monthlyDatesFeb.length, 3);
  assert.equal(monthlyDatesFeb[0].getMonth(), 1);
  assert.equal(monthlyDatesFeb[0].getDate(), 28, "Feb occurrence must be 28th");
  assert.equal(monthlyDatesFeb[1].getMonth(), 2);
  assert.equal(monthlyDatesFeb[1].getDate(), 31, "Mar occurrence must be 31st");
  assert.equal(monthlyDatesFeb[2].getMonth(), 3);
  assert.equal(monthlyDatesFeb[2].getDate(), 30, "Apr occurrence must clamp to 30th (not overflow to May 1!)");

  console.log("✓ calculateNextSummaryDates passed all weekly cadence and monthly overflow tests");
}

// ---------------------------------------------------------------------------
// 7. Test Background Auto-Unmute Timer Robustness & Reconciliation
// ---------------------------------------------------------------------------
async function testAutoUnmuteReconciliation() {
  console.log("\n--- Test 7: Auto-Unmute Timer Robustness & Storage Reconciliation ---");

  // Clear any existing timestamp
  setScheduledUnmuteTime(null);
  assert.equal(getScheduledUnmuteTime(), null);

  // Case A: Future unmute time -> should not unmute yet
  const futureTime = Date.now() + 60000;
  setScheduledUnmuteTime(futureTime);
  assert.equal(getScheduledUnmuteTime(), futureTime);
  const reconciledFuture = await checkAndReconcileRinger();
  assert.equal(reconciledFuture, false, "Must not unmute if scheduled time is in the future");
  assert.equal(getScheduledUnmuteTime(), futureTime, "Timestamp must remain in storage");

  // Case B: Expired unmute time -> should execute unmute and clear timestamp
  const pastTime = Date.now() - 5000;
  setScheduledUnmuteTime(pastTime);
  assert.equal(getScheduledUnmuteTime(), pastTime);

  const reconciledPast = await checkAndReconcileRinger();
  // In node environment, Capacitor.isNativePlatform() is false, unmutePhone returns false safely,
  // but the storage timestamp MUST be cleared!
  assert.equal(getScheduledUnmuteTime(), null, "Scheduled unmute timestamp must be cleared after reconciliation");

  console.log("✓ checkAndReconcileRinger correctly reconciles expired mute timestamps from storage");
}

// ---------------------------------------------------------------------------
// 8. Test Store Hydration Waiting & Permission Checking
// ---------------------------------------------------------------------------
async function testStoreHydrationAndPermissions() {
  console.log("\n--- Test 8: Store Hydration Waiting & Permission Status Inspection ---");

  // When store is hydrated, waitForStoreHydration resolves immediately
  useAttendanceStore.getState().setHasHydrated(true);
  const hydrated = await NotificationService.waitForStoreHydration(500);
  assert.equal(hydrated, true, "waitForStoreHydration should resolve true when store is hydrated");

  // checkPermissionStatus returns non-crashing safe status
  const status = await NotificationService.checkPermissionStatus();
  assert.equal(typeof status.display, "boolean");
  assert.equal(typeof status.exactAlarm, "boolean");

  console.log("✓ waitForStoreHydration and checkPermissionStatus verified");
}

// ---------------------------------------------------------------------------
// Master Test Runner
// ---------------------------------------------------------------------------
async function runAllTests() {
  testClampDateToMonth();
  testHashStringToNumber();
  testGetNotificationIdForSlot();
  testNotificationIdBands();
  testIsManagedNotificationId();
  testCalculateNextSummaryDates();
  await testAutoUnmuteReconciliation();
  await testStoreHydrationAndPermissions();

  console.log("\n===================================================================");
  console.log("🎉 ALL NOTIFICATION SERVICE & SCHEDULING AUDIT TESTS PASSED! 🎉");
  console.log("===================================================================");
}

runAllTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
