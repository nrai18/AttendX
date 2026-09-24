import { AttendanceService } from "./attendance.service";
import { prisma } from "../lib/prisma";

export interface PredictiveInsightsResult {
  summary: string;
  keyReasons: string[];
  vulnerableTimings: string[];
  recommendation: string;
}

export class PredictiveRagService {
  /**
   * Custom Statistical & Mathematical Forecast Engine.
   * Computes exact attendance projections, bunk allowances, risk clusters,
   * and personalized actionable insights locally with 0 external API tokens.
   */
  static async generateInsights(userId: string): Promise<PredictiveInsightsResult> {
    try {
      // 1. Fetch user attendance logs and subject data for active semester
      const { logs, subjects } = await AttendanceService.getAttendanceLogs(userId, {});

      // Fetch user profile target if available
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { targetAttendance: true }
      });
      const globalTarget = user?.targetAttendance ?? 75;

      const countableLogs = logs.filter(
        (l: any) =>
          l.status === "present" ||
          l.status === "absent" ||
          l.status === "medical" ||
          l.status === "od"
      );

      const attendedLogs = countableLogs.filter(
        (l: any) =>
          l.status === "present" ||
          l.status === "medical" ||
          l.status === "od"
      );

      const absentLogs = countableLogs.filter((l: any) => l.status === "absent");
      const totalConducted = countableLogs.length;
      const totalAttended = attendedLogs.length;
      const totalAbsent = absentLogs.length;

      const overallPercentage =
        totalConducted > 0 ? (totalAttended / totalConducted) * 100 : 100;

      // Safe bunk allowance formula: floor((A - target*T) / target)
      const safeBunkAllowance =
        overallPercentage >= globalTarget && totalConducted > 0
          ? Math.max(
              0,
              Math.floor(
                (totalAttended - (globalTarget / 100) * totalConducted) /
                  (globalTarget / 100)
              )
            )
          : 0;

      // Recovery required formula: ceil((target*T - A) / (1 - target))
      const requiredToRecover =
        overallPercentage < globalTarget && globalTarget < 100
          ? Math.max(
              0,
              Math.ceil(
                ((globalTarget / 100) * totalConducted - totalAttended) /
                  (1 - globalTarget / 100)
              )
            )
          : 0;

      // Case 1: Perfect attendance / no absences recorded
      if (totalAbsent === 0) {
        return {
          summary: `You have maintained an outstanding 100% attendance record across all ${totalConducted} recorded classes this semester. You are comfortably above your ${globalTarget}% target.`,
          keyReasons: [
            "Zero unexcused absences recorded",
            "Consistent daily presence across all subjects",
            `Total classes conducted: ${totalConducted}`
          ],
          vulnerableTimings: ["None identified — full attendance across all slots"],
          recommendation: `Keep up the excellent consistency! You have built a strong buffer of ${safeBunkAllowance} safe bunk allowances.`
        };
      }

      // 2. Statistical Cluster Analysis: Day of Week Distribution
      const dayCounts: Record<string, number> = {
        Monday: 0,
        Tuesday: 0,
        Wednesday: 0,
        Thursday: 0,
        Friday: 0,
        Saturday: 0,
        Sunday: 0
      };

      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      for (const log of absentLogs) {
        let dayName = "Monday";
        if (log.date) {
          const d = new Date(log.date);
          dayName = dayNames[d.getDay()] || "Monday";
        } else if (log.dayOfWeek !== undefined) {
          const idx = (log.dayOfWeek + 1) % 7;
          dayName = dayNames[idx] || "Monday";
        }
        dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
      }

      let peakDay = "Monday";
      let peakDayCount = 0;
      for (const [day, count] of Object.entries(dayCounts)) {
        if (count > peakDayCount) {
          peakDayCount = count;
          peakDay = day;
        }
      }

      // 3. Statistical Cluster Analysis: Time Slot Distribution
      const timeSlotCounts: Record<string, number> = {};
      let morningAbsences = 0;

      for (const log of absentLogs) {
        const timeStr = log.startTime && log.endTime ? `${log.startTime} - ${log.endTime}` : "Morning Slot";
        timeSlotCounts[timeStr] = (timeSlotCounts[timeStr] || 0) + 1;

        if (log.startTime) {
          const hour = parseInt(log.startTime.split(":")[0], 10);
          if (hour < 11) {
            morningAbsences++;
          }
        }
      }

      let peakTimeSlot = "09:00 - 10:00";
      let peakTimeCount = 0;
      for (const [slot, count] of Object.entries(timeSlotCounts)) {
        if (count > peakTimeCount) {
          peakTimeCount = count;
          peakTimeSlot = slot;
        }
      }

      // 4. Subject Vulnerability Ranking
      const subjectStatsList = (subjects || []).map((s: any) => {
        const subCountable = (s.attendance || []).filter(
          (a: any) =>
            a.status === "present" ||
            a.status === "absent" ||
            a.status === "medical" ||
            a.status === "od"
        );
        const subAttended = subCountable.filter(
          (a: any) =>
            a.status === "present" ||
            a.status === "medical" ||
            a.status === "od"
        ).length;
        const subAbsent = subCountable.filter((a: any) => a.status === "absent").length;
        const subTotal = subCountable.length;
        const subPct = subTotal > 0 ? (subAttended / subTotal) * 100 : 100;
        return {
          name: s.name,
          attended: subAttended,
          missed: subAbsent,
          total: subTotal,
          percentage: subPct
        };
      });

      subjectStatsList.sort((a: any, b: any) => a.percentage - b.percentage);
      const lowestSubject = subjectStatsList[0] || {
        name: "General Coursework",
        percentage: overallPercentage,
        missed: totalAbsent
      };

      // 5. Remarks Analysis
      const rawRemarks = absentLogs
        .map((l: any) => l.remarks?.trim())
        .filter((r: any) => r && r.length > 1 && r !== "null" && r !== "No reason specified");

      const distinctRemarks = Array.from(new Set(rawRemarks)).slice(0, 3);

      // 6. Synthesize Forecast & Actionable Advice
      const isOnTrack = overallPercentage >= globalTarget;
      let summary = "";
      if (isOnTrack) {
        summary = `Your overall attendance is currently ${overallPercentage.toFixed(1)}%, standing ${(overallPercentage - globalTarget).toFixed(1)}% above your ${globalTarget}% target. You have recorded ${totalAbsent} absence${totalAbsent === 1 ? "" : "s"} across ${totalConducted} classes, leaving you with ${safeBunkAllowance} safe bunk allowance${safeBunkAllowance === 1 ? "" : "s"} overall.`;
      } else {
        summary = `Your overall attendance is currently ${overallPercentage.toFixed(1)}%, trailing your ${globalTarget}% target by ${(globalTarget - overallPercentage).toFixed(1)}%. With ${totalAbsent} absence${totalAbsent === 1 ? "" : "s"} accumulated, you must attend the next ${requiredToRecover} consecutive class${requiredToRecover === 1 ? "" : "es"} without unexcused absences to restore eligibility.`;
      }

      const keyReasons: string[] = [];
      if (peakDayCount > 0) {
        const pctOnDay = Math.round((peakDayCount / totalAbsent) * 100);
        keyReasons.push(`Absences concentrated on ${peakDay}s (${peakDayCount} missed classes, ${pctOnDay}% of absences)`);
      }
      if (morningAbsences > 0) {
        keyReasons.push(`Morning lectures before 11:00 AM accounted for ${morningAbsences} missed class${morningAbsences === 1 ? "" : "es"}`);
      }
      if (lowestSubject && lowestSubject.total > 0) {
        keyReasons.push(`${lowestSubject.name}: Lowest subject attendance at ${lowestSubject.percentage.toFixed(1)}% (${lowestSubject.missed} missed)`);
      }
      if (distinctRemarks.length > 0) {
        keyReasons.push(`Reported absence reasons: ${distinctRemarks.join(", ")}`);
      } else if (keyReasons.length < 2) {
        keyReasons.push("Scattered intermittent absences across mid-week schedule");
      }

      const vulnerableTimings: string[] = [];
      if (peakDayCount > 0) {
        vulnerableTimings.push(`${peakDay}s ${peakTimeSlot}`);
      }
      if (morningAbsences > 1) {
        vulnerableTimings.push("Morning lectures (09:00 - 11:00)");
      }
      if (lowestSubject && lowestSubject.name) {
        vulnerableTimings.push(`${lowestSubject.name} regular slots`);
      }
      if (vulnerableTimings.length === 0) {
        vulnerableTimings.push(`${peakTimeSlot}`);
      }

      let recommendation = "";
      if (!isOnTrack) {
        recommendation = `Prioritize 100% attendance in ${lowestSubject.name} and avoid missing classes on ${peakDay}s to clear your ${requiredToRecover}-class recovery requirement.`;
      } else if (safeBunkAllowance <= 2) {
        recommendation = `Your safety buffer is tight (${safeBunkAllowance} safe leave${safeBunkAllowance === 1 ? "" : "s"}). Protect your attendance in ${lowestSubject.name} to avoid slipping into shortage.`;
      } else {
        recommendation = `Maintain your current routine. Your highest absence risk remains on ${peakDay}s; preserve your ${safeBunkAllowance} safe bunk allowance for genuine emergencies.`;
      }

      return {
        summary,
        keyReasons,
        vulnerableTimings,
        recommendation
      };
    } catch (error: any) {
      console.error("[PredictiveRagService] Error in statistical forecast engine:", error);
      return {
        summary: "Your attendance profile has been loaded. Maintain consistent attendance across all registered subjects.",
        keyReasons: ["Data processed locally by statistical engine"],
        vulnerableTimings: ["Morning schedule slots"],
        recommendation: "Target consistent attendance above your institutional requirement."
      };
    }
  }
}
