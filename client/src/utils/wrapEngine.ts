import { useAuthStore } from "../stores/authStore";
import { useAttendanceStore, computeRemainingClassesOffline } from "../stores/attendanceStore";
import { useCacheStore } from "../stores/cacheStore";
import { getInstructionalCutoffIso, formatLocalDate, parseLocalDate } from "../services/NotificationService";

export interface WrapCopyPayload {
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
  extraClassLine?: string;
  unmarkedLine?: string;
  finaleLine: string;
  remarkQuips: Record<string, string>;
}

export interface WrapSnapshot {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    targetAttendance: number;
    memberSince: string;
  };
  semester: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    lastTeachingDate: string | null;
    cutoffIso: string;
    isPastTeachingDay: boolean;
  };
  totals: {
    present: number;
    absent: number;
    medical: number;
    od: number;
    conducted: number;
    off: number;
    cancelled: number;
    rawLogs: number;
    percentage: number;
    targetPercentage: number;
    subjectsCount: number;
  };
  forecast: {
    remainingClasses: number;
    totalForecastedClasses: number;
    timelineProgressPct: number;
    phase: "beginning" | "early" | "halfway" | "stretch" | "ended";
    needAtTargetOutOfRemaining: number;
    maxSafeBunksAcrossRemaining: number;
    projectedIfAttendAll: number;
  };
  upcomingHorizon: {
    exams: Array<{ id?: string; title: string; date: string; endDate: string; eventType?: string; daysLeft: number }>;
    festsAndBreaks: Array<{ id?: string; title: string; date: string; endDate: string; eventType?: string; daysLeft: number; isFest?: boolean }>;
  };
  calendarPatterns: {
    perfectDaysCount: number;
    bestGreenStreak: { length: number; startDate: string | null; endDate: string | null };
    perfectMonths: string[];
    mixedPurpleDaysCount: number;
    bestMixedPurpleStreak: { length: number; startDate: string | null; endDate: string | null };
    fullCancelledDaysCount: number;
    sampleCancelledDates: string[];
  };
  subjectsRanked: Array<{
    rank: number;
    id: string;
    name: string;
    code?: string | null;
    faculty?: string;
    present: number;
    absent: number;
    off: number;
    total: number;
    pct: number;
    remainingClasses?: number;
  }>;
  months: Array<{
    key: string;
    monthIso: string;
    label: string;
    present: number;
    absent: number;
    off: number;
    cancelled: number;
    conducted: number;
    pct: number;
    isPerfectMonth: boolean;
    remarks: Array<{ text: string; count: number }>;
  }>;
  missingPatterns: {
    weekdays: Array<{ day: string; present: number; absent: number; total: number; attendPct: number; missPct: number }>;
    timeSlots: Array<{ slot: string; present: number; absent: number; total: number; attendPct: number; missPct: number }>;
  };
  unmarked?: {
    daysCount: number;
    fullyUnmarkedDaysCount: number;
    slotsCount: number;
    sampleDates: Array<{ date: string; scheduled: number; marked: number; missing: number }>;
  };
  extraClasses?: {
    total: number;
    attended: number;
    missed: number;
    off: number;
    pending: number;
    missedSamples: Array<{ date: string; subjectName: string; startTime: string; remark: string }>;
  };
  remarksTape: Array<{ text: string; count: number; sampleDate: string; sampleSubject: string }>;
  signature: string;
}

const ONE_DAY_MS = 86400000;

function daysBetweenIso(a: string, b: string): number {
  const ta = new Date(`${a}T00:00:00Z`).getTime();
  const tb = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((tb - ta) / ONE_DAY_MS);
}

function addDaysIso(iso: string, days: number): string {
  const t = new Date(`${iso}T00:00:00Z`).getTime();
  return new Date(t + days * ONE_DAY_MS).toISOString().slice(0, 10);
}

function computeStreakLocal(sortedDates: string[]): { length: number; startDate: string | null; endDate: string | null } {
  if (sortedDates.length === 0) return { length: 0, startDate: null, endDate: null };
  let bestLen = 1;
  let bestStart = sortedDates[0];
  let bestEnd = sortedDates[0];
  let curLen = 1;
  let curStart = sortedDates[0];

  for (let i = 1; i < sortedDates.length; i++) {
    const gap = daysBetweenIso(sortedDates[i - 1], sortedDates[i]);
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

/**
 * Always-ready local witty quip generator so ANY user remark triggers an instant,
 * playful reaction even offline or without Gemini API access.
 */
export function buildLocalRemarkQuip(remarkText: string, overallPct = 80): string {
  const lower = remarkText.trim().toLowerCase();
  if (!lower) return "Pure radio silence on the register.";

  const monthNow = new Date().getMonth();
  const winterAhead = monthNow >= 9 || monthNow <= 1;

  if (/\b(overslept|sleep|sleeping|nap|woke|alarm|bed|tired|lazy|snooze|late\s*uth)\b/i.test(lower)) {
    return winterAhead
      ? "Get your ass up — winter's coming next semester. If you couldn't beat the alarm right now, how are you waking up for Jan 9 AMs?"
      : "Your pillow has higher attendance than your first lecture. Wait until winter semester 9 AMs hit.";
  }
  if (/\b(home|homesick|gone\s*home|family|village|hometown|ghar|train|flight|trip)\b/i.test(lower)) {
    return "You like going home too much — are you homesick, or is hostel mess food that undefeated?";
  }
  if (/\b(cancel|cancelled|no\s*class|mass\s*bunk|maze|prof\s*absent|teacher\s*absent|suspended|free\s*day)\b/i.test(lower)) {
    return "Maze hi maze! A full day of cancelled lectures feels better than an official holiday.";
  }
  if (/\b(forgot|proxy|roll\s*call|mark\s*present|say\s*present|late)\b/i.test(lower)) {
    return `"${remarkText}" — physically present, absent on paper. Peak classroom tragedy.`;
  }
  if (/\b(freewill|will|mood|vibe|felt\s*like|just|man\s*nahi)\b/i.test(lower)) {
    return `Invoking "${remarkText}" directly onto the attendance log — fearless semester behavior.`;
  }
  if (/\b(exam|prep|study|assignment|viva|quiz|test|lab|project|coding|placement|interview)\b/i.test(lower)) {
    return `Strategic "${remarkText}" trade — sacrificing 1 class to rescue your CGPA.`;
  }
  if (/\b(sick|fever|ill|headache|cold|doctor|medical|unwell|rest)\b/i.test(lower)) {
    return "Recovery mode logged — health first, attendance bounce-back right after.";
  }
  if (/\b(fest|event|hack|club|sports|match|concert|cultural|volunteer|committee)\b/i.test(lower)) {
    return `Busy living real campus lore with "${remarkText}" while the timetable kept ticking.`;
  }
  if (/\b(rain|weather|bus|traffic|late)\b/i.test(lower)) {
    return `"${remarkText}" strikes again — nature vetoed your lecture schedule.`;
  }
  return `"${remarkText}" is officially framed in your Sem Replay archive (${overallPct.toFixed(1)}% holding steady).`;
}

export function buildLocalWrapCopy(snapshot: WrapSnapshot): WrapCopyPayload {
  const t = snapshot.totals;
  const f = snapshot.forecast;
  const cp = snapshot.calendarPatterns;
  const mp = snapshot.missingPatterns;
  const semName = snapshot.semester?.name || "This Semester";

  const worstDay = [...mp.weekdays].filter((d) => d.total >= 2).sort((a, b) => b.missPct - a.missPct)[0];
  const bestDay = [...mp.weekdays].filter((d) => d.total >= 2).sort((a, b) => b.attendPct - a.attendPct)[0];
  const worstSlot = [...mp.timeSlots].filter((s) => s.total >= 2).sort((a, b) => b.missPct - a.missPct)[0];

  const topSub = snapshot.subjectsRanked[0];
  const perfectSubs = snapshot.subjectsRanked.filter((s) => s.pct === 100 && s.total > 0);
  const peakMonth = [...snapshot.months].filter((m) => m.conducted >= 4).sort((a, b) => b.pct - a.pct)[0];

  const isEmpty = t.conducted === 0 && (t.rawLogs ?? 0) === 0;
  let phaseRoast = `${t.conducted} classes done, ${f.remainingClasses} forecasted ahead.`;
  if (isEmpty) {
    phaseRoast = `No classes logged in ${semName} yet — mark attendance on Today to unlock your Replay.`;
  } else if (f.phase === "beginning") {
    phaseRoast = `Only ${t.conducted} classes in out of ~${f.totalForecastedClasses} — semester barely started and you're already here!`;
  } else if (f.phase === "early") {
    phaseRoast = `Only ${t.conducted} of ~${f.totalForecastedClasses} done — tired already and not even halfway yet?`;
  } else if (f.phase === "halfway") {
    phaseRoast = `Just crossed halfway: ${t.conducted} down, ${f.remainingClasses} still left to steer your final %.`;
  } else if (f.phase === "stretch") {
    phaseRoast = `Home stretch — only ${f.remainingClasses} classes remaining until Last Teaching Day.`;
  } else {
    phaseRoast = `Teaching has wrapped — ${t.present} of ${t.conducted} classes locked in before the next semester transition.`;
  }

  const remarkQuips: Record<string, string> = {};
  for (const r of snapshot.remarksTape || []) {
    remarkQuips[r.text] = buildLocalRemarkQuip(r.text, t.percentage);
  }

  return {
    source: "local",
    archetypeTitle: isEmpty
      ? "Fresh Semester Slate"
      : perfectSubs.length >= 2 && t.percentage >= 80
        ? "The Calculated Lab Purist"
        : t.percentage >= 90
          ? "The Front-Row Constant"
          : t.percentage >= 75
            ? "The Margin Tactician"
            : "The Comeback Specialist",
    archetypeBadge: isEmpty ? "Ready to Log" : bestDay ? `${bestDay.day} Specialist` : t.percentage >= 75 ? "Criteria Safe" : "Clutch Mode",
    oneLiner: isEmpty
      ? `No classes logged in ${semName} yet — mark your first attendance to unlock Replay.`
      : `${t.present}/${t.conducted} (${t.percentage}%) in ${semName}${peakMonth ? `, peaking at ${peakMonth.pct}% in ${peakMonth.label}` : ""}${worstSlot ? `, with ${worstSlot.slot} alarms fighting hardest` : ""}.`,
    phaseRoast,
    introSubtitle: isEmpty
      ? `${semName} will populate cards automatically once classes are marked.`
      : `${semName} told in real logs, timing, and receipts.`,
    totalHeadline: isEmpty
      ? `0 classes conducted in ${semName} so far.`
      : `${t.present} classes attended out of ${t.conducted} conducted — sitting at ${t.percentage}%.`,
    monthlyArcCaption: peakMonth
      ? `Peaked at ${peakMonth.pct}% in ${peakMonth.key} across ${snapshot.months.length} tracked month${snapshot.months.length === 1 ? "" : "s"}.`
      : `Logged across ${snapshot.months.length} month${snapshot.months.length === 1 ? "" : "s"}.`,
    topSubjectCaption:
      perfectSubs.length > 0
        ? `Flawless 100% across ${perfectSubs.slice(0, 3).map((s) => s.name).join(", ")}.`
        : topSub && topSub.total > 0
          ? `${topSub.name} led your subjects at ${topSub.pct}%.`
          : "Mark classes on Today to populate your subject leaderboard.",
    missingPatternHeadline:
      bestDay && worstDay && worstSlot
        ? `${bestDay.day}s led at ${bestDay.attendPct}%, while ${worstDay.day}s (${worstDay.missPct}% miss) & ${worstSlot.slot} took the hits.`
        : "Your weekday & time-slot risk radar updates with every class logged.",
    streakHighlightLine:
      cp.perfectMonths.length > 0
        ? `100% month club (${cp.perfectMonths.join(", ")}) + ${cp.bestGreenStreak.length}-day green streak.`
        : `${cp.bestGreenStreak.length}-day 100% green streak & ${cp.mixedPurpleDaysCount} purple mixed-dot days.`,
    remarksRoast:
      snapshot.remarksTape.length > 0
        ? remarkQuips[snapshot.remarksTape[0].text]
        : "Zero excuses logged — clean register energy.",
    cancelledDayLine:
      cp.fullCancelledDaysCount > 0
        ? `Maze hi maze! ${cp.fullCancelledDaysCount} full day${cp.fullCancelledDaysCount === 1 ? "" : "s"} where every class got cancelled.`
        : `${cp.mixedPurpleDaysCount} mixed purple-dot days on your calendar where you attended half and bailed on the rest.`,
    extraClassLine:
      snapshot.extraClasses && snapshot.extraClasses.missed > 0
        ? `An extra class happened (${snapshot.extraClasses.missedSamples[0]?.subjectName || "Bonus Slot"}) and you missed it.`
        : snapshot.extraClasses && snapshot.extraClasses.total > 0
          ? `Attended ${snapshot.extraClasses.attended}/${snapshot.extraClasses.total} extra class${snapshot.extraClasses.total === 1 ? "" : "es"}.`
          : "Zero extra classes missed.",
    unmarkedLine:
      snapshot.unmarked && snapshot.unmarked.daysCount > 0
        ? `${snapshot.unmarked.daysCount} working day${snapshot.unmarked.daysCount === 1 ? "" : "s"} still unmarked in your logs.`
        : "0 unmarked working days — clean log discipline.",
    finaleLine: isEmpty
      ? `Start logging classes in ${semName} to build your poster.`
      : `${t.percentage}% in the books. Save your card before the next semester.`,
    remarkQuips,
  };
}

export function hasWrapReplayData(snapshot: WrapSnapshot | null | undefined): boolean {
  if (!snapshot) return false;
  return (snapshot.totals?.conducted ?? 0) > 0 || (snapshot.totals?.rawLogs ?? 0) > 0;
}

export function normalizeWrapCopy(
  snapshot: WrapSnapshot,
  rawCopy?: Partial<WrapCopyPayload> | null,
): WrapCopyPayload {
  const local = buildLocalWrapCopy(snapshot);
  if (!rawCopy || typeof rawCopy !== "object") return local;
  return {
    ...local,
    ...rawCopy,
    source: rawCopy.source === "gemini" ? "gemini" : "local",
    remarkQuips: {
      ...local.remarkQuips,
      ...(rawCopy.remarkQuips && typeof rawCopy.remarkQuips === "object" ? rawCopy.remarkQuips : {}),
    },
  };
}

/**
 * Builds a complete WrapSnapshot purely from local Zustand & offline cache stores
 * so mid-semester or end-semester Replay opens in 0ms even completely offline.
 */
export function buildOfflineWrapSnapshot(): WrapSnapshot | null {
  const auth = useAuthStore.getState();
  const att = useAttendanceStore.getState();
  const cache = useCacheStore.getState();

  const user = auth.user;
  const activeSemester = cache.semester?.activeSemester || cache.timetable?.activeSemester;
  const semId = activeSemester?.id || att.activeSemesterId || "local-sem";
  const semName = activeSemester?.name || "Current Semester";
  const todayIso = formatLocalDate(new Date());

  const events = att.events || [];
  const rawSubjects = cache.subjects_overview?.subjects || att.subjects || [];
  const allSlots = cache.timetable?.slots || [];

  const semStartIso = activeSemester?.startDate
    ? formatLocalDate(parseLocalDate(activeSemester.startDate))
    : `${todayIso.slice(0, 4)}-07-01`;
  const semEndIso = activeSemester?.endDate
    ? formatLocalDate(parseLocalDate(activeSemester.endDate))
    : `${todayIso.slice(0, 4)}-12-31`;
  const cutoffIso = getInstructionalCutoffIso(events, activeSemester) || semEndIso;

  const ltdEvent = events.find((e: any) => /last\s*(teaching|working)\s*day/i.test(String(e?.title || "")));
  const ltdIso = ltdEvent ? formatLocalDate(parseLocalDate(ltdEvent.endDate || ltdEvent.date)) : null;

  const allLogs: any[] = cache.all_logs || att.historyLogs || [];

  // Reconstruct per-month & per-day stats from cached calendar & all_logs
  const monthMap = new Map<string, { present: number; absent: number; off: number; cancelled: number; remarks: Map<string, number> }>();
  const dayBucket = new Map<string, { present: number; absent: number; off: number; cancelled: number }>();
  const weekdayStats = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => ({ day, present: 0, absent: 0 }));
  const slotStats = new Map<string, { slot: string; present: number; absent: number }>();
  const remarkCounts = new Map<string, { text: string; count: number; sampleDate: string; sampleSubject: string }>();

  let logPresent = 0;
  let logAbsent = 0;
  let logMedical = 0;
  let logOd = 0;
  let logOff = 0;
  let logCancelled = 0;

  if (Array.isArray(allLogs) && allLogs.length > 0) {
    for (const l of allLogs) {
      const iso = formatLocalDate(l.date || todayIso);
      const st = String(l.status || "").toLowerCase();
      const isAttended = st === "present" || st === "attended" || st === "medical" || st === "od";
      const isAbsent = st === "absent" || st === "missed";
      const isCancelled = st === "cancelled";
      const isOff = st === "off" || isCancelled;

      if (st === "present" || st === "attended") logPresent++;
      else if (st === "medical") logMedical++;
      else if (st === "od") logOd++;
      else if (isAbsent) logAbsent++;
      if (isCancelled) logCancelled++;
      if (isOff) logOff++;

      if (!dayBucket.has(iso)) dayBucket.set(iso, { present: 0, absent: 0, off: 0, cancelled: 0 });
      const db = dayBucket.get(iso)!;
      if (isAttended) db.present++;
      else if (isAbsent) db.absent++;
      else if (isCancelled) { db.cancelled++; db.off++; }
      else if (isOff) db.off++;

      const mKey = iso.slice(0, 7);
      if (!monthMap.has(mKey)) monthMap.set(mKey, { present: 0, absent: 0, off: 0, cancelled: 0, remarks: new Map() });
      const mb = monthMap.get(mKey)!;
      if (isAttended) mb.present++;
      else if (isAbsent) mb.absent++;
      if (isCancelled) mb.cancelled++;
      if (isOff) mb.off++;

      const rem = String(l.remarks || "").trim();
      if (rem) {
        mb.remarks.set(rem, (mb.remarks.get(rem) || 0) + 1);
        const k = rem.toLowerCase();
        const prev = remarkCounts.get(k);
        if (prev) prev.count++;
        else remarkCounts.set(k, { text: rem, count: 1, sampleDate: iso, sampleSubject: l.subjectName || l.subject?.name || "" });
      }

      if (isAttended || isAbsent) {
        const jsDay = new Date(`${iso}T00:00:00Z`).getUTCDay();
        if (isAttended) weekdayStats[jsDay].present++;
        else weekdayStats[jsDay].absent++;

        const startSlot = String(l.startTime || l.timetableSlot?.startTime || "").trim();
        if (startSlot) {
          if (!slotStats.has(startSlot)) slotStats.set(startSlot, { slot: startSlot, present: 0, absent: 0 });
          const ss = slotStats.get(startSlot)!;
          if (isAttended) ss.present++;
          else ss.absent++;
        }
      }
    }
  }

  const subjectsWithForecast = computeRemainingClassesOffline(
    rawSubjects,
    activeSemester || { id: semId, startDate: semStartIso, endDate: cutoffIso },
    allSlots,
    events,
    att.simulationBounds || { startDate: semStartIso, endDate: cutoffIso },
  );

  let attendedTotal = logPresent + logMedical + logOd;
  let absentTotal = logAbsent;
  if (attendedTotal + absentTotal === 0 && att.totalClasses > 0) {
    attendedTotal = att.totalAttended;
    absentTotal = Math.max(0, att.totalClasses - att.totalAttended);
  }
  const conducted = attendedTotal + absentTotal;
  const pct = conducted > 0 ? Number(((attendedTotal / conducted) * 100).toFixed(2)) : Number(att.overallPercentage || 0);

  const remainingClasses = subjectsWithForecast.reduce((sum, s: any) => sum + (Number(s.remainingClasses) || 0), 0);
  const totalForecastedClasses = conducted + remainingClasses;
  const isPastTeachingDay = todayIso > cutoffIso;
  const timelineProgressPct = isPastTeachingDay
    ? 100
    : totalForecastedClasses > 0
      ? Math.min(100, Math.round((conducted / totalForecastedClasses) * 100))
      : Math.min(100, Math.max(0, Math.round((Math.max(0, daysBetweenIso(semStartIso, todayIso)) / Math.max(1, daysBetweenIso(semStartIso, semEndIso))) * 100)));

  let phase: WrapSnapshot["forecast"]["phase"] = "ended";
  if (!isPastTeachingDay) {
    if (timelineProgressPct < 25) phase = "beginning";
    else if (timelineProgressPct < 48) phase = "early";
    else if (timelineProgressPct < 62) phase = "halfway";
    else phase = "stretch";
  }

  const greenDates: string[] = [];
  const mixedPurpleDates: string[] = [];
  const fullCancelledDates: string[] = [];
  for (const iso of [...dayBucket.keys()].sort()) {
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
      const mc = mb.present + mb.absent;
      const mpct = mc > 0 ? Number(((mb.present / mc) * 100).toFixed(2)) : 0;
      const [yr, mo] = mKey.split("-");
      const label = monthNames[parseInt(mo, 10) - 1] || mKey;
      return {
        key: `${label} ${yr}`,
        monthIso: mKey,
        label,
        present: mb.present,
        absent: mb.absent,
        off: mb.off,
        cancelled: mb.cancelled,
        conducted: mc,
        pct: mpct,
        isPerfectMonth: mc >= 4 && mpct === 100,
        remarks: [...mb.remarks.entries()].map(([text, count]) => ({ text, count })).sort((a, b) => b.count - a.count),
      };
    });

  const upcomingExams: WrapSnapshot["upcomingHorizon"]["exams"] = [];
  const upcomingFestsAndBreaks: Array<WrapSnapshot["upcomingHorizon"]["festsAndBreaks"][number] & { _priority?: number }> = [];
  const seenUpcoming = new Set<string>();
  const horizonEndIso = addDaysIso(semEndIso > cutoffIso ? semEndIso : cutoffIso, 45);
  for (const ev of events) {
    const evSemId = (ev as { semesterId?: string | null }).semesterId;
    if (evSemId && semId && semId !== "local-sem" && evSemId !== semId) continue;
    const startIso = formatLocalDate(parseLocalDate(ev.date));
    const endIso = ev.endDate ? formatLocalDate(parseLocalDate(ev.endDate)) : startIso;
    if (!evSemId && (startIso < semStartIso || startIso > horizonEndIso)) continue;
    if (endIso < todayIso || startIso > horizonEndIso) continue;
    const t = String(ev.title || "").toLowerCase();
    const ty = String(ev.eventType || ev.type || "").toLowerCase();
    if (ty === "restricted_holiday" || /\(restricted\s+holiday\)/i.test(t)) continue;
    const dedupKey = `${startIso}:${t.replace(/\s+/g, " ").trim()}`;
    if (seenUpcoming.has(dedupKey)) continue;
    seenUpcoming.add(dedupKey);
    const daysLeft = Math.max(0, daysBetweenIso(todayIso, startIso));
    const isExam =
      ["ct", "midsem", "endsem", "exam", "lab_exam"].includes(ty) ||
      (/\b(midsem|mid[\s-]?sem|endsem|end[\s-]?sem|exam|viva|assessment|ct)\b/i.test(t) && !/vacation|break/i.test(t));
    const isPriorityBreakOrMilestone =
      ty === "fest" ||
      ty === "vacation" ||
      ty === "institute" ||
      /\b(fest|cultural|techfest|meraki|yavnika|mridang|vacation|break|recess|last\s*(teaching|working)\s*day|commencement|orientation)\b/i.test(t);
    if (!isExam && !isPriorityBreakOrMilestone && daysLeft > 30) continue;
    if (isExam) {
      upcomingExams.push({ id: ev.id, title: ev.title, date: startIso, endDate: endIso, eventType: ev.eventType, daysLeft });
    } else {
      upcomingFestsAndBreaks.push({
        id: ev.id,
        title: ev.title,
        date: startIso,
        endDate: endIso,
        eventType: ev.eventType,
        daysLeft,
        isFest: ty === "fest" || /\b(fest|cultural|techfest|meraki|yavnika|mridang)\b/i.test(t),
        _priority: isPriorityBreakOrMilestone ? 0 : 1,
      });
    }
  }
  upcomingExams.sort((a, b) => a.daysLeft - b.daysLeft || a.date.localeCompare(b.date));
  upcomingFestsAndBreaks.sort((a, b) => (a._priority ?? 1) - (b._priority ?? 1) || a.daysLeft - b.daysLeft || a.date.localeCompare(b.date));
  upcomingFestsAndBreaks.forEach((it) => {
    delete it._priority;
  });

  const subjectsRanked = subjectsWithForecast
    .map((s: any, idx: number) => {
      const attCount = Number(s.attended ?? s.present) || 0;
      const totCount = Number(s.total) || 0;
      const subPct = totCount > 0 ? Number(((attCount / totCount) * 100).toFixed(2)) : Number(s.percentage || 0);
      return {
        rank: idx + 1,
        id: s.id || s.subjectId,
        name: s.name,
        code: s.code,
        faculty: s.faculty || "",
        present: attCount,
        absent: Math.max(0, totCount - attCount),
        off: Number(s.off) || 0,
        total: totCount,
        pct: subPct,
        remainingClasses: Number(s.remainingClasses) || 0,
      };
    })
    .sort((a, b) => b.pct - a.pct || b.present - a.present)
    .map((s, idx) => ({ ...s, rank: idx + 1 }));

  const targetRate = (user?.targetAttendance ?? att.targetPercentage ?? 75) / 100;
  const needAtTargetOutOfRemaining = Math.max(0, Math.ceil(targetRate * totalForecastedClasses) - attendedTotal);
  const maxSafeBunksAcrossRemaining = Math.max(0, remainingClasses - needAtTargetOutOfRemaining);

  // Offline calculation for Unmarked Instructional Days & Extra Class Outcomes
  const offDateSet = new Set<string>();
  for (const ev of events) {
    const ty = String(ev.eventType || ev.type || "").toLowerCase();
    const t = String(ev.title || "").toLowerCase();
    if (
      (ev.isHolidayList && ty !== "restricted_holiday") ||
      ["holiday", "vacation", "midsem", "endsem", "exam", "lab_exam"].includes(ty) ||
      /holiday|vacation|break|midsem|endsem|exam/i.test(t)
    ) {
      const sIso = formatLocalDate(parseLocalDate(ev.date));
      const eIso = ev.endDate ? formatLocalDate(parseLocalDate(ev.endDate)) : sIso;
      for (let d = new Date(`${sIso}T00:00:00Z`).getTime(); d <= new Date(`${eIso}T00:00:00Z`).getTime(); d += 86400000) {
        offDateSet.add(new Date(d).toISOString().slice(0, 10));
      }
    }
  }
  const regularLogsByIso = new Map<string, number>();
  let extraAttended = 0;
  let extraMissed = 0;
  let extraOff = 0;
  const extraMissedSamples: Array<{ date: string; subjectName: string; startTime: string; remark: string }> = [];
  if (Array.isArray(allLogs)) {
    for (const l of allLogs) {
      const iso = formatLocalDate(l.date || todayIso);
      const isExtra = Boolean(l.overrideId || l.isExtra);
      if (isExtra) {
        const st = String(l.status || "").toLowerCase();
        if (st === "present" || st === "medical" || st === "od") extraAttended++;
        else if (st === "absent") {
          extraMissed++;
          extraMissedSamples.push({
            date: iso,
            subjectName: l.subjectName || l.subject?.name || "Extra Class",
            startTime: l.startTime || l.override?.startTime || "",
            remark: l.remarks || l.override?.reason || "",
          });
        } else extraOff++;
      } else {
        regularLogsByIso.set(iso, (regularLogsByIso.get(iso) || 0) + 1);
      }
    }
  }
  const commenceEvt = events.find((e: any) => /commencement\s*of\s*classes/i.test(e.title || ""));
  const scanStart = commenceEvt ? formatLocalDate(parseLocalDate(commenceEvt.date)) : semStartIso;
  const scanEnd = todayIso < cutoffIso ? todayIso : cutoffIso;
  let unmarkedDaysCount = 0;
  let fullyUnmarkedDaysCount = 0;
  let unmarkedSlotsCount = 0;
  const unmarkedSampleDates: Array<{ date: string; scheduled: number; marked: number; missing: number }> = [];
  if (allSlots.length > 0 && scanStart <= scanEnd) {
    for (let t = new Date(`${scanStart}T00:00:00Z`).getTime(); t <= new Date(`${scanEnd}T00:00:00Z`).getTime(); t += 86400000) {
      const iso = new Date(t).toISOString().slice(0, 10);
      if (offDateSet.has(iso)) continue;
      const jsDay = new Date(t).getUTCDay();
      const dbDay = jsDay === 0 ? 6 : jsDay - 1;
      const schedCount = allSlots.filter((s: any) => {
        if (s.dayOfWeek !== dbDay) return false;
        const vf = s.validFrom ? formatLocalDate(parseLocalDate(s.validFrom)) : semStartIso;
        if (vf > iso) return false;
        if (s.validUntil && formatLocalDate(parseLocalDate(s.validUntil)) < iso) return false;
        return true;
      }).length;
      if (schedCount > 0) {
        const markedCount = regularLogsByIso.get(iso) || 0;
        if (markedCount < schedCount) {
          unmarkedDaysCount++;
          if (markedCount === 0) fullyUnmarkedDaysCount++;
          const missing = schedCount - markedCount;
          unmarkedSlotsCount += missing;
          if (unmarkedSampleDates.length < 5) {
            unmarkedSampleDates.push({ date: iso, scheduled: schedCount, marked: markedCount, missing });
          }
        }
      }
    }
  }

  return {
    user: {
      id: user?.id || "local",
      name: user?.name || "Student",
      email: user?.email || "",
      avatarUrl: user?.avatarUrl || null,
      targetAttendance: user?.targetAttendance ?? 75,
      memberSince: "2026",
    },
    semester: {
      id: semId,
      name: semName,
      startDate: semStartIso,
      endDate: semEndIso,
      lastTeachingDate: ltdIso,
      cutoffIso,
      isPastTeachingDay,
    },
    totals: {
      present: attendedTotal,
      absent: absentTotal,
      medical: logMedical,
      od: logOd,
      conducted,
      off: logOff,
      cancelled: logCancelled,
      rawLogs: allLogs.length || conducted,
      percentage: pct,
      targetPercentage: user?.targetAttendance ?? 75,
      subjectsCount: subjectsRanked.length,
    },
    forecast: {
      remainingClasses,
      totalForecastedClasses,
      timelineProgressPct,
      phase,
      needAtTargetOutOfRemaining,
      maxSafeBunksAcrossRemaining,
      projectedIfAttendAll:
        totalForecastedClasses > 0 ? Number((((attendedTotal + remainingClasses) / totalForecastedClasses) * 100).toFixed(2)) : pct,
    },
    upcomingHorizon: {
      exams: upcomingExams.slice(0, 6),
      festsAndBreaks: upcomingFestsAndBreaks.slice(0, 6),
    },
    calendarPatterns: {
      perfectDaysCount: greenDates.length,
      bestGreenStreak: computeStreakLocal(greenDates),
      perfectMonths: months.filter((m) => m.isPerfectMonth).map((m) => m.key),
      mixedPurpleDaysCount: mixedPurpleDates.length,
      bestMixedPurpleStreak: computeStreakLocal(mixedPurpleDates),
      fullCancelledDaysCount: fullCancelledDates.length,
      sampleCancelledDates: fullCancelledDates.slice(-5),
    },
    subjectsRanked,
    months,
    missingPatterns: {
      weekdays: [1, 2, 3, 4, 5, 6, 0]
        .map((i) => weekdayStats[i])
        .filter((w) => w.present + w.absent > 0)
        .map((w) => ({
          ...w,
          total: w.present + w.absent,
          attendPct: Number(((w.present / (w.present + w.absent)) * 100).toFixed(1)),
          missPct: Number(((w.absent / (w.present + w.absent)) * 100).toFixed(1)),
        })),
      timeSlots: [...slotStats.values()]
        .map((ss) => ({
          ...ss,
          total: ss.present + ss.absent,
          attendPct: Number(((ss.present / (ss.present + ss.absent)) * 100).toFixed(1)),
          missPct: Number(((ss.absent / (ss.present + ss.absent)) * 100).toFixed(1)),
        }))
        .sort((a, b) => b.missPct - a.missPct),
    },
    unmarked: {
      daysCount: unmarkedDaysCount,
      fullyUnmarkedDaysCount,
      slotsCount: unmarkedSlotsCount,
      sampleDates: unmarkedSampleDates,
    },
    extraClasses: {
      total: extraAttended + extraMissed + extraOff,
      attended: extraAttended,
      missed: extraMissed,
      off: extraOff,
      pending: 0,
      missedSamples: extraMissedSamples,
    },
    remarksTape: [...remarkCounts.values()].sort((a, b) => b.count - a.count),
    signature: `${semId}:${conducted}:${attendedTotal}:${remainingClasses}:${unmarkedSlotsCount}:${extraMissed}:v3`,
  };
}

export function getCachedWrapBundle(userId: string, semId: string): { snapshot?: WrapSnapshot; copy?: WrapCopyPayload } | null {
  try {
    const raw = localStorage.getItem(`attendx_wrap_cache_${userId}_${semId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCachedWrapBundle(userId: string, semId: string, bundle: { snapshot: WrapSnapshot; copy: WrapCopyPayload }) {
  try {
    localStorage.setItem(`attendx_wrap_cache_${userId}_${semId}`, JSON.stringify(bundle));
  } catch {}
}
