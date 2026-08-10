# 🎓 AttendX

> An intelligent, mobile-first academic attendance and timetable productivity platform designed for students, class representatives (CRs), and administrators.

---

## 📱 About AttendX

AttendX replaces manual attendance registers, scattered timetable screenshots, and WhatsApp group chaos with a single dark-themed native experience. It helps students track their lecture attendance, calculate safe leaves, simulate future scenarios, and sync class schedules automatically.

- 🎯 **Target**: Android APK (via Capacitor) & Desktop Web SPA
- 🎨 **Design System**: Dark-mode first (`#050508`), glassmorphic UI, custom HSL color tokens, and 48px touch targets for mobile.
- 🏫 **Institution Target**: IIIT Una (scalable multi-institution architecture).

---

## ✨ Features Breakdown

| Feature | Description |
|---------|-------------|
| 📅 **Action-Driven Today View** | Auto-filters to show only classes requiring action today with quick-marking toggles (*Clear / Off / Miss / Att*). |
| 📊 **Predictive Attendance Engine** | Real-time calculation of current %, **Safe Leaves** (how many classes you can skip), and **Classes Needed** to maintain your 75% target. |
| 🗓️ **Dot-Matrix Calendar** | Monthly calendar view showing attendance history. Saturdays and Sundays are defaulted to "Off". |
| 📍 **Room Number Sync** | View class locations (e.g. *Room 226*, *Lab 5*) for every slot on your daily timetable. |
| 👥 **Classroom Multiplayer** | CRs create classrooms; students join via 6-digit codes or QR codes for automatic timetable syncing. |
| 🔔 **Notification Tray Actions** | Zero-click attendance marking right from push notifications when a lecture slot ends. |
| 🤖 **AI Assistant & OCR** | AI query interface and image-to-timetable OCR parser for academic calendars and schedule PDFs. |

---

## 🛠️ Tech Stack

### Frontend (`client/`)
- **Core**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 + `shadcn/ui` + CSS Variables
- **State Management**: Zustand
- **API Client**: Axios with automatic Bearer token injection and silent HTTP-only refresh interceptors
- **Mobile Native**: Capacitor (Android APK, Status Bar, Haptics, Push Notifications)

### Backend (`server/`)
- **Runtime**: Node.js + Express + TypeScript
- **ORM & Database**: Prisma 5 + PostgreSQL 15
- **Authentication**: Hybrid JWT (In-memory Access Token + `httpOnly` Refresh Cookie with Rotation) & bcrypt
- **Security**: Helmet, CORS, Rate Limiting (`express-rate-limit`)

---

## 📂 Project Structure

```
AttendX/
├── client/                     # Vite + React + TypeScript + Capacitor
│   ├── src/
│   │   ├── components/         # Layout (AppShell, BottomNav, Sidebar, TopBar) & UI
│   │   ├── hooks/              # Custom hooks (useSilentRefresh, etc.)
│   │   ├── lib/                # Axios API client & utility functions
│   │   ├── pages/              # App routes (LoginPage, SignupPage, Today, Timetable, etc.)
│   │   └── stores/             # Zustand auth state store
│   ├── capacitor.config.ts     # Android Capacitor configuration
│   └── vite.config.ts          # Vite build config with path aliases
│
├── server/                     # Express REST API
│   ├── prisma/
│   │   └── schema.prisma       # Canonical PostgreSQL database schema
│   ├── src/
│   │   ├── controllers/        # Express route controllers
│   │   ├── middleware/         # Auth guard & validation middleware
│   │   ├── routes/             # API routes (/api/auth, /api/users)
│   │   ├── services/           # Core business logic (AuthService, UserService)
│   │   └── utils/              # JWT & cookie utilities
│   └── .env                    # Local environment variables (ignored in git)
│
├── README.md                   # Project documentation
└── .gitignore                  # Global git ignore configuration
```

---

## 🚀 Getting Started Locally

### Prerequisites
- Node.js (v20 or higher)
- PostgreSQL (v15 or higher)

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/nrai18/AttendX.git
   cd AttendX
   ```

2. **Configure Backend Environment**
   Navigate to `server/` and create `.env`:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/attendx?schema=public"
   PORT=3000
   JWT_SECRET="your_jwt_access_secret"
   JWT_REFRESH_SECRET="your_jwt_refresh_secret"
   FRONTEND_URL="http://localhost:5173"
   ```

3. **Install Dependencies**
   ```bash
   # Install server packages
   cd server
   npm install

   # Install client packages
   cd ../client
   npm install
   ```

4. **Run Database Migrations**
   ```bash
   cd ../server
   npx prisma db push
   ```

5. **Start Development Servers**
   ```bash
   # In terminal 1 (Server)
   cd server
   npm run dev

   # In terminal 2 (Client)
   cd client
   npm run dev
   ```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
