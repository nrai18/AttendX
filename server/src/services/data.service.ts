import { prisma } from "../lib/prisma";
import AdmZip from "adm-zip";
import { stringify } from "csv-stringify/sync";
import { parse } from "csv-parse/sync";
import { Prisma } from "@prisma/client";

export class DataService {
  static async exportData(userId: string): Promise<Buffer> {
    const activeSem = await prisma.semester.findFirst({
      where: { userId, isActive: true },
    });
    if (!activeSem) throw new Error("No active semester found");

    // Fetch Subjects
    const subjects = await prisma.subject.findMany({
      where: { semesterId: activeSem.id },
      include: { attendance: true },
    });

    // Generate subject_stats.csv
    const subjectStatsRows = subjects.map((sub: any, idx: number) => {
      let attended = 0, missed = 0, off = 0;
      sub.attendance.forEach((log: any) => {
        if (log.status === "present") attended++;
        if (log.status === "absent") missed++;
        if (log.status === "off") off++;
      });
      const total = attended + missed + off;
      const pct = total > 0 ? ((attended / total) * 100).toFixed(2) + "%" : "0.00%";
      return {
        "Sr. No.": idx + 1,
        "Subject": sub.name,
        "Attended": attended,
        "Missed": missed,
        "Off": off,
        "Total": total,
        "Percentage": pct,
        "Criteria": (sub.targetAttendance || 75) + "%"
      };
    });

    // Fetch Timetable
    const slots = await prisma.timetableSlot.findMany({
      where: { semesterId: activeSem.id },
      include: { subject: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

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
        "Type": slot.slotType === "practical" ? "Practical" : "Lecture"
      };
    });

    // Fetch Logs
    const logs = await prisma.attendance.findMany({
      where: { subject: { semesterId: activeSem.id } },
      include: { subject: true },
      orderBy: { date: 'asc' },
    });

    let currentDate = "";
    let logLectureNo = 1;
    const logRows = logs.map((log: any, idx: number) => {
      const dateStr = log.date.toISOString().split("T")[0];
      if (dateStr !== currentDate) {
        currentDate = dateStr;
        logLectureNo = 1;
      } else {
        logLectureNo++;
      }
      
      let attStatus = "Attended";
      if (log.status === "absent") attStatus = "Missed";
      if (log.status === "off") attStatus = "Off";

      return {
        "Sr. No.": idx + 1,
        "Date": dateStr,
        "Type": log.overrideId ? "Extra" : "Slot",
        "Lecture No.": logLectureNo,
        "Subject": log.subject.name,
        "Attendance": attStatus,
        "Att Modified": "",
        "Miss Modified": "",
        "Off Modified": ""
      };
    });

    const zip = new AdmZip();
    zip.addFile("subject_stats.csv", Buffer.from(stringify(subjectStatsRows, { header: true })));
    zip.addFile("timetable.csv", Buffer.from(stringify(timetableRows, { header: true })));
    zip.addFile("attendance_logs.csv", Buffer.from(stringify(logRows, { header: true })));

    return zip.toBuffer();
  }

  static async importData(userId: string, zipBuffer: Buffer): Promise<void> {
    const activeSem = await prisma.semester.findFirst({
      where: { userId, isActive: true },
    });
    if (!activeSem) throw new Error("No active semester found. Please create a semester first.");

    const zip = new AdmZip(zipBuffer);
    const subjectEntry = zip.getEntry("subject_stats.csv");
    const timetableEntry = zip.getEntry("timetable.csv");
    const logsEntry = zip.getEntry("attendance_logs.csv");

    if (!subjectEntry || !timetableEntry || !logsEntry) {
      throw new Error("Invalid ZIP format. Must contain subject_stats.csv, timetable.csv, and attendance_logs.csv");
    }

    const parseOptions = { columns: true, skip_empty_lines: true, trim: true };
    const subjectData = parse(subjectEntry.getData().toString('utf8'), parseOptions) as any as Record<string, string>[];
    const timetableData = parse(timetableEntry.getData().toString('utf8'), parseOptions) as any as Record<string, string>[];
    const logsData = parse(logsEntry.getData().toString('utf8'), parseOptions) as any as Record<string, string>[];

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Wipe current semester data
      await tx.subject.deleteMany({ where: { semesterId: activeSem.id } });
      // The deletion cascades to TimetableSlot and Attendance logs automatically

      // 2. Import Subjects
      const subjectMap = new Map<string, string>(); // Name -> ID
      let subjectIndex = 0;
      for (const row of subjectData) {
        const criteriaMatch = row["Criteria"]?.match(/(\d+)/);
        const target = criteriaMatch ? parseInt(criteriaMatch[1]) : 75;
        subjectIndex++;
        
        const sub = await tx.subject.create({
          data: {
            name: row["Subject"],
            semesterId: activeSem.id,
            userId,
            targetAttendance: target,
            colorHex: row["Color"] || ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#f43f5e"][subjectIndex % 11],
          }
        });
        subjectMap.set(row["Subject"], sub.id);
      }

      // 3. Import Timetable
      const daysMap: Record<string, number> = {
        "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6
      };
      
      const daySlotCounts: Record<number, number> = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };

      for (const row of timetableData) {
        const dayName = row["Day of Week"];
        const subjectName = row["Subject"];
        const dayIdx = daysMap[dayName] ?? 0;
        const subId = subjectMap.get(subjectName);
        if (!subId) continue;

        // Faking absolute times based on slot count
        const startHour = 9 + daySlotCounts[dayIdx];
        const startStr = `${startHour.toString().padStart(2, '0')}:00`;
        const endStr = `${startHour.toString().padStart(2, '0')}:50`;
        daySlotCounts[dayIdx]++;

        await tx.timetableSlot.create({
          data: {
            semesterId: activeSem.id,
            subjectId: subId,
            dayOfWeek: dayIdx,
            startTime: startStr,
            endTime: endStr,
            slotType: "lecture"
          }
        });
      }

      // 4. Import Logs
      for (const row of logsData) {
        const subName = row["Subject"];
        const subId = subjectMap.get(subName);
        if (!subId) continue;

        const dateStr = row["Date"]; // YYYY-MM-DD
        const dateObj = new Date(dateStr);
        
        const attStr = row["Attendance"];
        let status: any = "present";
        if (attStr === "Missed") status = "absent";
        if (attStr === "Off") status = "off";

        const typeStr = row["Type"];
        let isOverride = typeStr === "Extra" || typeStr === "override";

        let overrideId = undefined;
        if (isOverride) {
            const ov = await tx.timetableOverride.create({
                data: {
                    semesterId: activeSem.id,
                    date: dateObj,
                    overrideType: "extra_class",
                    subjectId: subId
                }
            });
            overrideId = ov.id;
        }

        await tx.attendance.create({
          data: {
            userId,
            subjectId: subId,
            date: dateObj,
            status,
            overrideId: overrideId
          }
        });
      }
    }, {
      timeout: 30000,
      maxWait: 5000
    });
  }
}
