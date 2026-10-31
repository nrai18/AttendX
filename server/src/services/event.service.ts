import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { CacheService } from "./cache.service";
import { isSameHoliday } from "../utils/holidayUtils";

export class EventService {
  static async getEvents(userId: string, startDate?: string, endDate?: string, semesterId?: string) {
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      };
    } else if (startDate) {
      dateFilter = {
        date: { gte: new Date(startDate) }
      };
    } else if (semesterId) {
      const sem = (await CacheService.getOrSet(userId, "semesters:active", () => prisma.semester.findFirst({ where: { userId, isActive: true } }))) || await prisma.semester.findUnique({
        where: { id: semesterId },
        select: { startDate: true, endDate: true }
      });
      if (sem) {
        dateFilter = {
          date: {
            gte: new Date(sem.startDate),
            lte: new Date(sem.endDate)
          }
        };
      }
    }

    const whereClause: any = {
      AND: [
        { OR: [{ userId }, { userId: null }] }
      ]
    };
    if (Object.keys(dateFilter).length > 0) {
      whereClause.AND.push(dateFilter);
    }

    if (semesterId) {
      whereClause.AND.push({
        OR: [{ semesterId }, { semesterId: null }]
      });
    }

    const events = await prisma.event.findMany({
      where: whereClause,
      orderBy: { date: "asc" }
    });

    // Deduplicate: If there's a global event and a user event with the same title and date, keep the user event
    const uniqueEvents = new Map();
    for (const evt of events) {
      const rawTitle = evt.title.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      const key = `${rawTitle}_${evt.date.toISOString().split('T')[0]}`;
      if (uniqueEvents.has(key)) {
        // If the existing one is global (userId: null) and the current one is user-specific, replace it
        if (!uniqueEvents.get(key).userId && evt.userId) {
          uniqueEvents.set(key, evt);
        }
      } else {
        uniqueEvents.set(key, evt);
      }
    }
    
    const dedupedList: any[] = [];
    for (const evt of uniqueEvents.values()) {
      const dateStr = evt.date.toISOString().split('T')[0];
      const isHol = evt.isHoliday || ["holiday", "restricted_holiday"].includes(evt.eventType);
      if (isHol) {
        const existingIdx = dedupedList.findIndex(d =>
          d.date.toISOString().split('T')[0] === dateStr &&
          (d.isHoliday || ["holiday", "restricted_holiday"].includes(d.eventType)) &&
          isSameHoliday(d.title, evt.title)
        );
        if (existingIdx !== -1) {
          if (evt.title.length > dedupedList[existingIdx].title.length) {
            dedupedList[existingIdx] = evt;
          }
          continue;
        }
      }
      dedupedList.push(evt);
    }
    return dedupedList;
  }



  static async saveWizardEvents(userId: string, semesterId: string, events: any[]) {
    // Validate semesterId ownership and fetch all existing events in a single parallel round-trip
    const [semesterExists, allExistingEvents] = await Promise.all([
      prisma.semester.findFirst({
        where: { id: semesterId, userId },
        select: { id: true },
      }),
      prisma.event.findMany({
        where: { semesterId, userId },
      }),
    ]);

    if (!semesterExists) {
      throw new Error("Unauthorized semester access or the specified semester does not exist.");
    }

    const eventsByDay = new Map<string, any[]>();
    for (const existing of allExistingEvents) {
      const dateKey = new Date(existing.date).toISOString().split("T")[0];
      const list = eventsByDay.get(dateKey) || [];
      list.push(existing);
      eventsByDay.set(dateKey, list);
    }

    // Save the user confirmed events, avoiding duplicates by title and date with batch createMany
    const createdEvents: any[] = [];
    const eventsToInsert: any[] = [];
    const updatePromises: Promise<any>[] = [];

    for (const evt of events) {
      // Normalize field aliases — older exports used description/type, newer use title/eventType
      const evtTitle: string = (evt.title || evt.description || "Event").trim();
      const evtEventType: string = evt.eventType || evt.type || "";
      const rawDate = evt.date || evt.startDate;
      const evtDate = new Date(rawDate);
      const dateKey = evtDate.toISOString().split("T")[0];

      let mappedType: any = "other";
      const rawType = evtEventType.toLowerCase();
      const titleLower = evtTitle.toLowerCase();

      if (rawType === "holiday") {
        mappedType = "holiday";
      } else if (rawType === "restricted_holiday") {
        mappedType = "restricted_holiday";
      } else if (rawType === "vacation") {
        mappedType = "vacation";
      } else if (rawType === "fest") {
        mappedType = "fest";
      } else if (rawType === "commencement" || rawType === "institute" || rawType === "event") {
        mappedType = "institute";
      } else if (rawType === "lab_exam" || titleLower.includes("lab") || titleLower.includes("practical")) {
        mappedType = "lab_exam";
      } else if (rawType === "exam" || rawType === "ct" || rawType === "midsem" || rawType === "endsem") {
        if (rawType === "midsem" || titleLower.includes("mid")) {
          mappedType = "midsem";
        } else if (rawType === "endsem" || titleLower.includes("end") || titleLower.includes("theory")) {
          mappedType = "endsem";
        } else if (rawType === "ct" || titleLower.includes("cycle") || titleLower.includes("ct")) {
          mappedType = "ct";
        } else {
          mappedType = "exam";
        }
      } else {
        // Fallback checks
        if (titleLower.includes("holiday")) mappedType = "holiday";
        else if (titleLower.includes("break") || titleLower.includes("vacation")) mappedType = "vacation";
        else if (titleLower.includes("fest")) mappedType = "fest";
        else if (titleLower.includes("commencement")) mappedType = "institute";
        else if (titleLower.includes("mid semester")) mappedType = "midsem";
        else if (titleLower.includes("end semester")) mappedType = "endsem";
        else if (titleLower.includes("cycle test") || titleLower.includes("ct-")) mappedType = "ct";
      }

      const isHolidayList = evt.isHolidayList === true;
      const isHoliday = evt.isHoliday === true || mappedType === "holiday" || mappedType === "restricted_holiday";

      const sameDayEvents = eventsByDay.get(dateKey) || [];

      // 1. Exact title duplicate check
      const exactMatch = sameDayEvents.find(e => e.title.toLowerCase().trim() === evtTitle.toLowerCase().trim());
      if (exactMatch) {
        if (evt.endDate && (!exactMatch.endDate || new Date(evt.endDate).getTime() !== new Date(exactMatch.endDate).getTime())) {
          exactMatch.endDate = new Date(evt.endDate);
          updatePromises.push(
            prisma.event.update({ where: { id: exactMatch.id }, data: { endDate: new Date(evt.endDate) } })
          );
        }
        createdEvents.push(exactMatch);
        continue;
      }

      // 2. Bidirectional Holiday Deduplication
      if (isHoliday) {
        const matchingHoliday = sameDayEvents.find(e =>
          (e.isHoliday || e.eventType === "holiday" || e.eventType === "restricted_holiday") &&
          isSameHoliday(e.title, evtTitle)
        );

        if (matchingHoliday) {
          // If the incoming event is from the Academic Calendar (e.g. "Dussehra (Vijay Dashmi)")
          // and existing is a central holiday (e.g. "Dussehra"), upgrade the existing entry with the official academic title
          if (!isHolidayList && matchingHoliday.isHolidayList) {
            matchingHoliday.title = evtTitle;
            matchingHoliday.eventType = mappedType;
            matchingHoliday.endDate = evt.endDate ? new Date(evt.endDate) : matchingHoliday.endDate;
            matchingHoliday.isHolidayList = false;
            matchingHoliday.isHoliday = true;

            updatePromises.push(
              prisma.event.update({
                where: { id: matchingHoliday.id },
                data: {
                  title: evtTitle,
                  eventType: mappedType,
                  endDate: matchingHoliday.endDate,
                  isHolidayList: false,
                  isHoliday: true
                }
              })
            );
            createdEvents.push(matchingHoliday);
            continue;
          } else {
            createdEvents.push(matchingHoliday);
            continue;
          }
        }
      }

      const newEventObj: any = {
        id: crypto.randomUUID(),
        userId,
        semesterId,
        title: evtTitle,
        eventType: mappedType,
        date: evtDate,
        endDate: evt.endDate ? new Date(evt.endDate) : null,
        allDay: evt.allDay !== false,
        isHoliday,
        isHolidayList,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      sameDayEvents.push(newEventObj);
      eventsByDay.set(dateKey, sameDayEvents);
      eventsToInsert.push(newEventObj);
      createdEvents.push(newEventObj);
    }

    // Execute all updates and the batch insert concurrently
    const operations: Promise<any>[] = [...updatePromises];
    if (eventsToInsert.length > 0) {
      operations.push(prisma.event.createMany({ data: eventsToInsert, skipDuplicates: true }));
    }
    if (operations.length > 0) {
      await Promise.all(operations);
    }

    CacheService.del(userId, "onboarding:status").catch(() => {});

    return createdEvents;
  }

  static async getTodayStatus(userId: string, semesterId: string, targetDateStr?: string) {
    let today: Date;
    if (targetDateStr) {
      // If a date string like YYYY-MM-DD is passed, construct UTC midnight directly
      const [year, month, day] = targetDateStr.split("-").map(Number);
      today = new Date(Date.UTC(year, month - 1, day));
    } else {
      // Fallback to local server date converted to UTC midnight
      const now = new Date();
      today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    }

    // Make sure we compare properly. If endDate is null, it's a single day event.
    // If endDate is provided, it's a multi-day event spanning from date to endDate.
    const activeEvents = await prisma.event.findMany({
      where: {
        userId,
        semesterId,
        OR: [
          {
            endDate: null,
            date: today
          },
          {
            endDate: { gte: today },
            date: { lte: today }
          }
        ]
      }
    });

    const nextEvents = await prisma.event.findMany({
      where: {
        userId,
        semesterId,
        date: { gt: today }
      },
      orderBy: { date: "asc" },
      take: 1
    });

    // Priority sort: official holidays and restricted holidays rank above all other event types
    // so that a custom/academic event never displaces a national holiday animation/greeting.
    const EVENT_PRIORITY: Record<string, number> = {
      holiday: 0,
      restricted_holiday: 1,
      vacation: 2,
      exam: 3,
      fest: 4,
      institute: 5,
    };
    const sortedEvents = [...activeEvents].sort((a, b) => {
      const pa = EVENT_PRIORITY[a.eventType] ?? 99;
      const pb = EVENT_PRIORITY[b.eventType] ?? 99;
      return pa - pb;
    });

    // Deduplicate activeEvents so multiple representations of the same holiday don't appear
    const deduplicatedEvents: any[] = [];
    for (const ev of sortedEvents) {
      const isHol = ev.isHoliday || ["holiday", "restricted_holiday"].includes(ev.eventType);
      if (isHol) {
        const existingIdx = deduplicatedEvents.findIndex(d =>
          (d.isHoliday || ["holiday", "restricted_holiday"].includes(d.eventType)) &&
          isSameHoliday(d.title, ev.title)
        );
        if (existingIdx !== -1) {
          if (ev.title.length > deduplicatedEvents[existingIdx].title.length) {
            deduplicatedEvents[existingIdx] = ev;
          }
          continue;
        }
      } else {
        if (deduplicatedEvents.some(d => d.title.toLowerCase().trim() === ev.title.toLowerCase().trim())) {
          continue;
        }
      }
      deduplicatedEvents.push(ev);
    }

    return {
      activeEvent: deduplicatedEvents.length > 0 ? deduplicatedEvents[0] : null,
      activeEvents: deduplicatedEvents,
      nextEvent: nextEvents.length > 0 ? nextEvents[0] : null
    };
  }

  static async clearAllEvents(userId: string, target?: "holiday_list" | "academic_calendar" | "all", semesterId?: string) {
    const baseWhere: any = { userId };

    if (semesterId) {
      baseWhere.semesterId = semesterId;
    }

    if (target === "holiday_list") {
      baseWhere.isHolidayList = true;
    } else if (target === "academic_calendar") {
      baseWhere.isHolidayList = false;
    }

    const res = await prisma.event.deleteMany({
      where: baseWhere
    });
    CacheService.del(userId, "onboarding:status").catch(() => {});
    return res;
  }
}
