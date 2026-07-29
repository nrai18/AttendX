import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import "express-async-errors";
import rateLimit from "express-rate-limit";
import path from "path";

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import semesterRoutes from "./routes/semester.routes";
import subjectRoutes from "./routes/subject.routes";
import timetableRoutes from "./routes/timetable.routes";
import attendanceRoutes from "./routes/attendance.routes";
import classroomRoutes from "./routes/classroom.routes";

import passport from "./config/passport";

const app = express();

// Security & Utility Middleware
app.use(passport.initialize());
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

// Registered Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/semesters", semesterRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/timetable", timetableRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/classrooms", classroomRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "AttendX API is running" });
});

// Root endpoint for Render health checks and browser testing
app.get("/", (req, res) => {
  res.status(200).json({ message: "AttendX API is running smoothly!" });
});

// Error Handling Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

export default app;
