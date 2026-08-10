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
- **Node.js**: v20.x or higher
- **PostgreSQL**: v15.x or higher (installed locally or hosted)

### Setup Instructions

Follow these steps to spin up the local development environment:

#### 1. Clone the Repository
```bash
git clone https://github.com/nrai18/AttendX.git
cd AttendX
```

#### 2. Install Project Dependencies
You need to install packages in both the backend and frontend directories:
```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

#### 3. Environment Variables Configuration
Create a `.env` file inside the `server/` directory:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/attendx?schema=public"
PORT=3000
JWT_SECRET="your_jwt_access_secret"
JWT_REFRESH_SECRET="your_jwt_refresh_secret"
FRONTEND_URL="http://localhost:5173"
```
*(Make sure to replace database credentials and secrets with your local values).*

#### 4. Prepare Database Schemas & Seed
Push the Prisma schemas to your active PostgreSQL instance:
```bash
cd ../server
npx prisma db push
```
To run database viewing tools, you can spin up Prisma Studio:
```bash
npx prisma studio
```

#### 5. Start Development Servers
Both the client and server must run concurrently for full functionality:

* **Backend API Server (Starts on Port 3000):**
  ```bash
  cd server
  npm run dev
  ```

* **Frontend Client (Starts on Port 5173):**
  ```bash
  cd client
  npm run dev
  ```

Access the application in your browser at `http://localhost:5173`. Authentication is mapped strictly to `@iiitu.ac.in` domains. For local testing, you can use the register flow or seed mock databases.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
