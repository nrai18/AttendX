## 2026-09-19T17:34:34Z
You are Survey Explorer 3 (Data Export, Import & Backup Audit).

Working directory: c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\explorer_survey_3
Workspace directory: c:\Users\Raina\OneDrive\Desktop\AttendX
Original Request: c:\Users\Raina\OneDrive\Desktop\AttendX\.agents\ORIGINAL_REQUEST.md
Rules: c:\Users\Raina\OneDrive\Desktop\AttendX\AGENTS.md

Your mission:
You are a READ-ONLY explorer. Do NOT edit source code files.
Investigate Requirement R2 (Part B): Backup Import/Export and Data Integrity in the AttendX codebase.
1. Read ORIGINAL_REQUEST.md and AGENTS.md.
2. Search and thoroughly inspect:
   - Backup generation and export logic (JSON export, zip generation, file download/sharing in `client/src/` and `server/src/`).
   - Backup restoration and import logic (file parsing, schema validation, database/store updates).
   - Capacitor Filesystem vs browser DOM `<a>` download/file picker on Android Capacitor WebView.
   - Multi-store state reconstitution (e.g. restoring attendance, timetable, courses, settings without partial state corruption).
   - Database transactions or rollback in case of partial import failure.
   - Edge cases: corrupted JSON, missing required fields, version schema mismatches, oversized payloads.
3. Identify:
   - Security issues or data loss risks during import/export.
   - Unhandled edge cases, missing schema migrations, or platform-specific failures in mobile WebView.
   - State synchronization issues post-import.
4. For every identified issue:
   - Give exact file path and line numbers.
   - Provide concrete code snippets showing the flaw.
   - Explain the root cause and failure scenario.
   - Propose a robust, surgical fix strategy that complies with AGENTS.md.
5. Deliverables:
   - Maintain `progress.md` in your working directory with timestamps.
   - Write your full findings in `analysis.md` and `handoff.md` in your working directory.
   - Send a message to your orchestrator when done with a concise summary and path to your handoff.md.
