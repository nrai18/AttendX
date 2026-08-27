import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { useAuthStore } from "../../stores/authStore";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Stepper } from "../../components/ui/stepper";
import { RunActionButton } from "../../components/ui/run-action-button";
import { SaveToggle } from "../../components/ui/save-toggle";
import { TimedUndoAction } from "../../components/ui/timed-undo-action";
import { EditProfile, ProfileData } from "../../components/ui/edit-profile";
import { LinkedDevicesModal } from "../../components/ui/linked-devices";
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
  HardDrive,
  X,
  FileText,
  Calendar,
  FileArchive,
  History,
} from "lucide-react";

import { useThemeStore } from "../../stores/themeStore";
import {
  FrequencySelector,
  type FrequencyData,
} from "../../components/ui/frequency-selector";
import { PeerSyncModal } from "../../components/sync/PeerSyncModal";
import { FeedbackModal } from "../../components/support/FeedbackModal";
import { ChangelogModal } from "../../components/settings/ChangelogModal";
import { NotificationService } from "../../services/NotificationService";

export const SettingsPage: React.FC = () => {
const renderDocuments = (type: string) => {
    // For backups, only show the most recent one (index 0 because it's sorted desc by createdAt on backend)
    let docs = storedDocuments.filter((d: any) => d.type === type);
    if (type === "BACKUP" && docs.length > 0) {
      docs = [docs[0]];
    }
    
    if (docs.length === 0) return null;
    return (
      <div className="flex flex-col gap-2 w-full mt-3">
        {docs.map((doc: any) => (
          <div
            key={doc.id}
            className="flex items-center justify-between bg-muted/30 p-2 rounded-lg border border-border"
          >
            <span className="text-xs font-medium truncate max-w-[200px] text-foreground">
              {doc.name}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  try {
                    const res = await api.get(`/documents/${doc.id}/download`, { responseType: 'blob' });
                    const url = window.URL.createObjectURL(new Blob([res.data]));
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', doc.name);
                    document.body.appendChild(link);
                    link.click();
                    link.parentNode?.removeChild(link);
                  } catch (e) {
                    console.error(e);
                    toast.error("Failed to download document.");
                  }
                }}
                className="text-xs flex items-center gap-1 text-primary hover:underline cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </button>
              <button
                onClick={() => {
                  toast("Delete Document", {
                    description: "Are you sure you want to delete this document?",
                    action: {
                      label: "Delete",
                      onClick: async () => {
                        try {
                          await api.delete(`/documents/${doc.id}`);
                          const { data } = await api.get("/documents");
                          setStoredDocuments(data);
                          toast.success("Document deleted");
                        } catch (e) {
                          console.error(e);
                          toast.error("Failed to delete document.");
                        }
                      }
                    },
                    cancel: { label: "Cancel", onClick: () => {} }
                  });
                }}
                className="text-xs flex items-center gap-1 text-rose-500 hover:text-rose-600 hover:underline cursor-pointer ml-2"
              >
                <X className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };
  const { user, setUser } = useAuthStore();
  const [activeView, setActiveView] = useState<"main" | "backup" | "contact" | "sync">(
    "main",
  );

  // Profile & Criteria
  const [targetAttendance, setTargetAttendance] = useState<number | string>(
    user?.targetAttendance ?? 75,
  );
  const { theme, setTheme } = useThemeStore();
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // App Info Modal State
  const [showAppInfoModal, setShowAppInfoModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isLinkedDevicesOpen, setIsLinkedDevicesOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Stored Documents State
  const [storedDocuments, setStoredDocuments] = useState<any[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("action") === "edit-profile") {
      setIsEditProfileOpen(true);
      // Clean up the URL
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const { data } = await api.get("/documents");
        setStoredDocuments(data);
      } catch (err) {
        console.error("Failed to fetch documents", err);
      }
    };
    fetchDocs();
  }, []);

  // Frequency Selector State (Demo / UI)
  const [classReminderTime, setClassReminderTime] = useState("5");
  const [notifyHoliday, setNotifyHoliday] = useState(true);
  const [notifyEvent, setNotifyEvent] = useState(true);
  const [notifyBirthday, setNotifyBirthday] = useState(true);
  const [dndEnabled, setDndEnabled] = useState(true);

  const [reminderFrequency, setReminderFrequency] = useState<FrequencyData>({
    type: "Weekly",
    subValue: "Mon",
  });

  // Reset Section Toggle
  const [enableReset, setEnableReset] = useState(false);

  // Reset Modals State
  const [resetModalType, setResetModalType] = useState<
    "subject" | "attendance" | "timetable" | "events" | "entire" | null
  >(null);

  const fetchSubjectsForReset = () => {
    api
      .get("/subjects")
      .then((res) => {
        setSubjects(res.data || []);
      })
      .catch((err) => console.error(err));
  };
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState("");

  // Contact Us State
  const [contactTopic, setContactTopic] = useState("Suggest an idea");
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSubmitted, setContactSubmitted] = useState(false);

  // Auto Backup Toggle State
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [isBackupNowLoading, setIsBackupNowLoading] = useState(false);
  const [backupStatusMessage, setBackupStatusMessage] = useState("");
  const [isImportingCSV, setIsImportingCSV] = useState(false);

  // Hidden File Input for Import
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Pre-fetch subjects for reset subject attendance modal
    api
      .get("/subjects")
      .then((res) => {
        setSubjects(res.data || []);
      })
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    if (
      user?.targetAttendance !== undefined &&
      user?.targetAttendance !== null
    ) {
      setTargetAttendance(user.targetAttendance);
    }
  }, [user?.targetAttendance]);

  const handleEditProfileSubmit = async (data: ProfileData, passwordData?: any) => {
    setIsSavingProfile(true);
    try {
      const payload: any = {
        name: data.fullName,
        gender: data.gender === 'unspecified' ? null : data.gender,
        birthday: data.birthday ? `${data.birthday}T00:00:00.000Z` : null,
        avatarUrl: data.avatarUrl,
      };
      
      if (passwordData && passwordData.newPassword) {
        payload.newPassword = passwordData.newPassword;
        if (passwordData.oldPassword) {
          payload.oldPassword = passwordData.oldPassword;
        }
      }

      await api.patch("/users/me", payload);
      
      if (setUser) {
        setUser({
          ...user!,
          name: data.fullName,
          gender: payload.gender,
          birthday: payload.birthday,
          avatarUrl: payload.avatarUrl,
          hasPassword: user?.hasPassword || !!passwordData?.newPassword
        });
      }
      
      toast.success("Profile updated successfully!");
      setIsEditProfileOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveProfile = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    const numericTarget = Math.min(
      100,
      Math.max(1, Number(targetAttendance) || 75),
    );

    try {
      await api.patch("/users/me", {
        targetAttendance: numericTarget,
        theme,
      });
      if (setUser) {
        setUser({
          ...user!,
          targetAttendance: numericTarget,
          theme,
        });
      }
      setTargetAttendance(numericTarget);
      useAttendanceStore.getState().fetchStats();
      window.dispatchEvent(new CustomEvent("attendance-updated"));
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
        exportData = {
          subjects: subRes.data,
          exportedAt: new Date().toISOString(),
        };
      }

      const fileName = `attendance_backup_${new Date().toISOString().slice(0, 10)}.json`;
      const jsonString = JSON.stringify(exportData, null, 2);

      if (Capacitor.isNativePlatform()) {
        try {
          const base64Content = btoa(unescape(encodeURIComponent(jsonString)));
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: base64Content,
            directory: Directory.Cache,
          });
          await Share.share({
            title: fileName,
            url: savedFile.uri,
          });
          setBackupStatusMessage("Backup exported successfully!");
          setTimeout(() => setBackupStatusMessage(""), 3000);
        } catch (e) {
          console.error("Filesystem save error:", e);
          toast.error("Failed to save JSON to device.");
        }
      } else {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonString);
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", fileName);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        setBackupStatusMessage("Backup exported successfully!");
        setTimeout(() => setBackupStatusMessage(""), 3000);
      }
    } catch (err) {
      console.error("Failed to export backup", err);
      toast.error("Failed to export backup file.");
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
          toast.error("Please create or select an active semester first before importing.");
          return;
        }

        toast("Import Backup", {
          description: "Importing this backup will replace current schedule slots for your active semester. Proceed?",
          action: {
            label: "Import",
            onClick: async () => {
              try {
                await api.post(`/timetable/import/${activeSem.id}`, payload);
                toast.success("Backup imported successfully!");
              } catch (err) {
                console.error(err);
                toast.error("Failed to import backup.");
              }
            }
          },
          cancel: { label: "Cancel", onClick: () => {} }
        });
      } catch (err) {
        console.error(err);
        toast.error("Invalid backup JSON format.");
      }
    };
    reader.readAsText(file);
  };

  // Export CSV
  const handleExportCSV = async () => {
    try {
      const res = await api.get("/data/export", { responseType: "blob" });
      
      let filename = `AttendX_Backup_${new Date().toISOString().slice(0, 10)}.zip`;
      const disposition = res.headers["content-disposition"];
      if (disposition && disposition.indexOf("filename=") !== -1) {
        const matches = /filename="([^"]+)"/.exec(disposition);
        if (matches != null && matches[1]) filename = matches[1];
      }

      const blob = new Blob([res.data], { type: "application/zip" });
      
      if (Capacitor.isNativePlatform()) {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const base64Content = base64data.split(',')[1];
          try {
            const savedFile = await Filesystem.writeFile({
              path: filename,
              data: base64Content,
              directory: Directory.Cache,
            });
            await Share.share({
              title: filename,
              url: savedFile.uri,
            });
          } catch (e: any) {
            // Capacitor throws an error if the user dismisses the share sheet
            const errorMsg = e?.message?.toLowerCase() || "";
            if (!errorMsg.includes("cancel") && !errorMsg.includes("dismiss")) {
              console.error("Filesystem save/share error:", e);
              toast.error("Failed to share file.");
            }
          }
        };
      } else {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
} catch (err) {
      console.error("CSV/ZIP export failed", err);
      toast.error("Failed to generate ZIP export.");
    } finally {
      // Refresh documents after export
      try {
        const { data } = await api.get("/documents");
        setStoredDocuments(data);
      } catch (e) {}
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const formData = new FormData();
    formData.append("file", file);

    const toastId = toast.loading("Uploading ZIP to ML Server...");
    setIsImportingCSV(true);

    try {
      const mlApiUrl = import.meta.env.VITE_ML_API_URL || "http://localhost:8000";

      const res = await fetch(`${mlApiUrl}/upload/zip?user_id=${user.id}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to upload ZIP");
      }

      const data = await res.json();
      const taskId = data.task_id;

      // Connect to WebSocket for progress
      const wsUrl = mlApiUrl.replace(/^http/, "ws");
      const ws = new WebSocket(`${wsUrl}/ws/progress/${taskId}`);

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        toast.loading(`Importing: ${msg.status} (${msg.progress}%)`, {
          id: toastId,
        });

        if (msg.progress === 100 || msg.status.includes("Error")) {
          ws.close();
          if (msg.progress === 100) {
            toast.success("Data imported successfully! Redirecting...", {
              id: toastId,
            });
            setTimeout(() => (window.location.href = "/timetable"), 1500);
          } else {
            toast.error(msg.status, { id: toastId });
            setIsImportingCSV(false);
          }
        }
      };

      ws.onerror = () => {
        toast.error(
          "Lost connection to progress tracker, but import may still be running.",
          { id: toastId },
        );
        setIsImportingCSV(false);
      };
    } catch (err: any) {
      console.error("Failed to import ZIP", err);
      toast.error(err.message || "Failed to import ZIP file.", { id: toastId });
      setIsImportingCSV(false);
    } finally {
      if (e.target) e.target.value = "";
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
        await api.post("/users/reset-subject-attendance", {
          subjectIds: selectedSubjectIds,
        });
        toast.success("Attendance cleared for selected subjects!");
      } else if (resetModalType === "attendance") {
        await api.post("/users/reset-all-attendance");
        toast.success(
          "All attendance records and overrides deleted successfully!",
        );
      } else if (resetModalType === "timetable") {
        await api.post("/users/reset-timetable");
        toast.success("Timetable schedule slots cleared successfully!");
      } else if (resetModalType === "events") {
        await api.post("/users/reset-events");
        toast.success("Academic calendar events removed successfully!");
      } else if (resetModalType === "entire") {
        await api.post("/users/reset-data");
        toast.success("App data reset successfully! Reloading...");
        setTimeout(() => {
          window.location.href = "/today";
        }, 1500);
        return;
      }

      useAttendanceStore.getState().fetchStats();
      window.dispatchEvent(new Event("attendance-updated"));

      setResetModalType(null);
      setIsResetting(false);
      setSelectedSubjectIds([]);
      setResetConfirmText("");
      fetchSubjectsForReset();
    } catch (err: any) {
      console.error("Reset failed", err);
      setResetError(
        err?.response?.data?.message || "Reset action failed. Try again.",
      );
      setIsResetting(false);
    }
  };

  // Submit Contact Form
  const handleSendContact = (e: React.FormEvent) => {
    e.preventDefault();
    const mailtoSubject = encodeURIComponent(
      `[${contactTopic}] ${contactSubject}`,
    );
    const mailtoBody = encodeURIComponent(
      `Name: ${user?.name || "User"}\nEmail: ${user?.email || "User"}\n\nMessage:\n${contactMessage}`,
    );
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&to=24247@iiitu.ac.in,rai18naman@gmail.com&su=${mailtoSubject}&body=${mailtoBody}`,
      "_blank",
    );
    setContactSubmitted(true);
  };

  // ------------------ SUB-VIEW: BACKUP / RESTORE ------------------
  if (activeView === "sync") {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto w-full pb-36 md:pb-8 space-y-6 animate-in fade-in duration-200">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setActiveView("main")}
            className="p-2 rounded-xl bg-card border border-border text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
            Peer Sync
          </h1>
        </div>
        
        <PeerSyncModal />
      </div>
    );
  }

  if (activeView === "backup") {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto w-full pb-36 md:pb-8 space-y-6 animate-in fade-in duration-200">
        <input
          type="file"
          accept=".json"
          ref={jsonInputRef}
          onChange={handleImportBackup}
          className="hidden"
        />
        <input
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed,multipart/x-zip"
          ref={csvInputRef}
          onChange={handleImportCSV}
          className="hidden"
        />

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveView("main")}
            className="p-2 rounded-xl bg-card border border-border text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
            Backup/Restore
          </h1>
        </div>

        {backupStatusMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{backupStatusMessage}</span>
          </div>
        )}

        {/* Manual Export/Import backup */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-foreground">
            Manual Export/Import backup
          </h2>
          <div className="bg-card border border-border/70 rounded-2xl divide-y divide-border/50 shadow-md">
            <button
              onClick={handleExportBackup}
              className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex flex-col gap-1 cursor-pointer"
            >
              <span className="text-sm font-bold text-foreground">
                Export backup file
              </span>
              <span className="text-xs text-muted-foreground leading-relaxed">
                Generates a backup file that can be imported back. This file
                cannot be read externally.
              </span>
            </button>

            <button
              onClick={() => jsonInputRef.current?.click()}
              className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex flex-col gap-1 cursor-pointer"
            >
              <span className="text-sm font-bold text-foreground">
                Import backup file
              </span>
              <span className="text-xs text-muted-foreground leading-relaxed">
                Supports backups exported by this app.
              </span>
            </button>
          </div>
        </div>

        {/* Automatic Google Drive backup */}
        <div className="space-y-4 pt-2">
          <h2 className="text-base font-bold text-foreground">
            Automatic Google Drive backup
          </h2>
          <div className="bg-card border border-border/70 rounded-2xl p-5 space-y-5 shadow-md">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Don't risk losing your data. Enable automatic backups to Google
              Drive. Up to 30 backups are saved in the "Ajack auto backup"
              folder and can be restored on a new phone.
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
                {isBackupNowLoading && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                Backup Now
              </button>
            </div>

            <div className="space-y-4 pt-2 border-t border-border/50">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-foreground">
                  Google Account
                </span>
                <span className="text-xs text-muted-foreground">
                  {user?.email || "rai18naman@gmail.com"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-foreground">
                    Enable automatic backups
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {autoBackupEnabled ? "On" : "Off"}
                  </span>
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
                  toast.info("Restoring from Google Drive. Select backup version...");
                }}
                className="w-full text-left pt-2 flex flex-col gap-0.5 group cursor-pointer"
              >
                <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                  Restore backup
                </span>
                <span className="text-xs text-muted-foreground">
                  Choose and restore a backup from Google Drive.
                </span>
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
      <div className="p-4 md:p-8 max-w-2xl mx-auto w-full pb-36 md:pb-8 space-y-6 animate-in fade-in duration-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveView("main")}
            className="p-2 rounded-xl bg-card border border-border text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
            Contact us
          </h1>
        </div>

        {/* Developer Info Card */}
        <div className="bg-card border border-emerald-500/30 rounded-2xl p-5 space-y-3 shadow-md bg-gradient-to-br from-emerald-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <img
              src="/developer-photo.jpg"
              alt="Naman Rai"
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500/40 shadow-sm shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                if (e.currentTarget.nextElementSibling) {
                  (
                    e.currentTarget.nextElementSibling as HTMLElement
                  ).style.display = "flex";
                }
              }}
            />
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-500 items-center justify-center font-bold text-lg hidden shrink-0">
              NR
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Naman Rai</h3>
              <p className="text-xs text-muted-foreground">
                App Developer & IIITU Student
              </p>
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
            <p className="text-muted-foreground font-normal">
              Your email client has been opened. You can also contact Naman Rai
              directly at rai18naman@gmail.com or 8076408958.
            </p>
          </div>
        )}

        <form onSubmit={handleSendContact} className="space-y-5">
          {/* Topic Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
              Topic
            </label>
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
              
              value={contactMessage}
              onChange={(e) => setContactMessage(e.target.value)}
              className="w-full bg-card border border-border/80 rounded-xl p-4 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
            />
          </div>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() =>
                toast.info("FAQs:\n1. How to import timetable? Use OCR or JSON import in Settings/Timetable.\n2. How attendance criteria works? Keep above target % (e.g. 75%).")
              }
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
    <div className="p-4 md:p-8 max-w-3xl mx-auto w-full pb-36 md:pb-8 space-y-8 animate-in fade-in duration-200">
      <input
        type="file"
        accept=".zip"
        ref={csvInputRef}
        onChange={handleImportCSV}
        className="hidden"
      />
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => window.history.back()}
          className="p-2 rounded-xl bg-card border border-border text-foreground hover:bg-muted transition-colors cursor-pointer md:hidden"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
            Settings
          </h1>
        </div>
      </div>
      {/* CATEGORY 0: Account */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
          Account
        </h2>
        <div className="bg-card border border-border/70 rounded-2xl shadow-md overflow-hidden">
          <button 
            onClick={() => setIsEditProfileOpen(true)}
            className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-muted border-2 border-border/50 shadow-sm shrink-0">
                <img 
                  src={user?.avatarUrl || (user?.gender === 'female' ? 'https://api.dicebear.com/7.x/notionists/svg?seed=female&gender=female' : user?.gender === 'male' ? 'https://api.dicebear.com/7.x/notionists/svg?seed=male&gender=male' : 'https://api.dicebear.com/7.x/notionists/svg?seed=user')} 
                  alt="Avatar" 
                  className="w-full h-full object-cover" 
                />
              </div>
              <div className="text-left">
                <h3 className="text-base font-extrabold text-foreground">{user?.name || "User"}</h3>
                <p className="text-xs text-muted-foreground font-medium">{user?.email}</p>
              </div>
            </div>
            <div className="bg-primary/10 text-primary p-2 rounded-full">
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
          <div className="h-px bg-border/50" />
          <button 
            onClick={() => setIsLinkedDevicesOpen(true)}
            className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/10 p-2.5 rounded-xl text-emerald-500 shrink-0">
                <Laptop className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="text-sm font-semibold text-foreground block">
                  Linked Devices
                </span>
                <span className="text-xs text-muted-foreground block mt-0.5">
                  Manage active sessions
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <EditProfile 
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        isLoading={isSavingProfile}
        initialData={{
          fullName: user?.name || "",
          email: user?.email || "",
          gender: user?.gender || "unspecified",
          birthday: user?.birthday ? user.birthday.split('T')[0] : "",
          avatarUrl: user?.avatarUrl || "",
          hasPassword: user?.hasPassword
        }}
        onSave={handleEditProfileSubmit}
      />
      {/* CATEGORY 1: General */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
          General
        </h2>
        <div className="bg-card border border-border/70 rounded-2xl divide-y divide-border/50 shadow-md">
          {/* Set criteria */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Set criteria
                </h3>
                <p className="text-xs text-muted-foreground">
                  {targetAttendance !== "" &&
                  targetAttendance !== null &&
                  targetAttendance !== undefined
                    ? `${targetAttendance}%`
                    : "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Stepper
                size="sm"
                min={1}
                max={100}
                value={Number(targetAttendance) || 75}
                onChange={setTargetAttendance}
              />
              <span className="text-xs font-semibold text-foreground">%</span>
              <SaveToggle onClick={handleSaveProfile} size="sm" />
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
                  {theme === "dark"
                    ? "Dark Mode"
                    : theme === "light"
                      ? "Light Mode"
                      : "System Default, using App colors"}
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

      {/* CATEGORY 2: Notifications & Reminders */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
          Notifications & Reminders
        </h2>
        <div className="bg-card border border-border/70 rounded-2xl p-4 shadow-md space-y-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Reminder Frequency
            </h3>
            <p className="text-xs text-muted-foreground">
              Select how often you want to receive academic updates.
            </p>
          </div>
          <div className="w-full flex items-center justify-center bg-transparent transition-colors duration-500">
            <FrequencySelector
              value={reminderFrequency}
              onChange={setReminderFrequency}
            />
          </div>

          <hr className="border-border/50" />
          <div className="pt-2 flex flex-col gap-2">
            <div className="flex gap-2">
              <button onClick={() => NotificationService.scheduleClassReminder("Data Structures", new Date(Date.now() + 60000), "Room 304")} className="flex-1 py-2 bg-primary/20 text-primary text-xs font-bold rounded-xl hover:bg-primary/30 transition-colors">Test Class Reminder</button>
              <button onClick={() => NotificationService.triggerPinnedClassMute("Operating Systems", new Date(Date.now() + 60000))} className="flex-1 py-2 bg-amber-500/20 text-amber-500 text-xs font-bold rounded-xl hover:bg-amber-500/30 transition-colors">Test DND Active</button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => NotificationService.scheduleHolidayNotification("Diwali", new Date())} className="flex-1 py-2 bg-emerald-500/20 text-emerald-500 text-xs font-bold rounded-xl hover:bg-emerald-500/30 transition-colors">Test Holiday</button>
              <button onClick={() => NotificationService.scheduleBirthdayNotification("Naman", new Date())} className="flex-1 py-2 bg-pink-500/20 text-pink-500 text-xs font-bold rounded-xl hover:bg-pink-500/30 transition-colors">Test Birthday</button>
            </div>
          </div>
        </div>
      </div>

      {/* CATEGORY 3: Data Management */}
          <div className="space-y-3">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
          Data Management
        </h2>
        <div className="bg-card border border-border/70 rounded-2xl divide-y divide-border/50 shadow-md">
          {/* Export data to ZIP */}
          <div className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  Export data to ZIP
                </h3>
                <p className="text-xs text-muted-foreground">
                  Downloads a ZIP archive of CSV files with your entire semester
                  data.
                </p>
              </div>
            </div>
            <RunActionButton
              action={handleExportCSV}
              idleLabel="Export ZIP"
              doneLabel="Saved"
              idleIcon={
                <Download className="w-4 h-4 text-primary-foreground opacity-90" />
              }
              widths={{ idle: 160, running: 280, done: 140 }}
              steps={[
                { id: 1, label: "Gathering Records", icon: FileSpreadsheet },
                { id: 2, label: "Compressing", icon: FileArchive },
                { id: 3, label: "Downloading", icon: Download },
              ]}
            />
          </div>

          {/* Import data from ZIP */}
          <div className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  Import data from ZIP
                </h3>
                <p className="text-xs text-muted-foreground">
                  Restores an exported ZIP file.{" "}
                  <span className="text-rose-500 font-bold">
                    WARNING: Replaces current semester.
                  </span>
                </p>
              </div>
            </div>
            <RunActionButton
              action={async () => csvInputRef.current?.click()}
              disabled={isImportingCSV}
              idleLabel="Import ZIP"
              doneLabel="Ready"
              idleIcon={
                <Upload className="w-4 h-4 text-primary-foreground opacity-90" />
              }
              widths={{ idle: 160, running: 280, done: 140 }}
              steps={[{ id: 1, label: "Awaiting File", icon: Upload }]}
            />
          </div>

          {/* Peer Sync */}
          <button
            onClick={() => setActiveView("sync")}
            className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  Peer Sync
                </h3>
                <p className="text-xs text-muted-foreground">
                  Transfer schedule securely via 6-digit code.
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        </div>
      </div>

      {/* CATEGORY 4: Stored Documents */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
          Stored Documents
        </h2>
        <div className="bg-card border border-border/70 rounded-2xl divide-y divide-border/50 shadow-md">
          <div className="p-4 flex flex-col">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Timetable Documents
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    PDFs and images uploaded for schedule AI extraction.
                  </p>
                </div>
              </div>
              {storedDocuments.filter((d) => d.type === "TIMETABLE").length ===
                0 && (
                <span className="text-xs font-bold bg-muted text-muted-foreground px-2 py-1 rounded-md">
                  Empty
                </span>
              )}
            </div>
            {renderDocuments("TIMETABLE")}
          </div>

          <div className="p-4 flex flex-col">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Academic Calendars
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    PDFs uploaded for semester event AI extraction.
                  </p>
                </div>
              </div>
              {storedDocuments.filter((d) => d.type === "CALENDAR").length ===
                0 && (
                <span className="text-xs font-bold bg-muted text-muted-foreground px-2 py-1 rounded-md">
                  Empty
                </span>
              )}
            </div>
            {renderDocuments("CALENDAR")}
          </div>

          <div className="p-4 flex flex-col">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <FileArchive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Data Backups
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    ZIP files containing exported semester CSV data.
                  </p>
                </div>
              </div>
              {storedDocuments.filter((d) => d.type === "BACKUP").length ===
                0 && (
                <span className="text-xs font-bold bg-muted text-muted-foreground px-2 py-1 rounded-md">
                  Empty
                </span>
              )}
            </div>
            {renderDocuments("BACKUP")}
          </div>
        </div>
      </div>

      {/* CATEGORY 5: App */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
          App
        </h2>
        <div className="bg-card border border-border/70 rounded-2xl divide-y divide-border/50 shadow-md">
          {/* Share App */}
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: "Smart Attendance Manager",
                  url: window.location.origin,
                });
              } else {
                navigator.clipboard.writeText(window.location.origin);
                toast.success("App link copied to clipboard!");
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
                <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  Contact us
                </h3>
                <p className="text-xs text-muted-foreground">
                  Suggestions, bugs, questions
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>

          {/* App info */}
          <button
            onClick={() => setShowAppInfoModal(true)}
            className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-center justify-between gap-3 cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  App info
                </h3>
                <p className="text-xs text-muted-foreground">
                  Version v1.3.4 & Developer details
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>

          {/* Install APK */}
          <a
            href="/AttendX.apk"
            download
            className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-center justify-between gap-3 cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 group-hover:scale-105 transition-transform flex items-center justify-center bg-card">
                <img src="/attendx_logo.png" alt="AttendX Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  Install AttendX
                </h3>
                <p className="text-xs text-muted-foreground">
                  Download the latest APK for Android
                </p>
              </div>
            </div>
            <Download className="w-4 h-4 text-muted-foreground shrink-0" />
          </a>
        </div>
      </div>

            {/* CATEGORY: Support */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
          Support
        </h2>
        <div className="bg-card border border-border/70 rounded-2xl divide-y divide-border/50 shadow-md">
          <div onClick={() => setIsFeedbackOpen(true)} className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-center justify-between cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  Send feedback
                </h3>
                <p className="text-xs text-muted-foreground">
                  Report an issue or suggest improvements.
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
          </div>
          <div onClick={() => setIsChangelogOpen(true)} className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-center justify-between cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground group-hover:text-purple-500 transition-colors">
                  Update History
                </h3>
                <p className="text-xs text-muted-foreground">
                  View changelogs and past release notes.
                </p>
              </div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-muted-foreground"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>
      </div>

      {/* CATEGORY 4: Reset & Delete */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
          Reset & Delete
        </h2>
        <div className="bg-card border border-border/70 rounded-2xl divide-y divide-border/50 shadow-md">
          {/* Enable reset options toggle switch */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 pr-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Enable reset options
                </h3>
                <p className="text-xs text-muted-foreground">
                  Allows access to reset options below that permanently delete
                  your data.
                </p>
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
              enableReset
                ? "hover:bg-muted/50 opacity-100"
                : "opacity-40 cursor-not-allowed"
            }`}
          >
            <div className="w-3 h-3 rounded-full bg-amber-500 mt-1 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-foreground">
                Reset subject attendance
              </span>
              <span className="text-xs text-muted-foreground leading-relaxed">
                Clears attendance for selected subjects. Timetable slots remain
                intact, but all marked attendance logs for those subjects are
                removed.
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
              enableReset
                ? "hover:bg-muted/50 opacity-100"
                : "opacity-40 cursor-not-allowed"
            }`}
          >
            <div className="w-3 h-3 rounded-full bg-amber-500 mt-1 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-foreground">
                Reset all attendance
              </span>
              <span className="text-xs text-muted-foreground leading-relaxed">
                Deletes all attendance records across all subjects. Subjects and
                timetable slots remain untouched.
              </span>
            </div>
          </button>

          {/* Option 3: Clear Timetable Schedule */}
          <button
            disabled={!enableReset}
            onClick={() => {
              setResetConfirmText("");
              setResetError("");
              setResetModalType("timetable");
            }}
            className={`w-full text-left p-4 flex items-start gap-3 transition-colors cursor-pointer border-b border-border/50 ${
              enableReset
                ? "hover:bg-muted/50 opacity-100"
                : "opacity-40 cursor-not-allowed"
            }`}
          >
            <div className="w-3 h-3 rounded-full bg-blue-500 mt-1 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-foreground">
                Clear timetable schedule
              </span>
              <span className="text-xs text-muted-foreground leading-relaxed">
                Removes all weekly scheduled class slots and overrides across
                your active semester. Attendance logs and subjects will be
                safely preserved.
              </span>
            </div>
          </button>

          {/* Option 4: Remove Semester Overview Calendar & Events */}
          <button
            disabled={!enableReset}
            onClick={() => {
              setResetConfirmText("");
              setResetError("");
              setResetModalType("events");
            }}
            className={`w-full text-left p-4 flex items-start gap-3 transition-colors cursor-pointer border-b border-border/50 ${
              enableReset
                ? "hover:bg-muted/50 opacity-100"
                : "opacity-40 cursor-not-allowed"
            }`}
          >
            <div className="w-3 h-3 rounded-full bg-purple-500 mt-1 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-foreground">
                Remove Academic Calendar & Events
              </span>
              <span className="text-xs text-muted-foreground leading-relaxed">
                Deletes all imported academic events (midsems, endsems, fests,
                holidays). Event badges and banners disappear across the app and
                calendar.
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
              enableReset
                ? "hover:bg-muted/50 opacity-100"
                : "opacity-40 cursor-not-allowed"
            }`}
          >
            <div className="w-3 h-3 rounded-full bg-rose-500 mt-1 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-rose-500">
                Reset entire app
              </span>
              <span className="text-xs text-muted-foreground leading-relaxed">
                Permanently wipes all semesters, subjects, timetable slots,
                attendance logs, and academic calendar events. Start completely
                fresh.
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
                  {resetModalType === "timetable" && "Clear Timetable Schedule"}
                  {resetModalType === "events" &&
                    "Remove Academic Calendar & Events"}
                  {resetModalType === "entire" && "Reset Entire App"}
                </h3>
                <p className="text-xs text-rose-500 font-semibold">
                  Irreversible Action
                </p>
              </div>
            </div>

            <>
              {/* Reset Subject Attendance Content */}
              {resetModalType === "subject" && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Select subjects to reset attendance history for:
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {subjects.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">
                        No subjects found.
                      </p>
                    ) : (
                      subjects.map((sub) => {
                        const isChecked = selectedSubjectIds.includes(sub.id);
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => {
                              if (isChecked) {
                                setSelectedSubjectIds(
                                  selectedSubjectIds.filter(
                                    (id) => id !== sub.id,
                                  ),
                                );
                              } else {
                                setSelectedSubjectIds([
                                  ...selectedSubjectIds,
                                  sub.id,
                                ]);
                              }
                            }}
                            className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                              isChecked
                                ? "bg-primary/10 border-primary text-primary"
                                : "bg-muted/40 border-border text-foreground hover:bg-muted"
                            }`}
                          >
                            <span>{sub.name}</span>
                            {isChecked && (
                              <Check className="w-4 h-4 text-primary" />
                            )}
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
                  This will delete all attendance logs and timetable overrides
                  across all subjects and semesters. Your subjects and timetable
                  slots will remain untouched.
                </p>
              )}

              {/* Clear Timetable Schedule Content */}
              {resetModalType === "timetable" && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This will clear all weekly schedule slots and overrides from
                  your active timetable. Your subject records and past
                  attendance history will remain safely intact.
                </p>
              )}

              {/* Remove Events Content */}
              {resetModalType === "events" && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This will permanently remove all academic calendar events
                  (exams, fests, holidays). Event rings and highlight banners
                  will be removed across all calendar views.
                </p>
              )}

              {/* Reset Entire App Content */}
              {resetModalType === "entire" && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    This will permanently wipe your semesters, subjects,
                    timetable slots, attendance logs, and academic events.
                  </p>
                  <div>
                    <label className="block text-xs text-muted-foreground font-medium mb-1.5">
                      Type{" "}
                      <span className="font-bold text-foreground">RESET</span>{" "}
                      to confirm:
                    </label>
                    <input
                      type="text"
                      
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
                  <TimedUndoAction
                    initialSeconds={5}
                    deleteLabel="Confirm Reset"
                    undoLabel="Cancel Reset"
                    icon={<Trash2 className="w-4 h-4 mr-1 inline-block" />}
                    onConfirm={async () => {
                      await handlePerformReset();
                    }}
                    disabled={
                      isResetting ||
                      (resetModalType === "entire" &&
                        resetConfirmText.trim() !== "RESET") ||
                      (resetModalType === "subject" &&
                        selectedSubjectIds.length === 0)
                    }
                  />
              </div>
            </>
          </div>
        </div>
      )}
      {/* App Info Modal */}
      {showAppInfoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6 relative overflow-hidden">
            <button
              onClick={() => setShowAppInfoModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4 border-b border-border/50 pb-5">
              <img
                src="/attendx_logo.png"
                alt="AttendX Logo"
                className="w-14 h-14 rounded-2xl object-cover shadow-lg shadow-primary/25 shrink-0 bg-white"
              />
              <div>
                <h2 className="text-xl font-extrabold text-foreground tracking-tight">
                  AttendX
                </h2>
                <p className="text-xs font-semibold text-primary">
                  Smart Attendance Manager • v1.3.4
                </p>
                <p className="text-xs text-muted-foreground">
                  Built for IIITU Ecosystem
                </p>
              </div>
            </div>

            {/* Creator Profile */}
            <div className="bg-muted/40 border border-border/60 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src="/developer-photo.jpg"
                  alt="Naman Rai"
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-full object-cover border-2 border-primary shadow-md shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    if (e.currentTarget.nextElementSibling) {
                      (
                        e.currentTarget.nextElementSibling as HTMLElement
                      ).style.display = "flex";
                    }
                  }}
                />
                <div className="w-14 h-14 rounded-full bg-primary/20 text-primary font-bold text-xl items-center justify-center hidden shrink-0">
                  NR
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Naman Rai
                  </h3>
                  <p className="text-xs font-medium text-primary">
                    Founder & Developer
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Student at IIITU
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                AttendX was developed to eliminate manual attendance
                calculations, criteria tracking anxiety, and timetable
                fragmentation for college students.
              </p>
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40 text-xs">
                <a
                  href="https://mail.google.com/mail/?view=cm&fs=1&to=24247@iiitu.ac.in,rai18naman@gmail.com"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background border border-border text-foreground hover:bg-muted transition-colors font-medium"
                >
                  <Mail className="w-3.5 h-3.5 text-primary" />
                  <span>rai18naman@gmail.com</span>
                </a>
                <a
                  href="tel:+918076408958"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background border border-border text-foreground hover:bg-muted transition-colors font-medium"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-500" />
                  <span>+91 8076408958</span>
                </a>
              </div>
            </div>

            {/* Key Features */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-foreground text-xs uppercase tracking-wider">
                Key Capabilities
              </h4>
              <ul className="grid grid-cols-2 gap-2 text-muted-foreground font-medium">
                <li className="flex items-center gap-1.5 bg-card p-2 rounded-xl border border-border/40">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Dynamic Criteria Target
                </li>
                <li className="flex items-center gap-1.5 bg-card p-2 rounded-xl border border-border/40">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Forecast Leave Calc
                </li>
                <li className="flex items-center gap-1.5 bg-card p-2 rounded-xl border border-border/40">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  OCR Timetable Importer
                </li>
                <li className="flex items-center gap-1.5 bg-card p-2 rounded-xl border border-border/40">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Classroom Hub Sync
                </li>
              </ul>
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => setShowAppInfoModal(false)}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-md shadow-primary/20 hover:opacity-90 transition-opacity"
              >
                Close App Info
              </button>
            </div>
          </div>
        </div>
      )}

      <FeedbackModal 
        isOpen={isFeedbackOpen} 
        onClose={() => setIsFeedbackOpen(false)} 
      />
      <ChangelogModal
        isOpen={isChangelogOpen}
        onClose={() => setIsChangelogOpen(false)}
      />
      <LinkedDevicesModal 
        isOpen={isLinkedDevicesOpen} 
        onClose={() => setIsLinkedDevicesOpen(false)} 
      />
    </div>
  );
};
