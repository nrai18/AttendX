import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";
import { CacheService } from "./cache.service";
import { EventService } from "./event.service";
import { isSameHoliday } from "../utils/holidayUtils";

import holidays2026 from "../data/holidays/2026.json";
import holidays2027 from "../data/holidays/2027.json";
import holidays2028 from "../data/holidays/2028.json";

import cal2026Even from "../data/academic_calendars/2026_even.json";
import cal2026Odd from "../data/academic_calendars/2026_odd.json";
import cal2027Even from "../data/academic_calendars/2027_even.json";
import cal2027Odd from "../data/academic_calendars/2027_odd.json";
import cal2028Even from "../data/academic_calendars/2028_even.json";
import cal2028Odd from "../data/academic_calendars/2028_odd.json";

export interface HolidayTemplateItem {
  sr?: number;
  name: string;
  date?: string;
  day?: string;
  isoDate: string;
}

export interface HolidayListTemplatePayload {
  year: number;
  fixedHolidays: HolidayTemplateItem[];
  restrictedHolidays: HolidayTemplateItem[];
}

export interface CalendarTemplateEventItem {
  title: string;
  startDate: string;
  endDate?: string;
  eventType: string;
  allDay?: boolean;
  semesters?: number[];
  description?: string | null;
}

export interface AcademicCalendarTemplatePayload {
  academicYear: string;
  semesterType: "even" | "odd";
  year: number;
  events: CalendarTemplateEventItem[];
}

const BUILTIN_HOLIDAYS: Record<string, HolidayListTemplatePayload> = {
  "2026": holidays2026 as HolidayListTemplatePayload,
  "2027": holidays2027 as HolidayListTemplatePayload,
  "2028": holidays2028 as HolidayListTemplatePayload,
};

const BUILTIN_CALENDARS: Record<string, AcademicCalendarTemplatePayload> = {
  "2026_even": cal2026Even as AcademicCalendarTemplatePayload,
  "2026_odd": cal2026Odd as AcademicCalendarTemplatePayload,
  "2027_even": cal2027Even as AcademicCalendarTemplatePayload,
  "2027_odd": cal2027Odd as AcademicCalendarTemplatePayload,
  "2028_even": cal2028Even as AcademicCalendarTemplatePayload,
  "2028_odd": cal2028Odd as AcademicCalendarTemplatePayload,
};

const SUPPORTED_YEARS = [2026, 2027, 2028] as const;

export class AcademicTemplateService {
  private static tableBootstrapped = false;
  private static memoryCache = new Map<string, { payload: any; version: number; updatedAt: string }>();

  private static async ensureTableExists(): Promise<boolean> {
    if (this.tableBootstrapped) return true;
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "academic_templates" (
          "id" TEXT PRIMARY KEY,
          "kind" TEXT NOT NULL,
          "key" TEXT UNIQUE NOT NULL,
          "year" INTEGER NOT NULL,
          "semesterType" TEXT,
          "payload" JSONB NOT NULL,
          "version" INTEGER NOT NULL DEFAULT 1,
          "updatedBy" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "academic_templates_kind_year_idx" ON "academic_templates" ("kind", "year");
      `);
      this.tableBootstrapped = true;
      return true;
    } catch (err) {
      console.warn("[AcademicTemplateService] DB table ensure skipped/failed, falling back to JSON/fs:", err);
      return false;
    }
  }

  private static getDiskOverridePath(kind: "holiday_list" | "academic_calendar", key: string): string {
    const dir = kind === "holiday_list" ? "holidays" : "academic_calendars";
    return path.resolve(__dirname, `../data/${dir}/${key}.json`);
  }

  private static readDiskOrBuiltin(kind: "holiday_list" | "academic_calendar", key: string): any | null {
    const builtin = kind === "holiday_list" ? BUILTIN_HOLIDAYS[key] : BUILTIN_CALENDARS[key];
    try {
      const filePath = this.getDiskOverridePath(kind, key);
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
        if (parsed) return parsed;
      }
    } catch {}
    return builtin || null;
  }

  static inferSemesterMeta(options: {
    semesterNumber?: number;
    semesterName?: string;
    year?: number;
    startDate?: Date | string;
    endDate?: Date | string;
  }): { year: number; semesterType: "even" | "odd"; semesterNumber?: number } {
    let year = options.year;
    let semesterType: "even" | "odd" = "odd";
    let semesterNumber = options.semesterNumber;

    if (!semesterNumber && options.semesterName) {
      const m =
        options.semesterName.match(/(?:semester|sem)[^\d]*(\d+)/i) ||
        options.semesterName.match(/\b(\d+)\b/);
      if (m) semesterNumber = parseInt(m[1], 10);
    }

    if (options.startDate) {
      const s = new Date(options.startDate);
      if (!isNaN(s.getTime())) {
        if (!year) year = s.getFullYear();
        const month = s.getMonth() + 1;
        semesterType = month >= 6 ? "odd" : "even";
      }
    }

    if (semesterNumber && !isNaN(semesterNumber)) {
      semesterType = semesterNumber % 2 === 0 ? "even" : "odd";
    }

    if (!year) year = new Date().getFullYear();

    return { year, semesterType, semesterNumber };
  }

  static async getHolidayList(year: number): Promise<{
    year: number;
    fixedHolidays: HolidayTemplateItem[];
    restrictedHolidays: HolidayTemplateItem[];
    version: number;
    source: "database" | "builtin";
  }> {
    const key = String(year);
    const cacheKey = `holiday:${key}`;

    if (await this.ensureTableExists()) {
      try {
        const row = await (prisma as any).academicTemplate?.findUnique?.({ where: { key } });
        if (row && row.kind === "holiday_list" && row.payload) {
          const payload = row.payload as HolidayListTemplatePayload;
          this.memoryCache.set(cacheKey, {
            payload,
            version: row.version || 1,
            updatedAt: new Date(row.updatedAt).toISOString(),
          });
          return {
            year: payload.year || year,
            fixedHolidays: Array.isArray(payload.fixedHolidays) ? payload.fixedHolidays : [],
            restrictedHolidays: Array.isArray(payload.restrictedHolidays) ? payload.restrictedHolidays : [],
            version: row.version || 1,
            source: "database",
          };
        }
      } catch (e) {
        console.warn("[AcademicTemplateService] getHolidayList DB fallback:", e);
      }
    }

    const mem = this.memoryCache.get(cacheKey);
    if (mem) {
      return {
        year: mem.payload.year || year,
        fixedHolidays: mem.payload.fixedHolidays || [],
        restrictedHolidays: mem.payload.restrictedHolidays || [],
        version: mem.version,
        source: "builtin",
      };
    }

    const fallback = this.readDiskOrBuiltin("holiday_list", key) || {
      year,
      fixedHolidays: [],
      restrictedHolidays: [],
    };
    return {
      year: fallback.year || year,
      fixedHolidays: Array.isArray(fallback.fixedHolidays) ? fallback.fixedHolidays : [],
      restrictedHolidays: Array.isArray(fallback.restrictedHolidays) ? fallback.restrictedHolidays : [],
      version: 1,
      source: "builtin",
    };
  }

  static async getAcademicCalendar(options: {
    year?: number;
    semesterType?: "even" | "odd";
    semesterNumber?: number;
    semesterName?: string;
    startDate?: Date | string;
    endDate?: Date | string;
  }): Promise<AcademicCalendarTemplatePayload & { key: string; version: number; source: "database" | "builtin" }> {
    const inferred = this.inferSemesterMeta(options);
    const key = `${inferred.year}_${inferred.semesterType}`;
    const cacheKey = `cal:${key}`;

    let base: AcademicCalendarTemplatePayload | null = null;
    let version = 1;
    let source: "database" | "builtin" = "builtin";

    if (await this.ensureTableExists()) {
      try {
        const row = await (prisma as any).academicTemplate?.findUnique?.({ where: { key } });
        if (row && row.kind === "academic_calendar" && row.payload) {
          base = row.payload as AcademicCalendarTemplatePayload;
          version = row.version || 1;
          source = "database";
          this.memoryCache.set(cacheKey, {
            payload: base,
            version,
            updatedAt: new Date(row.updatedAt).toISOString(),
          });
        }
      } catch (e) {
        console.warn("[AcademicTemplateService] getAcademicCalendar DB fallback:", e);
      }
    }

    if (!base) {
      const mem = this.memoryCache.get(cacheKey);
      if (mem) {
        base = mem.payload;
        version = mem.version;
      } else {
        base = this.readDiskOrBuiltin("academic_calendar", key) || {
          academicYear: `${inferred.year}-${String((inferred.year + 1) % 100).padStart(2, "0")}`,
          semesterType: inferred.semesterType,
          year: inferred.year,
          events: [],
        };
      }
    }

    let events = Array.isArray(base?.events) ? [...base!.events] : [];

    // Also include neighboring cross-year calendar if range spans Dec -> Jan or Jun -> Jul
    if (options.semesterNumber) {
      events = events.filter(
        (ev) => !ev.semesters || ev.semesters.length === 0 || ev.semesters.includes(options.semesterNumber!)
      );
    }

    if (options.startDate || options.endDate) {
      const sIso = options.startDate ? new Date(options.startDate).toISOString().slice(0, 10) : "0000-01-01";
      const eIso = options.endDate ? new Date(options.endDate).toISOString().slice(0, 10) : "9999-12-31";
      events = events.filter((ev) => {
        const start = ev.startDate;
        const end = ev.endDate || ev.startDate;
        return end >= sIso && start <= eIso;
      });
    }

    return {
      academicYear: base?.academicYear || `${inferred.year}`,
      semesterType: (base?.semesterType as "even" | "odd") || inferred.semesterType,
      year: base?.year || inferred.year,
      events,
      key,
      version,
      source,
    };
  }

  static async listAllTemplates() {
    const holidays = await Promise.all(
      SUPPORTED_YEARS.map(async (yr) => {
        const data = await this.getHolidayList(yr);
        return {
          key: String(yr),
          kind: "holiday_list",
          year: yr,
          version: data.version,
          source: data.source,
          fixedCount: data.fixedHolidays.length,
          restrictedCount: data.restrictedHolidays.length,
        };
      })
    );

    const calendars: any[] = [];
    for (const yr of SUPPORTED_YEARS) {
      for (const st of ["even", "odd"] as const) {
        const data = await this.getAcademicCalendar({ year: yr, semesterType: st });
        calendars.push({
          key: data.key,
          kind: "academic_calendar",
          year: yr,
          semesterType: st,
          academicYear: data.academicYear,
          version: data.version,
          source: data.source,
          eventCount: data.events.length,
        });
      }
    }

    return {
      supportedYears: [...SUPPORTED_YEARS],
      holidays,
      calendars,
    };
  }

  static async upsertHolidayTemplate(
    year: number,
    payload: HolidayListTemplatePayload,
    updatedBy?: string,
    rewriteActiveSemesters = true
  ) {
    if (![2026, 2027, 2028].includes(year)) {
      throw new Error("Supported holiday years are 2026, 2027, and 2028.");
    }
    const key = String(year);
    const normalizedPayload: HolidayListTemplatePayload = {
      year,
      fixedHolidays: Array.isArray(payload.fixedHolidays) ? payload.fixedHolidays : [],
      restrictedHolidays: Array.isArray(payload.restrictedHolidays) ? payload.restrictedHolidays : [],
    };

    let savedVersion = 1;
    if (await this.ensureTableExists()) {
      try {
        const existing = await (prisma as any).academicTemplate?.findUnique?.({ where: { key } });
        savedVersion = (existing?.version || 0) + 1;
        await (prisma as any).academicTemplate.upsert({
          where: { key },
          update: {
            payload: normalizedPayload as any,
            version: savedVersion,
            updatedBy: updatedBy || null,
          },
          create: {
            kind: "holiday_list",
            key,
            year,
            semesterType: null,
            payload: normalizedPayload as any,
            version: savedVersion,
            updatedBy: updatedBy || null,
          },
        });
      } catch (e) {
        console.warn("[AcademicTemplateService] upsertHolidayTemplate DB write warning:", e);
      }
    }

    this.memoryCache.set(`holiday:${key}`, {
      payload: normalizedPayload,
      version: savedVersion,
      updatedAt: new Date().toISOString(),
    });

    // Also update local JSON file if writable in this runtime
    try {
      const diskPath = this.getDiskOverridePath("holiday_list", key);
      if (fs.existsSync(path.dirname(diskPath))) {
        fs.writeFileSync(diskPath, JSON.stringify(normalizedPayload, null, 2), "utf8");
      }
    } catch {}

    let propagation: any = null;
    if (rewriteActiveSemesters) {
      propagation = await this.propagateToMatchingSemesters({
        kind: "holiday_list",
        year,
      });
    }

    return {
      key,
      year,
      version: savedVersion,
      fixedCount: normalizedPayload.fixedHolidays.length,
      restrictedCount: normalizedPayload.restrictedHolidays.length,
      propagation,
    };
  }

  static async upsertAcademicCalendarTemplate(
    year: number,
    semesterType: "even" | "odd",
    payload: Partial<AcademicCalendarTemplatePayload>,
    updatedBy?: string,
    rewriteActiveSemesters = true
  ) {
    if (![2026, 2027, 2028].includes(year)) {
      throw new Error("Supported academic calendar years are 2026, 2027, and 2028.");
    }
    if (!["even", "odd"].includes(semesterType)) {
      throw new Error("semesterType must be 'even' or 'odd'.");
    }

    const key = `${year}_${semesterType}`;
    const existingBuiltin = this.readDiskOrBuiltin("academic_calendar", key);
    const normalizedPayload: AcademicCalendarTemplatePayload = {
      academicYear:
        payload.academicYear ||
        existingBuiltin?.academicYear ||
        (semesterType === "odd"
          ? `${year}-${String((year + 1) % 100).padStart(2, "0")}`
          : `${year - 1}-${String(year % 100).padStart(2, "0")}`),
      semesterType,
      year,
      events: Array.isArray(payload.events) ? payload.events : [],
    };

    let savedVersion = 1;
    if (await this.ensureTableExists()) {
      try {
        const existing = await (prisma as any).academicTemplate?.findUnique?.({ where: { key } });
        savedVersion = (existing?.version || 0) + 1;
        await (prisma as any).academicTemplate.upsert({
          where: { key },
          update: {
            payload: normalizedPayload as any,
            version: savedVersion,
            updatedBy: updatedBy || null,
          },
          create: {
            kind: "academic_calendar",
            key,
            year,
            semesterType,
            payload: normalizedPayload as any,
            version: savedVersion,
            updatedBy: updatedBy || null,
          },
        });
      } catch (e) {
        console.warn("[AcademicTemplateService] upsertAcademicCalendarTemplate DB write warning:", e);
      }
    }

    this.memoryCache.set(`cal:${key}`, {
      payload: normalizedPayload,
      version: savedVersion,
      updatedAt: new Date().toISOString(),
    });

    try {
      const diskPath = this.getDiskOverridePath("academic_calendar", key);
      if (fs.existsSync(path.dirname(diskPath))) {
        fs.writeFileSync(diskPath, JSON.stringify(normalizedPayload, null, 2), "utf8");
      }
    } catch {}

    let propagation: any = null;
    if (rewriteActiveSemesters) {
      propagation = await this.propagateToMatchingSemesters({
        kind: "academic_calendar",
        year,
        semesterType,
      });
    }

    return {
      key,
      year,
      semesterType,
      version: savedVersion,
      eventCount: normalizedPayload.events.length,
      propagation,
    };
  }

  /**
   * Synchronizes and (when rewriteExisting=true) actively rewrites prior template events
   * on a semester without touching personal user birthdays or custom events, then
   * invalidates the user's Redis/L1 cache so forecasted attendance & calendar immediately update.
   */
  static async syncToSemester(options: {
    userId: string;
    semesterId: string;
    syncHolidayList?: boolean;
    syncAcademicCalendar?: boolean;
    year?: number;
    semesterNumber?: number;
    rewriteExisting?: boolean;
  }) {
    const {
      userId,
      semesterId,
      syncHolidayList = true,
      syncAcademicCalendar = false,
      rewriteExisting = false,
    } = options;

    const semester = await prisma.semester.findFirst({
      where: { id: semesterId, userId },
    });
    if (!semester) {
      throw new Error("Semester not found or unauthorized");
    }

    const startDate = new Date(semester.startDate);
    const endDate = new Date(semester.endDate);
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    const sIso = startDate.toISOString().slice(0, 10);
    const eIso = endDate.toISOString().slice(0, 10);

    const meta = this.inferSemesterMeta({
      semesterNumber: options.semesterNumber,
      semesterName: semester.name,
      year: options.year || startYear,
      startDate,
      endDate,
    });

    const payloadEvents: any[] = [];
    const yearsToSync = Array.from(new Set([startYear, endYear]));

    if (syncHolidayList) {
      if (rewriteExisting) {
        await prisma.event.deleteMany({
          where: {
            userId,
            semesterId,
            isHolidayList: true,
          },
        });
      }

      for (const yr of yearsToSync) {
        const hData = await this.getHolidayList(yr);
        for (const h of hData.fixedHolidays) {
          if (h.isoDate >= sIso && h.isoDate <= eIso) {
            payloadEvents.push({
              title: h.name,
              description: `Gazetted Holiday (${h.date || h.isoDate})`,
              date: `${h.isoDate}T00:00:00Z`,
              endDate: `${h.isoDate}T00:00:00Z`,
              eventType: "holiday",
              allDay: true,
              isHolidayList: true,
              isHoliday: true,
            });
          }
        }
        for (const rh of hData.restrictedHolidays) {
          if (rh.isoDate >= sIso && rh.isoDate <= eIso) {
            payloadEvents.push({
              title: `${rh.name} (Restricted Holiday)`,
              description: `Restricted Holiday (${rh.date || rh.isoDate})`,
              date: `${rh.isoDate}T00:00:00Z`,
              endDate: `${rh.isoDate}T00:00:00Z`,
              eventType: "restricted_holiday",
              allDay: true,
              isHolidayList: true,
              isHoliday: true,
            });
          }
        }
      }
    }

    if (syncAcademicCalendar) {
      const cal = await this.getAcademicCalendar({
        year: meta.year,
        semesterType: meta.semesterType,
        semesterNumber: meta.semesterNumber,
        startDate,
        endDate,
      });

      if (rewriteExisting) {
        // Rewrite academic calendar milestones while preserving personal/custom/birthday events
        const calTitlesNormalized = new Set(
          cal.events.map((e) => e.title.toLowerCase().trim())
        );
        const builtinRef = this.readDiskOrBuiltin("academic_calendar", `${meta.year}_${meta.semesterType}`);
        if (builtinRef?.events) {
          for (const be of builtinRef.events) {
            calTitlesNormalized.add(String(be.title || "").toLowerCase().trim());
          }
        }

        const existingNonHolidayListEvents = await prisma.event.findMany({
          where: { userId, semesterId, isHolidayList: false },
          select: { id: true, title: true, eventType: true },
        });
        const idsToRewrite = existingNonHolidayListEvents
          .filter((ev) => {
            const tl = ev.title.toLowerCase().trim();
            if (/birthday|bday|b'day/i.test(tl)) return false;
            return (
              calTitlesNormalized.has(tl) ||
              /last\s*(teaching|working)\s*day|commencement\s*of\s*classes|next\s*semester\s*commencement|end\s*semester\s*(theory|lab)|mid\s*semester\s*(exam|break)|attendance\s*shortage|supplementary\s*exam|practical\s*lab\s*demo|answer-sheets|student\s*vacation|winter\s*vacation|summer\s*vacation/i.test(
                tl
              )
            );
          })
          .map((e) => e.id);

        if (idsToRewrite.length > 0) {
          await prisma.event.deleteMany({
            where: { id: { in: idsToRewrite }, userId },
          });
        }
      }

      for (const ae of cal.events) {
        payloadEvents.push({
          title: ae.title,
          description: ae.description || null,
          date: `${ae.startDate}T00:00:00Z`,
          endDate: ae.endDate ? `${ae.endDate}T00:00:00Z` : `${ae.startDate}T00:00:00Z`,
          eventType: ae.eventType || "other",
          allDay: ae.allDay !== false,
          isHolidayList: false,
          isHoliday: ae.eventType === "holiday" || ae.eventType === "vacation",
        });
      }
    }

    if (payloadEvents.length === 0) {
      await CacheService.invalidateUser(userId);
      return { syncedCount: 0, events: [] };
    }

    const created = await EventService.saveWizardEvents(userId, semesterId, payloadEvents);
    await CacheService.invalidateUser(userId);
    return {
      syncedCount: created.length,
      events: created,
    };
  }

  /**
   * Rewrites existing events across all matching active semesters when a backend
   * holiday list or academic calendar changes, invalidating cached stats and forecasts.
   */
  static async propagateToMatchingSemesters(options: {
    kind: "holiday_list" | "academic_calendar" | "all";
    year?: number;
    semesterType?: "even" | "odd";
  }) {
    const activeSemesters = await prisma.semester.findMany({
      where: { isActive: true },
      select: {
        id: true,
        userId: true,
        name: true,
        startDate: true,
        endDate: true,
      },
    });

    let updatedSemesters = 0;
    let totalEventsSynced = 0;
    const affectedUserIds = new Set<string>();

    for (const sem of activeSemesters) {
      const sYear = new Date(sem.startDate).getFullYear();
      const eYear = new Date(sem.endDate).getFullYear();
      const meta = this.inferSemesterMeta({
        semesterName: sem.name,
        startDate: sem.startDate,
        endDate: sem.endDate,
      });

      const yearMatches =
        !options.year || sYear === options.year || eYear === options.year || meta.year === options.year;
      if (!yearMatches) continue;

      if (
        options.kind === "academic_calendar" &&
        options.semesterType &&
        meta.semesterType !== options.semesterType
      ) {
        continue;
      }

      try {
        const res = await this.syncToSemester({
          userId: sem.userId,
          semesterId: sem.id,
          syncHolidayList: options.kind === "holiday_list" || options.kind === "all",
          syncAcademicCalendar: options.kind === "academic_calendar" || options.kind === "all",
          year: options.year || meta.year,
          semesterNumber: meta.semesterNumber,
          rewriteExisting: true,
        });
        updatedSemesters++;
        totalEventsSynced += res.syncedCount;
        affectedUserIds.add(sem.userId);
      } catch (e) {
        console.warn(`[AcademicTemplateService] Failed propagating to semester ${sem.id}:`, e);
      }
    }

    return {
      updatedSemesters,
      affectedUsers: affectedUserIds.size,
      totalEventsSynced,
    };
  }
}
