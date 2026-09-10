<div align="center">
  <img src="client/public/icons.svg" alt="AttendX Logo" width="120" />
  <h1>🎓 AttendX</h1>
  <p><b>Next-Generation Academic Attendance, Timetable & Predictive Intelligence Platform</b></p>
  
  <p>
    <img src="https://img.shields.io/badge/version-3.0.0-blue.svg" alt="Version 3.0.0" />
    <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License MIT" />
    <img src="https://img.shields.io/badge/platform-Web%20%7C%20Android-lightgrey.svg" alt="Platform" />
  </p>

  <br/>
  <h3>Powered By</h3>
  <br/>
  <p>
    <img src="assets/tech/react.svg" width="40" alt="React" title="React" style="margin: 0 10px;" />
    <img src="assets/tech/nextdotjs.svg" width="40" alt="Next.js" title="Next.js" style="margin: 0 10px;" />
    <img src="assets/tech/tailwindcss.svg" width="40" alt="Tailwind CSS" title="Tailwind CSS" style="margin: 0 10px;" />
    <img src="assets/tech/nodejs.svg" width="40" alt="Node.js" title="Node.js" style="margin: 0 10px;" />
    <img src="assets/tech/postgresql.svg" width="40" alt="PostgreSQL" title="PostgreSQL" style="margin: 0 10px;" />
    <img src="assets/tech/redis.svg" width="40" alt="Redis" title="Redis" style="margin: 0 10px;" />
    <img src="assets/tech/python.svg" width="40" alt="Python" title="Python" style="margin: 0 10px;" />
    <img src="assets/tech/gemini.svg" width="40" alt="Google Gemini" title="Google Gemini Flash 3.8" style="margin: 0 10px;" />
  </p>
</div>

<br/>

## ✨ What is AttendX?

AttendX entirely eradicates the friction of university scheduling. Unlike generic calendar apps, AttendX understands the granular realities of academic life: lab groups, overlapping electives, complex holiday schedules, and predictive attendance mathematics.

## 🚀 Core Features

- **🧠 AI-Powered Timetable Extraction**: Upload a photo of your schedule, and the LangGraph orchestration pipeline invokes Gemini 3.8 Flash to intelligently generate a perfect JSON structural timetable in seconds.
- **📈 Predictive Mathematics**: Treat attendance as an optimization problem. Set a global target (e.g., 75%), and the engine calculates exactly how many consecutive classes you need to attend or how many "Safe Leaves" you can take.
- **🔄 Peer-to-Peer DataComm Synchronization**: Class Representatives (CRs) can bundle their timetable and generate an ephemeral 6-digit TTL code. Peers input the code and seamlessly merge the structural data instantly.
- **⚡ Brutalist, Anti-Slop UI**: A pristine, high-contrast brutalist design system engineered for tactile feedback and 60fps performance on low-end Android devices.
- **📱 Over-The-Air (OTA) Updates**: Bypasses traditional app store bottlenecks by streaming ZIP payloads directly to the Android WebView wrapper.

## 🛠️ Local Development Setup

To run AttendX locally, you will need **Node.js v20+**, **Python 3.11+**, **PostgreSQL**, and **Redis**.

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/nrai18/AttendX.git
cd AttendX

# Install Backend Dependencies
cd server
npm install

# Install Frontend Dependencies
cd ../client
npm install
```

### 2. Environment Configuration
Create a `.env` file in the `/server` directory and configure the following required variables:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/attendx"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your_secure_jwt_secret"
GEMINI_API_KEY="your_google_gemini_api_key"
```

### 3. Database Initialization
```bash
cd server
npx prisma db push
npx prisma db seed
```

### 4. Start the Application
Start the backend and frontend development servers concurrently:

```bash
# Terminal 1: Start Backend (Port 3000)
cd server
npm run dev

# Terminal 2: Start Frontend (Port 5173)
cd client
npm run dev
```

## 📜 License
Copyright © 2026 AttendX. Licensed under the MIT License.
