export interface FailureLogEntry {
  id: string;
  timestamp: string;
  method?: string;
  path?: string;
  statusCode?: number;
  userId?: string | null;
  userEmail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  errorMessage: string;
  errorName?: string;
  stack?: string | null;
  context?: Record<string, any>;
}

export class FailureLogRecorder {
  private static buffer: FailureLogEntry[] = [];
  private static MAX_ENTRIES = 200;

  static recordError(err: any, req?: any, extraContext?: Record<string, any>) {
    try {
      const entry: FailureLogEntry = {
        id: Math.random().toString(36).substring(2, 10),
        timestamp: new Date().toISOString(),
        method: req?.method,
        path: req?.originalUrl || req?.url,
        statusCode: err?.status || err?.statusCode || 500,
        userId: req?.user?.userId || req?.user?.id || extraContext?.userId || null,
        userEmail: req?.user?.email || req?.body?.email || extraContext?.email || null,
        ip: req?.ip || req?.headers?.["x-forwarded-for"] || null,
        userAgent: req?.headers?.["user-agent"] || null,
        errorMessage: err?.message || String(err),
        errorName: err?.name || "Error",
        stack: err?.stack || null,
        context: extraContext
      };

      this.buffer.push(entry);
      if (this.buffer.length > this.MAX_ENTRIES) {
        this.buffer.shift();
      }
    } catch (e) {
      console.error("[FailureLogRecorder] Failed to record error:", e);
    }
  }

  static getRecentLogs(filter?: { userId?: string; email?: string; limit?: number }): FailureLogEntry[] {
    let logs = [...this.buffer];
    if (filter?.userId || filter?.email) {
      const userLogs = logs.filter(
        l => (filter.userId && l.userId === filter.userId) || 
             (filter.email && l.userEmail && l.userEmail.toLowerCase() === filter.email.toLowerCase())
      );
      if (userLogs.length > 0) {
        const others = logs.filter(l => !userLogs.includes(l));
        logs = [...userLogs, ...others];
      }
    }
    const limit = filter?.limit || 50;
    return logs.slice(-limit).reverse();
  }

  static formatLogsAsText(logs: FailureLogEntry[]): string {
    if (logs.length === 0) {
      return "No server failure logs recorded during this session.\nAll systems operational.\n";
    }

    const header = `================================================================================\n` +
                   `ATTENDX SERVER FAILURE DIAGNOSTIC LOGS\n` +
                   `Generated At: ${new Date().toISOString()} (${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST)\n` +
                   `Total Recorded Entries: ${logs.length}\n` +
                   `================================================================================\n\n`;

    const body = logs.map((log, idx) => {
      let text = `[#${idx + 1}] [${log.timestamp}] ERROR ${log.statusCode || 500} | ${log.method || "N/A"} ${log.path || "N/A"}\n`;
      if (log.userEmail || log.userId) {
        text += `User: ${log.userEmail || "Anonymous"} (ID: ${log.userId || "null"})\n`;
      }
      if (log.ip) {
        text += `Client IP: ${log.ip}\n`;
      }
      if (log.userAgent) {
        text += `User Agent: ${log.userAgent}\n`;
      }
      if (log.context && Object.keys(log.context).length > 0) {
        text += `Context: ${JSON.stringify(log.context)}\n`;
      }
      text += `Error: [${log.errorName || "Error"}] ${log.errorMessage}\n`;
      if (log.stack) {
        text += `Stack Trace:\n${log.stack}\n`;
      }
      return text;
    }).join("\n--------------------------------------------------------------------------------\n\n");

    return header + body;
  }
}
