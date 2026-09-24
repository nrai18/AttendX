import { CustomMlCopilotService, CopilotContext, CopilotResponse } from "./custom_ml_copilot.service";

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
    const eventsSummary =
      context.calendarEvents && context.calendarEvents.length > 0
        ? context.calendarEvents.map((e: any) => `${e.title || e.name} (${e.date || e.startDate})`).join(", ")
        : "No upcoming holiday events recorded";
    const appVersion = context.appVersion || "4.0.0";

    const userId = context.userId || "anonymous";
    const userName = context.userName || "Student";
    const role = "student";
    const department = "Computer Science & Engineering";
    const batch = "2023-2027";
    const targetAttendance = context.targetPercentage ?? 75;

    const localTime = context.localTime || new Date().toISOString();
    const currentRoute = context.currentRoute || "/today";
    const selectedItemsJson = JSON.stringify(context.selectedItems || []);
    const overallPercentage = context.overallPercentage ?? 100;
    const totalAttended = context.totalAttended ?? 0;
    const totalClasses = context.totalClasses ?? 0;

    const formattedSubjectsList =
      context.subjects && context.subjects.length > 0
        ? context.subjects
            .map(
              (s: any) =>
                `- ${s.name} (ID: ${s.id}${s.code ? `, Code: ${s.code}` : ""}): ${s.attended || 0}/${s.total || 0} classes (${(s.percentage || 0).toFixed(1)}%, Target: ${s.target || targetAttendance}%)`
            )
            .join("\n")
        : "None enrolled";

    const formattedHistory =
      history && history.length > 0
        ? history
            .map((m: any) => `${m.role === "user" ? "Student" : "Copilot"}: ${m.content || m.text || ""}`)
            .join("\n")
        : "None";

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

[USER_COMMAND]
Input: "${text}"
Prior Dialog History:
${formattedHistory}

[EXECUTION_RULES]
1. Zero Database Writes: Do not write to DB. Return mutations in "actions" array.
2. Confirmation Requirements: Destructive: REMOVE_SUBJECT, DROP_SUBJECT_FROM_TIMETABLE, REMOVE_ATTENDANCE, MARK_FULL_DAY_OFF, SHIFT_TIMETABLE_SLOT, ADD_SUBJECT, CHANGE_TARGET, CHANGE_GLOBAL_TARGET (requiresConfirmation=true). Safe: NAVIGATE, READ_STATS, FILTER_VIEW, SET_SIMULATION_PREVIEW, SWITCH_THEME, SHARE_APP, CHANGE_REMINDER_FREQUENCY, MARK_ATTENDANCE (requiresConfirmation=false).
3. Entity Resolution: Match subjects by name against [CLIENT_SESSION_STATE].subjects to get exact IDs. Resolve dates relative to [CLIENT_SESSION_STATE].localTime.
4. Output Schema:
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
5. Guardrails: For OUT_OF_SCOPE queries, return a polite refusal explaining AttendX Copilot only assists with attendance, timetable, and college ordinances.`;
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
      appVersion: effectiveContext.app_version || effectiveContext.appVersion || "4.0.0",
      activeSemesterId: effectiveContext.active_semester_id || effectiveContext.activeSemesterId,
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
      historyLogs: effectiveContext.history_logs || effectiveContext.historyLogs || [],
      calendarEvents: effectiveContext.calendar_events || effectiveContext.calendarEvents || [],
      history: effectiveHistory,
    };

    // 1. Construct the rigid 6-bracket master prompt
    const masterPrompt = this.assembleMasterPrompt(text, copilotContext, effectiveHistory);

    // 2. Delegate inference to CustomMlCopilotService (Gemini 3.8-Flash Intent Router)
    const result: CopilotResponse = await CustomMlCopilotService.process(text, copilotContext, masterPrompt);

    return {
      intent: result.intent,
      reply: result.reply,
      response: result.response,
      citations: result.citations,
      actions: result.actions,
      simulation: result.simulation,
      action: result.actions && result.actions.length > 0 ? result.actions[0] : null,
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
