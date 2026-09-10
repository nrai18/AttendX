# AttendX Product Requirements Document (PRD)

## Table of Contents
- [1. Executive Summary & Vision](#1-executive-summary--vision)
- [2. Target Demographics & User Personas](#2-target-demographics--user-personas)
- [3. Problem Statement & Proposed Solution](#3-problem-statement--proposed-solution)
- [4. Core Epics & Feature Requirements](#4-core-epics--feature-requirements)
- [5. Non-Functional Requirements (NFRs)](#5-non-functional-requirements-nfrs)
- [6. Data Architecture (Prisma Schema Deep Dive)](#6-data-architecture-prisma-schema-deep-dive)
- [7. API Architecture & REST Specifications (The Routes Folder)](#7-api-architecture--rest-specifications-the-routes-folder)
- [8. Frontend Component Architecture](#8-frontend-component-architecture)
- [9. State Management & Data Flow](#9-state-management--data-flow)
- [10. Security & Threat Model](#10-security--threat-model)
- [11. AI & Machine Learning Pipeline](#11-ai--machine-learning-pipeline)
- [12. Deployment & DevOps](#12-deployment--devops)
- [13. Future Roadmap (Phase 3 Outline)](#13-future-roadmap-phase-3-outline)
- [14. Appendices & Glossary](#14-appendices--glossary)

---

### 1. Executive Summary & Vision
**Product Name:** AttendX  
**Version:** 3.0.0  
**Vision:** AttendX is a next-generation academic companion engineered to replace antiquated excel sheets and generic calendar apps. It provides students with an intelligent, highly localized platform to track attendance, map timetables via AI OCR, and synchronize academic structural data seamlessly across peers.

### 2. Target Demographics & User Personas
- **The Student (End-User):** Needs to track exact attendance percentages to meet strict university requirements (e.g., 75% rule). Wants predictive math to know exactly how many classes they can safely skip.
- **The Class Representative (CR):** The administrative backbone of a cohort. Needs tools to generate and distribute structural weekly timetables and holiday overrides to dozens of students instantly.
- **The System Administrator:** Manages global AI quota limits (Gemini API), monitors Redis caching performance, and ensures API security.

### 3. Problem Statement & Proposed Solution
**Problem:** University students rely on fragmented systems—WhatsApp groups for timetable changes, unreliable ERPs for attendance tracking, and mental math to determine if they can safely skip a class.
**Solution:** AttendX unifies this workflow. It imports timetables automatically using AI (Gemini 3.8 Flash), calculates precise mathematical bounds for attendance forecasting, and features a Peer-to-Peer (P2P) synchronization protocol so changes made by a CR update the entire cohort instantly without overwriting personal attendance logs.

### 4. Core Epics & Feature Requirements
#### Epic 1: Timetable & Academic Configuration
- **AI OCR Import:** Parse images of timetables directly into JSON data structures.
- **Dynamic Overrides:** Users can add weekend extra classes or cancel specific lectures without breaking the structural weekly recurring schedule.

#### Epic 2: Mathematical Attendance Engine
- **Tri-State Logging:** Track Present (Green), Absent (Red), and Off (Yellow) statuses per slot.
- **Predictive Mathematics:** Algorithmically determine "Consecutive Classes Needed" and "Safe Misses Available".

#### Epic 3: Peer-to-Peer (P2P) Sync
- **TTL Code Generation:** CRs can snapshot their timetable and generate a 6-digit sync code valid for a short duration.
- **Conflict-Free Merge:** Students input the code to update their schedule. Historical attendance data remains strictly isolated.

### 5. Non-Functional Requirements (NFRs)
- **Performance:** UI rendering must maintain 60fps on low-end Android WebViews (enforced via Capacitor).
- **Latency:** Core API responses (excluding AI) must resolve in < 150ms.
- **Availability:** Ensure 99.9% uptime, with graceful fallback UI rendering if upstream AI APIs hit `429 RESOURCE_EXHAUSTED` quotas.
- **Design:** UI must strictly follow brutalist, anti-slop guidelines (solid colors, hard borders, zero glassmorphism or nested blurred shadows).

### 6. Data Architecture (Prisma Schema Deep Dive)
PostgreSQL is utilized with strict relational integrity via Prisma ORM:
- **User:** `id`, `email`, `passwordHash`, `targetAttendance`
- **Semester:** `id`, `userId`, `isActive`, `startDate`, `endDate`
- **Subject:** `id`, `semesterId`, `name`, `code`, `colorHex`
- **TimetableSlot:** `id`, `subjectId`, `dayOfWeek`, `startTime`, `endTime`, `room`
- **AttendanceRecord:** `id`, `slotId` (optional), `overrideId` (optional), `date`, `status`
- **TimetableOverride:** `id`, `semesterId`, `subjectId`, `targetDate`, `overrideType`

### 7. API Architecture & REST Specifications (The Routes Folder)
The backend avoids monolithic routing by segmenting the API into isolated modules.
- `/api/auth/` (Login, Register, Refresh, Me)
- `/api/timetable/` (Fetch, AI OCR Import, Slot Management)
- `/api/attendance/` (Stats, Log Entry, AI Insights)
- `/api/sync/` (Generate Code, Verify Code)

### 8. Frontend Component Architecture
Built on React 18, Vite, and Tailwind CSS.
- **Layouts:** Persistent shell components with floating chatbot integration.
- **Views:** Modular page components (`PredictiveAttendanceView.tsx`) utilizing `framer-motion` for snapping and brutalist CSS for mechanical aesthetics.
- **Memoization:** Extensive use of `React.memo` to prevent re-renders when global state is mutated.

### 9. State Management & Data Flow
- **Global State:** Managed via `Zustand`. The `attendanceStore` caches the structural timetable and optimistic UI mutations to guarantee zero-latency button clicks.
- **Server Cache:** `ioredis` caches heavy computations (like AI Predictive Insights) for 24 hours to preserve API quotas and minimize downstream latency.

### 10. Security & Threat Model
- **Authentication:** JWT Access Tokens combined with rotating HttpOnly Refresh Tokens stored in Redis.
- **Device Management:** Sessions are tracked via `ua-parser-js`, allowing remote revocation.
- **Rate Limiting:** Redis-backed sliding window limiters prevent brute-force attacks on P2P sync codes and AI endpoints.

### 11. AI & Machine Learning Pipeline
- **Orchestration:** LangGraph state machines manage LLM interactions.
- **Models:** Default generation via `gemini-3.8-flash`.
- **Failover Chain:** In the event of high load, automatically falls back to `gemini-3.7-flash` -> `gemini-3.1-pro-preview` -> `gemini-3.6-flash`.
- **Usage:** Employed for both Timetable structure extraction (OCR) and predictive natural language insights on missed attendance trends.

### 12. Deployment & DevOps
- **Frontend App:** Hosted as a Progressive Web App (PWA) on Vercel.
- **Backend API:** Dockerized Node.js container deployed on Render or AWS ECS.
- **Mobile Native:** Packaged using CapacitorJS. OTA (Over-the-Air) updates fetch zip payloads on boot to bypass app store delays for minor patches.

### 13. Future Roadmap (Phase 3 Outline)
- **Q1:** Introduction of cross-university global sync codes.
- **Q2:** Biometric attendance verification utilizing WebAuthn.
- **Q3:** Migration of the ML backend to a dedicated Python microservice architecture for more advanced predictive clustering.

### 14. Appendices & Glossary
- **CR:** Class Representative.
- **TTL:** Time-To-Live (used for 6-digit sync codes).
- **OTA:** Over-The-Air updates.
- **Brutalist UI:** A design paradigm strictly avoiding soft gradients, opting for stark `#000` borders and high contrast.
