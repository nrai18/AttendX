import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useSyncStore } from "../../stores/syncStore";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { useCacheStore } from "../../stores/cacheStore";
import { startOfWeek, endOfWeek, subDays, startOfMonth, endOfMonth, format } from "date-fns";
import { ScheduleDate } from "../ui/schedule-date";
import { FeedbackAction } from "../ui/feedback-action";
import { ChevronDown, ShieldCheck, DownloadCloud, Database, CheckCircle2, RefreshCw } from "lucide-react";
import { RunActionButton } from "../ui/run-action-button";
import { triggerDynamicHUD } from "../ui/dynamic-island-hud";
import { SoundFX } from "../../utils/soundEffects";
type SyncMode = "SEND" | "RECEIVE";
type ContextType = "FULL_EXPORT" | "TIMETABLE_CALENDAR" | "SCHEDULE_STATUS";
type DateRangePreset = "This Week" | "Last 7 Days" | "Current Month" | "Full Semester" | "Custom Range";

export const PeerSyncModal = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<SyncMode>("RECEIVE");
  const [inputCode, setInputCode] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [reviewData, setReviewData] = useState<any>(null);

  // Transfer config state
  const [contextType, setContextType] = useState<ContextType>("FULL_EXPORT");
  const [datePreset, setDatePreset] = useState<DateRangePreset>("Full Semester");
  const [customStartDate, setCustomStartDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const activeCode = useSyncStore((state) => state.activeCode);
  const expiresAt = useSyncStore((state) => state.expiresAt);
  const setActiveCode = useSyncStore((state) => state.setActiveCode);
  const clearActiveCode = useSyncStore((state) => state.clearActiveCode);
  const activeSemesterId = useAttendanceStore((state) => state.activeSemesterId);
  const isSemesterLoading = useAttendanceStore((state) => state.isLoading);

  const [remainingTime, setRemainingTime] = useState<number>(0);

  useEffect(() => {
    if (localStorage.getItem("onboarding_peer_sync") !== "true") {
      localStorage.setItem("onboarding_peer_sync", "true");
      api.patch("/users/onboarding-status", { step: "peer_sync" }).catch(() => {});
      window.dispatchEvent(new CustomEvent("onboarding-step-completed", { detail: { step: "peer_sync" } }));
    }
  }, []);

  useEffect(() => {
    if (!expiresAt || !activeCode) {
      setRemainingTime(0);
      return;
    }

    const calculateRemaining = () => Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    const initialRemaining = calculateRemaining();
    
    if (initialRemaining <= 0) {
      clearActiveCode();
      setRemainingTime(0);
      return;
    }

    setRemainingTime(initialRemaining);

    const timer = setInterval(() => {
      const currentRemaining = calculateRemaining();
      setRemainingTime(currentRemaining);
      if (currentRemaining <= 0) {
        clearInterval(timer);
        clearActiveCode();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, activeCode, clearActiveCode]);

  const handleGenerateCode = async () => {
    if (isSemesterLoading) return toast.error("Semester data is still syncing, please wait a moment.");
    setLoading(true);
    try {
      let dateRange: any = undefined;
      
      if (contextType === "FULL_EXPORT" || contextType === "SCHEDULE_STATUS") {
        const today = new Date();
        if (datePreset === "This Week") {
          dateRange = { 
            startDate: format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
            endDate: format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd")
          };
        } else if (datePreset === "Last 7 Days") {
          dateRange = { 
            startDate: format(subDays(today, 7), "yyyy-MM-dd"),
            endDate: format(today, "yyyy-MM-dd")
          };
        } else if (datePreset === "Current Month") {
          dateRange = { 
            startDate: format(startOfMonth(today), "yyyy-MM-dd"),
            endDate: format(endOfMonth(today), "yyyy-MM-dd")
          };
        } else if (datePreset === "Custom Range") {
          dateRange = { startDate: customStartDate, endDate: customEndDate };
        }
      }

      const res = await api.post("/transfer/send", {
        contextType,
        dateRange
      });
      // FE-L04 FIX: Properly handle 0 TTL by using explicit null check rather than falsy || operator
      setActiveCode(String(res.data.code), res.data.expiresIn != null ? Number(res.data.expiresIn) : 300);
      // Active code displayed directly in modal UI
    } catch (error: any) {
      console.log("Error caught in PeerSyncModal:", error);
      const errRes = error.response;
      if (errRes?.data?.code) {
        // FE-H07 FIX: Only recover if the backend actually provides the code
        const recoveredCode = String(errRes.data.code); 
        let recoveredExp = Number(errRes.data.expiresIn);
        if (isNaN(recoveredExp) || recoveredExp <= 0) recoveredExp = 300; 
        
        setActiveCode(recoveredCode, recoveredExp);
        // Recovered code displayed directly in modal UI
      } else {
        toast.error(errRes?.data?.message || "Failed to generate code.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetrieveCode = async () => {
    if (isSemesterLoading) return toast.error("Semester data is still syncing, please wait a moment.");
    if (inputCode.length !== 6) return toast.error("Code must be 6 digits.");
    if (!activeSemesterId) return toast.error("No active semester found to import into.");
    
    setLoading(true);
    setSyncError(null);
    try {
      const res = await api.post("/transfer/retrieve", { code: inputCode });
      setReviewData(res.data);
      SoundFX.playSnapPopSound();
      triggerDynamicHUD({
        type: "sparkle",
        label: "Peer Sync Code Retrieved",
        subtitle: `Ready to mirror schedule (${res.data?.senderName || "Peer"})`,
      });
    } catch (error: any) {
      const msg = error.response?.data?.error || error.response?.data?.message || "Failed to retrieve schedule.";
      setSyncError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSync = async () => {
    if (!reviewData || !activeSemesterId) return;
    setLoading(true);
    try {
      await api.post(`/timetable/import/${activeSemesterId}`, reviewData.payload, { timeout: 180000 });
      
      // Invalidate all caches so that today, timetable, subjects, and stats update immediately
      const cacheState = useCacheStore.getState();
      cacheState.setCache("today", null);
      cacheState.setCache("timetable", null);
      cacheState.setCache("calendar", null);
      cacheState.setCache("attendance", null);
      cacheState.setCache("semester", null);
      
      // Dispatch reactivity events across active pages
      window.dispatchEvent(new CustomEvent("timetable-updated"));
      window.dispatchEvent(new CustomEvent("attendance-updated"));
      window.dispatchEvent(new CustomEvent("semester-updated"));
      window.dispatchEvent(new CustomEvent("today-updated"));

      // Invalidate in-flight stats lock and reset cooldown so fresh stats are immediately fetched
      useAttendanceStore.getState().invalidateInFlightStats();
      useAttendanceStore.getState().fetchStats(true).catch(() => {});

      // Fire push notification to the sender AFTER import succeeds (single, deduplicated).
      // The _syncToken encodes sender identity + retriever avatar for the notification image.
      if (reviewData._syncToken) {
        api.post("/transfer/confirm-sync", { _syncToken: reviewData._syncToken }).catch(function() {});
      }

      SoundFX.playSnapPopSound();
      triggerDynamicHUD({
        type: "sparkle",
        label: "Schedule Mirrored Successfully!",
      });
      setInputCode("");
      setReviewData(null);
      setSyncError(null);
      navigate("/timetable");
    } catch (error: any) {
      const msg = error.response?.data?.error || error.response?.data?.message || "Failed to import schedule.";
      setSyncError(msg);
      // FE-H08 FIX: Clear reviewData on failure to prevent duplicate import spamming
      setReviewData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card dark:bg-[#0E0E12] text-foreground p-6 rounded-3xl w-full max-w-md mx-auto shadow-xl border border-border/70">
      <div className="flex bg-muted rounded-lg p-1 mb-6">
        <button
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === "RECEIVE" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setMode("RECEIVE")}
        >
          Retrieve
        </button>
        <button
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === "SEND" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setMode("SEND")}
        >
          Send
        </button>
      </div>

      {mode === "SEND" ? (
        <div className="text-left">
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sync Mode</label>
              <select 
                value={contextType} 
                onChange={(e) => setContextType(e.target.value as ContextType)}
                className="w-full bg-muted border border-border rounded-lg p-3 text-sm text-foreground focus:outline-none focus:border-primary"
              >
                <option value="SCHEDULE_STATUS">Schedule Status Mirror (Safe)</option>
                <option value="TIMETABLE_CALENDAR">Timetable & Calendar Only</option>
                <option value="FULL_EXPORT">Full Backup (All Data)</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                {contextType === "SCHEDULE_STATUS" && "Shares structure + Held/Off status. Hides your personal attendance marks."}
                {contextType === "TIMETABLE_CALENDAR" && "Shares only the structural timetable and calendar. No logs."}
                {contextType === "FULL_EXPORT" && "Shares EVERYTHING, including your raw personal attendance logs."}
              </p>
            </div>

            {contextType !== "TIMETABLE_CALENDAR" && (
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Date Range Filter</label>
                <button
                  onClick={() => setShowDatePicker(true)}
                  className="w-full bg-muted border border-border rounded-lg p-3 text-sm text-left text-foreground focus:outline-none focus:border-primary hover:bg-muted-foreground/20 transition-colors flex justify-between items-center"
                >
                  <span>
                    {datePreset === "Custom Range" ? `${customStartDate} to ${customEndDate}` : datePreset}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            )}

            {showDatePicker && createPortal(
              <div className="theme-nova-green fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-card dark:bg-[#0E0E12] rounded-3xl shadow-2xl border border-border max-w-[95vw] overflow-hidden">
                  <ScheduleDate
                    onApply={(range) => {
                      if (range.start && range.end) {
                        setCustomStartDate(format(range.start, "yyyy-MM-dd"));
                        setCustomEndDate(format(range.end, "yyyy-MM-dd"));
                        setDatePreset("Custom Range");
                      }
                      setShowDatePicker(false);
                    }}
                    onCancel={() => setShowDatePicker(false)}
                  />
                </div>
              </div>,
              document.body
            )}
          </div>

          {activeCode && (
            <div className="text-center py-4 mb-4 border-t border-border pt-6 animate-in fade-in zoom-in duration-300">
              <h2 className="text-xl font-semibold mb-2">App Code</h2>
              <p className="text-sm text-muted-foreground mb-6">Share this code to transfer your schedule</p>
              <div className="text-5xl font-mono tracking-[0.3em] font-bold text-foreground mb-6">
                {activeCode.substring(0, 3)} {activeCode.substring(3, 6)}
              </div>
              <div className="w-full bg-muted-foreground/10 h-1.5 rounded-full overflow-hidden mb-4 relative">
                <div 
                  className="bg-primary h-full transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${(remainingTime / 300) * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-center gap-2 mb-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-xs font-mono font-bold text-primary tabular-nums">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  Code expires in {remainingTime}s
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {activeCode && (
              <button 
                onClick={() => { clearActiveCode(); }}
                className="bg-muted hover:bg-muted/80 text-foreground py-3 px-4 rounded-lg font-medium transition-all"
              >
                Cancel
              </button>
            )}
            <button 
              onClick={handleGenerateCode}
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm flex justify-center items-center transition-all bg-[#00D2FF] text-black hover:bg-[#00D2FF]/90 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(0,210,255,0.4)]"
            >
              {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              {activeCode ? "Update & Regenerate" : "Generate 6-Digit Code"}
            </button>
          </div>
        </div>
      ) : (
        <div className="py-2">
          {reviewData ? (
            <div className="animate-in fade-in zoom-in duration-300">
              <h3 className="text-lg font-semibold mb-4 text-center">Sync Preview</h3>
              <div className="flex flex-col items-center gap-3 mb-6 bg-muted/30 p-4 rounded-xl border border-border">
                {reviewData.sender?.avatarUrl && (
                  <img src={reviewData.sender.avatarUrl} alt="Sender Avatar" className="w-16 h-16 avatar-circle rounded-full object-cover border-2 border-primary/20" referrerPolicy="no-referrer" />
                )}
                <div className="text-center">
                  <p className="font-medium text-foreground">{reviewData.sender?.name || "Unknown User"}</p>
                  <p className="text-xs text-muted-foreground">{reviewData.sender?.email}</p>
                </div>
              </div>
              
              <div className="space-y-3 text-sm mb-6 bg-muted/50 p-4 rounded-xl border border-border">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">{reviewData.contextType.replace(/_/g, ' ')}</span>
                </div>
                {reviewData.contextType !== "TIMETABLE_CALENDAR" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Range</span>
                    <span className="font-medium">
                      {reviewData.payload?.metadata?.startDate && reviewData.payload?.metadata?.endDate
                        ? `${reviewData.payload.metadata.startDate} to ${reviewData.payload.metadata.endDate}`
                        : "Full Semester"}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 items-center w-full min-w-0">
                <button 
                  onClick={() => setReviewData(null)}
                  disabled={loading}
                  className="bg-muted hover:bg-muted/80 text-foreground h-[48px] px-4 rounded-2xl font-bold text-sm transition-all shrink-0 cursor-pointer"
                >
                  Cancel
                </button>
                <div className="flex-1 min-w-0 w-full">
                  <RunActionButton 
                    fullWidth
                    action={handleConfirmSync}
                    onCancel={() => {
                      setReviewData(null);
                      setLoading(false);
                    }}
                    disabled={loading}
                    idleLabel="Confirm & Sync"
                    doneLabel="Mirrored"
                    subLabel="Mirroring"
                    idleIcon={<RefreshCw className="h-4 w-4 text-primary-foreground opacity-90" />}
                    steps={[
                      { id: 1, label: 'Securing', icon: ShieldCheck },
                      { id: 2, label: 'Fetching Data', icon: DownloadCloud },
                      { id: 3, label: 'Merging Records', icon: Database },
                      { id: 4, label: 'Finalizing', icon: CheckCircle2 }
                    ]}
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              <label className="text-sm text-muted-foreground block mb-2">Retrieval code (6-digit number)</label>
              <input
                type="text"
                maxLength={6}
                value={inputCode}
                onChange={(e) => {
                  setInputCode(e.target.value.replace(/\D/g, ""));
                  setSyncError(null);
                }}
                placeholder="e.g. 543210"
                className="w-full bg-muted border border-border rounded-lg py-4 px-4 text-center text-2xl tracking-widest text-foreground focus:outline-none focus:border-primary mb-6"
              />
              {syncError ? (
                <div className="flex justify-center w-full">
                  <FeedbackAction 
                    errorMessage={syncError} 
                    loadingMessage="Syncing..." 
                    status={loading ? "loading" : "error"} 
                    onRetry={handleRetrieveCode} 
                  />
                </div>
              ) : (
                <button 
                  onClick={handleRetrieveCode}
                  disabled={loading || inputCode.length !== 6}
                  className="w-full py-3 rounded-xl font-bold text-sm flex justify-center items-center transition-all bg-[#00D2FF] text-black hover:bg-[#00D2FF]/90 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(0,210,255,0.4)]"
                >
                  {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                  Download & Sync Schedule
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
