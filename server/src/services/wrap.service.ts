import { prisma } from "../lib/prisma";
import { AIManager } from "../utils/ai_manager";
import { CacheService } from "./cache.service";
import crypto from "crypto";

export interface WrapRemarkQuipMap {
  [remark: string]: string;
}

export interface WrapAiCopy {
  source: "gemini" | "local";
  archetypeTitle: string;
  archetypeBadge: string;
  oneLiner: string;
  phaseRoast: string;
  introSubtitle: string;
  totalHeadline: string;
  monthlyArcCaption: string;
  topSubjectCaption: string;
  missingPatternHeadline: string;
  streakHighlightLine: string;
  remarksRoast: string;
  cancelledDayLine: string;
  extraClassLine: string;
  unmarkedLine: string;
  finaleLine: string;
  remarkQuips: WrapRemarkQuipMap;
}

const ONE_DAY_MS = 86400000;

function toIsoDate(d: Date | string): string {
  if (typeof d === "string") {
    const m = d.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  const obj = d instanceof Date ? d : new Date(d);
  return obj.toISOString().slice(0, 10);
}

function getTodayIstIso(): string {
  const istMs = Date.now() + 330 * 60 * 1000;
  return new Date(istMs).toISOString().slice(0, 10);
}

function daysBetweenIso(a: string, b: string): number {
  const ta = new Date(`${a}T00:00:00Z`).getTime();
  const tb = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((tb - ta) / ONE_DAY_MS);
}

function addDaysIso(iso: string, days: number): string {
  const t = new Date(`${iso}T00:00:00Z`).getTime();
  return new Date(t + days * ONE_DAY_MS).toISOString().slice(0, 10);
}

function computeStreak(sortedDates: string[]): { length: number; startDate: string | null; endDate: string | null } {
  if (sortedDates.length === 0) return { length: 0, startDate: null, endDate: null };
  let bestLen = 1;
  let bestStart = sortedDates[0];
  let bestEnd = sortedDates[0];
  let curLen = 1;
  let curStart = sortedDates[0];

  for (let i = 1; i < sortedDates.length; i++) {
    const gap = daysBetweenIso(sortedDates[i - 1], sortedDates[i]);
    // Allow 1-3 day weekend/holiday gap only if adjacent calendar dates? Wait: use consecutive study/marked day index OR <=3 days weekend bridge; keep exact <=3d for calendar continuity with distinct calendar dates
    if (gap >= 1 && gap <= 3) {
      curLen++;
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
        bestEnd = sortedDates[i];
      }
    } else {
      curLen = 1;
      curStart = sortedDates[i];
    }
  }
  return { length: bestLen, startDate: bestStart, endDate: bestEnd };
}

export class WrapService {
  static buildLocalRemarkQuip(remarkText: string, pct: number): string {
    const lower = remarkText.toLowerCase();
    const monthNow = new Date().getMonth(); // 0-11
    const isColdMonth = monthNow >= 9 || monthNow <= 1;

    if (/\b(overslept|sleep|sleeping|nap|woke|alarm|bed|tired|lazy|snooze)\b/i.test(lower)) {
      return isColdMonth
        ? "Get your ass up — winter's coming in the next semester. If you couldn't beat the alarm in summer/autumn, how are you surviving 9 AMs in January?"
        : "Your pillow owes your attendance register an apology. If you can't wake up right now, winter semester 9 AMs are going to cook you.";
    }
    if (/\b(home|homesick|gone\s*home|family|village|hometown|train|flight|trip)\b/i.test(lower)) {
      return "You like going home too much — are you homesick, or did hostel mess finally break your spirit?";
    }
    if (/\b(cancel|cancelled|no\s*class|mass\s*bunk|maze|prof\s*absent|teacher\s*absent|suspended)\b/i.test(lower)) {
      return "Maze hi maze! A full day of cancelled classes hits harder than any official holiday.";
    }
    if (/\b(forgot|proxy|roll\s*call|mark\s*present|say\s*present|late)\b/i.test(lower)) {
      return `"${remarkText}" — physically present, spiritually uncounted. Peak tragedy.`;
    }
    if (/\b(freewill|will|mood|vibe|felt\s*like|just\s*bunked|bunk)\b/i.test(lower)) {
      return `Invoking "${remarkText}" straight onto the log — zero excuses, pure free will.`;
    }
    if (/\b(exam|prep|study|assignment|viva|quiz|test|lab|project|coding|placement)\b/i.test(lower)) {
      return `Strategic "${remarkText}" bunk — burning 1 attendance slot to save your CGPA.`;
    }
    if (/\b(sick|fever|ill|headache|cold|doctor|medical|unwell|rest)\b/i.test(lower)) {
      return "Health mode activated — take the rest and bounce back into safe territory.";
    }
    if (/\b(fest|event|hack|club|sports|match|concert|cultural|volunteer|committee)\b/i.test(lower)) {
      return `Living real college life with "${remarkText}" while the timetable kept ticking.`;
    }
    return `"${remarkText}" is permanently framed in the Sem hall of fame (${pct.toFixed(1)}% holding strong).`;
  }

  static buildDeterministicCopy(snapshot: any): WrapAiCopy {
    const t = snapshot.totals;
    const f = snapshot.forecast;
    const cp = snapshot.calendarPatterns;
    const mp = snapshot.missingPatterns;
    const semName = snapshot.semester?.name || "This Semester";

    const worstDay = [...(mp.weekdays || [])]
      .filter((d: any) => d.total >= 3)
      .sort((a: any, b: any) => b.missPct - a.missPct)[0];
    const bestDay = [...(mp.weekdays || [])]
      .filter((d: any) => d.total >= 3)
      .sort((a: any, b: any) => b.attendPct - a.attendPct)[0];
    const worstSlot = [...(mp.timeSlots || [])]
      .filter((s: any) => s.total >= 3)
      .sort((a: any, b: any) => b.missPct - a.missPct)[0];

    const topSub = snapshot.subjectsRanked?.[0];
    const perfectSubs = (snapshot.subjectsRanked || []).filter((s: any) => s.pct === 100 && s.total > 0);
    const months = snapshot.months || [];
    const peakMonth = [...months].filter((m: any) => m.conducted >= 4).sort((a: any, b: any) => b.pct - a.pct)[0];

    let phaseRoast = `${t.conducted} classes down, ${f.remainingClasses} left until the cutoff.`;
    if (t.conducted === 0 && (t.rawLogs ?? 0) === 0) {
      phaseRoast = `No classes logged in ${semName} yet — mark attendance on Today to unlock your Replay.`;
    } else if (f.phase === "beginning") {
      phaseRoast = `Only ${t.conducted} classes in out of ~${f.totalForecastedClasses} — semester barely started and you're already checking Replay?`;
    } else if (f.phase === "early") {
      phaseRoast = `Only ${t.conducted} of ${f.totalForecastedClasses} classes done — tired already and not even halfway yet?`;
    } else if (f.phase === "halfway") {
      phaseRoast = `Right around halfway: ${t.conducted} logged, ${f.remainingClasses} forecasted left. Time to lock in.`;
    } else if (f.phase === "stretch") {
      phaseRoast = `Final stretch: ${f.remainingClasses} classes remaining before Last Teaching Day closes the books.`;
    } else {
      phaseRoast = `Classes are wrapped — ${t.present} of ${t.conducted} attended before Semester reset wipes the slate.`;
    }

    const archetypeTitle =
      perfectSubs.length >= 2 && t.percentage >= 80
        ? "The Calculated Lab Purist"
        : t.percentage >= 90
          ? "The Front-Row Constant"
          : t.percentage >= 75
            ? "The Edge-of-Margin Tactician"
            : "The Last-Minute Comeback Bet";

    const archetypeBadge = bestDay
      ? `${bestDay.day} Specialist`
      : t.percentage >= 75
        ? "Above Criteria"
        : "Recovery Arc";

    const remarkQuips: WrapRemarkQuipMap = {};
    for (const r of (snapshot.remarksTape || [])) {
      remarkQuips[r.text] = this.buildLocalRemarkQuip(r.text, t.percentage);
    }

    const cancelledDayLine =
      cp.fullCancelledDaysCount > 0
        ? `Maze hi maze! You unlocked ${cp.fullCancelledDaysCount} full day${cp.fullCancelledDaysCount === 1 ? "" : "s"} where classes got cancelled.`
        : "Zero full-day cancellations — the timetable showed zero mercy.";

    const purpleStreakLine =
      cp.mixedPurpleDaysCount > 0
        ? `${cp.mixedPurpleDaysCount} mixed purple-dot days on your calendar (streak of ${cp.bestMixedPurpleStreak?.length || 1}!) — half present, half tactical exit.`
        : `Clean binary days — barely any purple half-bunk days on your calendar.`;

    const ec = snapshot.extraClasses || { total: 0, attended: 0, missed: 0, missedSamples: [] };
    const extraClassLine =
      ec.missed > 0
        ? `An extra class happened (${ec.missedSamples?.[0]?.subjectName || "Bonus Slot"}${ec.missedSamples?.[0]?.remark ? ` · "${ec.missedSamples[0].remark}"` : ""}) and you missed ${ec.missed === 1 ? "it" : `${ec.missed} of them`}.`
        : ec.total > 0
          ? `Bonus grind unlocked: attended ${ec.attended} of ${ec.total} extra class${ec.total === 1 ? "" : "es"}.`
          : "No extra classes added on top of your weekly timetable.";

    const um = snapshot.unmarked || { daysCount: 0, slotsCount: 0 };
    const unmarkedLine =
      um.daysCount > 0
        ? `${um.daysCount} working day${um.daysCount === 1 ? "" : "s"} (${um.slotsCount} scheduled slot${um.slotsCount === 1 ? "" : "s"}) still sit unmarked in your logs.`
        : "0 unmarked working days — every scheduled teaching day is cleanly logged.";

    const isEmpty = t.conducted === 0 && (t.rawLogs ?? 0) === 0;
    return {
      source: "local",
      archetypeTitle: isEmpty ? "Fresh Semester Slate" : archetypeTitle,
      archetypeBadge: isEmpty ? "Ready to Log" : archetypeBadge,
      oneLiner: isEmpty
        ? `No classes logged in ${semName} yet — mark your first attendance to unlock Replay.`
        : `${t.present}/${t.conducted} (${t.percentage}%) in ${semName}${peakMonth ? `, peaking at ${peakMonth.pct}% in ${peakMonth.label}` : ""}${worstSlot ? `, with ${worstSlot.slot} alarms losing most battles` : ""}.`,
      phaseRoast,
      introSubtitle: isEmpty
        ? `${semName} will populate cards automatically once classes are marked.`
        : `${semName} told through timing, bunks, and your exact remarks.`,
      totalHeadline: isEmpty
        ? `0 classes conducted in ${semName} so far.`
        : `${t.present} classes attended out of ${t.conducted} conducted — sitting at ${t.percentage}%.`,
      monthlyArcCaption: peakMonth
        ? `Peaked at ${peakMonth.pct}% in ${peakMonth.key} across ${months.length} tracked months.`
        : `Tracked across ${months.length} month${months.length === 1 ? "" : "s"} so far.`,
      topSubjectCaption:
        perfectSubs.length > 0
          ? `Untouchable 100% across ${perfectSubs.slice(0, 3).map((s: any) => s.name).join(", ")}.`
          : topSub && topSub.total > 0
            ? `${topSub.name} led your semester at ${topSub.pct}%.`
            : "Mark classes on Today to populate your subject leaderboard.",
      missingPatternHeadline:
        bestDay && worstDay && worstSlot
          ? `${bestDay.day} peaked at ${bestDay.attendPct}%, while ${worstDay.day} (${worstDay.missPct}% miss) and ${worstSlot.slot} took the hardest hits.`
          : "Keep logging slots to sharpen your weekday & hourly risk map.",
      streakHighlightLine:
        cp.perfectMonths?.length > 0
          ? `100% month club (${cp.perfectMonths.join(", ")}) + ${cp.bestGreenStreak.length}-day clean streak.`
          : `Best 100%-day streak: ${cp.bestGreenStreak?.length || 0} days (${cp.perfectDaysCount} total green days).`,
      remarksRoast:
        snapshot.remarksTape?.length > 0
          ? remarkQuips[snapshot.remarksTape[0].text]
          : "Clean slate — not a single wild remark logged yet.",
      cancelledDayLine: `${cancelledDayLine} ${purpleStreakLine}`,
      extraClassLine,
      unmarkedLine,
      finaleLine: isEmpty
        ? `Start logging classes in ${semName} to build your poster.`
        : `${t.percentage}% locked in. Save your poster before the next transition.`,
      remarkQuips,
    };
  }

  static async getWrapSummary(userId: string, semesterId?: string) {
    const cacheKey = `semester:wrap:v3:${semesterId || "active"}`;
    return CacheService.getOrSet(userId, cacheKey, async () => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          targetAttendance: true,
          createdAt: true,
        },
      });
      if (!user) throw new Error("User not found");

      const semester = semesterId
        ? await prisma.semester.findFirst({ where: { id: semesterId, userId } })
        : (await prisma.semester.findFirst({ where: { userId, isActive: true } })) ||
          (await prisma.semester.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }));

      const todayIso = getTodayIstIso();

      if (!semester) {
        return null;
      }

      const [subjects, timetableSlots, events, logs, extraOverrides] = await Promise.all([
        prisma.subject.findMany({ where: { userId, semesterId: semester.id } }),
        prisma.timetableSlot.findMany({
          where: { semesterId: semester.id },
          include: { subject: { select: { id: true, name: true, code: true } } },
        }),
        prisma.event.findMany({
          where: { userId, OR: [{ semesterId: semester.id }, { semesterId: null }] },
          orderBy: { date: "asc" },
        }),
        prisma.attendance.findMany({
          where: { userId, subject: { semesterId: semester.id } },
          include: {
            subject: { select: { id: true, name: true, code: true, faculty: true, colorHex: true, targetAttendance: true } },
            timetableSlot: { select: { startTime: true, endTime: true, slotType: true } },
            override: { select: { startTime: true, endTime: true, reason: true } },
          },
          orderBy: [{ date: "asc" }, { markedAt: "asc" }],
        }),
        prisma.timetableOverride.findMany({
          where: { semesterId: semester.id, overrideType: "extra_class" },
          include: { subject: { select: { id: true, name: true, code: true } } },
          orderBy: { date: "asc" },
        }),
      ]);

      // Determine cutoff from Last Teaching Day / Last Working Day or semester.endDate
      const ltdEvent = events.find((e) => /last\s*(teaching|working)\s*day/i.test(e.title));
      const semStartIso = toIsoDate(semester.startDate);
      const semEndIso = toIsoDate(semester.endDate);
      const ltdIso = ltdEvent ? toIsoDate(ltdEvent.endDate || ltdEvent.date) : null;
      const cutoffIso = ltdIso && ltdIso < semEndIso ? ltdIso : semEndIso;

      let present = 0;
      let absent = 0;
      let medical = 0;
      let od = 0;
      let off = 0;
      let cancelled = 0;

      const subMap = new Map<string, any>();
      for (const s of subjects) {
        subMap.set(s.id, {
          id: s.id,
          name: s.name,
          code: s.code,
          faculty: s.faculty || "",
          colorHex: s.colorHex,
          target: s.targetAttendance ?? user.targetAttendance ?? 75,
          present: 0,
          absent: 0,
          off: 0,
          conducted: 0,
          remainingClasses: 0,
        });
      }

      const monthMap = new Map<string, { present: number; absent: number; off: number; cancelled: number; remarks: Map<string, number> }>();
      const dayBucket = new Map<string, { present: number; absent: number; off: number; cancelled: number }>();
      const weekdayStats = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => ({
        day,
        present: 0,
        absent: 0,
      }));
      const slotStats = new Map<string, { slot: string; present: number; absent: number }>();
      const remarkCounts = new Map<string, { text: string; count: number; sampleDate: string; sampleSubject: string }>();

      for (const log of logs) {
        const iso = toIsoDate(log.date);
        const st = String(log.status).toLowerCase();
        const isAttended = st === "present" || st === "medical" || st === "od";
        const isAbsent = st === "absent";
        const isCancelled = st === "cancelled";
        const isOff = st === "off" || isCancelled;

        if (st === "present") present++;
        else if (st === "medical") medical++;
        else if (st === "od") od++;
        else if (st === "absent") absent++;
        else if (isCancelled) cancelled++;
        if (isOff) off++;

        const subEntry = subMap.get(log.subjectId);
        if (subEntry) {
          if (isAttended) subEntry.present++;
          else if (isAbsent) subEntry.absent++;
          else if (isOff) subEntry.off++;
        }

        // Day buckets for Calendar streaks (Green / Mixed Purple / Full Cancelled)
        if (!dayBucket.has(iso)) {
          dayBucket.set(iso, { present: 0, absent: 0, off: 0, cancelled: 0 });
        }
        const db = dayBucket.get(iso)!;
        if (isAttended) db.present++;
        else if (isAbsent) db.absent++;
        else if (isCancelled) {
          db.cancelled++;
          db.off++;
        } else if (isOff) {
          db.off++;
        }

        // Monthly map
        const mKey = iso.slice(0, 7);
        if (!monthMap.has(mKey)) {
          monthMap.set(mKey, { present: 0, absent: 0, off: 0, cancelled: 0, remarks: new Map() });
        }
        const mb = monthMap.get(mKey)!;
        if (isAttended) mb.present++;
        else if (isAbsent) mb.absent++;
        if (isCancelled) mb.cancelled++;
        if (isOff) mb.off++;

        const remark = (log.remarks || "").trim();
        if (remark) {
          mb.remarks.set(remark, (mb.remarks.get(remark) || 0) + 1);
          const normKey = remark.toLowerCase();
          const prev = remarkCounts.get(normKey);
          if (prev) {
            prev.count++;
          } else {
            remarkCounts.set(normKey, {
              text: remark,
              count: 1,
              sampleDate: iso,
              sampleSubject: log.subject?.name || "",
            });
          }
        }

        // Weekday & time-slot patterns (only conducted present/absent classes)
        if (isAttended || isAbsent) {
          const jsDay = new Date(`${iso}T00:00:00Z`).getUTCDay();
          if (isAttended) weekdayStats[jsDay].present++;
          else weekdayStats[jsDay].absent++;

          const timeSlot = (log.timetableSlot?.startTime || log.override?.startTime || "").trim();
          if (timeSlot) {
            if (!slotStats.has(timeSlot)) {
              slotStats.set(timeSlot, { slot: timeSlot, present: 0, absent: 0 });
            }
            const ss = slotStats.get(timeSlot)!;
            if (isAttended) ss.present++;
            else ss.absent++;
          }
        }
      }

      const attendedTotal = present + medical + od;
      const conducted = attendedTotal + absent;
      const overallPct = conducted > 0 ? Number(((attendedTotal / conducted) * 100).toFixed(2)) : 0;

      // Forecast remaining classes from tomorrow up to cutoffIso
      const offDates = new Set<string>();
      const upcomingExams: any[] = [];
      const upcomingFestsAndBreaks: any[] = [];
      const seenUpcoming = new Set<string>();
      const horizonEndIso = addDaysIso(semEndIso > cutoffIso ? semEndIso : cutoffIso, 45);

      for (const ev of events) {
        const startIso = toIsoDate(ev.date);
        const endIso = ev.endDate ? toIsoDate(ev.endDate) : startIso;
        const typeLower = String(ev.eventType || "").toLowerCase();
        const titleLower = String(ev.title || "").toLowerCase();
        const isHolidayOff =
          (ev.isHolidayList && typeLower !== "restricted_holiday") ||
          ["holiday", "vacation", "midsem", "endsem", "exam", "lab_exam"].includes(typeLower) ||
          /holiday|vacation|break|midsem|endsem|exam/i.test(titleLower);

        if (isHolidayOff) {
          const t0 = new Date(`${startIso}T00:00:00Z`).getTime();
          const t1 = new Date(`${endIso}T00:00:00Z`).getTime();
          for (let t = t0; t <= t1; t += ONE_DAY_MS) {
            offDates.add(new Date(t).toISOString().slice(0, 10));
          }
        }

        if (ev.semesterId == null && (startIso < semStartIso || startIso > horizonEndIso)) {
          continue;
        }
        if (endIso >= todayIso && startIso <= horizonEndIso) {
          // Restricted holidays are optional observances and never belong in "Coming Up Next"
          if (typeLower === "restricted_holiday" || /\(restricted\s+holiday\)/i.test(titleLower)) {
            continue;
          }
          const dedupKey = `${startIso}:${titleLower.replace(/\s+/g, " ").trim()}`;
          if (seenUpcoming.has(dedupKey)) continue;
          seenUpcoming.add(dedupKey);

          const daysLeft = Math.max(0, daysBetweenIso(todayIso, startIso));
          const isExam =
            ["ct", "midsem", "endsem", "exam", "lab_exam"].includes(typeLower) ||
            (/\b(midsem|mid[\s-]?sem|endsem|end[\s-]?sem|exam|viva|assessment|ct)\b/i.test(titleLower) &&
              !/vacation|break/i.test(titleLower));
          const isPriorityBreakOrMilestone =
            typeLower === "fest" ||
            typeLower === "vacation" ||
            typeLower === "institute" ||
            /\b(fest|cultural|techfest|meraki|yavnika|mridang|vacation|break|recess|last\s*(teaching|working)\s*day|commencement|orientation)\b/i.test(
              titleLower,
            );

          // Routine single-day holidays more than 30d away (e.g. next year's August holidays) don't crowd "Coming Up Next"
          if (!isExam && !isPriorityBreakOrMilestone && daysLeft > 30) {
            continue;
          }

          const item = {
            id: ev.id,
            title: ev.title,
            date: startIso,
            endDate: endIso,
            eventType: ev.eventType,
            daysLeft,
            isFest: typeLower === "fest" || /\b(fest|cultural|techfest|meraki|yavnika|mridang)\b/i.test(titleLower),
            _priority: isPriorityBreakOrMilestone ? 0 : 1,
          };
          if (isExam) upcomingExams.push(item);
          else upcomingFestsAndBreaks.push(item);
        }
      }

      upcomingExams.sort((a, b) => a.daysLeft - b.daysLeft || a.date.localeCompare(b.date));
      upcomingFestsAndBreaks.sort(
        (a, b) => a._priority - b._priority || a.daysLeft - b.daysLeft || a.date.localeCompare(b.date),
      );
      upcomingFestsAndBreaks.forEach((it) => {
        delete it._priority;
      });

      const activeSlots = timetableSlots.filter((s) => !s.validUntil);
      const slotsByDayCount = [0, 0, 0, 0, 0, 0, 0];
      const subSlotsByDay = new Map<string, number[]>();
      for (const s of activeSlots) {
        if (s.dayOfWeek >= 0 && s.dayOfWeek < 7) {
          slotsByDayCount[s.dayOfWeek]++;
          if (!subSlotsByDay.has(s.subjectId)) {
            subSlotsByDay.set(s.subjectId, [0, 0, 0, 0, 0, 0, 0]);
          }
          subSlotsByDay.get(s.subjectId)![s.dayOfWeek]++;
        }
      }

      let remainingClassesForecast = 0;
      const tomorrowTime = new Date(`${todayIso}T00:00:00Z`).getTime() + ONE_DAY_MS;
      const cutoffTime = new Date(`${cutoffIso}T00:00:00Z`).getTime();
      if (tomorrowTime <= cutoffTime && activeSlots.length > 0) {
        for (let t = tomorrowTime; t <= cutoffTime; t += ONE_DAY_MS) {
          const iso = new Date(t).toISOString().slice(0, 10);
          if (offDates.has(iso)) continue;
          const jsDay = new Date(t).getUTCDay();
          const dbDay = jsDay === 0 ? 6 : jsDay - 1;
          remainingClassesForecast += slotsByDayCount[dbDay] || 0;
          for (const [subId, arr] of subSlotsByDay.entries()) {
            const se = subMap.get(subId);
            if (se) se.remainingClasses += arr[dbDay] || 0;
          }
        }
      }

      const totalForecastedClasses = conducted + remainingClassesForecast;
      const isPastTeachingDay = todayIso > cutoffIso;
      const timelineProgressPct =
        isPastTeachingDay
          ? 100
          : totalForecastedClasses > 0
            ? Math.min(100, Math.round((conducted / totalForecastedClasses) * 100))
            : Math.min(100, Math.max(0, Math.round((Math.max(0, daysBetweenIso(semStartIso, todayIso)) / Math.max(1, daysBetweenIso(semStartIso, semEndIso))) * 100)));

      let phase: "beginning" | "early" | "halfway" | "stretch" | "ended" = "ended";
      if (!isPastTeachingDay) {
        if (timelineProgressPct < 25) phase = "beginning";
        else if (timelineProgressPct < 48) phase = "early";
        else if (timelineProgressPct < 62) phase = "halfway";
        else phase = "stretch";
      }

      // Streaks, Calendar Purple Mixed Dots & Full-Day Cancelled
      const greenDates: string[] = [];
      const mixedPurpleDates: string[] = [];
      const fullCancelledDates: string[] = [];

      const sortedDates = [...dayBucket.keys()].sort();
      for (const iso of sortedDates) {
        const b = dayBucket.get(iso)!;
        const c = b.present + b.absent;
        if (c > 0 && b.absent === 0) greenDates.push(iso);
        else if (b.present > 0 && b.absent > 0) mixedPurpleDates.push(iso);
        else if (c === 0 && b.off > 0) fullCancelledDates.push(iso);
      }

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const months = [...monthMap.keys()]
        .sort()
        .map((mKey) => {
          const mb = monthMap.get(mKey)!;
          const mConducted = mb.present + mb.absent;
          const pct = mConducted > 0 ? Number(((mb.present / mConducted) * 100).toFixed(2)) : 0;
          const [yr, mo] = mKey.split("-");
          const label = monthNames[parseInt(mo, 10) - 1] || mKey;
          const remarksArr = [...mb.remarks.entries()]
            .map(([text, count]) => ({ text, count }))
            .sort((a, b) => b.count - a.count);
          return {
            key: `${label} ${yr}`,
            monthIso: mKey,
            label,
            present: mb.present,
            absent: mb.absent,
            off: mb.off,
            cancelled: mb.cancelled,
            conducted: mConducted,
            pct,
            isPerfectMonth: mConducted >= 4 && pct === 100,
            remarks: remarksArr,
          };
        });

      const perfectMonths = months.filter((m) => m.isPerfectMonth).map((m) => m.key);

      const subjectsRanked = [...subMap.values()]
        .map((s) => {
          const total = s.present + s.absent;
          return {
            ...s,
            total,
            pct: total > 0 ? Number(((s.present / total) * 100).toFixed(2)) : 0,
          };
        })
        .sort((a, b) => b.pct - a.pct || b.present - a.present || a.name.localeCompare(b.name))
        .map((s, idx) => ({ ...s, rank: idx + 1 }));

      const weekdays = [1, 2, 3, 4, 5, 6, 0]
        .map((i) => weekdayStats[i])
        .filter((w) => w.present + w.absent > 0)
        .map((w) => {
          const total = w.present + w.absent;
          return {
            day: w.day,
            present: w.present,
            absent: w.absent,
            total,
            attendPct: Number(((w.present / total) * 100).toFixed(1)),
            missPct: Number(((w.absent / total) * 100).toFixed(1)),
          };
        });

      const timeSlots = [...slotStats.values()]
        .map((ss) => {
          const total = ss.present + ss.absent;
          return {
            slot: ss.slot,
            present: ss.present,
            absent: ss.absent,
            total,
            attendPct: Number(((ss.present / total) * 100).toFixed(1)),
            missPct: Number(((ss.absent / total) * 100).toFixed(1)),
          };
        })
        .sort((a, b) => b.missPct - a.missPct || a.slot.localeCompare(b.slot));

      const remarksTape = [...remarkCounts.values()]
        .sort((a, b) => b.count - a.count);

      const targetRate = (user.targetAttendance ?? 75) / 100;
      const needAtTargetOutOfRemaining = Math.max(0, Math.ceil(targetRate * totalForecastedClasses) - attendedTotal);
      const maxSafeBunksAcrossRemaining = Math.max(0, remainingClassesForecast - needAtTargetOutOfRemaining);

      // Detect Unmarked Instructional Days & Missing Slots in Logs
      const commenceEvt = events.find((e) => /commencement\s*of\s*classes/i.test(e.title));
      const scanStartIso = commenceEvt ? toIsoDate(commenceEvt.date) : semStartIso;
      const scanEndIso = todayIso < cutoffIso ? todayIso : cutoffIso;
      const regularLogsByDate = new Map<string, number>();
      for (const l of logs) {
        if (!l.overrideId) {
          const iso = toIsoDate(l.date);
          regularLogsByDate.set(iso, (regularLogsByDate.get(iso) || 0) + 1);
        }
      }
      let unmarkedDaysCount = 0;
      let fullyUnmarkedDaysCount = 0;
      let unmarkedSlotsCount = 0;
      const unmarkedSampleDates: Array<{ date: string; scheduled: number; marked: number; missing: number }> = [];

      if (timetableSlots.length > 0 && scanStartIso <= scanEndIso) {
        const tScanStart = new Date(`${scanStartIso}T00:00:00Z`).getTime();
        const tScanEnd = new Date(`${scanEndIso}T00:00:00Z`).getTime();
        for (let t = tScanStart; t <= tScanEnd; t += ONE_DAY_MS) {
          const iso = new Date(t).toISOString().slice(0, 10);
          if (offDates.has(iso)) continue;
          const jsDay = new Date(t).getUTCDay();
          const dbDay = jsDay === 0 ? 6 : jsDay - 1;
          const scheduledOnDate = timetableSlots.filter((s) => {
            if (s.dayOfWeek !== dbDay) return false;
            const vf = toIsoDate(s.validFrom);
            if (vf > iso) return false;
            if (s.validUntil && toIsoDate(s.validUntil) < iso) return false;
            return true;
          }).length;
          if (scheduledOnDate > 0) {
            const markedOnDate = regularLogsByDate.get(iso) || 0;
            if (markedOnDate < scheduledOnDate) {
              unmarkedDaysCount++;
              if (markedOnDate === 0) fullyUnmarkedDaysCount++;
              const missing = scheduledOnDate - markedOnDate;
              unmarkedSlotsCount += missing;
              if (unmarkedSampleDates.length < 5) {
                unmarkedSampleDates.push({ date: iso, scheduled: scheduledOnDate, marked: markedOnDate, missing });
              }
            }
          }
        }
      }

      // Compute Extra Class Outcomes (e.g., an extra class happened and you missed it)
      const logByOverrideId = new Map<string, any>();
      for (const l of logs) {
        if (l.overrideId) logByOverrideId.set(l.overrideId, l);
      }
      let extraAttended = 0;
      let extraMissed = 0;
      let extraOff = 0;
      let extraPending = 0;
      const extraMissedSamples: Array<{ date: string; subjectName: string; startTime: string; remark: string }> = [];
      for (const ov of extraOverrides) {
        const matched = logByOverrideId.get(ov.id);
        if (!matched) {
          extraPending++;
          continue;
        }
        const st = String(matched.status).toLowerCase();
        if (st === "present" || st === "medical" || st === "od") {
          extraAttended++;
        } else if (st === "absent") {
          extraMissed++;
          extraMissedSamples.push({
            date: toIsoDate(ov.date),
            subjectName: ov.subject?.name || matched.subject?.name || "Extra Class",
            startTime: ov.startTime || "",
            remark: matched.remarks || ov.reason || "",
          });
        } else {
          extraOff++;
        }
      }

      const created = new Date(user.createdAt);
      const memberSince = `${String(created.getMonth() + 1).padStart(2, "0")}/${String(created.getFullYear()).slice(-2)}`;

      const signature = crypto
        .createHash("sha1")
        .update(`${semester.id}:${logs.length}:${attendedTotal}:${absent}:${remainingClassesForecast}:${unmarkedSlotsCount}:${extraMissed}:${remarksTape[0]?.text || ""}:v2`)
        .digest("hex")
        .slice(0, 12);

      const snapshot = {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          targetAttendance: user.targetAttendance ?? 75,
          memberSince,
        },
        semester: {
          id: semester.id,
          name: semester.name,
          startDate: semStartIso,
          endDate: semEndIso,
          lastTeachingDate: ltdIso,
          cutoffIso,
          isPastTeachingDay,
        },
        totals: {
          present: attendedTotal,
          absent,
          medical,
          od,
          conducted,
          off,
          cancelled,
          rawLogs: logs.length,
          percentage: overallPct,
          targetPercentage: user.targetAttendance ?? 75,
          subjectsCount: subjects.length,
        },
        forecast: {
          remainingClasses: remainingClassesForecast,
          totalForecastedClasses,
          timelineProgressPct,
          phase,
          needAtTargetOutOfRemaining,
          maxSafeBunksAcrossRemaining,
          projectedIfAttendAll:
            totalForecastedClasses > 0
              ? Number((((attendedTotal + remainingClassesForecast) / totalForecastedClasses) * 100).toFixed(2))
              : overallPct,
        },
        upcomingHorizon: {
          exams: upcomingExams.slice(0, 6),
          festsAndBreaks: upcomingFestsAndBreaks.slice(0, 6),
        },
        calendarPatterns: {
          perfectDaysCount: greenDates.length,
          bestGreenStreak: computeStreak(greenDates),
          perfectMonths,
          mixedPurpleDaysCount: mixedPurpleDates.length,
          bestMixedPurpleStreak: computeStreak(mixedPurpleDates),
          fullCancelledDaysCount: fullCancelledDates.length,
          sampleCancelledDates: fullCancelledDates.slice(-5),
        },
        subjectsRanked,
        months,
        missingPatterns: { weekdays, timeSlots },
        unmarked: {
          daysCount: unmarkedDaysCount,
          fullyUnmarkedDaysCount,
          slotsCount: unmarkedSlotsCount,
          sampleDates: unmarkedSampleDates,
        },
        extraClasses: {
          total: extraOverrides.length,
          attended: extraAttended,
          missed: extraMissed,
          off: extraOff,
          pending: extraPending,
          missedSamples: extraMissedSamples,
        },
        remarksTape,
        signature,
      };

      return {
        snapshot,
        localCopy: this.buildDeterministicCopy(snapshot),
      };
    });
  }

  static async generateAiCopy(userId: string, providedSnapshot?: any): Promise<WrapAiCopy> {
    const bundle = providedSnapshot ? { snapshot: providedSnapshot, localCopy: this.buildDeterministicCopy(providedSnapshot) } : await this.getWrapSummary(userId);
    if (!bundle) {
      throw new Error("No active semester data available.");
    }
    const { snapshot, localCopy } = bundle;
    const cacheKey = `semester:wrap:ai:${snapshot.signature}`;

    try {
      return await CacheService.getOrSet(userId, cacheKey, async () => {
        const prompt = `
You are writing punchy, anti-cringe Spotify/BitChord Replay copy for an Indian university student's attendance tracker (AttendX).
Use ONLY numbers/names from the JSON below. Be playful, sharp, collegiate (Hinglish phrases like "Maze hi maze" where fit for cancelled classes, witty wake-up/winter roasts for oversleeping, playful "homesick" teasing for repeated Home trips), zero corporate buzzwords.

DATA:
${JSON.stringify({
  semester: snapshot.semester.name,
  phase: snapshot.forecast.phase,
  progressPct: snapshot.forecast.timelineProgressPct,
  conducted: snapshot.totals.conducted,
  attended: snapshot.totals.present,
  percentage: snapshot.totals.percentage,
  remainingClasses: snapshot.forecast.remainingClasses,
  totalForecasted: snapshot.forecast.totalForecastedClasses,
  topSubjects: snapshot.subjectsRanked.map((s: any) => ({ name: s.name, pct: s.pct, attended: s.present, total: s.total })),
  months: snapshot.months.map((m: any) => ({ key: m.key, pct: m.pct, remarks: m.remarks })),
  streaks: snapshot.calendarPatterns,
  unmarked: snapshot.unmarked,
  extraClasses: snapshot.extraClasses,
  weekdays: snapshot.missingPatterns.weekdays,
  worstSlots: snapshot.missingPatterns.timeSlots.slice(0, 3),
  remarks: snapshot.remarksTape.map((r: any) => ({ text: r.text, count: r.count })),
  upcomingExams: snapshot.upcomingHorizon.exams.slice(0, 3).map((e: any) => e.title),
  upcomingFests: snapshot.upcomingHorizon.festsAndBreaks.slice(0, 3).map((e: any) => e.title),
})}

Return STRICT JSON matching:
{
  "archetypeTitle": "3-4 words",
  "archetypeBadge": "2 words",
  "oneLiner": "max 20 words",
  "phaseRoast": "max 22 words teasing mid-sem progress or celebrating end-sem",
  "introSubtitle": "max 14 words",
  "totalHeadline": "max 16 words",
  "monthlyArcCaption": "max 22 words",
  "topSubjectCaption": "max 18 words",
  "missingPatternHeadline": "max 18 words",
  "streakHighlightLine": "max 18 words mentioning 100% / green or purple mixed days",
  "remarksRoast": "max 22 words roasting top remarks",
  "cancelledDayLine": "max 18 words using 'Maze hi maze' if full cancelled days > 0",
  "extraClassLine": "max 20 words mentioning missed extra class if extraClasses.missed > 0",
  "unmarkedLine": "max 18 words noting unmarked working days or 0 unmarked discipline",
  "finaleLine": "max 14 words",
  "remarkQuips": { "<exact remark text>": "sharp 1-line funny reaction (max 22 words)" }
}`;

        const response = await AIManager.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            temperature: 0.55,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 },
          },
        });

        const parsed = JSON.parse(String(response?.text || "{}").replace(/```json|```/g, "").trim());
        return {
          ...localCopy,
          ...parsed,
          remarkQuips: {
            ...localCopy.remarkQuips,
            ...(parsed?.remarkQuips && typeof parsed.remarkQuips === "object" ? parsed.remarkQuips : {}),
          },
          source: "gemini",
        } as WrapAiCopy;
      });
    } catch {
      return localCopy;
    }
  }
}
