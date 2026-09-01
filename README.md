# 🎓 AttendX

> **Next-Generation Academic Attendance, Timetable & Predictive Intelligence Platform**  
> Engineered for students, class representatives (CRs), and university administrators. Delivering a fast, mobile-first native experience across Progressive Web Apps (PWA), Desktop Web, and Android.

![AttendX Version](https://img.shields.io/badge/version-2.3.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)

---

## 📱 1. Executive Summary

**AttendX** completely reimagines the academic experience by eliminating manual attendance registers, messy timetable screenshots, and cluttered WhatsApp groups. It delivers a blazing-fast, responsive platform for managing university schedules, tracking attendance targets, forecasting safe absences, securely syncing with peers, and automatically parsing academic timetables and calendars using AI vision.

Built with a modern stack featuring React 18, Node.js, and Google's Gemini Flash 3.6, AttendX is designed to scale from a single student's daily driver to an entire campus's infrastructure.

---

## ✨ 2. Deep Dive: Core Features

### 📅 Action-Driven Daily Attendance & Agenda
- **Smart Status Toggles**: A fluid, gesture-friendly interface allowing one-tap toggling between **Attended**, **Missed**, and **Off** states.
- **Void & Revert Capabilities**: Instantly undo or clear any marked record back to an unlogged state without database corruption.
- **Dynamic Extra Classes**: Seamlessly add ad-hoc, rescheduled, or weekend lectures directly from the daily view. The system handles cascading data cleanup automatically.
- **Real-Time Global Synchronization**: Every action dispatches a global `attendance-updated` event. Changes made in Today's agenda instantly and optimistically synchronize across the Calendar, Subject overviews, Predictive Engine, and Navigation badges without requiring a page reload.

### 🤖 AI-Powered Timetable & Calendar OCR
- **Multimodal AI Parser**: Users can upload timetable PDFs, raw images, or screenshots of Academic Calendars. AttendX uses **Google Gemini 3.6 Flash** for high-precision, structural data extraction.
- **Multi-Branch & Semester Intelligence**: Automatically identifies branches (e.g., *CSE, ECE, IT*), semesters, and overlapping elective blocks from complex university grid formats.
- **Holiday & Event Extraction**: Parses extensive holiday lists, mid-term schedules, and academic events directly into the Matrix Calendar.
- **Interactive Setup Wizard**: An intuitive multi-step wizard allows users to verify, edit, and select their specific electives with real-time visual previews before committing the structure to the database.

### 🔄 Secure Peer-to-Peer Sync & Data Transfer
- **Direct P2P Protocol**: Share schedule structures, holiday calendars, or full historical attendance logs with friends using cryptographically secure, ephemeral 6-digit codes.
- **Sync Previews (Two-Step Verification)**: Before importing, the receiver sees the sender's avatar, name, and the specific date range of the payload, preventing accidental data overwrites.
- **Contextual Export Types**: 
  - *Schedule Status Mirror*: Safely syncs only the structural timetable.
  - *Timetable & Calendar*: Syncs the structural timetable plus all academic events.
  - *Full Export*: Complete data transfer including historical attendance records.

### 📊 Predictive Attendance Engine & Scenario Simulator
- **Unified Global Target**: A single source of truth for your attendance goal (e.g., `75%`, `80%`, `85%`). Adjusting this immediately recalibrates all safe-leave mathematics across the app.
- **Mathematical Safe Leaves**: Computes the exact, consecutive number of classes you can safely miss without dipping below your target percentage.
- **Catch-Up Calculator**: Accurately forecasts the mandatory consecutive classes required to recover from an attendance deficit.
- **Interactive Future Simulator**: A sandbox mode where users can toggle future classes (Attended/Missed) to dynamically forecast their end-of-semester percentage in real-time.

### 🗓️ Timezone-Resilient Dot-Matrix Calendar
- **Monthly Matrix View**: A highly visual calendar utilizing color-coded status dots:
  - 🟢 **Attended**: 100% attendance for scheduled classes that day.
  - 🔴 **Missed**: 0% attendance for scheduled classes that day.
  - 🟡 **Mixed**: Partial attendance across the day's lectures.
  - 🟠 **Off / Holiday**: Institute holidays, weekends, or declared off-days.
  - ⚪ **Future**: Upcoming scheduled slots.
- **Strict UTC/Local Resilience**: Built around strict ISO date string matching (`YYYY-MM-DD`) to completely eliminate timezone drift, ensuring midnight boundary crossovers are flawless regardless of device locale.

### 📚 Subject Management & Device Security
- **Granular Analytics**: Deep-dive analytics for every subject, detailing exact lecture counts, safety buffers, and historical trends.
- **Advanced Session Management**: Users can view all active devices logged into their account (complete with OS and browser footprint) and remotely revoke rogue sessions.
- **Native OS Integration**: Features Web Share API integration allowing users to share the APK directly via WhatsApp, Telegram, or Email using native share sheets.

---

## 🛠️ 3. Technology Stack & Architecture

```text
                             FRONTEND                            
 React 18  •  TypeScript  •  Vite  •  Tailwind CSS          
 Zustand   •  Lucide Icons •  Capacitor (Android Native)    
============================================================
                               REST / JSON (Axios)
============================================================
                             BACKEND                             
 Node.js   •  Express.js  •  TypeScript  •  Prisma ORM      
 JWT Auth  •  Multer      •  Google GenAI (Gemini 3.6 Flash)
============================================================
                               PostgreSQL
============================================================
                             DATABASE                            
 PostgreSQL (Neon Cloud / Local) with strict relational     
 integrity and cascading constraints                        
```

### Frontend (`client/`)
- **Core**: React 18, TypeScript, Vite.
- **Styling**: Tailored CSS Variables & Tailwind CSS enabling a True Dual Theme (Pristine Light Mode & Sleek Dark Mode).
- **State**: Zustand for reactive global stores (Auth, Attendance, UI state).
- **Networking**: Axios interceptors handling bearer token injection and silent 30-day rolling refresh token rotation.
- **Mobile**: Capacitor runtime for generating native Android APKs.

### Backend (`server/`)
- **Core**: Node.js, Express.js, TypeScript.
- **Database**: PostgreSQL orchestrated via Prisma ORM for type-safe queries and cascading relational integrity.
- **Security**: Helmet, CORS protection, bcrypt password hashing, and HttpOnly cookie-based refresh tokens.
- **AI Integration**: Official `@google/genai` SDK interfacing with the Gemini 3.6 Flash multimodal model.

---

## 🚀 4. Local Development & Setup

### Prerequisites
- **Node.js**: v20.x or later.
- **Database**: A PostgreSQL instance (v15.x+), either local or hosted (e.g., Neon).
- **API Keys**: Google Gemini API key for OCR features.

### Installation Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/nrai18/AttendX.git
   cd AttendX
   ```

2. **Backend Setup**
   ```bash
   cd server
   npm install
   ```
   Create a `.env` file in the `server/` directory:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/attendx?schema=public"
   PORT=3000
   JWT_SECRET="your_highly_secure_jwt_secret"
   JWT_REFRESH_SECRET="your_highly_secure_refresh_secret"
   FRONTEND_URL="http://localhost:5173"
   GEMINI_API_KEY="your_google_gemini_api_key"
   ```
   Apply the Prisma schema to your database:
   ```bash
   npx prisma db push
   ```
   Start the backend development server:
   ```bash
   npm run dev
   ```

3. **Frontend Setup**
   Open a new terminal session:
   ```bash
   cd client
   npm install
   ```
   Start the Vite frontend development server:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5173`.

---

## 🔒 5. Core System Invariants & Synchronization Rules

- **Target Attendance Immutability**: When the global Target Attendance is modified, no historical data is mutated. Instead, all threshold badges, calculation engines, and predictive metrics re-evaluate dynamically on the client side.
- **Event-Driven UI**: All data mutations (Marks, Voids, Deletions) immediately emit an `attendance-updated` event, instructing all mounted React components to optimistically pull fresh data from the Zustand cache.
- **Timezone Drift Prevention**: All calendar and attendance date comparisons must strictly use the format `YYYY-MM-DD`. JavaScript `Date` objects are intercepted and normalized to prevent cross-timezone bleeding.

---

## 📄 6. License

This project is open-source and licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
