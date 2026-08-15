# 🎓 AttendX

> **Next-Generation Academic Attendance, Timetable & Predictive Intelligence Platform**  
> Engineered for students, class representatives (CRs), and university administrators with a mobile-first, dark-themed native experience.

---

## 📱 About AttendX

**AttendX** eliminates manual attendance registers, messy timetable screenshots, and WhatsApp group clutter. It delivers a fast, responsive, and intelligent platform for managing university schedules, tracking attendance targets, forecasting safe absences, and automatically parsing academic timetables using AI vision.

- 🎯 **Target Platforms**: Progressive Web App (PWA), Desktop Web SPA & Android APK (via Capacitor)
- 🎨 **Design System**: Dark-mode first (`#050508`), glassmorphic styling, tailored HSL color tokens, and fluid 48px touch targets for mobile devices.
- 🏫 **Campus Ready**: Optimized for institutional workflows (IIIT Una architecture with multi-institution scalability).

---

## ✨ Core Features

### 📅 1. Action-Driven Daily Attendance & Agenda
- **Smart Status Toggles**: One-tap toggling between **Attended (`present`)**, **Missed (`absent`)**, and **Off (`cancelled`)**.
- **Void / Undo Support**: Tap the active status again to quickly void or clear any marked record back to unlogged.
- **Extra Classes on the Fly**: Add and delete ad-hoc or rescheduled lectures directly from the daily view with cascading data cleanup.
- **Real-Time Global Sync**: Changes made in Today's agenda instantly synchronize across the Calendar, Subject overviews, Predictive Engine, and Navigation badges via unified event broadcasting.

### 🤖 2. AI-Powered Timetable OCR & Setup Wizard
- **Multimodal AI Parser**: Upload timetable PDFs or screenshots; extracted via **Google Gemini 3.6 Flash** for high-precision schedule reconstruction.
- **Multi-Branch & Semester Detection**: Automatically identifies branches (e.g., *CSE, ECE, IT*) and semesters from complex university grids.
- **Interactive Setup Wizard**: Select your specific branch, batch, and electives with real-time preview before committing slots to the database.
- **Automatic Entity Creation**: Generates subjects, regular timetable slots, slot timings, and room numbers (*e.g., Room 226, Lab 5*) automatically.

### 📊 3. Predictive Attendance Engine & Scenario Simulator
- **Unified Global Target Goal**: Single source of truth for your attendance goal (e.g. `75%`, `80%`, `85%`, `90%`) synchronized across the backend database and local cache.
- **Safe Leaves Calculation**: Computes exact consecutive classes you can safely miss without dipping below your target percentage.
- **Catch-Up Calculator**: Accurate forecasting of mandatory consecutive classes required to recover from attendance deficits.
- **Interactive Future Simulator**: Simulate future attended/missed classes per subject to forecast future attendance percentages in real time.

### 🗓️ 4. Timezone-Resilient Dot-Matrix Calendar
- **Monthly Matrix View**: Visual calendar with color-coded status dots:
  - 🟢 **Attended**: All scheduled classes attended
  - 🔴 **Missed**: All scheduled classes missed
  - 🟡 **Mixed**: Partial attendance across the day's lectures
  - 🟠 **Off / Holiday**: Institute holidays, weekends, or declared off-days
  - ⚪ **Not Marked / Future**: Unmarked past classes or upcoming scheduled slots
- **Day Inspector**: Click any calendar date to inspect class-by-class attendance breakdown and override statuses.
- **UTC / Local Timezone Resilient**: Strict ISO date matching prevents discrepancies between local device time and database timestamps.

### 📚 5. Subject Management & Granular Analytics
- Complete subject breakdown with lecture count breakdowns (*Attended*, *Missed*, *Off*, *Total*).
- Color-coded visual health indicators and safety buffers for every course.
- Safe subject deletion with optional past attendance history preservation.

### 🔒 6. Data Privacy, Backup & Exports
- **CSV & JSON Data Export**: Download complete attendance audit logs with timestamps, subject codes, and status tags.
- **Account & Reset Controls**: One-click data reset or account deletion tools directly from user settings.

---

## 🛠️ Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                            │
│  React 18  •  TypeScript  •  Vite  •  Tailwind CSS          │
│  Zustand   •  Lucide Icons •  Capacitor (Android Native)    │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST / JSON (Axios)
┌──────────────────────────────▼──────────────────────────────┐
│                         BACKEND                             │
│  Node.js   •  Express.js  •  TypeScript  •  Prisma ORM      │
│  JWT Auth  •  Multer      •  Google GenAI (Gemini 3.6 Flash)│
└──────────────────────────────┬──────────────────────────────┘
                               │ PostgreSQL
┌──────────────────────────────▼──────────────────────────────┐
│                         DATABASE                            │
│  PostgreSQL (Neon Cloud / Local) with strict relational     │
│  integrity and cascading constraints                        │
└─────────────────────────────────────────────────────────────┘
```

### Frontend (`client/`)
- **Framework**: React 18 with TypeScript & Vite
- **Styling**: Vanilla CSS Variables & Tailwind CSS with dynamic dark/light themes
- **State Management**: Zustand (Auth, Attendance State, and Global Events)
- **Networking**: Axios with Bearer token injection and silent refresh handling
- **Native Runtime**: Capacitor for Android build compilation

### Backend (`server/`)
- **Runtime**: Node.js + Express (TypeScript)
- **Database & ORM**: PostgreSQL with Prisma ORM
- **AI Integration**: Google Gemini API (`gemini-3.6-flash`) for multimodal OCR schedule extraction
- **Authentication**: Hybrid JWT architecture with refresh token rotation and bcrypt password hashing
- **Security**: CORS headers, Helmet protection, and request sanitization

---

## 📂 Project Architecture

```
AttendX/
├── client/                               # Frontend Single Page Application
│   ├── public/                           # Static assets (developer photo, icons, etc.)
│   ├── src/
│   │   ├── components/
│   │   │   ├── attendance/               # PredictiveAttendanceView, Agenda cards
│   │   │   ├── layout/                   # AppShell, TopBar, Sidebar, BottomNav
│   │   │   ├── semester/                 # CreateSemesterModal
│   │   │   └── ui/                       # Reusable UI primitives
│   │   ├── lib/                          # Axios API instance & utility helpers
│   │   ├── pages/
│   │   │   ├── attendance/               # TodayPage, CalendarPage
│   │   │   ├── auth/                     # LoginPage, SignupPage
│   │   │   ├── marketing/                # LandingPage
│   │   │   ├── settings/                 # SettingsPage (Profile, Target, Exports)
│   │   │   ├── subjects/                 # SubjectsPage, SubjectDetailPage
│   │   │   └── timetable/                # TimetablePage, TimetableWizardModal
│   │   └── stores/                       # Zustand state stores (authStore, attendanceStore)
│   ├── capacitor.config.ts               # Capacitor Android configuration
│   └── vite.config.ts                    # Vite build configuration & proxy setup
│
├── server/                               # Backend Express API Server
│   ├── prisma/
│   │   └── schema.prisma                 # Relational schema (Users, Subjects, Slots, Attendance, etc.)
│   └── src/
│       ├── controllers/                  # Route handlers (Attendance, Timetable, Subjects, Users)
│       ├── middleware/                   # Auth guards & error handling
│       ├── routes/                       # Express router endpoints
│       ├── services/                     # Business logic & calculations (AttendanceService, TimetableService)
│       └── lib/                          # Prisma client initialization
│
├── AGENTS.md                             # AI Model rules & invariants
└── README.md                             # Project documentation
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20.x or later
- **npm** or **pnpm**
- **PostgreSQL**: v15.x or later (or a Neon serverless PostgreSQL instance)
- **Gemini API Key**: For AI Timetable OCR extraction features

---

### 2. Installation & Setup

#### Clone the Repository
```bash
git clone https://github.com/nrai18/AttendX.git
cd AttendX
```

#### Backend Setup
1. Navigate into `server/`:
   ```bash
   cd server
   npm install
   ```

2. Create a `.env` file in `server/`:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/attendx?schema=public"
   PORT=3000
   JWT_SECRET="your_jwt_secret_key"
   JWT_REFRESH_SECRET="your_jwt_refresh_secret_key"
   FRONTEND_URL="http://localhost:5173"
   GEMINI_API_KEY="your_google_gemini_api_key"
   ```

3. Sync database schema:
   ```bash
   npx prisma db push
   ```

4. Start the backend development server:
   ```bash
   npx tsx src/server.ts
   # or
   npm run dev
   ```

#### Frontend Setup
1. In a new terminal, navigate into `client/`:
   ```bash
   cd client
   npm install
   ```

2. Start the Vite development server:
   ```bash
   npm run dev
   ```

3. Open your browser at `http://localhost:5173`.

---

## 🔄 Global Synchronization Rules

- When the **Target Attendance Goal** is updated (via Predictive Engine or Settings), all subject calculations, threshold badges, and safe bunk indicators immediately reflect the new target without requiring manual overrides.
- All attendance actions (*mark, void, extra classes, deletes*) dispatch a client-side `attendance-updated` event that seamlessly refreshes all open views and calendars in real-time.
- Calendar date operations strictly employ UTC date key formatting (`YYYY-MM-DD`) to eliminate timezone drift on local client machines.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
