/**
 * Offline-First Academic Calendar & Holiday Catalog Bundle
 * 
 * Bundles pre-indexed official institute academic calendars and national/regional holidays
 * so that offline semester onboarding, transitions, and timetable creations never fail on missing network connectivity.
 */

import h2026 from './data/holidays/2026.json';
import h2027 from './data/holidays/2027.json';
import h2028 from './data/holidays/2028.json';
import cal2026Odd from './data/academic_calendars/2026_odd.json';
import cal2027Even from './data/academic_calendars/2027_even.json';
import cal2027Odd from './data/academic_calendars/2027_odd.json';

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
  semesters?: number[];
  description?: string;
}

export interface TemplateAcademicCalendarData {
  academicYear: string;
  semesterType: 'odd' | 'even';
  year: number;
  events: TemplateAcademicEvent[];
}

export const STATIC_HOLIDAYS: Record<number, TemplateHolidayData> = {
  2026: h2026 as unknown as TemplateHolidayData,
  2027: h2027 as unknown as TemplateHolidayData,
  2028: h2028 as unknown as TemplateHolidayData,
};

export const STATIC_ACADEMIC_CALENDARS: Record<string, TemplateAcademicCalendarData> = {
  '2026_odd': cal2026Odd as unknown as TemplateAcademicCalendarData,
  '2027_even': cal2027Even as unknown as TemplateAcademicCalendarData,
  '2027_odd': cal2027Odd as unknown as TemplateAcademicCalendarData,
};

export function getHolidaysTemplate(year: number = new Date().getFullYear()): TemplateHolidayData {
  if (STATIC_HOLIDAYS[year]) {
    return STATIC_HOLIDAYS[year];
  }
  return {
    year,
    fixedHolidays: [],
    restrictedHolidays: [],
  };
}

export function getAcademicCalendarTemplate(options: {
  semesterNumber?: number;
  year?: number;
  startDate?: string;
  endDate?: string;
}): TemplateAcademicCalendarData {
  let targetYear = options.year || new Date().getFullYear();
  let semesterType: 'odd' | 'even' = 'odd';

  if (options.semesterNumber !== undefined && !isNaN(options.semesterNumber)) {
    semesterType = options.semesterNumber % 2 !== 0 ? 'odd' : 'even';
  } else if (options.startDate) {
    const month = new Date(options.startDate).getMonth() + 1;
    semesterType = month <= 6 ? 'even' : 'odd';
    targetYear = new Date(options.startDate).getFullYear();
  }

  const key = `${targetYear}_${semesterType}`;
  const catalog = STATIC_ACADEMIC_CALENDARS[key];

  if (!catalog) {
    return {
      academicYear: `${targetYear}-${targetYear + 1}`,
      semesterType,
      year: targetYear,
      events: [],
    };
  }

  let filteredEvents = catalog.events || [];
  if (options.semesterNumber !== undefined && !isNaN(options.semesterNumber)) {
    const sNum = options.semesterNumber;
    filteredEvents = filteredEvents.filter((e) =>
      !e.semesters || e.semesters.length === 0 || e.semesters.includes(sNum)
    );
  }

  return {
    ...catalog,
    events: filteredEvents,
  };
}

export function getOfflineCalendarEventsForSemester(options: {
  semesterId: string;
  semesterNumber?: number;
  startDate: string;
  endDate: string;
}): any[] {
  const { semesterId, semesterNumber, startDate, endDate } = options;
  if (!semesterId || !startDate || !endDate) return [];

  const startYear = parseInt(startDate.split('-')[0]) || new Date().getFullYear();
  const endYear = parseInt(endDate.split('-')[0]) || startYear;
  const startDateStr = startDate.split('T')[0];
  const endDateStr = endDate.split('T')[0];

  const payloadEvents: any[] = [];
  let eventCounter = 1;

  // 1. Fixed and Restricted Holidays across semester duration
  for (let y = startYear; y <= endYear; y++) {
    const hData = getHolidaysTemplate(y);
    for (const h of hData.fixedHolidays) {
      if (!h.isoDate || h.isoDate < startDateStr || h.isoDate > endDateStr) continue;
      payloadEvents.push({
        id: `offline-evt-${eventCounter++}-${Date.now()}`,
        title: h.name,
        date: `${h.isoDate}T00:00:00.000Z`,
        endDate: `${h.isoDate}T23:59:59.999Z`,
        eventType: 'holiday',
        isHoliday: true,
        isHolidayList: true,
        allDay: true,
        semesterId,
      });
    }
  }

  // 2. Official Academic Calendar Events
  const academicData = getAcademicCalendarTemplate({
    semesterNumber,
    year: startYear,
    startDate,
    endDate,
  });

  for (const e of academicData.events) {
    if (!e.startDate || !e.endDate) continue;
    if (e.endDate < startDateStr || e.startDate > endDateStr) continue;
    payloadEvents.push({
      id: `offline-evt-${eventCounter++}-${Date.now()}`,
      title: e.title,
      date: `${e.startDate}T00:00:00.000Z`,
      endDate: `${e.endDate}T23:59:59.999Z`,
      eventType: e.eventType || 'other',
      isHoliday: ['holiday', 'vacation'].includes(e.eventType?.toLowerCase() || ''),
      isHolidayList: false,
      allDay: e.allDay !== false,
      description: e.description || '',
      semesterId,
    });
  }

  return payloadEvents;
}
