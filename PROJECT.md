# Project: AttendX Custom ML Copilot, Forecast Engine, Security Tiering & Offline Fixes

## Architecture
- **Client**: React 19, TypeScript, TailwindCSS 4, Zustand 5 stores, Capacitor 6 (Android native runtime), Axios HTTP client.
- **Server**: Node.js v24, Express, TypeScript, Prisma ORM 7.9, PostgreSQL.
- **Custom ML Architecture (Zero External Token Usage)**:
  - Embedded local ML classifier and rule/slot extraction engine in `server/src/services/custom_ml_copilot.service.ts` and `predictive_rag.service.ts`.
  - Zero external API tokens for Copilot chat and Forecast calculations.
  - Instant warm-up on server boot and client boot.
  - Strictly preserves external Gemini API (`@google/genai` with `gemini-3.8-flash`) for:
    1. Academic Calendar document parsing (`server/src/services/calendar_rag.service.ts`)
    2. Timetable OCR parsing (`server/src/services/timetable.service.ts`)
- **Context Injection Pipeline**:
  - React frontend captures `{ text, currentRoute, selectedItems, localTime }` alongside user context.
  - Backend rigidly constructs the bracketed prompt:
    `[SYSTEM_IDENTITY]`, `[GLOBAL_APP_STATE]`, `[USER_PROFILE]`, `[CLIENT_SESSION_STATE]`, `[USER_COMMAND]`, `[EXECUTION_RULES]`.
- **Security Tiering & Execution**:
  - ML Copilot NEVER writes directly to PostgreSQL database.
  - Strict JSON mutation array outputs: `actions: [{ id, type, isDestructive, requiresConfirmation, target, description, payload }]`.
  - Tier 1 (Safe): Immediate execution.
  - Tier 2 (Destructive): Returns `CONFIRMATION_REQUIRED: true` flag. React UI renders Confirmation Card; action only executes on explicit user tap.
- **Offline Data Resilience**:
  - Axios client timeout prevents silent deadlocks on mobile WebViews.
  - Cached state hydration from Capacitor Preferences and Zustand stores guarantees graceful offline loading for Semester Overview, Forecast Page, Reports Page, and Archived Timetable.

## Feature Inventory
| # | Feature / Deliverable | Description | Milestone | Source |
|---|---|---|---|---|
| 1 | Custom Copilot ML Intent Classifier | Zero-token local ML classifier handling 6 core intents (`MARK_ATTENDANCE`, `SIMULATE_ATTENDANCE`, `NAVIGATE_APP`, `SHIFT_TIMETABLE`, `KNOWLEDGE_BASE`, `OUT_OF_SCOPE`) | M1 | ORIGINAL_REQUEST R1 |
| 2 | Custom Zero-Token Forecast Engine | Statistical predictive attendance model replacing Gemini in `predictive_rag.service.ts` | M1 | ORIGINAL_REQUEST R1 |
| 3 | Instant Copilot Warmup on Boot | Server pre-caches vocabulary and client pre-warms Copilot on startup in `App.tsx` | M1 | ORIGINAL_REQUEST R1 |
| 4 | Gemini Preservation Verification | Ensure `calendar_rag.service.ts` and `timetable.service.ts` remain untouched with `gemini-3.8-flash` | M1 | ORIGINAL_REQUEST R1 |
| 5 | Rich Client Context Extraction | Capture `{ text, currentRoute, selectedItems, localTime }` in `FloatingChatbot.tsx` | M2 | ORIGINAL_REQUEST R2 |
| 6 | Rigid Bracketed Master Prompt Assembly | Backend formats exact prompt structure: `[SYSTEM_IDENTITY]`, `[GLOBAL_APP_STATE]`, `[USER_PROFILE]`, `[CLIENT_SESSION_STATE]`, `[USER_COMMAND]`, `[EXECUTION_RULES]` | M2 | ORIGINAL_REQUEST R2 |
| 7 | Zero-Direct-DB-Write Enforcement | Sandboxed ML model emitting strictly JSON mutation arrays | M3 | ORIGINAL_REQUEST R3 |
| 8 | Tiered Action Classification & UI Confirmation | Safe vs Destructive ActionPolicyMatrix; `CONFIRMATION_REQUIRED` flag triggers interactive UI cards | M3 | ORIGINAL_REQUEST R3 |
| 9 | Axios Client Offline Timeout | Add 5000ms timeout to `api.ts` to prevent infinite hanging requests on disconnected WebViews | M4 | ORIGINAL_REQUEST R4 |
| 10 | Semester Overview Offline Loading Fix | Resolve hydration race & offline fallback in `SemesterHubPage.tsx` | M4 | ORIGINAL_REQUEST R4 |
| 11 | Forecast Page Offline Loading Fix | Fix `isLoading` initial lock and offline fallback in `PredictiveAttendanceView.tsx` | M4 | ORIGINAL_REQUEST R4 |
| 12 | Reports Page Offline Loading Fix | Fix early return bug without `setLoading(false)` in `ReportView.tsx` | M4 | ORIGINAL_REQUEST R4 |
| 13 | Archived Timetable Offline Loading Fix | Fix cache key mismatch and initial spinner in `ArchiveTimetableModal.tsx` | M4 | ORIGINAL_REQUEST R4 |
| 14 | Server Test Runner Default Export Patch | Add `export default prisma;` to `server/src/lib/prisma.ts` | M5 | ORIGINAL_REQUEST R5 |
| 15 | Chaos Test Suite Implementation | Implement comprehensive test suite covering voice commands, boundary cases, JSON adherence, latency, context retention | M5 | ORIGINAL_REQUEST R5 |
| 16 | Evaluation Benchmark & Report | Run 1,000-query benchmark & chaos tests; generate `llm_eval_report.md` | M5 | ORIGINAL_REQUEST R5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M1 | Custom Zero-Token ML Copilot & Forecast Engine | Implement local ML Copilot engine, statistical forecast engine, app boot warmup, preserve Gemini in calendar/timetable | none | DONE |
| M2 | Context Injection Pipeline | Client `{ text, currentRoute, selectedItems, localTime }` payload and backend 6-bracket prompt assembly | M1 | DONE |
| M3 | Security Tiering & Execution | JSON mutation arrays schema, ActionPolicyMatrix, `CONFIRMATION_REQUIRED` flag, and React UI confirmation cards | M1, M2 | DONE |
| M4 | Fix Offline Infinite Loading Bugs | Axios timeout, Semester Overview, Forecast Page, Reports Page, and Archived Timetable offline persistence | none | DONE |
| M5 | Chaos Testing, Evaluation & llm_eval_report.md | Server test fix, chaos test suite, benchmark_1000 execution, and `llm_eval_report.md` | M1, M2, M3, M4 | DONE |

## Interface Contracts
### Copilot Client ↔ Backend Pipeline
- **Request Payload**:
  ```typescript
  {
    message: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    currentRoute: string;
    selectedItems?: any[];
    localTime: string;
    student_context?: Record<string, any>;
  }
  ```
- **Backend Master Prompt Blueprint**:
  - `[SYSTEM_IDENTITY]`: Role definition, assistant personality, AttendX capabilities.
  - `[GLOBAL_APP_STATE]`: Timetable slots, enrolled subjects, attendance percentages, academic calendar events.
  - `[USER_PROFILE]`: Student name, email, target percentage, semester info.
  - `[CLIENT_SESSION_STATE]`: `currentRoute`, `selectedItems`, `localTime`, device connection status.
  - `[USER_COMMAND]`: Exact raw user text or transcribed speech command.
  - `[EXECUTION_RULES]`: Output schema constraints (strictly JSON mutation arrays), safety restrictions, zero hallucinated IDs.
- **Response Format**:
  ```typescript
  {
    reply: string;
    actions: Array<{
      id: string;
      type: string;
      category: 'READ' | 'WRITE' | 'CONFIG' | 'NAVIGATION';
      isDestructive: boolean;
      requiresConfirmation: boolean;
      target: string;
      description: string;
      impact?: string;
      payload: Record<string, any>;
    }>;
    requiresConfirmation?: boolean;
  }
  ```

### Code Layout
- `server/src/services/custom_ml_copilot.service.ts` — Embedded local ML classifier, slot extraction, intent resolution
- `server/src/services/ai_chat.service.ts` — Copilot orchestration, rigid prompt assembly, delegation to custom ML
- `server/src/services/predictive_rag.service.ts` — Zero-token statistical attendance forecast engine
- `server/src/services/calendar_rag.service.ts` — Academic calendar multimodal document parsing (GEMINI PRESERVED)
- `server/src/services/timetable.service.ts` — Timetable OCR extraction (GEMINI PRESERVED)
- `client/src/components/common/FloatingChatbot.tsx` — Context capture, interactive confirmation cards, execution
- `client/src/lib/api.ts` — Axios instance with timeout and offline error handling
- `client/src/pages/semester/SemesterHubPage.tsx` — Semester overview offline loading
- `client/src/components/attendance/PredictiveAttendanceView.tsx` — Forecast page offline loading
- `client/src/pages/reports/ReportView.tsx` — Reports page offline loading
- `client/src/pages/timetable/ArchiveTimetableModal.tsx` — Archived timetable offline loading
- `server/src/tests/chaos_eval.test.ts` — Chaos testing and evaluation test suite
- `llm_eval_report.md` — Comprehensive evaluation report
