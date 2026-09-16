# Original User Request

## Initial Request — 2026-09-19T17:33:08Z

# Teamwork Project Prompt — Draft

Conduct a comprehensive app-wide code review and bug hunt to identify offline-sync race conditions, notification logic flaws, data import/export errors, and other systemic edge cases in the AttendX codebase. Use a full team of agents for this deep audit.

Working directory: c:\Users\Raina\OneDrive\Desktop\AttendX
Integrity mode: development

## Requirements

### R1. Identify Offline-Sync Race Conditions
Scan the React frontend (specifically Zustand stores, API interceptors, and page components) to find instances where optimistic UI updates could be overwritten by stale GET responses or flawed offline-queue implementations. Propose and implement fixes.

### R2. Audit Notifications and Data Export
Review the local notifications scheduling logic (`Capacitor/LocalNotifications`) and the import/export backup functionality. Identify potential failures, missing edge cases, or platform-specific WebView errors. Propose and implement fixes.

### R3. Comprehensive Bug Report
Produce a detailed Markdown report (`audit_report.md` in the working directory) documenting every discovered issue. Include code snippets, root cause analysis, and explanations of the applied fixes.

## Acceptance Criteria

### Verification & Reporting
- [ ] An `audit_report.md` file is generated containing at least 3 distinct bug classifications (Offline Sync, Notifications, Import/Export).
- [ ] Each bug in the report includes a root cause analysis and a reference to the specific file/lines affected.
- [ ] Fixes for the identified bugs are implemented directly in the codebase without breaking the existing Capacitor compilation process.
- [ ] The report includes a checklist of the exact files modified so the user can review the changes.
