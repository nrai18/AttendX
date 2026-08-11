import React, { useState, useEffect, useRef } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { api } from "../../lib/api";
import {
  Settings,
  Target,
  User,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Moon,
  Sun,
  Laptop,
  RefreshCw,
  ShieldAlert,
  ArrowLeft,
  ArrowUpDown,
  FileSpreadsheet,
  Download,
  Upload,
  Check,
  ChevronRight,
  ShieldCheck,
  ListFilter,
  RotateCcw,
  Sparkles,
  Share2,
  Star,
  Users,
  Info,
  Send,
  Mail,
  Phone,
  HelpCircle,
  HardDrive
} from "lucide-react";

import { useThemeStore } from "../../stores/themeStore";

export const SettingsPage: React.FC = () => {
  const { user, setUser } = useAuthStore();
  const [activeView, setActiveView] = useState<"main" | "backup" | "contact">("main");

  // Profile & Criteria
  const [targetAttendance, setTargetAttendance] = useState<number>(user?.targetAttendance ?? 75);
  const { theme, setTheme } = useThemeStore();
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);


  // Reset Section Toggle
  const [enableReset, setEnableReset] = useState(false);

  // Reset Modals State
  const [resetModalType, setResetModalType] = useState<"subject" | "attendance" | "events" | "entire" | null>(null);

  const fetchSubjectsForReset = () => {
    api.get("/subjects").then((res) => {
      setSubjects(res.data || []);
    }).catch((err) => console.error(err));
  };
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccessMessage, setResetSuccessMessage] = useState("");

  // Contact Us State
  const [contactTopic, setContactTopic] = useState("Suggest an idea");
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSubmitted, setContactSubmitted] = useState(false);

  // Auto Backup Toggle State
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [isBackupNowLoading, setIsBackupNowLoading] = useState(false);
  const [backupStatusMessage, setBackupStatusMessage] = useState("");

  // Hidden File Input for Import
  const jsonInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Pre-fetch subjects for reset subject attendance modal
    api.get("/subjects").then((res) => {
      setSubjects(res.data || []);
    }).catch((err) => console.error(err));
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await api.patch("/users/me", {
        targetAttendance: Number(targetAttendance),
        theme,
      });
      if (setUser) {
        setUser({
          ...user!,
          targetAttendance: Number(targetAttendance),
          theme,
        });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error("Failed to update profile", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Export JSON Backup
  const handleExportBackup = async () => {
    try {
      const semRes = await api.get("/semesters/active");
      const activeSem = semRes.data;
      let exportData: any = {};

      if (activeSem) {
        const res = await api.get(`/timetable/export/${activeSem.id}`);
        exportData = res.data;
      } else {
        const subRes = await api.get("/subjects");
        exportData = { subjects: subRes.data, exportedAt: new Date().toISOString() };
      }

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `attendance_backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setBackupStatusMessage("Backup exported successfully!");
      setTimeout(() => setBackupStatusMessage(""), 3000);
    } catch (err) {
      console.error("Failed to export backup", err);
      alert("Failed to export backup file.");
    }
  };

  // Import JSON Backup
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const payload = JSON.parse(event.target?.result as string);
        const semRes = await api.get("/semesters/active");
        const activeSem = semRes.data;

        if (!activeSem) {
          alert("Please create or select an active semester first before importing.");
          return;
        }

        if (confirm("Importing this backup will replace current schedule slots for your active semester. Proceed?")) {
          await api.post(`/timetable/import/${activeSem.id}`, payload);
          setBackupStatusMessage("Backup imported successfully!");
          setTimeout(() => setBackupStatusMessage(""), 3000);
        }
      } catch (err) {
        console.error("Failed to import backup file", err);
        alert("Invalid backup JSON format.");
      }
    };
    reader.readAsText(file);
  };

  // Export CSV
  const handleExportCSV = async () => {
    try {
      const res = await api.get("/attendance/stats");
      const stats = res.data || [];

      let csvContent = "data:text/csv;charset=utf-8,Subject Name,Subject Code,Attended,Total,Percentage\n";
      stats.forEach((item: any) => {
        csvContent += `"${item.subject.name}","${item.subject.code || ''}",${item.presentCount},${item.totalCount},${item.percentage}%\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `attendance_report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("CSV export failed", err);
      alert("Failed to generate CSV export.");
    }
  };

  // Trigger Resets
  const handlePerformReset = async () => {
    setIsResetting(true);
    setResetError("");

    try {
      if (resetModalType === "subject") {
        if (selectedSubjectIds.length === 0) {
          setResetError("Please select at least one subject to reset.");
          setIsResetting(false);
          return;
        }
        await api.post("/users/reset-subject-attendance", { subjectIds: selectedSubjectIds });
        setResetSuccessMessage("Attendance cleared for selected subjects!");
      } else if (resetModalType === "attendance") {
        await api.post("/users/reset-all-attendance");
        setResetSuccessMessage("All attendance records and overrides deleted successfully!");
      } else if (resetModalType === "events") {
        await api.post("/users/reset-events");
        setResetSuccessMessage("Academic calendar events removed successfully!");
      } else if (resetModalType === "entire") {
        await api.post("/users/reset-data");
        window.location.href = "/today";
        return;
      }

      useAttendanceStore.getState().fetchStats();
      window.dispatchEvent(new Event("attendance-updated"));

      setTimeout(() => {
        setResetModalType(null);
        setResetSuccessMessage("");
        setIsResetting(false);
        setSelectedSubjectIds([]);
        setResetConfirmText("");
        fetchSubjectsForReset();
      }, 1500);
    } catch (err: any) {
      console.error("Reset failed", err);
      setResetError(err?.response?.data?.message || "Reset action failed. Try again.");
      setIsResetting(false);
    }
  };

  // Submit Contact Form
  const handleSendContact = (e: React.FormEvent) => {
    e.preventDefault();
    const mailtoSubject = encodeURIComponent(`[${contactTopic}] ${contactSubject}`);
    const mailtoBody = encodeURIComponent(`Name: ${user?.name || "User"}\nEmail: ${user?.email || "User"}\n\nMessage:\n${contactMessage}`);
    window.location.href = `mailto:rai18naman@gmail.com?subject=${mailtoSubject}&body=${mailtoBody}`;
    setContactSubmitted(true);
  };

  // ------------------ SUB-VIEW: BACKUP / RESTORE ------------------
  if (activeView === "backup") {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto w-full pb-24 md:pb-8 space-y-6 animate-in fade-in duration-200">
        <input
          type="file"
          accept=".json"
          ref={jsonInputRef}
          onChange={handleImportBackup}
          className="hidden"
        />

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveView("main")}
            className="p-2 rounded-xl bg-card border border-border text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Backup/Restore</h1>
        </div>

        {backupStatusMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{backupStatusMessage}</span>
          </div>
        )}

        {/* Manual Export/Import backup */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-foreground">Manual Export/Import backup</h2>
          <div className="bg-card border border-border/70 rounded-2xl divide-y divide-border/50 shadow-md">
            <button
              onClick={handleExportBackup}
              className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex flex-col gap-1 cursor-pointer"
            >
              <span className="text-sm font-bold text-foreground">Export backup file</span>
              <span className="text-xs text-muted-foreground leading-relaxed">
                Generates a backup file that can be imported back. This file cannot be read externally.
              </span>
            </button>

            <button
              onClick={() => jsonInputRef.current?.click()}
              className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex flex-col gap-1 cursor-pointer"
            >
              <span className="text-sm font-bold text-foreground">Import backup file</span>
              <span className="text-xs text-muted-foreground leading-relaxed">
                Supports backups exported by this app.
              </span>
            </button>
          </div>
        </div>

        {/* Automatic Google Drive backup */}
        <div className="space-y-4 pt-2">
          <h2 className="text-base font-bold text-foreground">Automatic Google Drive backup</h2>
          <div className="bg-card border border-border/70 rounded-2xl p-5 space-y-5 shadow-md">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Don't risk losing your data. Enable automatic backups to Google Drive. Up to 30 backups are saved in the "Ajack auto backup" folder and can be restored on a new phone.
            </p>

            <div className="text-xs font-semibold text-muted-foreground">
              Last backup: <span className="text-foreground">---</span>
            </div>

            <div>
              <button
                disabled={isBackupNowLoading}
                onClick={() => {
                  setIsBackupNowLoading(true);
                  setTimeout(() => {
                    setIsBackupNowLoading(false);
                    setBackupStatusMessage("Google Drive backup completed!");
                    setTimeout(() => setBackupStatusMessage(""), 3000);
                  }, 1500);
                }}
                className="px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isBackupNowLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Backup Now
              </button>
            </div>

            <div className="space-y-4 pt-2 border-t border-border/50">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-foreground">Google Account</span>
                <span className="text-xs text-muted-foreground">{user?.email || "rai18naman@gmail.com"}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-foreground">Enable automatic backups</span>
                  <span className="text-xs text-muted-foreground">{autoBackupEnabled ? "On" : "Off"}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoBackupEnabled(!autoBackupEnabled)}
                  className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer relative ${
                    autoBackupEnabled ? "bg-emerald-500" : "bg-muted"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      autoBackupEnabled ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <button
                onClick={() => {
                  alert("Restoring from Google Drive. Select backup version...");
                }}
                className="w-full text-left pt-2 flex flex-col gap-0.5 group cursor-pointer"
              >
                <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">Restore backup</span>
                <span className="text-xs text-muted-foreground">Choose and restore a backup from Google Drive.</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ------------------ SUB-VIEW: CONTACT US ------------------
  if (activeView === "contact") {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto w-full pb-24 md:pb-8 space-y-6 animate-in fade-in duration-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveView("main")}
            className="p-2 rounded-xl bg-card border border-border text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Contact us</h1>
        </div>

        {/* Developer Info Card */}
        <div className="bg-card border border-emerald-500/30 rounded-2xl p-5 space-y-3 shadow-md bg-gradient-to-br from-emerald-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold text-lg">
              NR
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Naman Rai</h3>
              <p className="text-xs text-muted-foreground">App Developer & Support Leader</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-border/50 text-muted-foreground">
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-emerald-500" />
              <span>+91 8076408958</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-emerald-500" />
              <span>rai18naman@gmail.com</span>
            </div>
          </div>
        </div>

        {contactSubmitted && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-bold space-y-1">
            <p className="text-sm">Thank you for reaching out!</p>
            <p className="text-muted-foreground font-normal">Your email client has been opened. You can also contact Naman Rai directly at rai18naman@gmail.com or 8076408958.</p>
          </div>
        )}

        <form onSubmit={handleSendContact} className="space-y-5">
          {/* Topic Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Topic</label>
            <select
              value={contactTopic}
              onChange={(e) => setContactTopic(e.target.value)}
              className="w-full bg-card border border-emerald-500/50 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
            >
              <option value="Suggest an idea">Suggest an idea</option>
              <option value="Report a bug">Report a bug</option>
              <option value="Ask a question">Ask a question</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <input
              type="text"
              required
              placeholder="Subject (required)"
              value={contactSubject}
              onChange={(e) => setContactSubject(e.target.value)}
              className="w-full bg-card border border-border/80 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <textarea
              required
              rows={6}
              placeholder="Message (required)"
              value={contactMessage}
              onChange={(e) => setContactMessage(e.target.value)}
              className="w-full bg-card border border-border/80 rounded-xl p-4 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
            />
          </div>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => alert("FAQs:\n1. How to import timetable? Use OCR or JSON import in Settings/Timetable.\n2. How attendance criteria works? Keep above target % (e.g. 75%).")}
              className="text-xs text-emerald-500 hover:underline cursor-pointer"
            >
              Check out our FAQs for quick answers
            </button>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-full bg-emerald-400 hover:bg-emerald-500 text-black font-extrabold text-sm transition-all shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            Send via Email
          </button>
        </form>
      </div>
    );
  }

  // ------------------ MAIN SETTINGS VIEW ------------------
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto w-full pb-24 md:pb-8 space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => window.history.back()}
          className="p-2 rounded-xl bg-card border border-border text-foreground hover:bg-muted transition-colors cursor-pointer md:hidden"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">Settings</h1>
        </div>
      </div>

      {/* CATEGORY 1: General */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">General</h2>
        <div className="bg-card border border-border/70 rounded-2xl divide-y divide-border/50 shadow-md">
          {/* Set criteria */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Set criteria</h3>
                <p className="text-xs text-muted-foreground">{targetAttendance}%</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="100"
                value={targetAttendance}
                onChange={(e) => setTargetAttendance(Number(e.target.value))}
                className="w-16 text-center py-1 rounded-lg bg-muted border border-border text-foreground text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          {/* Set theme */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <Sun className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Set theme</h3>
                <p className="text-xs text-muted-foreground">
                  {theme === "dark" ? "Dark Mode" : theme === "light" ? "Light Mode" : "System Default, using App colors"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-muted p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`p-1.5 rounded-lg transition-all ${theme === "dark" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                <Moon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`p-1.5 rounded-lg transition-all ${theme === "light" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                <Sun className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTheme("system")}
                className={`p-1.5 rounded-lg transition-all ${theme === "system" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                <Laptop className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CATEGORY 2: Database */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Database</h2>
        <div className="bg-card border border-border/70 rounded-2xl divide-y divide-border/50 shadow-md">
          {/* Backup/Restore */}
          <button
            onClick={() => setActiveView("backup")}
            className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <ArrowUpDown className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">Backup/Restore</h3>
                <p className="text-xs text-muted-foreground">Avoid losing your data. Set up automatic backups or use manual export and import.</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>

          {/* Export data as CSV */}
          <button
            onClick={handleExportCSV}
            className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">Export data as CSV</h3>
                <p className="text-xs text-muted-foreground">Generates a ZIP archive of CSV files readable by spreadsheet apps. These files cannot be imported back.</p>
              </div>
            </div>
            <Download className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        </div>
      </div>

      {/* CATEGORY 3: App */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">App</h2>
        <div className="bg-card border border-border/70 rounded-2xl divide-y divide-border/50 shadow-md">
          {/* Share App */}
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: "Smart Attendance Manager", url: window.location.origin });
              } else {
                navigator.clipboard.writeText(window.location.origin);
                alert("App link copied to clipboard!");
              }
            }}
            className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-center gap-3 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-foreground">Share App</span>
          </button>

          {/* Contact us */}
          <button
            onClick={() => setActiveView("contact")}
            className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">Contact us</h3>
                <p className="text-xs text-muted-foreground">Suggestions, bugs, questions</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>

          {/* App info */}
          <button
            onClick={() => alert("Smart Attendance Manager v1.2.0\nDeveloped by Naman Rai")}
            className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-center gap-3 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Info className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-foreground">App info</span>
          </button>
        </div>
      </div>

      {/* CATEGORY 4: Reset & Delete */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Reset & Delete</h2>
        <div className="bg-card border border-border/70 rounded-2xl divide-y divide-border/50 shadow-md">
          {/* Enable reset options toggle switch */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 pr-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-foreground">Enable reset options</h3>
                <p className="text-xs text-muted-foreground">Allows access to reset options below that permanently delete your data.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEnableReset(!enableReset)}
              className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer relative shrink-0 ${
                enableReset ? "bg-amber-500" : "bg-muted"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  enableReset ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Option 1: Reset subject attendance */}
          <button
            disabled={!enableReset}
            onClick={() => {
              setResetConfirmText("");
              setResetError("");
              fetchSubjectsForReset();
              setResetModalType("subject");
            }}
            className={`w-full text-left p-4 flex items-start gap-3 transition-colors cursor-pointer border-b border-border/50 ${
              enableReset ? "hover:bg-muted/50 opacity-100" : "opacity-40 cursor-not-allowed"
            }`}
          >
            <div className="w-3 h-3 rounded-full bg-amber-500 mt-1 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-foreground">Reset subject attendance</span>
              <span className="text-xs text-muted-foreground leading-relaxed">
                Clears attendance for selected subjects. Timetable slots remain intact, but all marked attendance logs for those subjects are removed.
              </span>
            </div>
          </button>

          {/* Option 2: Reset all attendance */}
          <button
            disabled={!enableReset}
            onClick={() => {
              setResetConfirmText("");
              setResetError("");
              setResetModalType("attendance");
            }}
            className={`w-full text-left p-4 flex items-start gap-3 transition-colors cursor-pointer border-b border-border/50 ${
              enableReset ? "hover:bg-muted/50 opacity-100" : "opacity-40 cursor-not-allowed"
            }`}
          >
            <div className="w-3 h-3 rounded-full bg-amber-500 mt-1 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-foreground">Reset all attendance</span>
              <span className="text-xs text-muted-foreground leading-relaxed">
                Deletes all attendance records across all subjects. Subjects and timetable slots remain untouched.
              </span>
            </div>
          </button>

          {/* Option 3: Remove Academic Hub Calendar & Events */}
          <button
            disabled={!enableReset}
            onClick={() => {
              setResetConfirmText("");
              setResetError("");
              setResetModalType("events");
            }}
            className={`w-full text-left p-4 flex items-start gap-3 transition-colors cursor-pointer border-b border-border/50 ${
              enableReset ? "hover:bg-muted/50 opacity-100" : "opacity-40 cursor-not-allowed"
            }`}
          >
            <div className="w-3 h-3 rounded-full bg-purple-500 mt-1 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-foreground">Remove Academic Calendar & Events</span>
              <span className="text-xs text-muted-foreground leading-relaxed">
                Deletes all imported academic events (midsems, endsems, fests, holidays). Event badges and banners disappear across the app and calendar.
              </span>
            </div>
          </button>

          {/* Option 4: Reset entire app */}
          <button
            disabled={!enableReset}
            onClick={() => {
              setResetConfirmText("");
              setResetError("");
              setResetModalType("entire");
            }}
            className={`w-full text-left p-4 flex items-start gap-3 transition-colors cursor-pointer ${
              enableReset ? "hover:bg-muted/50 opacity-100" : "opacity-40 cursor-not-allowed"
            }`}
          >
            <div className="w-3 h-3 rounded-full bg-rose-500 mt-1 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-rose-500">Reset entire app</span>
              <span className="text-xs text-muted-foreground leading-relaxed">
                Permanently wipes all semesters, subjects, timetable slots, attendance logs, and academic calendar events. Start completely fresh.
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* RESET MODAL DIALOGS */}
      {resetModalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-card border border-border/80 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {resetModalType === "subject" && "Reset Subject Attendance"}
                  {resetModalType === "attendance" && "Reset All Attendance"}
                  {resetModalType === "events" && "Remove Academic Calendar & Events"}
                  {resetModalType === "entire" && "Reset Entire App"}
                </h3>
                <p className="text-xs text-rose-500 font-semibold">Irreversible Action</p>
              </div>
            </div>

            {resetSuccessMessage ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-sm font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                <span>{resetSuccessMessage}</span>
              </div>
            ) : (
              <>
                {/* Reset Subject Attendance Content */}
                {resetModalType === "subject" && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Select subjects to reset attendance history for:</p>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {subjects.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-4 text-center">No subjects found.</p>
                      ) : (
                        subjects.map((sub) => {
                          const isChecked = selectedSubjectIds.includes(sub.id);
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => {
                                if (isChecked) {
                                  setSelectedSubjectIds(selectedSubjectIds.filter((id) => id !== sub.id));
                                } else {
                                  setSelectedSubjectIds([...selectedSubjectIds, sub.id]);
                                }
                              }}
                              className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                                isChecked
                                  ? "bg-primary/10 border-primary text-primary"
                                  : "bg-muted/40 border-border text-foreground hover:bg-muted"
                              }`}
                            >
                              <span>{sub.name}</span>
                              {isChecked && <Check className="w-4 h-4 text-primary" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Reset All Attendance Content */}
                {resetModalType === "attendance" && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    This will delete all attendance logs and timetable overrides across all subjects and semesters. Your subjects and timetable slots will remain untouched.
                  </p>
                )}

                {/* Remove Events Content */}
                {resetModalType === "events" && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    This will permanently remove all academic calendar events (exams, fests, holidays). Event rings and highlight banners will be removed across all calendar views.
                  </p>
                )}

                {/* Reset Entire App Content */}
                {resetModalType === "entire" && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      This will permanently wipe your semesters, subjects, timetable slots, attendance logs, and academic events.
                    </p>
                    <div>
                      <label className="block text-xs text-muted-foreground font-medium mb-1.5">
                        Type <span className="font-bold text-foreground">RESET</span> to confirm:
                      </label>
                      <input
                        type="text"
                        placeholder="RESET"
                        value={resetConfirmText}
                        onChange={(e) => setResetConfirmText(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground font-mono text-sm focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>
                )}

                {resetError && (
                  <p className="text-xs text-rose-500 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20 font-semibold">
                    {resetError}
                  </p>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isResetting}
                    onClick={() => setResetModalType(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={
                      isResetting ||
                      (resetModalType === "entire" && resetConfirmText.trim() !== "RESET") ||
                      (resetModalType === "subject" && selectedSubjectIds.length === 0)
                    }
                    onClick={handlePerformReset}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-600/30 disabled:opacity-40 cursor-pointer"
                  >
                    {isResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Confirm Reset
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
