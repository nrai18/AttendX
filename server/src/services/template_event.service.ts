import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { EventService } from './event.service';

export interface TemplateHoliday {
  sr: number;
  name: string;
  date: string;
  day: string;
  isoDate: string;
}

export interface TemplateHolidayData {
  year: number;
  fixedHolidays: TemplateHoliday[];
  restrictedHolidays: TemplateHoliday[];
}

export interface TemplateAcademicEvent {
  title: string;
  startDate: string;
  endDate: string;
  eventType: string;
  allDay: boolean;
  semesters: number[];
  description?: string;
}

export class TemplateEventService {
  private static holidaysDir = path.join(__dirname, '../data/holidays');
  private static academicDir = path.join(__dirname, '../data/academic_calendars');

  /**
   * Fetches official fixed and restricted holidays for a given year.
   */
  static getHolidays(year: number = new Date().getFullYear()): TemplateHolidayData {
    const filePath = path.join(this.holidaysDir, `${year}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
      } catch (e) {
        console.error(`[TemplateEventService] Error reading holiday file for year ${year}:`, e);
      }
    }
    return {
      year,
      fixedHolidays: [],
      restrictedHolidays: []
    };
  }

  /**
   * Fetches official academic calendar events matching a semester number and/or year/date range.
   */
  static getAcademicCalendar(options: {
    semesterNumber?: number;
    year?: number;
    startDate?: string;
    endDate?: string;
  }): { academicYear: string; semesterType: 'odd' | 'even'; year: number; events: TemplateAcademicEvent[] } {
    let targetYear = options.year || new Date().getFullYear();
    let semesterType: 'odd' | 'even' = 'odd';

    // 1. Determine semester type (odd vs even)
    if (options.semesterNumber !== undefined && !isNaN(options.semesterNumber)) {
      semesterType = options.semesterNumber % 2 !== 0 ? 'odd' : 'even';
    } else if (options.startDate) {
      const month = new Date(options.startDate).getMonth() + 1; // 1-12
      // Jan - June (1-6) => even semester; July - Dec (7-12) => odd semester
      semesterType = month <= 6 ? 'even' : 'odd';
      targetYear = new Date(options.startDate).getFullYear();
    }

    const fileName = `${targetYear}_${semesterType}.json`;
    const filePath = path.join(this.academicDir, fileName);

    let catalog: any = null;
    if (fs.existsSync(filePath)) {
      try {
        catalog = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch (e) {
        console.error(`[TemplateEventService] Error reading academic calendar ${fileName}:`, e);
      }
    }

    if (!catalog) {
      return {
        academicYear: `${targetYear}-${targetYear + 1}`,
        semesterType,
        year: targetYear,
        events: []
      };
    }

    // Filter events by semester number if provided
    let filteredEvents = catalog.events || [];
    if (options.semesterNumber !== undefined && !isNaN(options.semesterNumber)) {
      const sNum = options.semesterNumber;
      filteredEvents = filteredEvents.filter((e: TemplateAcademicEvent) => 
        !e.semesters || e.semesters.length === 0 || e.semesters.includes(sNum)
      );
    }

    return {
      academicYear: catalog.academicYear || `${targetYear}-${targetYear + 1}`,
      semesterType,
      year: targetYear,
      events: filteredEvents
    };
  }

  /**
   * Syncs official holidays and/or academic calendar events directly into a user's active semester.
   */
  static async syncToSemester(options: {
    userId: string;
    semesterId: string;
    syncHolidayList?: boolean;
    syncAcademicCalendar?: boolean;
    year?: number;
    semesterNumber?: number;
  }) {
    const { userId, semesterId, syncHolidayList, syncAcademicCalendar } = options;

    const semester = await prisma.semester.findFirst({
      where: { id: semesterId, userId }
    });
    if (!semester) throw new Error("Semester not found or access denied");

    const semStartDate = new Date(semester.startDate);
    const semEndDate = new Date(semester.endDate);
    const startYear = semStartDate.getFullYear();

    // Derive semester number from semester name if not explicitly passed (e.g. "Semester 5 (3rd Year)" -> 5)
    let semNum = options.semesterNumber;
    if (!semNum) {
      const match = semester.name.match(/semester\s*(\d+)/i);
      if (match) semNum = parseInt(match[1]);
    }

    const payloadEvents: any[] = [];

    // 1. Sync Holidays
    if (syncHolidayList) {
      const endYear = semEndDate.getFullYear();
      for (let y = startYear; y <= endYear; y++) {
        const holidayData = this.getHolidays(y);

        // Fixed holidays
        for (const h of holidayData.fixedHolidays) {
          if (!h.isoDate) continue;
          const hTime = new Date(`${h.isoDate}T00:00:00Z`).getTime();
          if (hTime < semStartDate.getTime() || hTime > semEndDate.getTime()) {
            continue; // Strictly skip holidays outside this semester's duration
          }
          payloadEvents.push({
            title: h.name,
            date: `${h.isoDate}T00:00:00Z`,
            endDate: `${h.isoDate}T00:00:00Z`,
            eventType: "holiday",
            allDay: true,
            isHolidayList: true,
            isHoliday: true
          });
        }

        // Restricted holidays
        for (const rh of holidayData.restrictedHolidays) {
          if (!rh.isoDate) continue;
          const rhTime = new Date(`${rh.isoDate}T00:00:00Z`).getTime();
          if (rhTime < semStartDate.getTime() || rhTime > semEndDate.getTime()) {
            continue; // Strictly skip holidays outside this semester's duration
          }
          payloadEvents.push({
            title: rh.name,
            date: `${rh.isoDate}T00:00:00Z`,
            endDate: `${rh.isoDate}T00:00:00Z`,
            eventType: "restricted_holiday",
            allDay: true,
            isHolidayList: true,
            isHoliday: true
          });
        }
      }
    }

    // 2. Sync Academic Calendar
    if (syncAcademicCalendar) {
      const academicData = this.getAcademicCalendar({
        semesterNumber: semNum,
        year: startYear,
        startDate: semester.startDate.toISOString().split('T')[0],
        endDate: semester.endDate.toISOString().split('T')[0]
      });

      for (const ae of academicData.events) {
        if (!ae.startDate) continue;
        const aeTime = new Date(`${ae.startDate}T00:00:00Z`).getTime();
        if (aeTime < semStartDate.getTime() || aeTime > semEndDate.getTime()) {
          continue; // Strictly skip academic events outside this semester's duration
        }
        payloadEvents.push({
          title: ae.title,
          description: ae.description || null,
          date: `${ae.startDate}T00:00:00Z`,
          endDate: ae.endDate ? `${ae.endDate}T00:00:00Z` : `${ae.startDate}T00:00:00Z`,
          eventType: ae.eventType || "other",
          allDay: ae.allDay !== false,
          isHolidayList: false,
          isHoliday: ae.eventType === "holiday" || ae.eventType === "vacation"
        });
      }
    }

    if (payloadEvents.length === 0) {
      return { syncedCount: 0, events: [] };
    }

    // Save with deduplication via EventService
    const created = await EventService.saveWizardEvents(userId, semesterId, payloadEvents);
    return { syncedCount: created.length, events: created };
  }
}
