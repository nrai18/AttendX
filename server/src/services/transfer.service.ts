import { prisma } from "../lib/prisma";
import { TimetableService } from "./timetable.service";

export class TransferService {
  static async buildPayload(userId: string, contextType: string, dateRange?: { startDate: string, endDate: string }) {
    const activeSem = await prisma.semester.findFirst({
      where: { userId, isActive: true },
    });
    if (!activeSem) throw new Error("No active semester found");

    const exportedTimetable = await TimetableService.exportTimetable(userId, activeSem.id);

    const payload: any = {
      slots: exportedTimetable.slots,
      academicCalendar: [],
      lectureLogs: [],
      subjects: exportedTimetable.subjects,
      metadata: {
        startDate: dateRange?.startDate || null,
        endDate: dateRange?.endDate || null,
      }
    };

    // 3. Fetch Events (Academic Calendar)
    const events = await prisma.event.findMany({
      where: { 
        OR: [
          { semesterId: activeSem.id },
          { semesterId: null }
        ]
      }
    });

    // 4. Fetch Attendance Logs (if needed based on context)
    let logs: any[] = [];
    if (contextType === "FULL_EXPORT" || contextType === "SCHEDULE_STATUS") {
      let whereClause: any = { userId, subject: { semesterId: activeSem.id } };
      
      if (dateRange && dateRange.startDate && dateRange.endDate) {
        whereClause.date = {
          gte: new Date(dateRange.startDate).toISOString(),
          lte: new Date(dateRange.endDate).toISOString()
        };
      }
      
      logs = await prisma.attendance.findMany({
        where: whereClause,
        include: { subject: true }
      });
    }

    if (contextType === "FULL_EXPORT") {
      payload.academicCalendar = events;
      payload.lectureLogs = logs;
    } 
    else if (contextType === "TIMETABLE_CALENDAR") {
      payload.academicCalendar = events.map((e: any) => ({ date: e.date, type: e.eventType, description: e.title, isHolidayList: e.isHolidayList }));
    }
    else if (contextType === "SCHEDULE_STATUS") {
      payload.academicCalendar = events.map((e: any) => ({ date: e.date, type: e.eventType, description: e.title, isHolidayList: e.isHolidayList }));

      
      // Strip personal marks for SCHEDULE_STATUS
      payload.lectureLogs = logs.map((log: any) => {
        let status = log.status;
        let isConducted = false;
        
        if (status === "present" || status === "absent" || status === "medical" || status === "od") {
          status = "HELD";
          isConducted = true;
        } else if (status === "off") {
          status = "CANCELLED";
          isConducted = false;
        }
        
        return {
          date: log.date.toISOString().split('T')[0],
          subjectId: log.subjectId, // the sender's uuid
          subjectCode: log.subject?.code,
          subjectName: log.subject?.name,
          slot: log.timetableSlotId,
          status,
          isConducted
        };
      });
    }

    return payload;
  }
}
