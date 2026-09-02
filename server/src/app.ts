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
import eventRoutes from "./routes/event.routes";
import dataRoutes from "./routes/data.routes";
import documentRoutes from "./routes/document.routes";
import transferRoutes from "./routes/transfer.routes";
import supportRoutes from "./routes/support.routes";
import systemRoutes from "./routes/system.routes";
import assignmentRoutes from "./routes/assignment.routes";
import { CURRICULUM_META } from "./utils/subjectDictionary";

import passport from "./config/passport";

const app = express();
app.set("trust proxy", 1); // Trust Render's reverse proxy for correct https redirects

// Security & Utility Middleware
app.use(passport.initialize());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());
app.use(morgan("dev"));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

// Prevent aggressive browser caching of JSON responses
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// Registered Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/semesters", semesterRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/timetable", timetableRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/classrooms", classroomRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/data", dataRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/transfer", transferRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/assignments", assignmentRoutes);

// Public: curriculum metadata — branches & semesters derived from actual curriculum
// No auth required; used by the timetable import wizard on the client
app.get("/api/curriculum/meta", (_req, res) => {
  res.status(200).json(CURRICULUM_META);
});

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok", message: "AttendX API is running" });
});

// Error Handling Middleware for API
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  if (req.path.startsWith("/api")) {
    return res.status(err.status || 500).json({
      message: err.message || "Internal Server Error",
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }
  next(err);
});

export async function startServer() {
  console.log("startServer() invoked...");
  const PORT = 3000;

  if (process.env.NODE_ENV !== "production") {
    console.log("Skipping Vite middleware in dev since we run a separate client dev server.");
  } else {
    // tsup bundles to server/dist/server.js so:
    //   __dirname = /opt/render/project/src/server/dist
    //   ../../    = /opt/render/project/src
    //   ../../client/dist = /opt/render/project/src/client/dist  ✓
    const distPath = path.resolve(__dirname, "../../client/dist");
    app.use(express.static(distPath));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  console.log("Calling app.listen...");
  const server = app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`🚀 Server ready at: http://0.0.0.0:${PORT}`);
  });
  server.timeout = 300000; // 5 minutes
}

export default app;
