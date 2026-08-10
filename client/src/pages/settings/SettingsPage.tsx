import React, { useState } from "react";
import { useAuthStore } from "../../stores/authStore";
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
  ShieldAlert
} from "lucide-react";

export const SettingsPage: React.FC = () => {
  const { user, setUser } = useAuthStore();
  const [targetAttendance, setTargetAttendance] = useState<number>(user?.targetAttendance ?? 75);
  const [theme, setTheme] = useState<"light" | "dark" | "system">(user?.theme ?? "dark");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Reset Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetError, setResetError] = useState("");

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const res = await api.patch("/users/me", {
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

  const handleResetData = async () => {
    setIsResetting(true);
    setResetError("");

    try {
      await api.post("/users/reset-data");
      // Successfully reset! Reload app page to start fresh
      window.location.href = "/today";
    } catch (err: any) {
      console.error("Failed to reset app data", err);
      setResetError(err?.response?.data?.message || "Failed to reset app data. Please try again.");
      setIsResetting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto w-full pb-24 md:pb-8 flex flex-col space-y-8">
      {/* Page Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Settings & Preferences</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            Manage your target criteria, preferences, and data
          </p>
        </div>
      </div>

      {/* Profile & Target Attendance Card */}
      <form onSubmit={handleSaveProfile} className="bg-[#0c0d12] border border-white/10 rounded-2xl p-6 space-y-6 shadow-xl">
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <User className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-bold text-white">Account & Target Attendance</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Full Name
            </label>
            <input
              type="text"
              disabled
              value={user?.name || ""}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Email Address
            </label>
            <input
              type="text"
              disabled
              value={user?.email || ""}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Target Attendance (%)
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="100"
                value={targetAttendance}
                onChange={(e) => setTargetAttendance(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-sm focus:outline-none focus:border-indigo-500 font-semibold"
              />
              <Target className="w-4 h-4 text-muted-foreground absolute right-3.5 top-3" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Default is 75%. Safe buffer calculations and warning indicators use this target.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Theme Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "dark", label: "Dark", icon: Moon },
                { id: "light", label: "Light", icon: Sun },
                { id: "system", label: "System", icon: Laptop },
              ].map((t) => {
                const Icon = t.icon;
                const isSelected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id as any)}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20"
                        : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          {saveSuccess ? (
            <span className="flex items-center gap-2 text-sm font-medium text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Settings updated successfully!
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Changes apply immediately to your dashboard</span>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </form>

      {/* Danger Zone / Reset Full App Data */}
      <div className="bg-rose-950/20 border border-rose-500/30 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 text-rose-400 border-b border-rose-500/20 pb-4">
          <ShieldAlert className="w-5 h-5" />
          <h2 className="text-lg font-bold text-rose-400">Danger Zone</h2>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white">Reset Full App Data</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Permanently wipe all semesters, subjects, timetable slots, attendance logs, and events associated with your account.
              This action cannot be undone.
            </p>
          </div>

          <button
            onClick={() => {
              setResetConfirmText("");
              setResetError("");
              setShowResetModal(true);
            }}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600 hover:text-white transition-all shadow-lg shadow-rose-950/40"
          >
            <Trash2 className="w-4 h-4" />
            Reset All Data
          </button>
        </div>
      </div>

      {/* Reset Data Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0c0d12] border border-rose-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Confirm Reset Data</h3>
                <p className="text-xs text-rose-400 font-medium">Irreversible Action</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to reset all app data? This will permanently delete:
            </p>
            <ul className="text-xs text-white/80 space-y-1.5 list-disc list-inside bg-black/40 p-3 rounded-xl border border-white/5">
              <li>All active & past semesters</li>
              <li>All added subjects & target limits</li>
              <li>Your timetable weekly slots & extra classes</li>
              <li>All marked attendance history</li>
              <li>Academic events & custom schedules</li>
            </ul>

            <div>
              <label className="block text-xs text-muted-foreground font-medium mb-1.5">
                Type <span className="font-bold text-white">RESET</span> below to confirm:
              </label>
              <input
                type="text"
                placeholder="RESET"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/20 text-white font-mono text-sm focus:outline-none focus:border-rose-500"
              />
            </div>

            {resetError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                {resetError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetConfirmText.trim() !== "RESET" || isResetting}
                onClick={handleResetData}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-lg shadow-rose-600/30 disabled:opacity-40 cursor-pointer"
              >
                {isResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Permanently Reset App
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
