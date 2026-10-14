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

/**
 * Parses any date string into a UTC midnight Date instance, preventing
 * local timezone offsets (e.g. IST +05:30) from shifting dates across midnight.
 */
function parseDateAsUtc(dateStr: string): Date {
  if (!dateStr) return new Date();
  const trimmed = dateStr.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  }
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0));
}

export class DataService {
  static async exportData(userId: string, options?: ExportDataOptions): Promise<Buffer> {
    const activeSem = await prisma.semester.findFirst({
      where: { userId, isActive: true },
    });
    if (!activeSem && !options?.forTicket) {
      throw new Error("No active semester found. Please create or activate a semester first.");
    }

    // Fetch Subjects (if active semester exists)
    const subjects = activeSem
      ? await prisma.subject.findMany({
          where: { semesterId: activeSem.id },
          include: { attendance: true },
        })
      : [];

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

    // Fetch Timetable (all slots including archived)
    const slots = activeSem
      ? await prisma.timetableSlot.findMany({
          where: { semesterId: activeSem.id },
          include: { subject: true },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        })
      : [];

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
      return {
        "Sr. No.": idx + 1,
        "Day of Week": daysMap[slot.dayOfWeek],
        "Lecture No.": lectureNo,
        "Subject": slot.subject.name,
        "Timing": `${slot.startTime} - ${slot.endTime}`,
        "Room": slot.room || "",
        "Type": slot.slotType === "practical" ? "Practical" : (slot.slotType === "tutorial" ? "Tutorial" : "Lecture"),
        "Valid From": slot.validFrom ? slot.validFrom.toISOString().split('T')[0] : "",
        "Valid Until": slot.validUntil ? slot.validUntil.toISOString().split('T')[0] : ""
      };
    });

    // Fetch Logs
    const logs = activeSem
      ? await prisma.attendance.findMany({
          where: { subject: { semesterId: activeSem.id } },
          include: { subject: true },
          orderBy: { date: 'asc' },
        })
      : [];

    let currentDate = "";
    let logLectureNo = 1;
    const logRows = logs.map((log: any, idx: number) => {
      const rawDate = log.date.toISOString().split("T")[0];
      if (rawDate !== currentDate) {
        currentDate = rawDate;
        logLectureNo = 1;
      } else {
        logLectureNo++;
      }
      
      const dateStr = rawDate; // ISO format: YYYY-MM-DD
      
      let attStatus = "Attended";
      if (log.status === "absent") attStatus = "Missed";
      else if (log.status === "off") attStatus = "Off";
      else if (log.status === "cancelled") attStatus = "Cancelled";
      else if (log.status === "medical") attStatus = "Medical";
      else if (log.status === "od") attStatus = "OD";

      return {
        "Sr. No.": idx + 1,
        "Date": dateStr,
        "Type": log.overrideId ? "Extra" : "Slot",
        "Lecture No.": logLectureNo,
        "Subject": log.subject.name,
        "Attendance": attStatus,
        "Att Modified": "",
        "Miss Modified": "",
        "Off Modified": "",
        "Remarks": log.remarks || ""
      };
    });

    // Fetch Events (Academic Calendar)
    const events = activeSem
      ? await prisma.event.findMany({
          where: { semesterId: activeSem.id },
          orderBy: { date: 'asc' },
        })
      : [];

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
    zip.addFile("subject_stats.csv", Buffer.from(stringify(subjectStatsRows, { header: true })));
    zip.addFile("timetable.csv", Buffer.from(stringify(timetableRows, { header: true })));
    zip.addFile("attendance_logs.csv", Buffer.from(stringify(logRows, { header: true })));
    zip.addFile("events.csv", Buffer.from(stringify(eventRows, { header: true })));

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
    const activeSem = await prisma.semester.findFirst({
      where: { userId, isActive: true },
    });
    if (!activeSem) throw new Error("No active semester found. Please create or activate a semester first.");

    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    // Helper to find entry case-insensitively, handling paths with leading directories
    const findEntry = (filename: string) =>
      entries.find(
        (e) =>
          !e.isDirectory &&
          (e.entryName.toLowerCase() === filename.toLowerCase() ||
            e.entryName.toLowerCase().endsWith("/" + filename.toLowerCase()) ||
            e.entryName.toLowerCase().endsWith("\\" + filename.toLowerCase()))
      );

    const subjectEntry = findEntry("subject_stats.csv");
    const timetableEntry = findEntry("timetable.csv");
    const logsEntry = findEntry("attendance_logs.csv");
    const eventsEntry = findEntry("events.csv");

    if (!subjectEntry || !timetableEntry || !logsEntry) {
      throw new Error(
        "Invalid ZIP format. Must contain subject_stats.csv, timetable.csv, and attendance_logs.csv"
      );
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
        // 1. Wipe current semester data safely respecting foreign key constraints
        const oldSubjects = await tx.subject.findMany({
          where: { semesterId: activeSem.id },
          select: { id: true },
        });
        const oldSubjectIds = oldSubjects.map((s) => s.id);

        if (oldSubjectIds.length > 0) {
          // Disassociate notes and assignments from deleting subjects
          await tx.note.updateMany({
            where: { subjectId: { in: oldSubjectIds } },
            data: { subjectId: null },
          });
          await tx.assignment.updateMany({
            where: { subjectId: { in: oldSubjectIds } },
            data: { subjectId: null },
          });
        }

        // Wipe attendance records referencing the semester
        await tx.attendance.deleteMany({
          where: {
            OR: [
              { subject: { semesterId: activeSem.id } },
              { timetableSlot: { semesterId: activeSem.id } },
              { override: { semesterId: activeSem.id } },
            ],
          },
        });

        // Delete overrides, slots, subjects, and events
        await tx.timetableOverride.deleteMany({ where: { semesterId: activeSem.id } });
        await tx.timetableSlot.deleteMany({ where: { semesterId: activeSem.id } });
        await tx.subject.deleteMany({ where: { semesterId: activeSem.id } });
        await tx.event.deleteMany({ where: { semesterId: activeSem.id } });

        // 2. Import Subjects
        const subjectMap = new Map<string, string>(); // Name -> ID
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
        }> = [];

        for (const row of timetableData) {
          const dayName = (row["Day of Week"] || "").trim().toLowerCase();
          const subjectName = (row["Subject"] || "").trim();
          const dayIdx = daysMap[dayName] ?? 0;
          const subId = subjectMap.get(subjectName);
          if (!subId) continue;

          // Parse exact timing from CSV instead of faking it
          const timing = row["Timing"]; // e.g., "09:00 - 09:50"
          let startStr = "09:00";
          let endStr = "10:00";
          if (timing && timing.includes("-")) {
            const parts = timing.split("-");
            startStr = parts[0].trim();
            endStr = parts[1].trim();
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
          });
        }

        // 4. Import Logs
        const seenLogKeys = new Set<string>();

        for (const row of logsData) {
          const subName = (row["Subject"] || "").trim();
          const subId = subjectMap.get(subName);
          if (!subId) continue;

          const dateStr = row["Date"]?.trim();
          if (!dateStr) continue;
          const dateObj = parseDateAsUtc(dateStr);

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

          let overrideId: string | undefined = undefined;
          let matchedSlotId: string | undefined = undefined;

          if (isOverride) {
            const ov = await tx.timetableOverride.create({
              data: {
                semesterId: activeSem.id,
                date: dateObj,
                overrideType: "extra_class",
                subjectId: subId,
              },
            });
            overrideId = ov.id;
          } else {
            // Attempt to associate with a timetable slot on that weekday
            const dayOfWeek = (dateObj.getUTCDay() + 6) % 7; // Monday = 0
            const matchingSlots = createdSlots.filter(
              (s) => s.subjectId === subId && s.dayOfWeek === dayOfWeek
            );

            if (matchingSlots.length === 1) {
              matchedSlotId = matchingSlots[0].id;
            } else if (matchingSlots.length > 1) {
              const lectureNo = parseInt(row["Lecture No."], 10);
              if (
                !isNaN(lectureNo) &&
                lectureNo >= 1 &&
                lectureNo <= matchingSlots.length
              ) {
                matchedSlotId = matchingSlots[lectureNo - 1].id;
              } else {
                matchedSlotId = matchingSlots[0].id;
              }
            }
          }

          // Deduplication key against unique constraint [userId, subjectId, date, timetableSlotId]
          const dateIso = dateObj.toISOString().slice(0, 10);
          const dedupeKey = `${subId}_${dateIso}_${matchedSlotId || "none"}_${overrideId || "none"}`;
          if (seenLogKeys.has(dedupeKey)) {
            continue;
          }
          seenLogKeys.add(dedupeKey);

          await tx.attendance.create({
            data: {
              userId,
              subjectId: subId,
              date: dateObj,
              status,
              timetableSlotId: matchedSlotId || null,
              overrideId: overrideId || null,
              remarks: row["Remarks"]?.trim() || null,
            },
          });
        }

        // 5. Import Events (Academic Calendar)
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

          await tx.event.create({
            data: {
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
            },
          });
        }
      },
      {
        timeout: 30000,
        maxWait: 5000,
      }
    );

    // Invalidate server cache for user
    await CacheService.invalidateUser(userId);
  }
}
