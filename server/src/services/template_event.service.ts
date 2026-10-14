import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { EventService } from './event.service';

import h2026 from '../data/holidays/2026.json';
import h2027 from '../data/holidays/2027.json';
import h2028 from '../data/holidays/2028.json';
import cal2026Odd from '../data/academic_calendars/2026_odd.json';
import cal2027Even from '../data/academic_calendars/2027_even.json';
import cal2027Odd from '../data/academic_calendars/2027_odd.json';

const BUILTIN_HOLIDAYS: Record<number, TemplateHolidayData> = {
  2026: h2026 as unknown as TemplateHolidayData,
  2027: h2027 as unknown as TemplateHolidayData,
  2028: h2028 as unknown as TemplateHolidayData,
};

const BUILTIN_ACADEMIC_CALENDARS: Record<string, any> = {
  '2026_odd': cal2026Odd,
  '2027_even': cal2027Even,
  '2027_odd': cal2027Odd,
};

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
  private static resolveDir(subDir: string): string {
    const candidates = [
      path.join(__dirname, '../data', subDir),
      path.join(__dirname, '../src/data', subDir),
      path.join(__dirname, 'data', subDir),
      path.join(process.cwd(), 'server/src/data', subDir),
      path.join(process.cwd(), 'src/data', subDir),
      path.join(process.cwd(), 'server/data', subDir),
      path.join(process.cwd(), 'data', subDir),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return path.join(__dirname, '../data', subDir);
  }

  /**
   * Fetches official fixed and restricted holidays for a given year.
   */
  static getHolidays(year: number = new Date().getFullYear()): TemplateHolidayData {
    if (BUILTIN_HOLIDAYS[year]) {
      return BUILTIN_HOLIDAYS[year];
    }

    const holidaysDir = this.resolveDir('holidays');
    const filePath = path.join(holidaysDir, `${year}.json`);
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

    const key = `${targetYear}_${semesterType}`;
    let catalog: any = BUILTIN_ACADEMIC_CALENDARS[key];

    if (!catalog) {
      const academicDir = this.resolveDir('academic_calendars');
      const fileName = `${key}.json`;
      const filePath = path.join(academicDir, fileName);

      if (fs.existsSync(filePath)) {
        try {
          catalog = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (e) {
          console.error(`[TemplateEventService] Error reading academic calendar ${fileName}:`, e);
        }
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
    const startDateStr = semStartDate.toISOString().split('T')[0];
    const endDateStr = semEndDate.toISOString().split('T')[0];

    // Derive semester number from semester name if not explicitly passed (e.g. "Semester 5 (3rd Year)" -> 5)
    let semNum = options.semesterNumber;
    if (!semNum) {
      const match = semester.name.match(/(?:semester|sem)[^\d]*(\d+)/i) 
        || semester.name.match(/(\d+)(?:st|nd|rd|th)?\s*(?:semester|sem)/i) 
        || semester.name.match(/\b(\d+)\b/);
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
          if (h.isoDate < startDateStr || h.isoDate > endDateStr) {
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
          if (rh.isoDate < startDateStr || rh.isoDate > endDateStr) {
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
        startDate: startDateStr,
        endDate: endDateStr
      });

      for (const ae of academicData.events) {
        if (!ae.startDate) continue;
        const aeStart = ae.startDate;
        const aeEnd = ae.endDate || ae.startDate;
        if (aeEnd < startDateStr || aeStart > endDateStr) {
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
