import { CustomMlCopilotService, CopilotContext, CopilotResponse } from "./custom_ml_copilot.service";
import { prisma } from "../lib/prisma";

export interface MasterPromptPayload {
  text: string;
  currentRoute?: string;
  selectedItems?: any[];
  localTime?: string;
  history?: any[];
  student_context?: any;
}

export class AiChatService {
  /**
   * Assembles the rigid 6-bracket master prompt string per Requirement R2:
   * [SYSTEM_IDENTITY]
   * [GLOBAL_APP_STATE]
   * [USER_PROFILE]
   * [CLIENT_SESSION_STATE]
   * [USER_COMMAND]
   * [EXECUTION_RULES]
   */
  public static assembleMasterPrompt(
    text: string,
    context: CopilotContext,
    history: any[] = []
  ): string {
    const activeSemesterId = context.activeSemesterId || "None";
    const semesterName = context.semesterName || "Current Semester";
    const startDate = context.startDate || "Not specified";
    const endDate = context.endDate || "Not specified";
    const commencementDate = context.commencementDate || startDate;
    const lastWorkingDay = context.lastWorkingDay || endDate;
    const todayIso = (context.localTime ? new Date(context.localTime) : new Date()).toISOString().split("T")[0];
    const upcomingEventsList =
      context.calendarEvents && Array.isArray(context.calendarEvents) && context.calendarEvents.length > 0
        ? context.calendarEvents
            .filter((e: any) => {
              const rawEnd = e.endDate || e.date || e.startDate;
              if (!rawEnd) return true;
              const dStr = rawEnd instanceof Date ? rawEnd.toISOString().split("T")[0] : String(rawEnd).split("T")[0];
              return dStr >= todayIso;
            })
            .slice(0, 12)
            .map((e: any) => {
              let dateStr = "Unknown Date";
              if (e.date) {
                dateStr = e.date instanceof Date ? e.date.toISOString().split("T")[0] : String(e.date).split("T")[0];
              } else if (e.startDate) {
                dateStr = e.startDate instanceof Date ? e.startDate.toISOString().split("T")[0] : String(e.startDate).split("T")[0];
              }
              if (e.endDate) {
                const endStr = e.endDate instanceof Date ? e.endDate.toISOString().split("T")[0] : String(e.endDate).split("T")[0];
                if (endStr !== dateStr) dateStr += ` to ${endStr}`;
              }
              return `${e.title || e.name || e.eventName || "Unnamed Event"} (${dateStr})`;
            })
            .join(", ")
        : "No upcoming holiday events recorded";
    const eventsSummary = upcomingEventsList || "No upcoming holiday events recorded";
    const appVersion = context.appVersion || "4.0.0";

    const userId = context.userId || "anonymous";
    const userName = context.userName || "Student";
    const role = "student";
    const department = (context as any).department || "General Academics";
    const batch = (context as any).batch || "Current Batch";
    const targetAttendance = context.targetPercentage ?? 75;

    const localTime = context.localTime || new Date().toISOString();
    const currentRoute = context.currentRoute || "/today";
    const selectedItemsJson = JSON.stringify(context.selectedItems || []);
    const overallPercentage = context.overallPercentage ?? 100;
    const totalAttended = context.totalAttended ?? 0;
    const totalClasses = context.totalClasses ?? 0;

    const formattedSubjectsList =
      context.subjects && Array.isArray(context.subjects) && context.subjects.length > 0
        ? context.subjects
            .map((s: any) => {
              const att = Number(s.attended || 0);
              const tot = Number(s.total || 0);
              const tgt = Number(s.target || targetAttendance || 75);
              const p = tgt / 100;
              const safeBunks = tot > 0 ? Math.max(0, Math.floor((att - p * tot) / p)) : 0;
              const needClasses = tot > 0 && p < 1 ? Math.max(0, Math.ceil((p * tot - att) / (1 - p))) : 0;
              return `- ${s.name} (ID: ${s.id}${s.code ? `, Code: ${s.code}` : ""}): ${att}/${tot} (${Number(s.percentage || 0).toFixed(1)}%, Target: ${tgt}%, SafeBunks: ${safeBunks}, NeedToAttend: ${needClasses}${s.remainingClasses !== undefined ? `, RemainingSemClasses: ${s.remainingClasses}` : ""})`;
            })
            .join("\n")
        : "None enrolled";

    const formattedHistory =
      history && history.length > 0
        ? history
            .slice(-10)
            .map((m: any) => `${m.role === "user" ? "Student" : "Copilot"}: ${m.content || m.text || ""}`)
            .join("\n")
        : "None";

    const needsHistoryLogs = /\b(when was i|history|log|logs|past|last week|yesterday|marked on|absent on|present on|did i attend|did i miss)\b/i.test(text);
    const historyLogsSummary =
      needsHistoryLogs && context.historyLogs && context.historyLogs.length > 0
        ? context.historyLogs
            .slice(-20)
            .map((l: any) => {
              const d = new Date(l.date);
              if (isNaN(d.getTime())) return `Invalid Date: ${l.subject?.name || l.subjectName || "Subject"} - ${l.status}`;
              return `${d.toISOString().split("T")[0]}: ${l.subject?.name || l.subjectName || "Subject"} - ${l.status}`;
            })
            .join("\n")
        : "Omitted (not needed for this query)";

    return `[SYSTEM_IDENTITY]
Role: AttendX AI Copilot & Offline Academic Advisor
Engine: Zero-Token Local Machine Learning Intent Classifier & Predictive Engine
Execution Policy: Strictly output structured JSON action mutations. Direct database writes are forbidden.

[GLOBAL_APP_STATE]
Active Semester ID: ${activeSemesterId}
Semester Name: ${semesterName}
Dates: ${startDate} to ${endDate}
Commencement Date: ${commencementDate}
Last Working Day: ${lastWorkingDay}
Upcoming Events: ${eventsSummary}
App Version: ${appVersion}

[USER_PROFILE]
User ID: ${userId}
Name: ${userName}
Birthday: ${context.userBirthday || "Not provided"}
Role: ${role}
Department: ${department}
Batch: ${batch}
Target Attendance: ${targetAttendance}%

[CLIENT_SESSION_STATE]
Local Timestamp: ${localTime}
Current Screen/Route: ${currentRoute}
Selected Item Context: ${selectedItemsJson}
Overall Attendance: ${overallPercentage}% (${totalAttended}/${totalClasses} classes)
Subjects Enrolled:
${formattedSubjectsList}
Recent Attendance Logs (Last 30):
${historyLogsSummary}


[USER_COMMAND]
Input: "${text}"
Prior Dialog History:
${formattedHistory}

[EXECUTION_RULES]
1. Zero Database Writes: Do not write to DB. Return mutations in "actions" array.
2. Confirmation Requirements: Destructive: REMOVE_SUBJECT, DROP_SUBJECT_FROM_TIMETABLE, REMOVE_ATTENDANCE, MARK_FULL_DAY_OFF, SHIFT_TIMETABLE_SLOT, ADD_SUBJECT, CHANGE_TARGET, CHANGE_GLOBAL_TARGET (requiresConfirmation=true). Safe: NAVIGATE, READ_STATS, FILTER_VIEW, SET_SIMULATION_PREVIEW, SWITCH_THEME, SHARE_APP, CHANGE_REMINDER_FREQUENCY, CHANGE_SUMMARY_TIME, CHANGE_CLASS_REMINDER_OFFSET, UPDATE_TIMETABLE_ALERTS, MARK_ATTENDANCE (requiresConfirmation=false).
3. Entity Resolution: Match subjects by name against [CLIENT_SESSION_STATE].subjects to get exact IDs. Resolve dates relative to [CLIENT_SESSION_STATE].localTime.
4. Auto-Remarks: If generating a MARK_ATTENDANCE or MARK_FULL_DAY_OFF action, ALWAYS include 'remarks': 'Marked by AttendX Copilot' inside the action payload.
5. Output Schema:
{
  "intent": "CHIT_CHAT | APP_FAQ | POLICY_RAG | SUBMIT_FEEDBACK | NAVIGATE_APP | UPDATE_SETTINGS | TIMETABLE_QUERY | FORECAST_SIMULATION | TRIGGER_REPORT | MARK_ATTENDANCE | SHIFT_TIMETABLE | MODIFY_SUBJECTS | MODIFY_TARGET",
  "reply": "string",
  "response": "string",
  "citations": ["string"],
  "actions": [
    {
      "type": "string",
      "payload": { ... },
      "requiresConfirmation": boolean
    }
  ]
}
6. Guardrails: For OUT_OF_SCOPE queries, return a polite refusal explaining AttendX Copilot only assists with attendance, timetable, and college ordinances.`;
  }

  /**
   * Handle incoming chat requests locally via CustomMlCopilotService
   */
  public static async handleChat(
    messageOrPayload: string | MasterPromptPayload,
    history: any[] = [],
    studentContext: any = {}
  ): Promise<any> {
    let text = "";
    let currentRoute = "/today";
    let selectedItems: any[] = [];
    let localTime = new Date().toISOString();
    let effectiveHistory = history;
    let effectiveContext = studentContext;

    if (typeof messageOrPayload === "object" && messageOrPayload !== null) {
      text = messageOrPayload.text || (messageOrPayload as any).message || "";
      currentRoute = messageOrPayload.currentRoute || "/today";
      selectedItems = messageOrPayload.selectedItems || [];
      localTime = messageOrPayload.localTime || new Date().toISOString();
      if (messageOrPayload.history) effectiveHistory = messageOrPayload.history;
      if (messageOrPayload.student_context) effectiveContext = messageOrPayload.student_context;
    } else {
      text = String(messageOrPayload || "");
    }

    // Prepare normalized context
    const copilotContext: CopilotContext = {
      userId: effectiveContext.user_id || effectiveContext.userId,
      userName: effectiveContext.user_name || effectiveContext.userName || "Student",
      userEmail: effectiveContext.user_email || effectiveContext.userEmail,
      userBirthday: effectiveContext.user_birthday || effectiveContext.userBirthday,
      appVersion: effectiveContext.app_version || effectiveContext.appVersion || "4.0.0",
      activeSemesterId: effectiveContext.active_semester_id || effectiveContext.activeSemesterId || null,
      semesterName: effectiveContext.semester_name || effectiveContext.semesterName,
      startDate: effectiveContext.active_semester_start_date || effectiveContext.startDate,
      endDate: effectiveContext.active_semester_end_date || effectiveContext.endDate,
      commencementDate: effectiveContext.commencementDate,
      lastWorkingDay: effectiveContext.lastWorkingDay,
      overallPercentage: effectiveContext.overall_percentage ?? effectiveContext.overallPercentage,
      targetPercentage: effectiveContext.target_percentage ?? effectiveContext.targetPercentage,
      totalAttended: effectiveContext.total_attended ?? effectiveContext.totalAttended,
      totalClasses: effectiveContext.total_classes ?? effectiveContext.totalClasses,
      currentRoute,
      selectedItems,
      localTime,
      subjects: effectiveContext.subjects || [],
      timetable_slots: effectiveContext.timetable_slots || effectiveContext.timetableSlots || [],
      historyLogs: effectiveContext.history_logs || effectiveContext.historyLogs || [],
      calendarEvents: effectiveContext.calendar_events || effectiveContext.calendarEvents || [],
      history: effectiveHistory,
    };

    // Auto-enrich missing profile / semester metadata & calendar events from database if userId exists
    if (copilotContext.userId) {
      try {
        const [dbUser, dbSem] = await Promise.all([
          (!copilotContext.userBirthday || !copilotContext.userEmail || !copilotContext.userName || copilotContext.userName === "Student")
            ? prisma.user.findUnique({
                where: { id: copilotContext.userId },
                select: { birthday: true, email: true, name: true },
              })
            : Promise.resolve(null),
          !copilotContext.endDate
            ? prisma.semester.findFirst({
                where: { userId: copilotContext.userId, isActive: true },
                select: { id: true, name: true, startDate: true, endDate: true },
              })
            : Promise.resolve(null),
        ]);
        if (dbUser?.birthday && !copilotContext.userBirthday) {
          copilotContext.userBirthday = dbUser.birthday.toISOString().split("T")[0];
        }
        if (dbUser?.email && !copilotContext.userEmail) {
          copilotContext.userEmail = dbUser.email;
        }
        if (dbUser?.name && (!copilotContext.userName || copilotContext.userName === "Student")) {
          copilotContext.userName = dbUser.name;
        }
        if (dbSem) {
          if (!copilotContext.activeSemesterId) copilotContext.activeSemesterId = dbSem.id;
          if (!copilotContext.semesterName) copilotContext.semesterName = dbSem.name;
          if (!copilotContext.startDate) copilotContext.startDate = dbSem.startDate.toISOString().split("T")[0];
          if (!copilotContext.endDate) copilotContext.endDate = dbSem.endDate.toISOString().split("T")[0];
          if (!copilotContext.lastWorkingDay) copilotContext.lastWorkingDay = dbSem.endDate.toISOString().split("T")[0];
        }

        // Auto-enrich calendar events from database if client sent an incomplete/empty list
        const semId = copilotContext.activeSemesterId || dbSem?.id;
        const dbEvents = await prisma.event.findMany({
          where: {
            OR: [{ userId: copilotContext.userId }, { userId: null }],
            ...(semId ? { OR: [{ semesterId: semId }, { semesterId: null }] } : {}),
          },
          orderBy: { date: "asc" },
        });
        if (dbEvents && dbEvents.length > 0) {
          const eventMap = new Map<string, any>();
          (copilotContext.calendarEvents || []).forEach((e: any) => {
            const key = e.id || `${e.title}_${e.date}`;
            eventMap.set(key, e);
          });
          dbEvents.forEach((e: any) => {
            const key = e.id || `${e.title}_${e.date instanceof Date ? e.date.toISOString().split("T")[0] : e.date}`;
            eventMap.set(key, {
              id: e.id,
              title: e.title,
              eventType: e.eventType,
              date: e.date,
              endDate: e.endDate,
              description: e.description,
              isHoliday: e.isHoliday,
              isHolidayList: e.isHolidayList,
            });
          });
          copilotContext.calendarEvents = Array.from(eventMap.values());
        }
      } catch (dbEnrichErr) {
        console.warn("[AiChatService] Database context enrichment failed:", dbEnrichErr);
      }
    }

    console.info(`\n============================ [AIChat:Request] ============================`);
    console.info(`[AIChat:Request] Timestamp: ${new Date().toISOString()}`);
    console.info(`[AIChat:Request] User Question: "${text}"`);
    console.info(`[AIChat:Request] User Profile: Name="${copilotContext.userName}", ID="${copilotContext.userId}", Email="${copilotContext.userEmail || 'Not passed'}"`);
    console.info(`[AIChat:Request] Screen Context: Route="${copilotContext.currentRoute}", ActiveSem="${copilotContext.activeSemesterId || 'None'}", SemName="${copilotContext.semesterName || 'None'}"`);
    console.info(`[AIChat:Request] Attendance Context: ${copilotContext.overallPercentage}% (${copilotContext.totalAttended}/${copilotContext.totalClasses} classes), Target: ${copilotContext.targetPercentage}%`);
    console.info(`[AIChat:Request] Enriched Context: ${copilotContext.subjects?.length || 0} subjects | ${copilotContext.calendarEvents?.length || 0} events | ${copilotContext.historyLogs?.length || 0} logs | History: ${copilotContext.history?.length || 0} turns`);

    // 1. Construct the rigid 6-bracket master prompt
    const masterPrompt = this.assembleMasterPrompt(text, copilotContext, effectiveHistory);

    // 2. Delegate inference to CustomMlCopilotService (Gemini 3.8-Flash Intent Router)
    let result: CopilotResponse;
    try {
      result = await CustomMlCopilotService.process(text, copilotContext, masterPrompt);
    } catch (e) {
      console.error("[AiChatService] Error calling CustomMlCopilotService:", e);
      result = {
         intent: "APP_FAQ",
         reply: "I am currently offline or experiencing network issues. Please try again in a moment.",
         response: "I am currently offline or experiencing network issues. Please try again in a moment.",
         citations: [],
         actions: [],
         requiresConfirmation: false
      };
    }

    console.info(`[AIChat:Response] Intent: "${result.intent || 'CHIT_CHAT'}"`);
    console.info(`[AIChat:Response] Reply Text: "${result.reply || result.response || ''}"`);
    console.info(`[AIChat:Response] Actions Generated (${result.actions?.length || 0}):`, JSON.stringify(result.actions || []));
    if (result.simulation) {
      console.info(`[AIChat:Response] Simulation Attached:`, JSON.stringify(result.simulation));
    }
    console.info(`============================ [AIChat:End] ============================\n`);

    return {
      intent: result.intent || 'CHIT_CHAT',
      reply: result.reply || 'I am having trouble processing that right now.',
      response: result.response || result.reply || '',
      citations: result.citations || [],
      actions: result.actions || [],
      simulation: result.simulation,
      action: (result.actions && result.actions.length > 0) ? result.actions[0] : null,
      masterPromptSummary: {
        systemIdentity: "Loaded",
        globalAppState: copilotContext.activeSemesterId || "Default",
        userProfile: copilotContext.userName,
        clientSessionState: copilotContext.currentRoute,
        userCommand: text,
        executionRules: "Security Tiered"
      }
    };
  }
}
