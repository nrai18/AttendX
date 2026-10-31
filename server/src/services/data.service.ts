import { prisma } from "../lib/prisma";
import AdmZip from "adm-zip";
import { stringify } from "csv-stringify/sync";
import { parse } from "csv-parse/sync";
import { Prisma } from "@prisma/client";
import { FailureLogRecorder } from "../utils/failureLogRecorder";
import { CacheService } from "./cache.service";

export interface ExportDataOptions {
  deviceLogs?: any;
  userEmail?: string;
  forTicket?: boolean;
}

const UTF8_BOM = "\uFEFF";

/**
 * Normalizes time strings to HH:MM (24-hour, zero-padded), e.g. "9:00" -> "09:00".
 */
function normalizeTimeStr(timeStr: string): string {
  if (!timeStr) return "00:00";
  const trimmed = timeStr.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{1,2})/);
  if (match) {
    const hours = match[1].padStart(2, "0");
    const minutes = match[2].padStart(2, "0");
    return `${hours}:${minutes}`;
  }
  return trimmed;
}

/**
 * Parses any date string into a UTC midnight Date instance, preventing
 * local timezone offsets (e.g. IST +05:30) from shifting dates across midnight.
 * Supports ISO (YYYY-MM-DD), UK/Indian (DD/MM/YYYY or DD-MM-YYYY), US (MM/DD/YYYY),
 * and numeric Excel serial date numbers.
 */
function parseDateAsUtc(dateStr: string): Date {
  if (!dateStr) return new Date();
  const trimmed = String(dateStr).trim();
  if (!trimmed) return new Date();

  // 1. ISO format: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  }

  // 2. DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY vs MM/DD/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const part1 = parseInt(dmyMatch[1], 10);
    const part2 = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    let day = part1;
    let month = part2;
    // Disambiguation: if part1 <= 12 and part2 > 12, part2 is day and part1 is month (MM/DD/YYYY)
    if (part1 <= 12 && part2 > 12) {
      month = part1;
      day = part2;
    }
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }

  // 3. Excel numeric serial date (e.g. 45000)
  if (/^\d{5}$/.test(trimmed)) {
    const serial = parseInt(trimmed, 10);
    // Excel epoch base is Dec 30, 1899
    const excelEpoch = Date.UTC(1899, 11, 30);
    const ms = excelEpoch + serial * 86400000;
    const d = new Date(ms);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  }

  // 4. Standard Date fallback
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0));
  }

  return new Date();
}

export class DataService {
  static async exportData(userId: string, options?: ExportDataOptions): Promise<Buffer> {
    const activeSem = await prisma.semester.findFirst({
      where: { userId, isActive: true },
    });
    if (!activeSem && !options?.forTicket) {
      throw new Error("No active semester found. Please create or activate a semester first.");
    }

    // Fetch all relational datasets in parallel to minimize network roundtrips
    const [subjects, slots, logs, events] = activeSem
      ? await Promise.all([
          prisma.subject.findMany({
            where: { semesterId: activeSem.id },
            include: { attendance: true },
            orderBy: { name: 'asc' },
          }),
          prisma.timetableSlot.findMany({
            where: { semesterId: activeSem.id },
            include: { subject: true },
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
          }),
          prisma.attendance.findMany({
            where: { subject: { semesterId: activeSem.id } },
            include: { subject: true, timetableSlot: true, override: true },
            orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
          }),
          prisma.event.findMany({
            where: { semesterId: activeSem.id },
            orderBy: { date: 'asc' },
          }),
        ])
      : [[], [], [], []];

    // Generate subject_stats.csv
    const subjectStatsRows = subjects.map((sub: any, idx: number) => {
      let attended = 0, missed = 0, off = 0;
      sub.attendance.forEach((log: any) => {
        if (log.status === "present" || log.status === "medical" || log.status === "od") attended++;
        else if (log.status === "absent") missed++;
        else if (log.status === "off" || log.status === "cancelled") off++;
      });
      const total = attended + missed; // Off classes don't count towards total
      const pct = total > 0 ? ((attended / total) * 100).toFixed(2) + "%" : "0.00%";
      return {
        "Sr. No.": idx + 1,
        "Subject": sub.name,
        "Code": sub.code || "",
        "Credits": sub.credits != null ? String(sub.credits) : "",
        "Faculty": sub.faculty || "",
        "Color": sub.colorHex || "",
        "Attended": attended,
        "Missed": missed,
        "Off": off,
        "Total": total,
        "Percentage": pct,
        "Criteria": (sub.targetAttendance || 75) + "%"
      };
    });

    // Timetable slots mapped from parallel fetch
    const daysMap = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    let currentDay = -1;
    let lectureNo = 1;
    const timetableRows = slots.map((slot: any, idx: number) => {
      if (slot.dayOfWeek !== currentDay) {
        currentDay = slot.dayOfWeek;
        lectureNo = 1;
      } else {
        lectureNo++;
      }
      const normStart = normalizeTimeStr(slot.startTime);
      const normEnd = normalizeTimeStr(slot.endTime);
      return {
        "Sr. No.": idx + 1,
        "Day of Week": daysMap[slot.dayOfWeek] || "Monday",
        "Lecture No.": lectureNo,
        "Subject": slot.subject.name,
        "Timing": `${normStart} - ${normEnd}`,
        "Room": slot.room || "",
        "Type": slot.slotType === "practical" ? "Practical" : (slot.slotType === "tutorial" ? "Tutorial" : "Lecture"),
        "Valid From": slot.validFrom ? slot.validFrom.toISOString().split('T')[0] : "",
        "Valid Until": slot.validUntil ? slot.validUntil.toISOString().split('T')[0] : ""
      };
    });

    // Logs mapped from parallel fetch
    let currentDate = "";
    let logLectureNo = 1;
    const subjectDailyCounts = new Map<string, number>();

    const logRows = logs.map((log: any, idx: number) => {
      const rawDate = log.date.toISOString().split("T")[0];
      if (rawDate !== currentDate) {
        currentDate = rawDate;
        logLectureNo = 1;
        subjectDailyCounts.clear();
      } else {
        logLectureNo++;
      }

      const subName = log.subject.name;
      const subCount = (subjectDailyCounts.get(subName) || 0) + 1;
      subjectDailyCounts.set(subName, subCount);

      const dateStr = rawDate; // ISO format: YYYY-MM-DD
      
      let attStatus = "Attended";
      if (log.status === "absent") attStatus = "Missed";
      else if (log.status === "off") attStatus = "Off";
      else if (log.status === "cancelled") attStatus = "Cancelled";
      else if (log.status === "medical") attStatus = "Medical";
      else if (log.status === "od") attStatus = "OD";

      let slotTimeStr = "";
      if (log.timetableSlot) {
        slotTimeStr = `${normalizeTimeStr(log.timetableSlot.startTime)} - ${normalizeTimeStr(log.timetableSlot.endTime)}`;
      } else if (log.override && log.override.startTime) {
        slotTimeStr = `${normalizeTimeStr(log.override.startTime)} - ${normalizeTimeStr(log.override.endTime || log.override.startTime)}`;
      }

      return {
        "Sr. No.": idx + 1,
        "Date": dateStr,
        "Type": log.overrideId ? "Extra" : "Slot",
        "Lecture No.": logLectureNo,
        "Subject Lecture No.": subCount,
        "Slot Time": slotTimeStr,
        "Subject": subName,
        "Attendance": attStatus,
        "Att Modified": "",
        "Miss Modified": "",
        "Off Modified": "",
        "Override Reason": log.override?.reason || "",
        "Remarks": log.remarks || ""
      };
    });

    // Events mapped from parallel fetch
    const eventRows = events.map((event: any, idx: number) => {
      return {
        "Sr. No.": idx + 1,
        "Title": event.title,
        "Description": event.description || "",
        "Date": event.date.toISOString().split("T")[0],
        "End Date": event.endDate ? event.endDate.toISOString().split("T")[0] : event.date.toISOString().split("T")[0],
        "Type": event.eventType,
        "All Day": event.allDay ? "Yes" : "No",
        "Is Holiday": event.isHoliday ? "Yes" : "No",
        "Is Holiday List": event.isHolidayList ? "Yes" : "No"
      };
    });

    const zip = new AdmZip();

    // Export CSVs with UTF-8 BOM to guarantee accurate display in Microsoft Excel on Windows
    zip.addFile("subject_stats.csv", Buffer.from(UTF8_BOM + stringify(subjectStatsRows, { header: true }), "utf8"));
    zip.addFile("timetable.csv", Buffer.from(UTF8_BOM + stringify(timetableRows, { header: true }), "utf8"));
    zip.addFile("attendance_logs.csv", Buffer.from(UTF8_BOM + stringify(logRows, { header: true }), "utf8"));
    zip.addFile("events.csv", Buffer.from(UTF8_BOM + stringify(eventRows, { header: true }), "utf8"));

    // Export semester metadata for seamless device migrations
    if (activeSem) {
      const semesterMeta = {
        name: activeSem.name,
        startDate: activeSem.startDate.toISOString().split("T")[0],
        endDate: activeSem.endDate.toISOString().split("T")[0],
      };
      zip.addFile("semester.json", Buffer.from(JSON.stringify(semesterMeta, null, 2), "utf8"));
    }

    // Always attach comprehensive server failure diagnostics
    const failureLogs = FailureLogRecorder.getRecentLogs({
      userId,
      email: options?.userEmail,
      limit: 100
    });
    const formattedFailureLogs = FailureLogRecorder.formatLogsAsText(failureLogs);
    zip.addFile("server_failure_logs.txt", Buffer.from(formattedFailureLogs, "utf8"));

    // If client diagnostic logs were provided, attach them
    if (options?.deviceLogs) {
      zip.addFile("client_diagnostic_logs.json", Buffer.from(JSON.stringify(options.deviceLogs, null, 2), "utf8"));
    }

    // Attach system telemetry and server status
    const systemDiagnostics = {
      exportedAt: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      memory: process.memoryUsage(),
      uptimeSeconds: process.uptime(),
      userId,
      userEmail: options?.userEmail || null,
      hasActiveSemester: !!activeSem,
      activeSemesterId: activeSem?.id || null,
    };
    zip.addFile("system_diagnostics.json", Buffer.from(JSON.stringify(systemDiagnostics, null, 2), "utf8"));

    return zip.toBuffer();
  }

  static async importData(userId: string, zipBuffer: Buffer): Promise<void> {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    // Helper to find entry case-insensitively, strictly excluding macOS metadata files and AppleDouble headers
    const findEntry = (filename: string) => {
      const target = filename.toLowerCase();
      return entries.find((e) => {
        if (e.isDirectory) return false;
        const name = e.entryName.toLowerCase();
        if (name.includes("__macosx") || name.split("/").pop()?.startsWith("._") || name.split("\\").pop()?.startsWith("._")) {
          return false;
        }
        return (
          name === target ||
          name.endsWith("/" + target) ||
          name.endsWith("\\" + target)
        );
      });
    };

    const subjectEntry = findEntry("subject_stats.csv");
    const timetableEntry = findEntry("timetable.csv");
    const logsEntry = findEntry("attendance_logs.csv");
    const eventsEntry = findEntry("events.csv");
    const semesterEntry = findEntry("semester.json");

    if (!subjectEntry || !timetableEntry || !logsEntry) {
      throw new Error(
        "Invalid ZIP format. Must contain subject_stats.csv, timetable.csv, and attendance_logs.csv"
      );
    }

    let activeSem = await prisma.semester.findFirst({
      where: { userId, isActive: true },
    });

    // Parse semester.json if available
    let semesterMeta: any = null;
    if (semesterEntry) {
      try {
        semesterMeta = JSON.parse(semesterEntry.getData().toString("utf8"));
      } catch (e) {
        console.warn("[DataService.importData] Failed to parse semester.json:", e);
      }
    }

    // Auto-create active semester if user has none, enabling smooth imports on fresh accounts
    if (!activeSem) {
      if (semesterMeta) {
        activeSem = await prisma.semester.create({
          data: {
            userId,
            name: semesterMeta.name || "Restored Semester",
            startDate: semesterMeta.startDate ? parseDateAsUtc(semesterMeta.startDate) : new Date(),
            endDate: semesterMeta.endDate ? parseDateAsUtc(semesterMeta.endDate) : new Date(Date.now() + 120 * 86400000),
            isActive: true,
          },
        });
      } else {
        throw new Error("No active semester found. Please create or activate a semester first.");
      }
    }

    const parseOptions = {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
    };

    const subjectData = parse(
      subjectEntry.getData().toString("utf8"),
      parseOptions
    ) as any as Record<string, string>[];
    const timetableData = parse(
      timetableEntry.getData().toString("utf8"),
      parseOptions
    ) as any as Record<string, string>[];
    const logsData = parse(
      logsEntry.getData().toString("utf8"),
      parseOptions
    ) as any as Record<string, string>[];
    const eventsData = eventsEntry
      ? ((parse(
          eventsEntry.getData().toString("utf8"),
          parseOptions
        ) as any) as Record<string, string>[])
      : [];

    await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // Expand active semester date bounds if backup contains wider logs
        if (semesterMeta && activeSem) {
          const bStart = semesterMeta.startDate ? parseDateAsUtc(semesterMeta.startDate) : null;
          const bEnd = semesterMeta.endDate ? parseDateAsUtc(semesterMeta.endDate) : null;
          if (bStart && bEnd) {
            const newStart = bStart < activeSem.startDate ? bStart : activeSem.startDate;
            const newEnd = bEnd > activeSem.endDate ? bEnd : activeSem.endDate;
            if (newStart.getTime() !== activeSem.startDate.getTime() || newEnd.getTime() !== activeSem.endDate.getTime()) {
              await tx.semester.update({
                where: { id: activeSem.id },
                data: { startDate: newStart, endDate: newEnd },
              });
            }
          }
        }

        // 1. Gather existing subjects, notes, and assignments to prevent permanent orphanage
        const oldSubjects = await tx.subject.findMany({
          where: { semesterId: activeSem.id },
          select: { id: true, name: true },
        });
        const oldSubjectIds = oldSubjects.map((s) => s.id);
        const oldSubjectIdToName = new Map<string, string>();
        oldSubjects.forEach((s) => oldSubjectIdToName.set(s.id, s.name));

        const existingNotes = oldSubjectIds.length > 0
          ? await tx.note.findMany({
              where: { subjectId: { in: oldSubjectIds } },
              select: { id: true, subjectId: true },
            })
          : [];
        const existingAssignments = oldSubjectIds.length > 0
          ? await tx.assignment.findMany({
              where: { subjectId: { in: oldSubjectIds } },
              select: { id: true, subjectId: true },
            })
          : [];

        if (oldSubjectIds.length > 0) {
          // Temporarily disassociate foreign keys so subject deletion succeeds without cascade destruction
          await tx.note.updateMany({
            where: { subjectId: { in: oldSubjectIds } },
            data: { subjectId: null },
          });
          await tx.assignment.updateMany({
            where: { subjectId: { in: oldSubjectIds } },
            data: { subjectId: null },
          });
        }

        // Wipe attendance records referencing this semester
        await tx.attendance.deleteMany({
          where: {
            OR: [
              { subject: { semesterId: activeSem.id } },
              { timetableSlot: { semesterId: activeSem.id } },
              { override: { semesterId: activeSem.id } },
            ],
          },
        });

        // Delete exports, overrides, slots, subjects, and events
        await tx.export.deleteMany({
          where: {
            OR: [
              { semesterId: activeSem.id },
              ...(oldSubjectIds.length > 0 ? [{ subjectId: { in: oldSubjectIds } }] : []),
            ],
          },
        });
        await tx.timetableOverride.deleteMany({ where: { semesterId: activeSem.id } });
        await tx.timetableSlot.deleteMany({ where: { semesterId: activeSem.id } });
        await tx.subject.deleteMany({ where: { semesterId: activeSem.id } });
        await tx.event.deleteMany({ where: { semesterId: activeSem.id } });

        // 2. Import Subjects
        const subjectMap = new Map<string, string>(); // Name -> New ID
        let subjectIndex = 0;
        const defaultColors = [
          "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
          "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#f43f5e",
        ];

        for (const row of subjectData) {
          const subName = row["Subject"]?.trim();
          if (!subName) continue;

          const criteriaMatch = row["Criteria"]?.match(/(\d+)/);
          const target = criteriaMatch ? parseInt(criteriaMatch[1], 10) : 75;
          const credits = row["Credits"] ? parseInt(row["Credits"], 10) : undefined;
          subjectIndex++;

          const sub = await tx.subject.create({
            data: {
              name: subName,
              code: row["Code"]?.trim() || null,
              credits: isNaN(credits as any) ? null : credits,
              faculty: row["Faculty"]?.trim() || null,
              semesterId: activeSem.id,
              userId,
              targetAttendance: target,
              colorHex:
                row["Color"]?.trim() ||
                defaultColors[subjectIndex % defaultColors.length],
            },
          });
          subjectMap.set(subName, sub.id);
        }

        // Re-link notes and assignments to their matched newly-created subjects
        for (const [oldId, oldName] of oldSubjectIdToName.entries()) {
          const newSubId = subjectMap.get(oldName);
          if (newSubId) {
            const matchingNoteIds = existingNotes
              .filter((n) => n.subjectId === oldId)
              .map((n) => n.id);
            if (matchingNoteIds.length > 0) {
              await tx.note.updateMany({
                where: { id: { in: matchingNoteIds } },
                data: { subjectId: newSubId },
              });
            }

            const matchingAssignmentIds = existingAssignments
              .filter((a) => a.subjectId === oldId)
              .map((a) => a.id);
            if (matchingAssignmentIds.length > 0) {
              await tx.assignment.updateMany({
                where: { id: { in: matchingAssignmentIds } },
                data: { subjectId: newSubId },
              });
            }
          }
        }

        // 3. Import Timetable
        const daysMap: Record<string, number> = {
          monday: 0,
          tuesday: 1,
          wednesday: 2,
          thursday: 3,
          friday: 4,
          saturday: 5,
          sunday: 6,
        };

        const createdSlots: Array<{
          id: string;
          subjectId: string;
          dayOfWeek: number;
          startTime: string;
          endTime: string;
          validFrom: Date;
          validUntil: Date | null;
        }> = [];

        for (const row of timetableData) {
          const dayName = (row["Day of Week"] || "").trim().toLowerCase();
          const subjectName = (row["Subject"] || "").trim();
          const dayIdx = daysMap[dayName] ?? 0;
          const subId = subjectMap.get(subjectName);
          if (!subId) continue;

          // Parse exact timing from CSV with zero-padding normalization
          const timing = row["Timing"]; // e.g., "9:00 - 9:50" or "09:00 - 09:50"
          let startStr = "09:00";
          let endStr = "10:00";
          if (timing && timing.includes("-")) {
            const parts = timing.split("-");
            startStr = normalizeTimeStr(parts[0].trim());
            endStr = normalizeTimeStr(parts[1].trim());
          }

          // Handle archived timetable attributes
          const validFromStr = row["Valid From"];
          const validUntilStr = row["Valid Until"];
          const validFrom = validFromStr ? parseDateAsUtc(validFromStr) : new Date();
          const validUntil = validUntilStr ? parseDateAsUtc(validUntilStr) : null;

          let slotType: "lecture" | "practical" | "tutorial" = "lecture";
          const typeLower = (row["Type"] || "").toLowerCase().trim();
          if (typeLower === "practical") slotType = "practical";
          else if (typeLower === "tutorial") slotType = "tutorial";

          const slot = await tx.timetableSlot.create({
            data: {
              semesterId: activeSem.id,
              subjectId: subId,
              dayOfWeek: dayIdx,
              startTime: startStr,
              endTime: endStr,
              slotType,
              validFrom,
              validUntil,
              room: row["Room"]?.trim() || "",
            },
          });

          createdSlots.push({
            id: slot.id,
            subjectId: subId,
            dayOfWeek: dayIdx,
            startTime: startStr,
            endTime: endStr,
            validFrom,
            validUntil,
          });
        }

        // 4. Import Logs (Attendance)
        const seenLogKeys = new Set<string>();
        const usedSlotIdsByDate = new Map<string, Set<string>>();
        const attendanceToCreate: Array<Prisma.AttendanceCreateManyInput> = [];

        for (const row of logsData) {
          const subName = (row["Subject"] || "").trim();
          const subId = subjectMap.get(subName);
          if (!subId) continue;

          const dateStr = row["Date"]?.trim();
          if (!dateStr) continue;
          const dateObj = parseDateAsUtc(dateStr);
          const dateIso = dateObj.toISOString().slice(0, 10);

          if (!usedSlotIdsByDate.has(dateIso)) {
            usedSlotIdsByDate.set(dateIso, new Set<string>());
          }
          const usedOnDate = usedSlotIdsByDate.get(dateIso)!;

          const attStr = (row["Attendance"] || "").trim().toLowerCase();
          let status: any = "present";
          if (attStr === "missed" || attStr === "absent") status = "absent";
          else if (attStr === "off") status = "off";
          else if (attStr === "cancelled") status = "cancelled";
          else if (attStr === "medical") status = "medical";
          else if (attStr === "od" || attStr === "on duty") status = "od";
          else if (attStr === "attended" || attStr === "present") status = "present";

          const typeStr = (row["Type"] || "").trim().toLowerCase();
          const isOverride = typeStr === "extra" || typeStr === "override";

          let overrideId: string | null = null;
          let matchedSlotId: string | null = null;

          if (isOverride) {
            let ovStartTime: string | null = null;
            let ovEndTime: string | null = null;
            const timingRaw = (row["Slot Time"] || row["Timing"] || "").trim();
            if (timingRaw && timingRaw.includes("-")) {
              const parts = timingRaw.split("-");
              ovStartTime = normalizeTimeStr(parts[0].trim());
              ovEndTime = normalizeTimeStr(parts[1].trim());
            }

            const ov = await tx.timetableOverride.create({
              data: {
                semesterId: activeSem.id,
                date: dateObj,
                overrideType: "extra_class",
                subjectId: subId,
                startTime: ovStartTime,
                endTime: ovEndTime,
                reason: row["Override Reason"]?.trim() || row["Remarks"]?.trim() || "Imported extra class",
              },
            });
            overrideId = ov.id;
          } else {
            const dayOfWeek = (dateObj.getUTCDay() + 6) % 7; // Monday = 0
            
            // All slots on this day sorted chronologically
            const allDaySlots = createdSlots
              .filter(
                (s) =>
                  s.dayOfWeek === dayOfWeek &&
                  s.validFrom <= dateObj &&
                  (!s.validUntil || s.validUntil >= dateObj)
              )
              .sort((a, b) => a.startTime.localeCompare(b.startTime));

            // Matching slots for this specific subject
            let matchingSlots = allDaySlots.filter((s) => s.subjectId === subId);
            if (matchingSlots.length === 0) {
              matchingSlots = createdSlots
                .filter((s) => s.subjectId === subId && s.dayOfWeek === dayOfWeek)
                .sort((a, b) => a.startTime.localeCompare(b.startTime));
            }

            // Strategy 1: Exact slot timing match if available
            const timingRaw = (row["Slot Time"] || row["Timing"] || "").trim();
            if (timingRaw && timingRaw.includes("-")) {
              const rowStart = normalizeTimeStr(timingRaw.split("-")[0].trim());
              const matchByTime = matchingSlots.find((s) => s.startTime === rowStart);
              if (matchByTime) {
                matchedSlotId = matchByTime.id;
              }
            }

            // Strategy 2: Subject-specific lecture index match
            const subLectureNo = parseInt(row["Subject Lecture No."], 10);
            if (!matchedSlotId && !isNaN(subLectureNo) && subLectureNo >= 1 && subLectureNo <= matchingSlots.length) {
              matchedSlotId = matchingSlots[subLectureNo - 1].id;
            }

            // Strategy 3: Day-wide period match (check allDaySlots at period index if subject matches)
            const lectureNo = parseInt(row["Lecture No."], 10);
            if (!matchedSlotId && !isNaN(lectureNo) && lectureNo >= 1 && lectureNo <= allDaySlots.length) {
              const candidate = allDaySlots[lectureNo - 1];
              if (candidate && candidate.subjectId === subId) {
                matchedSlotId = candidate.id;
              }
            }

            // Strategy 4: Fallback to subject-specific index using overall lectureNo if within bounds
            if (!matchedSlotId && !isNaN(lectureNo) && lectureNo >= 1 && lectureNo <= matchingSlots.length) {
              matchedSlotId = matchingSlots[lectureNo - 1].id;
            }

            // Strategy 5: Unused slot on this date to guarantee zero duplicate-slot collision
            if (!matchedSlotId && matchingSlots.length > 0) {
              const unused = matchingSlots.find((s) => !usedOnDate.has(s.id));
              matchedSlotId = unused ? unused.id : matchingSlots[0].id;
            }

            if (matchedSlotId) {
              usedOnDate.add(matchedSlotId);
            }
          }

          // Deduplication key against unique constraint [userId, subjectId, date, timetableSlotId]
          const dedupeKey = `${subId}_${dateIso}_${matchedSlotId || "none"}_${overrideId || "none"}`;
          if (seenLogKeys.has(dedupeKey)) {
            continue;
          }
          seenLogKeys.add(dedupeKey);

          attendanceToCreate.push({
            userId,
            subjectId: subId,
            date: dateObj,
            status,
            timetableSlotId: matchedSlotId,
            overrideId: overrideId,
            remarks: row["Remarks"]?.trim() || null,
          });
        }

        // Batch insert attendance records in chunks of 250 rows to prevent query timeouts
        const CHUNK_SIZE = 250;
        for (let i = 0; i < attendanceToCreate.length; i += CHUNK_SIZE) {
          const chunk = attendanceToCreate.slice(i, i + CHUNK_SIZE);
          await tx.attendance.createMany({
            data: chunk,
          });
        }

        // 5. Import Events (Academic Calendar) in batch
        const validEventTypes = new Set([
          "ct",
          "midsem",
          "endsem",
          "exam",
          "lab_exam",
          "holiday",
          "restricted_holiday",
          "vacation",
          "fest",
          "institute",
          "other",
        ]);

        const eventsToCreate: Array<Prisma.EventCreateManyInput> = [];

        for (const row of eventsData) {
          const dateStr = row["Date"]?.trim();
          if (!dateStr) continue;

          const dateObj = parseDateAsUtc(dateStr);
          const endDateStr = row["End Date"]?.trim();
          const endDateObj = endDateStr ? parseDateAsUtc(endDateStr) : null;
          const rawType = (row["Type"] || "other").toLowerCase().trim();
          const eventType = validEventTypes.has(rawType)
            ? (rawType as any)
            : "other";

          eventsToCreate.push({
            title: row["Title"]?.trim() || "Imported Event",
            description: row["Description"]?.trim() || null,
            date: dateObj,
            endDate: endDateObj,
            eventType,
            allDay: row["All Day"] === "Yes" || row["All Day"] === "true",
            isHoliday:
              row["Is Holiday"] === "Yes" ||
              row["Is Holiday"] === "true" ||
              eventType === "holiday" ||
              eventType === "restricted_holiday" ||
              eventType === "vacation",
            isHolidayList:
              row["Is Holiday List"] === "Yes" ||
              row["Is Holiday List"] === "true",
            userId,
            semesterId: activeSem.id,
          });
        }

        for (let i = 0; i < eventsToCreate.length; i += CHUNK_SIZE) {
          const chunk = eventsToCreate.slice(i, i + CHUNK_SIZE);
          await tx.event.createMany({
            data: chunk,
          });
        }
      },
      {
        timeout: 60000,
        maxWait: 10000,
      }
    );

    // Invalidate server cache for user
    await CacheService.invalidateUser(userId);
  }
}
