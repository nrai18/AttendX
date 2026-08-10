# Product Requirements Document: AttendX

**Document Version:** 2.0.0 (Master Specification)
**Project Name:** AttendX
**Product Type:** Collaborative Attendance & Academic Schedule Tracking Utility
**Deployment Strategy:** Full-Stack Web App (Phase 1) → Installable PWA (Phase 2) → Native Mobile App (Phase 3)

---

## 1. Executive Summary & Product Vision

AttendX is a proactive, student-centric academic planner designed to eliminate the daily friction of tracking lecture attendance in rigorous university environments like the Indian Institute of Information Technology (IIIT), Una.

Generic calendar applications fail to account for the unique constraints of engineering curriculums: mandatory 75% attendance thresholds, double-stacked elective slots, split practical groups (G1 vs. G2), and sudden timetable modifications. The core philosophy of AttendX is **"Proactive Attendance Health."** The platform moves beyond retrospective logging by instantly rendering safe margins, predicting the impact of future absences, and utilizing AI for layout-aware timetable ingestion and conversational attendance logging.

---

## 2. Target Personas

| Persona | Characteristics & Core Needs |
| --- | --- |
| **The Core User (Naman Rai)** | A second-year ECE student (Semester 5, Section G2) navigating overlapping core subjects and lab group divisions. Needs to instantly filter out G1 lab collisions. Requires a one-tap daily interface to log attendance and view exact margins for rigorous subjects like *Digital Circuits and Systems* and *Fiber Optic Communication*. |
| **The Borderline Student** | Hovers dangerously close to the 75% mandate. Needs absolute decimal-point precision. Relies heavily on predictive UI indicators (e.g., "Need to attend 1 lecture" vs. "Can miss 2 lectures") to make daily operational decisions. |
| **The Class Representative (CR)** | Manages the schedule for the entire section. Needs the ability to compile a perfect, conflict-free timetable once, export it as a syndicated payload, and distribute it for instant class-wide onboarding. |

---

## 3. Core Functional Requirements

### 3.1 Authentication & Security Architecture

To protect academic data and ensure strict tenant isolation, AttendX implements a secure authentication flow:

* **Google Workspace SSO [Planned - Phase 2]:** Low-friction onboarding restricted to official institute domains (e.g., `@iiitu.ac.in`) to prevent database pollution from external users.
* **Local Auth (Fallback) [Implemented]:** Standard email/password flow utilizing `bcrypt` hashing, strictly enforced to require `@iiitu.ac.in` domain emails during registration and login.
* **Session Management [Implemented]:** Utilizes short-lived JWT Access Tokens in memory and long-lived Refresh Tokens stored in secure, `HttpOnly`, `SameSite=Strict` cookies.
* **Tenant Isolation [Implemented]:** Backend middleware extracts the `userId` from the JWT, strictly scoping all database queries so users cannot interact with or overwrite another student's timetable.

### 3.2 Smart OCR Ingestion & Conflict Resolution

The onboarding flow handles dense, multi-column PDF schedules without breaking table boundaries.

* **AI Parsing Engine [In Development / Currently Mocked]:** Uploaded timetable images/PDFs are routed to the backend where they will eventually be processed by a multimodal LLM (e.g., GPT-4o Vision or Llama-Parse) returning a strict JSON output schema. Currently, this returns a layout-aware mock schema of raw slots to resolve collisions.
* **Collision De-duplication [Implemented]:** If a Monday 11:50 slot shows both `ECMC203 (P)` and `CSMC209 (P)`, the system cross-references the user's selected group (e.g., G2) and discards the overlapping G1 slot, assigning the correct room and faculty.
* **Global Curriculum Dictionary [Implemented]:** The backend intercepts raw OCR codes (`ECMC202`, `ECSE304`, `ICVA301`) and maps them to a centralized dictionary, rendering human-readable names (`Digital Circuits and Systems`, `Fiber Optic Communication`, `Professional Ethics`) on the user dashboard.

#### 3.2.1 Engineering Hierarchy & Mapping Logic [Implemented]

The backend filtering and parsing engine evaluates schedules using a strict hierarchical tree: **Year $\rightarrow$ Semester $\rightarrow$ Branch $\rightarrow$ Section $\rightarrow$ Subject Series $\rightarrow$ Group Sub-divisions**.

* **Second Year (Semester 3) Mapping:**
  - **Section Prefix Logic:** All sections are prefixed with the number **2** (e.g., `2CSA`, `2CSB`, `2CYA`, `2DSA`, `2ECA`).
  - **Subject Code Pattern:** Courses strictly follow the **200-series** nomenclature (e.g., `CSMC201`, `ECMC202`, `DSMC201`, `CYMC201`).
  - **Collision/Group Logic:** Practicals and tutorials are strictly divided into binary cohorts: **G1** and **G2**. The backend filter only needs to prompt the user for their G1/G2 designation to resolve slot collisions (e.g., dropping a G1 slot if the user is in G2).
* **Third Year (Semester 5) Mapping:**
  - **Section Prefix Logic:** All sections are prefixed with the number **3** (e.g., `3CSA`, `3CYA`, `3DSA`, `3ITA`, `3ECA`).
  - **Subject Code Pattern:** Courses step up to the **300-series** nomenclature (e.g., `CSSE301`, `ECMC301`, `ITSE301`, `DSMC301`).
  - **Collision/Group Logic:** Standard labs still use **G1/G2**. However, the backend must now parse and filter Program Elective blocks. The setup wizard prompts the user to select their specific elective group codes found in the timetable, such as **PE-I-A1, PE-II-B1, PE-II-A4**, etc., to correctly map their schedule and filter out the overlapping options.
* **Fourth Year (Semester 7) Mapping:**
  - **Section Prefix Logic:** All sections are prefixed with the number **4** (e.g., `4CSA`, `4ITA`, `4ECA`).
  - **Subject Code Pattern:** Subject naming conventions shift, often dropping the standard hundred-series numbering for more compact identifiers (e.g., `ITSE25`, `CSSE24`, `CSSE13`, `ITSE23`).
  - **Collision/Group Logic:** The timetable features large, multi-slot practical blocks that dominate the afternoon schedule (e.g., `CSL801 (P)` for CSE, `ITL801 (P)` for IT, and `ECL801 (P)` for ECE). The backend OCR maps these contiguous blocks to stretch across multiple time slots (e.g., spanning from 14:00 to 17:20 without interruption).

#### 3.2.2 Dynamic Setup Wizard Integration (`scheduleFilter.ts`) [Planned - Phase 2]

To implement this logic, the React frontend will dynamically adjust its Setup Wizard steps based on the user's selected semester. If a user selects "Semester 5", the UI will automatically append an "Electives Configuration" step to capture the `PE` identifiers, a step that is bypassed for Semester 3 and Semester 7 students.


### 3.3 Granular Attendance Tracking & UI Rendering

Attendance is strictly evaluated at the component level.

* **Theory/Lab Separation [Implemented]:** Subjects with both `(L)` and `(P)` components in the timetable generate two distinct `Subject` database rows (e.g. `Fiber Optic Communication` and `Fiber Optic Communication Lab`). This prevents high theory attendance from masking a lab deficit.
* **Ad-Hoc "Extra" Classes [Implemented]:** The *Today* agenda includes an unlinked "Extra" row allowing users to log attendance for unscheduled classes without modifying the master weekly timetable.
* **Contextual Absence Remarks [Planned - Phase 2]:** Marking a class as "Missed" will reveal a text-entry prompt to log the reason (e.g., "Medical Leave", "O.D. for Techfest"), preserving a historical paper trail.
* **Day Status Resolution [Implemented]:** The Calendar aggregates daily logs into a single colored dot: Green (100% attended), Red (0% attended), Purple (Mixed attendance), or Yellow (Off/No classes - including automatically marking Saturdays and Sundays).

### 3.4 Data Management & Reset States

The *Settings* panel exposes three strict reset tiers:

* **Reset Subject Attendance [Implemented]:** Wipes logs for a specific subject; keeps slots intact.
* **Reset All Attendance [Implemented]:** Wipes all historical records globally; keeps the timetable intact.
* **Reset Entire App [Implemented]:** A hard factory reset. Drops all user-linked subjects, slots, and logs to prepare for a fresh semester.

### 3.5 Peer-to-Peer Syndication (Import / Export) [Planned - Phase 2]

A localized sharing mechanism bypassing server-side OCR costs and network dependencies.

* **Export Flow:** Serializes a user's configured subjects and slots, packages them into `schedule.json`, and compresses them into a `.zip` stream.
* **Import Validation:** Extracts uploaded `.zip` files in memory, executing strict Zod schema validation to ensure data integrity before executing a Prisma bulk-insert transaction.

### 3.6 Conversational AI Assistant [Planned - Phase 3]

An integrated chat drawer acting as an academic advisor.

* **Deterministic Tool Calling:** The LLM is strictly prohibited from calculating mathematical percentages. It parses human intent and executes backend tools to fetch exact database figures.
* **Capabilities:** Users can ask predictive questions ("Can I miss AI tomorrow?"), command state changes ("Mark me absent for Fiber Optics, I was sick"), and request daily summaries.

---

## 4. Real-Time State & Predictive Mathematics

The application must never require a manual page refresh to reflect updated attendance margins.

* **State Aggregation [Implemented]:** Toggling a class to "Attended" triggers a Zustand state mutation that instantly updates the Subject Card margin, the global Top Header fraction (e.g., `84.85 | 75`), and the Calendar day status dot.
* **Predictive Margin Formula [Implemented]:** To calculate "Safe Leaves" (or required classes), the backend dynamically evaluates the target margin ($M$) against total attended classes ($A$) and total conducted classes ($T$):

$$\text{Safe Leaves} = \lfloor \frac{A - (M \times T)}{M} \rfloor$$

$$\text{Need to Attend} = \lceil \frac{(M \times T) - A}{1 - M} \rceil$$

*(Note: Target $M$ is expressed as a decimal, e.g., 0.75 for 75%).*

---

## 5. Technical Architecture

| Layer | Technology Choice | Justification |
| --- | --- | --- |
| **Frontend Core** | React + Vite + TypeScript | Lightning-fast HMR and strict type safety for complex JSON payloads. |
| **State Management** | Zustand + TanStack Query | Optimistic UI updates across unlinked components; robust API caching. |
| **Styling & UI** | Tailwind CSS + Custom CSS | Accessible, custom-designed dark-mode layout matching a premium health-tech aesthetic. |
| **Backend API** | Node.js + Express (TypeScript) | Proven REST architecture; seamless integration with file buffering (`multer`). |
| **Database & ORM** | PostgreSQL + Prisma | Relational integrity for linking users, semesters, subjects, and specific slots. |
| **PWA Delivery** | `vite-plugin-pwa` | Enables direct installation to iOS/Android home screens with offline caching. |

---

## 6. Database Schema (Prisma)

```prisma
enum UserRole {
  student
  cr
  admin
  superadmin
}

enum AttendanceStatus {
  present
  absent
  off
  cancelled
  medical
  od
}

model User {
  id               String       @id @default(uuid())
  email            String       @unique
  name             String
  passwordHash     String?      
  authProvider     String       @default("local") // "local" or "google"
  oauthId          String?      @unique           
  refreshToken     String?      
  targetAttendance Int          @default(75)
  branch           String?      
  semester         Int?         
  section          String?      
  practicalGroup   String?      // e.g., "G1" or "G2"
  electives        String[]     
  semestersData    Semester[]
  subjects         Subject[]
  attendance       Attendance[]
}

model Semester {
  id             String              @id @default(uuid())
  userId         String
  name           String              // e.g. "Semester 5 (IT)"
  startDate      DateTime            @db.Date
  endDate        DateTime            @db.Date
  isActive       Boolean             @default(false)
  user           User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  subjects       Subject[]
  timetableSlots TimetableSlot[]
  overrides      TimetableOverride[]
}

model Subject {
  id               String          @id @default(uuid())
  semesterId       String
  userId           String
  name             String          // e.g., "Digital Circuits and Systems"
  code             String?         // e.g., "ECMC202"
  type             String          // "Theory", "Practical", "Tutorial"
  colorHex         String?
  targetAttendance Int?            // Overrides global target
  semester         Semester        @relation(fields: [semesterId], references: [id], onDelete: Cascade)
  user             User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  timetableSlots   TimetableSlot[]
  attendance       Attendance[]
}

model TimetableSlot {
  id         String   @id @default(uuid())
  semesterId String
  subjectId  String
  dayOfWeek  Int      // 0=Monday … 6=Sunday
  startTime  String   // "09:00"
  endTime    String   // "10:00"
  room       String?
  subject    Subject  @relation(fields: [subjectId], references: [id], onDelete: Cascade)
}

model Attendance {
  id              String           @id @default(uuid())
  userId          String
  subjectId       String
  timetableSlotId String?          // NULL for ad-hoc "Extra" classes
  date            DateTime         @db.Date
  status          AttendanceStatus // present, absent, off, medical, od
  remark          String?          // e.g., "Medical leave"
  user            User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  subject         Subject          @relation(fields: [subjectId], references: [id], onDelete: Cascade)
}
```

---

## 7. API Route Specifications

### **Authentication (`/api/auth`)**

* `POST /register` [Implemented]: Local registration with `bcrypt` hash. Restricts email domains to `@iiitu.ac.in`.
* `POST /login` [Implemented]: Issues `HttpOnly` Refresh Token cookie and JSON Access Token. Restricts login to `@iiitu.ac.in` domain.
* `GET /google` [Planned - Phase 2]: Redirects to Google Workspace SSO.
* `POST /refresh` [Implemented]: Validates `HttpOnly` cookie to issue a new Access Token.
* `POST /logout` [Implemented]: Revokes the session and clears cookies.

### **Timetable Syndication (`/api/timetable`)**

* `GET /export` [Planned - Phase 2]: Queries active `Subjects` and `Slots`. Pipes data into `archiver` and returns an `application/zip` download stream.
* `POST /import` [Planned - Phase 2]: Intercepts `.zip` via `multer`. Extracts `schedule.json`. Validates via Zod. Wipes existing slots and bulk-inserts the new payload.

### **AI Assistant (`/api/ai`) [Planned - Phase 3]**

* `POST /chat`: Accepts user message history. Triggers LLM with registered tools (e.g., `calculateSafeLeaves(subjectId)`, `markAttendance(date, subjectId, status, remark)`). Returns Server-Sent Events (SSE) stream to the React UI.

---

## 8. Engineering Retrospective & Issues Faced

### 8.1 OCR Stacking & Elective Collisions
**The Problem:** Timetable templates stack multiple electives (e.g., ECSE303 and ECSE304) into a single visual box at the same hour. Standard text extraction often missed the second stacked course (e.g., missing the Monday 9 AM Fiber Optics class) or failed to associate it with the correct day.
**The Solution:** The backend OCR schema was refactored to parse multiple codes per slot. We modified the `processOcrImage` service layer to return both options so that the user's personal elective filter during the Setup Wizard could correctly capture and activate the right slot.

### 8.2 Active Semester and User Scoping Conflicts
**The Problem:** The system database holds records for multiple users (e.g., `dev@iiitu.ac.in` and `24247@iiitu.ac.in`). During initial test scripts and database wipes, the scripts used generic queries (`prisma.user.findFirst()`) which fetched the wrong user's semester. When the developer tried to wipe the timetable on the UI, the frontend appeared "frozen" or "stuck" because the backend wiped Naman's slots instead of the Developer's slots.
**The Solution:** Scoped all service actions strictly to the authenticated user ID (`req.user.userId`) and their specific active semester ID, ensuring isolation between users.

### 8.3 Asynchronous Code Syntax Errors & Server Crashes
**The Problem:** During rapid development, syntax errors occurred in the backend service classes (such as `semester.service.ts` expecting semicolons before `async` keywords due to esbuild compilation issues). This triggered backend server watch-loop crashes (`node:events throw er; Error: listen EADDRINUSE: address already in use :::3000`), locking up the local ports.
**The Solution:** Resolved the transform errors in the Express routes and services, and configured robust port checking and cleanup scripts (`kill-port`) to release blocked dev server ports cleanly.

---

## 9. Key Performance Indicators (KPIs)

To evaluate the operational health of AttendX, the following metrics are tracked:
* **Sync Latency:** Real-time state synchronizations (Today page toggles to TopHeader percentage update) must complete under 100ms on the client.
* **OCR Ingestion Accuracy:** 95% of parsed timetable text must map to correct subject codes in the system dictionary.
* **Debarment Warning Conversion:** Measuring daily engagement on the Subjects Page, focusing on how frequently students on the borderline (70-76% attendance) check their "Need to attend" statistics.
