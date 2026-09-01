# Product Requirements Document (PRD) – AttendX

## 1. Executive Summary & Vision

**Product Name:** AttendX  
**Current Version:** 2.3.0  
**Target Platforms:** Progressive Web App (PWA), Desktop Web SPA, Native Android (Capacitor)  

**Vision Statement:**  
To provide the definitive academic companion for university students, blending cutting-edge AI for zero-friction onboarding with a rigorous mathematical engine for attendance prediction. AttendX replaces outdated excel sheets, manual university portals, and chaotic WhatsApp groups with a sleek, native-feeling application designed for the modern student.

---

## 2. Target Demographics & User Personas

1. **The Borderline Student (Primary):** Constantly hovers around the 75% attendance mark. Needs precise, mathematically sound predictions on exactly how many classes they can afford to miss, and exactly how many consecutive days they must attend to recover from a deficit.
2. **The Class Representative / CR (Secondary):** Manages the timetable for the entire batch. Needs the ability to quickly establish the structural timetable, parse academic calendars, and securely distribute this data to hundreds of classmates via Peer-to-Peer Sync.
3. **The High Achiever:** Maintains 90%+ attendance but utilizes the platform to track academic holidays, extra classes, and ensure their university portal aligns with their local records.

---

## 3. Problem Statement & Proposed Solution

### The Problem
* **Friction in Setup:** Existing apps require students to manually input every single subject, time slot, and room number.
* **Inaccurate Math:** Generic trackers calculate overall percentages but fail to account for the specific weight of daily schedules (e.g., missing a Tuesday with 4 classes hurts more than a Friday with 1 class).
* **Data Silos:** Timetables change frequently, and changes are communicated via messy group chats rather than updating a structured database.

### The AttendX Solution
* **AI-First Onboarding:** Users upload an image of their timetable. Google Gemini Flash 3.6 extracts, normalizes, and categorizes the data instantly.
* **Predictive Forecasting:** The engine calculates *Safe Leaves* and *Catch Up* requirements based on the user's specific global target (e.g., 75%).
* **Peer Sync:** CRs can update the schedule and broadcast a 6-digit expiring code, allowing the entire batch to mirror the changes instantly.

---

## 4. Core Epics & Feature Requirements

### Epic 1: Intelligent Onboarding & AI OCR
* **FR 1.1 - Timetable Extraction:** The system must accept Image/PDF uploads and utilize Gemini 3.6 to extract subject codes, names, start/end times, and rooms.
* **FR 1.2 - Elective Collision Resolution:** The AI must detect "stacked" slots (multiple electives running simultaneously) and present them in a Setup Wizard for the user to select their specific track.
* **FR 1.3 - Calendar Parsing:** Support for ingesting official university Academic Calendars to automatically populate holidays and exams into the Matrix Calendar.

### Epic 2: The Core Attendance Loop
* **FR 2.1 - The Today View:** Must display a chronological list of today's classes with large, touch-friendly 48px targets.
* **FR 2.2 - Tri-State Toggles:** Classes can be marked as `Attended`, `Missed`, or `Off`. Tapping an active state reverts it to `null`.
* **FR 2.3 - Ad-Hoc Modifications:** Users must be able to add "Extra Classes" or delete specific instances on a specific day without altering the structural, recurring timetable.

### Epic 3: The Predictive Forecasting Engine
* **FR 3.1 - Global Target Engine:** A centralized setting for the desired attendance percentage.
* **FR 3.2 - Safe Leaves Formula:** 
  `Safe Leaves = Floor( (Attended - (Target * Total)) / Target )`
* **FR 3.3 - Catch Up Formula:**
  `Need to Attend = Ceil( ((Target * Total) - Attended) / (1 - Target) )`
* **FR 3.4 - Scenario Simulator:** An interactive sandbox allowing users to project future statuses and see the real-time impact on their end-of-semester percentage.

### Epic 4: Peer-to-Peer Data Transfer Protocol
* **FR 4.1 - Payload Generation:** Users can pack their timetable, calendar, or attendance history into a JSON payload.
* **FR 4.2 - Ephemeral Codes:** The backend generates a cryptographically secure 6-digit code with a strict 5-minute TTL.
* **FR 4.3 - Sync Preview (2-Step Verification):** The receiver enters the code and is presented with a preview showing the sender's identity and payload scope before the data is committed.

### Epic 5: Infrastructure, Security & Themes
* **FR 5.1 - Persistent Sessions:** JWT Refresh Tokens utilizing a 30-day sliding window, stored in `HttpOnly` cookies.
* **FR 5.2 - Device Management:** A dashboard allowing users to view OS/Browser fingerprints of active sessions and revoke them.
* **FR 5.3 - Dual Theme Architecture:** Pristine Light Mode and Sleek Dark Mode driven by native CSS variables.

---

## 5. Non-Functional Requirements (NFRs)

* **Performance (NFR-1):** The UI must render optimistically. Action toggles (marking attendance) must reflect instantly (under 16ms) in the UI, with network requests resolving silently in the background.
* **Security (NFR-2):** Passwords must be hashed via `bcrypt`. All API endpoints must be protected by a strict Bearer Token auth guard.
* **Timezone Resilience (NFR-3):** All attendance logs must be keyed by an ISO Date String (`YYYY-MM-DD`) stripped of timezone data to prevent midnight boundary drift.

---

## 6. Data Architecture (Prisma Schema Deep Dive)

* **User:** Tracks credentials, global target attendance, branch, section, and avatar.
* **Semester & Subject:** Hierarchical structures holding timetable slots. Features cascading deletes to ensure data hygiene.
* **TimetableSlot:** Represents structural, recurring weekly classes (e.g., Every Monday at 9 AM).
* **Event:** Stores calendar anomalies, academic holidays, and exams.
* **Attendance:** Stores historical override logs (Attended/Missed/Off/Extra) mapped by strict ISO Dates.
* **ShareTransfer:** An ephemeral table holding encrypted payloads for Peer-to-Peer Sync, utilizing cron or Prisma middleware for TTL cleanup.

---

## 7. API Architecture & REST Specifications

### **Authentication (`/api/auth`)**
* `POST /register`: Local registration restricted to specific institution email domains.
* `POST /login`: Issues `HttpOnly` Refresh Token and JSON Access Token.
* `POST /refresh`: Validates `HttpOnly` cookie; features parallel request queueing to prevent token invalidation races.
* `GET /sessions`: Returns an array of active device sessions.

### **Timetable & AI (`/api/timetable` & `/api/ai`)**
* `POST /ocr/extract`: Pipes Multer image buffers to Gemini 3.6 Flash, returning a structured JSON payload of detected slots.
* `POST /sync/generate`: Stores a payload in `ShareTransfer` and returns a 6-digit code.
* `POST /sync/retrieve`: Returns the payload for a given 6-digit code, immediately destroying the record to prevent replay attacks.

---

## 8. Engineering Challenges & Retrospective

### 8.1 Token Rotation Race Conditions
**Problem:** Rapid page reloads caused multiple parallel requests to attempt a token refresh simultaneously. The first request rotated the token, rendering the subsequent requests unauthorized, leading to an infinite logout loop.
**Solution:** Implemented an Axios interceptor queue. When a 401 is detected, all subsequent requests are paused and pushed into a queue while a single refresh request executes. Once successful, the queue is replayed.

### 8.2 OCR Stacking & Elective Collisions
**Problem:** Timetable templates stack multiple electives (e.g., ECSE303 and ECSE304) into a single visual box at the same hour. Standard text extraction often missed the second course.
**Solution:** The backend OCR schema was refactored to parse multiple codes per slot, returning an array of options. The frontend Setup Wizard allows the user to filter down to their specific elective track before database insertion.

### 8.3 Local vs UTC Timezone Drift
**Problem:** Students logging attendance late at night (e.g., 11 PM) reported the attendance jumping to the next day due to UTC conversion on the backend.
**Solution:** Standardized the entire pipeline to strictly use local date strings (`YYYY-MM-DD`) as primary keys for the UI, completely decoupling the time-of-day from attendance mapping.

---

## 9. Future Roadmap (Phase 3 Outline)

1. **Advanced Notification Engine:** 
   - Implementation of FCM / Web Push for offline alerts.
   - Triggers for "Attendance Danger", "Class Starting in 15m", and "Holiday Tomorrow".
2. **AttendX AI (Contextual Assistant):**
   - Integration of a dedicated Floating Chatbot with strict boundaries.
   - Capable of answering specific schedule queries and executing actions (e.g., "Mark me absent for all classes today").
   - Voice Mode integration via Web Speech API or Gemini Live.
3. **UI/UX Expansion:**
   - Deeper adherence to minimalist, high-contrast design paradigms (moving away from generic "AI" aesthetics).
