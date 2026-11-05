import JSZip from "jszip";
import { useAttendanceStore } from "../stores/attendanceStore";
import { useCacheStore } from "../stores/cacheStore";
import { useAuthStore } from "../stores/authStore";
import { useOfflineStore } from "../stores/offlineStore";

const UTF8_BOM = "\uFEFF";

function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(cells: any[]): string {
  return cells.map(escapeCsvCell).join(",");
}

/**
 * Robust RFC 4180 CSV Parser
 * Handles multiline quoted fields, escaped double-quotes (""), and whitespace trimming.
 */
function parseCsv(text: string): Record<string, string>[] {
  const cleanText = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentCell += '"';
          i++; // skip escaped quote
        } else {
          insideQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentCell.trim());
        currentCell = "";
      } else if (char === "\r") {
        if (nextChar === "\n") i++;
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = "";
      } else if (char === "\n") {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim());
  const dataRows: Record<string, string>[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 0 || (row.length === 1 && !row[0])) continue;
    const obj: Record<string, string> = {};
    headers.forEach((header, colIdx) => {
      obj[header] = row[colIdx] || "";
    });
    dataRows.push(obj);
  }

  return dataRows;
}

function normalizeTimeStr(timeStr: string): string {
  if (!timeStr) return "09:00";
  const trimmed = timeStr.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{1,2})/);
  if (match) {
    const hours = match[1].padStart(2, "0");
    const minutes = match[2].padStart(2, "0");
    return `${hours}:${minutes}`;
  }
  return trimmed;
}

const DAYS_MAP = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAYS_LOOKUP: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

export class OfflineZipService {
  /**
   * Generates a complete AttendX ZIP archive directly in the browser when offline.
   * Produces subject_stats.csv, timetable.csv, attendance_logs.csv, events.csv,
   * semester.json, and client_diagnostic_logs.json.
   */
  static async exportZipOffline(): Promise<{ blob: Blob; filename: string }> {
    const attendanceState = useAttendanceStore.getState();
    const cacheState = useCacheStore.getState();
    const user = useAuthStore.getState().user;

    const activeSemester =
      cacheState.semester?.activeSemester ||
      (attendanceState.hasActiveSemester && attendanceState.activeSemesterId
        ? {
            id: attendanceState.activeSemesterId,
            name: "Active Semester",
            startDate: new Date().toISOString().slice(0, 10),
            endDate: new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10),
          }
        : null);

    const subjects =
      (cacheState.subjects?.subjects && cacheState.subjects.subjects.length > 0)
        ? cacheState.subjects.subjects
        : (attendanceState.subjects || []);

    const slots =
      (cacheState.timetable?.slots && cacheState.timetable.slots.length > 0)
        ? cacheState.timetable.slots
        : [];

    const events =
      (cacheState.semester?.events && cacheState.semester.events.length > 0)
        ? cacheState.semester.events
        : (attendanceState.events || []);

    // Flatten attendance logs from cache
    let logs: any[] = [];
    if (cacheState.all_logs && Array.isArray(cacheState.all_logs)) {
      logs = cacheState.all_logs;
    } else if (cacheState.subject_logs) {
      const flattened: any[] = [];
      Object.values(cacheState.subject_logs).forEach((subLogs: any) => {
        if (Array.isArray(subLogs)) flattened.push(...subLogs);
      });
      logs = flattened;
    }

    // 1. subject_stats.csv
    const subjectHeaders = [
      "Sr. No.",
      "Subject",
      "Code",
      "Credits",
      "Faculty",
      "Color",
      "Attended",
      "Missed",
      "Off",
      "Total",
      "Percentage",
      "Criteria",
    ];

    const subjectRows = subjects.map((sub: any, idx: number) => {
      const attended = Number(sub.attended ?? 0);
      const missed = Number(sub.missed ?? 0);
      const off = Number(sub.off ?? 0);
      const total = Number(sub.total ?? (attended + missed));
      const pct = total > 0 ? ((attended / total) * 100).toFixed(2) + "%" : "0.00%";
      const criteria = (sub.targetAttendance || user?.targetAttendance || 75) + "%";
      return toCsvRow([
        idx + 1,
        sub.name || "Subject",
        sub.code || "",
        sub.credits != null ? String(sub.credits) : "",
        sub.faculty || "",
        sub.colorHex || "#3b82f6",
        attended,
        missed,
        off,
        total,
        pct,
        criteria,
      ]);
    });

    const subjectStatsCsv = UTF8_BOM + [toCsvRow(subjectHeaders), ...subjectRows].join("\r\n");

    // 2. timetable.csv
    const timetableHeaders = [
      "Sr. No.",
      "Day of Week",
      "Lecture No.",
      "Subject",
      "Timing",
      "Room",
      "Type",
      "Valid From",
      "Valid Until",
    ];

    let currentDay = -1;
    let lectureNo = 1;
    const timetableRows = slots.map((slot: any, idx: number) => {
      const slotDay = slot.dayOfWeek ?? 0;
      if (slotDay !== currentDay) {
        currentDay = slotDay;
        lectureNo = 1;
      } else {
        lectureNo++;
      }
      const normStart = normalizeTimeStr(slot.startTime);
      const normEnd = normalizeTimeStr(slot.endTime);
      const subName = slot.subject?.name || subjects.find((s: any) => s.id === slot.subjectId)?.name || "Class";
      const slotType = (slot.slotType || "").toLowerCase() === "practical" ? "Practical" : ((slot.slotType || "").toLowerCase() === "tutorial" ? "Tutorial" : "Lecture");

      return toCsvRow([
        idx + 1,
        DAYS_MAP[slotDay] || "Monday",
        lectureNo,
        subName,
        `${normStart} - ${normEnd}`,
        slot.room || "",
        slotType,
        slot.validFrom ? String(slot.validFrom).slice(0, 10) : "",
        slot.validUntil ? String(slot.validUntil).slice(0, 10) : "",
      ]);
    });

    const timetableCsv = UTF8_BOM + [toCsvRow(timetableHeaders), ...timetableRows].join("\r\n");

    // 3. attendance_logs.csv
    const logHeaders = [
      "Sr. No.",
      "Date",
      "Type",
      "Lecture No.",
      "Subject Lecture No.",
      "Slot Time",
      "Subject",
      "Attendance",
      "Att Modified",
      "Miss Modified",
      "Off Modified",
      "Override Reason",
      "Remarks",
    ];

    const logRows = logs.map((log: any, idx: number) => {
      const subName = log.subject?.name || subjects.find((s: any) => s.id === log.subjectId)?.name || "Class";
      let attStatus = "Attended";
      if (log.status === "absent") attStatus = "Missed";
      else if (log.status === "off") attStatus = "Off";
      else if (log.status === "cancelled") attStatus = "Cancelled";
      else if (log.status === "medical") attStatus = "Medical";
      else if (log.status === "od") attStatus = "OD";

      const slotTimeStr = log.startTime && log.endTime ? `${normalizeTimeStr(log.startTime)} - ${normalizeTimeStr(log.endTime)}` : "";

      return toCsvRow([
        idx + 1,
        log.date ? String(log.date).slice(0, 10) : new Date().toISOString().slice(0, 10),
        log.isExtra ? "Extra" : "Slot",
        idx + 1,
        1,
        slotTimeStr,
        subName,
        attStatus,
        "",
        "",
        "",
        log.reason || "",
        log.remarks || "",
      ]);
    });

    const logsCsv = UTF8_BOM + [toCsvRow(logHeaders), ...logRows].join("\r\n");

    // 4. events.csv
    const eventHeaders = [
      "Sr. No.",
      "Title",
      "Description",
      "Date",
      "End Date",
      "Type",
      "All Day",
      "Is Holiday",
      "Is Holiday List",
    ];

    const eventRows = events.map((ev: any, idx: number) => {
      const start = ev.date ? String(ev.date).slice(0, 10) : "";
      const end = ev.endDate ? String(ev.endDate).slice(0, 10) : start;
      return toCsvRow([
        idx + 1,
        ev.title || "Academic Event",
        ev.description || "",
        start,
        end,
        ev.eventType || "other",
        ev.allDay ? "Yes" : "No",
        ev.isHoliday ? "Yes" : "No",
        ev.isHolidayList ? "Yes" : "No",
      ]);
    });

    const eventsCsv = UTF8_BOM + [toCsvRow(eventHeaders), ...eventRows].join("\r\n");

    // 5. Build ZIP
    const zip = new JSZip();
    zip.file("subject_stats.csv", subjectStatsCsv);
    zip.file("timetable.csv", timetableCsv);
    zip.file("attendance_logs.csv", logsCsv);
    zip.file("events.csv", eventsCsv);

    if (activeSemester) {
      const semMeta = {
        name: activeSemester.name,
        startDate: activeSemester.startDate ? String(activeSemester.startDate).slice(0, 10) : "",
        endDate: activeSemester.endDate ? String(activeSemester.endDate).slice(0, 10) : "",
      };
      zip.file("semester.json", JSON.stringify(semMeta, null, 2));
    }

    const clientDiag = {
      exportedAt: new Date().toISOString(),
      offlineExport: true,
      platform: "AttendX Client",
      subjectsCount: subjects.length,
      slotsCount: slots.length,
      logsCount: logs.length,
      eventsCount: events.length,
    };
    zip.file("client_diagnostic_logs.json", JSON.stringify(clientDiag, null, 2));

    const blob = await zip.generateAsync({
      type: "blob",
      mimeType: "application/zip",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `AttendX_Semester_Export_${dateStr}.zip`;

    return { blob, filename };
  }

  /**
   * Unpacks and restores an AttendX ZIP archive directly in the browser when offline.
   * Parses subject_stats.csv, timetable.csv, attendance_logs.csv, events.csv, semester.json,
   * updates local Zustand stores, capacitorStorage, and queues background sync for reconnection.
   */
  static async importZipOffline(file: File | Blob): Promise<{
    success: boolean;
    stats: {
      subjectsCount: number;
      slotsCount: number;
      logsCount: number;
      eventsCount: number;
    };
  }> {
    const zip = await JSZip.loadAsync(file);

    const findFile = (target: string) => {
      const matchKey = Object.keys(zip.files).find((filename) => {
        const norm = filename.replace(/\\/g, "/").toLowerCase();
        return norm === target.toLowerCase() || norm.endsWith("/" + target.toLowerCase());
      });
      return matchKey ? zip.files[matchKey] : null;
    };

    const subjectEntry = findFile("subject_stats.csv");
    const timetableEntry = findFile("timetable.csv");
    const logsEntry = findFile("attendance_logs.csv");
    const eventsEntry = findFile("events.csv");
    const semesterEntry = findFile("semester.json");

    if (!subjectEntry || !timetableEntry || !logsEntry) {
      throw new Error("Invalid ZIP format. Must contain subject_stats.csv, timetable.csv, and attendance_logs.csv");
    }

    // 1. Semester Metadata
    let semesterMeta = {
      name: "Restored Semester",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10),
    };

    if (semesterEntry) {
      try {
        const metaStr = await semesterEntry.async("string");
        const parsed = JSON.parse(metaStr);
        if (parsed.name) semesterMeta.name = parsed.name;
        if (parsed.startDate) semesterMeta.startDate = parsed.startDate;
        if (parsed.endDate) semesterMeta.endDate = parsed.endDate;
      } catch (e) {
        console.warn("Failed to parse semester.json", e);
      }
    }

    const activeSemesterId = `restored_sem_${Date.now()}`;
    const restoredSemester = {
      id: activeSemesterId,
      name: semesterMeta.name,
      startDate: semesterMeta.startDate,
      endDate: semesterMeta.endDate,
      isActive: true,
    };

    // 2. Parse Subjects
    const subjectRaw = await subjectEntry.async("string");
    const subjectData = parseCsv(subjectRaw);

    const defaultColors = [
      "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
      "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#f43f5e",
    ];

    const subjectsMap = new Map<string, any>();
    const restoredSubjects = subjectData
      .map((row, idx) => {
        const name = (row["Subject"] || "").trim();
        if (!name) return null;
        const targetMatch = row["Criteria"]?.match(/(\d+)/);
        const target = targetMatch ? parseInt(targetMatch[1], 10) : 75;
        const credits = row["Credits"] ? parseInt(row["Credits"], 10) : undefined;
        const attended = parseInt(row["Attended"] || "0", 10) || 0;
        const missed = parseInt(row["Missed"] || "0", 10) || 0;
        const off = parseInt(row["Off"] || "0", 10) || 0;
        const total = attended + missed;
        const percentage = total > 0 ? Number(((attended / total) * 100).toFixed(1)) : 0;

        const sub = {
          id: `sub_${Date.now()}_${idx}`,
          name,
          code: (row["Code"] || "").trim() || undefined,
          credits: isNaN(credits as any) ? undefined : credits,
          faculty: (row["Faculty"] || "").trim() || undefined,
          colorHex: (row["Color"] || "").trim() || defaultColors[idx % defaultColors.length],
          targetAttendance: target,
          semesterId: activeSemesterId,
          attended,
          missed,
          off,
          total,
          percentage,
        };
        subjectsMap.set(name.toLowerCase(), sub);
        return sub;
      })
      .filter(Boolean) as any[];

    // 3. Parse Timetable
    const timetableRaw = await timetableEntry.async("string");
    const timetableData = parseCsv(timetableRaw);

    const restoredSlots: any[] = [];
    timetableData.forEach((row, idx) => {
      const dayName = (row["Day of Week"] || "").trim().toLowerCase();
      const subName = (row["Subject"] || "").trim().toLowerCase();
      const matchedSub = subjectsMap.get(subName);
      if (!matchedSub) return;

      const dayIdx = DAYS_LOOKUP[dayName] ?? 0;
      const timing = row["Timing"] || "09:00 - 10:00";
      let startStr = "09:00";
      let endStr = "10:00";
      if (timing.includes("-")) {
        const parts = timing.split("-");
        startStr = normalizeTimeStr(parts[0]);
        endStr = normalizeTimeStr(parts[1]);
      }

      const slotType = (row["Type"] || "").toLowerCase() === "practical" ? "practical" : ((row["Type"] || "").toLowerCase() === "tutorial" ? "tutorial" : "lecture");

      restoredSlots.push({
        id: `slot_${Date.now()}_${idx}`,
        semesterId: activeSemesterId,
        subjectId: matchedSub.id,
        dayOfWeek: dayIdx,
        startTime: startStr,
        endTime: endStr,
        slotType,
        room: (row["Room"] || "").trim(),
        subject: matchedSub,
      });
    });

    // 4. Parse Attendance Logs
    const logsRaw = await logsEntry.async("string");
    const logsData = parseCsv(logsRaw);
    const restoredLogs: any[] = [];

    logsData.forEach((row, idx) => {
      const subName = (row["Subject"] || "").trim().toLowerCase();
      const matchedSub = subjectsMap.get(subName);
      if (!matchedSub) return;

      const rawAtt = (row["Attendance"] || "").toLowerCase().trim();
      let status: "present" | "absent" | "off" | "cancelled" | "medical" | "od" = "present";
      if (rawAtt === "missed" || rawAtt === "absent") status = "absent";
      else if (rawAtt === "off") status = "off";
      else if (rawAtt === "cancelled") status = "cancelled";
      else if (rawAtt === "medical") status = "medical";
      else if (rawAtt === "od") status = "od";

      const dateStr = row["Date"] || new Date().toISOString().slice(0, 10);
      restoredLogs.push({
        id: `att_${Date.now()}_${idx}`,
        subjectId: matchedSub.id,
        date: dateStr,
        status,
        remarks: row["Remarks"] || "",
        isExtra: (row["Type"] || "").toLowerCase().includes("extra"),
        subject: matchedSub,
      });
    });

    // 5. Parse Events
    let restoredEvents: any[] = [];
    if (eventsEntry) {
      try {
        const eventsRaw = await eventsEntry.async("string");
        const eventsData = parseCsv(eventsRaw);
        restoredEvents = eventsData.map((row, idx) => ({
          id: `evt_${Date.now()}_${idx}`,
          semesterId: activeSemesterId,
          title: (row["Title"] || "").trim() || "Academic Event",
          description: (row["Description"] || "").trim(),
          date: row["Date"] || new Date().toISOString().slice(0, 10),
          endDate: row["End Date"] || row["Date"] || new Date().toISOString().slice(0, 10),
          eventType: (row["Type"] || "other").toLowerCase().trim(),
          allDay: (row["All Day"] || "").toLowerCase() === "yes",
          isHoliday: (row["Is Holiday"] || "").toLowerCase() === "yes",
          isHolidayList: (row["Is Holiday List"] || "").toLowerCase() === "yes",
        }));
      } catch (e) {
        console.warn("Failed to parse events.csv", e);
      }
    }

    // 6. Calculate Totals
    const totalAttended = restoredSubjects.reduce((sum, s) => sum + s.attended, 0);
    const totalClasses = restoredSubjects.reduce((sum, s) => sum + s.total, 0);
    const overallPercentage = totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 0;

    // 7. Synchronously hydrate client stores
    useAttendanceStore.setState({
      activeSemesterId,
      hasActiveSemester: true,
      subjects: restoredSubjects as any,
      totalAttended,
      totalClasses,
      overallPercentage,
      events: restoredEvents as any,
    });

    useCacheStore.getState().setCache("semester", {
      activeSemester: restoredSemester,
      events: restoredEvents,
    });
    useCacheStore.getState().setCache("subjects", {
      subjects: restoredSubjects,
      stats: restoredSubjects,
      activeSemesterId,
    });
    useCacheStore.getState().setCache("timetable", {
      activeSemester: restoredSemester,
      subjects: restoredSubjects,
      slots: restoredSlots,
    });
    useCacheStore.getState().setCache("all_logs", restoredLogs);

    // Group logs by subject
    const subjectLogsMap: Record<string, any[]> = {};
    restoredLogs.forEach((l) => {
      if (!subjectLogsMap[l.subjectId]) subjectLogsMap[l.subjectId] = [];
      subjectLogsMap[l.subjectId].push(l);
    });
    useCacheStore.getState().setCache("subject_logs", subjectLogsMap);

    // 8. Queue an offline background sync payload so when online, backend DB imports it
    try {
      useOfflineStore.getState().enqueue({
        method: "POST",
        url: "/timetable/import/" + activeSemesterId,
        data: {
          semester: restoredSemester,
          subjects: restoredSubjects,
          timetable: restoredSlots,
          logs: restoredLogs,
          events: restoredEvents,
        },
      });
    } catch (e) {}

    // 9. Dispatch events to alert all pages
    window.dispatchEvent(new CustomEvent("attendance-updated"));
    window.dispatchEvent(new CustomEvent("timetable-updated"));
    window.dispatchEvent(new CustomEvent("events-updated"));
    window.dispatchEvent(new CustomEvent("semester-updated"));

    return {
      success: true,
      stats: {
        subjectsCount: restoredSubjects.length,
        slotsCount: restoredSlots.length,
        logsCount: restoredLogs.length,
        eventsCount: restoredEvents.length,
      },
    };
  }
}
