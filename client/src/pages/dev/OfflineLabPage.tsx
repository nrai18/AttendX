import React, { useState, useEffect, useRef } from "react";
import { useOfflineStore, QueuedRequest } from "../../stores/offlineStore";
import { useCacheStore } from "../../stores/cacheStore";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { useAuthStore } from "../../stores/authStore";
import { api } from "../../lib/api";
import { Preferences } from "@capacitor/preferences";
import { format } from "date-fns";
import {
  Wifi,
  WifiOff,
  Server,
  RefreshCw,
  Trash2,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Send,
  RotateCcw,
  Plus,
  Terminal,
  Activity,
  Layers,
  Database,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

interface LogMessage {
  id: string;
  time: string;
  type: "info" | "success" | "warn" | "error";
  text: string;
  meta?: any;
}

export const OfflineLabPage: React.FC = () => {
  const queue = useOfflineStore((state) => state.queue);
  const isSyncing = useOfflineStore((state) => state.isSyncing);
  const clearQueue = useOfflineStore((state) => state.clearQueue);
  const dequeue = useOfflineStore((state) => state.dequeue);
  const enqueue = useOfflineStore((state) => state.enqueue);
  const flushQueue = useOfflineStore((state) => state.flushQueue);

  const cacheState = useCacheStore();
  const attendanceState = useAttendanceStore();
  const user = useAuthStore((state) => state.user);

  // Connectivity Telemetry
  const [isBrowserOnline, setIsBrowserOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [serverPingStatus, setServerPingStatus] = useState<
    "checking" | "connected" | "disconnected"
  >("checking");
  const [serverLatencyMs, setServerLatencyMs] = useState<number | null>(null);

  // Terminal Console Logs
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const logTerminalRef = useRef<HTMLDivElement>(null);

  // JSON payload modal / expanded view
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(
    null,
  );

  const addLog = (
    type: "info" | "success" | "warn" | "error",
    text: string,
    meta?: any,
  ) => {
    const newLog: LogMessage = {
      id: Math.random().toString(36).substring(7),
      time: new Date().toLocaleTimeString(),
      type,
      text,
      meta,
    };
    setLogs((prev) => [...prev.slice(-150), newLog]);
  };

  // Auto-scroll terminal log to bottom
  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [logs]);

  // Track browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsBrowserOnline(true);
      addLog("success", "Browser 'online' event triggered");
    };
    const handleOffline = () => {
      setIsBrowserOnline(false);
      addLog(
        "warn",
        "Browser 'offline' event triggered. Network disconnected.",
      );
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Heartbeat ping to server /api/health with backoff
  useEffect(() => {
    let isMounted = true;
    let timerId: any = null;

    const pingServer = async () => {
      const startTime = performance.now();
      let nextDelay = 4000;
      try {
        await api.get("/health", { timeout: 2500 } as any);
        if (!isMounted) return;
        const latency = Math.round(performance.now() - startTime);
        setServerPingStatus("connected");
        setServerLatencyMs(latency);
        nextDelay = 5000;
      } catch (err: any) {
        if (!isMounted) return;
        setServerPingStatus("disconnected");
        setServerLatencyMs(null);
        // Exponential backoff when disconnected (15s) to avoid terminal flooding
        nextDelay = 15000;
      }
      if (isMounted) {
        timerId = setTimeout(pingServer, nextDelay);
      }
    };

    pingServer();
    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, []);
    // Auto-fire offline queue the moment backend port 3000 is detected as REACHABLE
  useEffect(() => {
    if (serverPingStatus === "connected") {
      const offlineState = useOfflineStore.getState();
      if (offlineState.queue.length > 0) {
        useOfflineStore.setState({ isSyncing: false });
        offlineState.flushQueue();
      }
    }
  }, [serverPingStatus]);


  // Sync listener to log resolution progress
  useEffect(() => {
    const handleSyncComplete = () => {
      addLog(
        "success",
        "Received 'attendance-updated' event! Global stores refreshed.",
      );
    };

    const handleOfflineSyncCompleted = (e: any) => {
      const { successCount, conflictCount, syncedItems, isCrossTab } =
        e.detail || {};
      const prefix = isCrossTab ? "[Cross-Tab Sync] " : "";
      if (successCount > 0) {
        addLog(
          "success",
          `✅ ${prefix}Synced ${successCount} offline action(s) with server!`,
        );
        if (Array.isArray(syncedItems)) {
          syncedItems.forEach((item: any) => {
            addLog(
              "success",
              `  └─ [Server Synced] ${item.method} ${item.url} (${item.summary})`,
            );
          });
        }
      }
      if (conflictCount > 0) {
        addLog(
          "error",
          `❌ ${prefix}${conflictCount} offline action(s) were rejected by server / rolled back.`,
        );
      }
    };

    window.addEventListener("attendance-updated", handleSyncComplete);
    window.addEventListener("offline-sync-completed", handleOfflineSyncCompleted);
    return () => {
      window.removeEventListener("attendance-updated", handleSyncComplete);
      window.removeEventListener(
        "offline-sync-completed",
        handleOfflineSyncCompleted,
      );
    };
  }, []);

  // Real-time Cross-Tab Synchronization (Zero refresh needed)
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel("attendx_offline_sync");
      channel.onmessage = (event) => {
        if (
          event.data?.type === "QUEUE_UPDATED" &&
          Array.isArray(event.data.queue)
        ) {
          useOfflineStore.setState({ queue: event.data.queue });
          addLog(
            "info",
            `Cross-tab sync: Queue updated (${event.data.queue.length} items)`,
          );
        }
        if (
          event.data?.type === "ATTENDANCE_STATS_UPDATED" &&
          event.data.stats
        ) {
          useAttendanceStore.setState({
            overallPercentage: event.data.stats.overallPercentage,
            ...(typeof event.data.stats.totalAttended === "number"
              ? { totalAttended: event.data.stats.totalAttended }
              : {}),
            ...(typeof event.data.stats.totalClasses === "number"
              ? { totalClasses: event.data.stats.totalClasses }
              : {}),
          });
          addLog(
            "success",
            `Cross-tab sync: TopBar updated to ${event.data.stats.overallPercentage.toFixed(2)}%`,
          );
        }
      };
    }

    const handleQueueEvent = (e: any) => {
      if (e.detail?.queue) {
        useOfflineStore.setState({ queue: e.detail.queue });
      }
    };
    window.addEventListener("offline-queue-changed", handleQueueEvent);

    // High-frequency polling fallback (ensures sync even if tab was in background)
    const storageSyncTimer = setInterval(async () => {
      try {
        const raw = await Preferences.get({ key: "attendx-offline-queue" });
        if (raw?.value) {
          const parsed = JSON.parse(raw.value);
          const storedQueue = parsed?.state?.queue;
          if (
            Array.isArray(storedQueue) &&
            JSON.stringify(storedQueue) !==
              JSON.stringify(useOfflineStore.getState().queue)
          ) {
            useOfflineStore.setState({ queue: storedQueue });
          }
        }

        const rawAtt = await Preferences.get({
          key: "attendx-attendance-cache",
        });
        if (rawAtt?.value) {
          const parsedAtt = JSON.parse(rawAtt.value);
          const storedStats = parsedAtt?.state;
          if (
            storedStats &&
            typeof storedStats.overallPercentage === "number" &&
            storedStats.overallPercentage !==
              useAttendanceStore.getState().overallPercentage
          ) {
            useAttendanceStore.setState({
              overallPercentage: storedStats.overallPercentage,
              totalAttended: storedStats.totalAttended,
              totalClasses: storedStats.totalClasses,
            });
          }
        }
      } catch {}
    }, 1000);

    return () => {
      if (channel) channel.close();
      window.removeEventListener("offline-queue-changed", handleQueueEvent);
      clearInterval(storageSyncTimer);
    };
  }, []);

  // Manual Trigger to Flush Queue
  const handleFlushQueue = async () => {
    if (queue.length === 0) {
      toast.info("Queue is already empty");
      return;
      }
      useOfflineStore.setState({ isSyncing: false });
    addLog("info", `Initiating flushQueue() for ${queue.length} item(s)...`);
    try {
      await flushQueue();
      addLog("success", "flushQueue() execution cycle completed.");
    } catch (e: any) {
      addLog("error", `flushQueue() failed: ${e?.message || e}`);
    }
  };

  // Replay a single mutation immediately
  const handleReplaySingle = async (item: QueuedRequest) => {
    addLog(
      "info",
      `Manually replaying item [${item.id}]: ${item.method.toUpperCase()} ${item.url}`,
    );
    try {
      const res = await api.request({
        method: item.method,
        url: item.url,
        data: item.data,
        headers: { ...item.headers, "X-Offline-Retry": "true" },
      });
      addLog("success", `Server accepted [${item.id}]: Status ${res.status}`);
      dequeue(item.id);
      toast.success(
        `Synced single mutation ${item.method.toUpperCase()} ${item.url}`,
      );
      window.dispatchEvent(new Event("attendance-updated"));
    } catch (err: any) {
      addLog(
        "error",
        `Server rejected [${item.id}]: ${err.response?.status || "Network Error"}`,
        err.response?.data,
      );
      toast.error(`Replay failed: ${err.message}`);
    }
  };

  // Simulation Generators
  const simulateFullDayMark = (
    status: "present" | "absent" | "off" | "clear",
  ) => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const semId =
      attendanceState.activeSemesterId ||
      cacheState.semester?.activeSemester?.id;
    const actionName =
      status === "clear" ? "Undo Day" : `Full Day ${status.toUpperCase()}`;

    enqueue({
      method: "POST",
      url: "/attendance/mark-day",
      data: {
        date: todayStr,
        status,
        remarks: status === "absent" ? "Simulated Absent via Lab" : undefined,
        semesterId: semId,
      },
    });

    addLog("info", `Enqueued simulation: ${actionName} for ${todayStr}`);
    toast.success(`Enqueued ${actionName}`);
  };

  // Repair corrupted Subject Cache
  const handleSelfHealCache = () => {
    const allLogs =
      cacheState.subject_logs?.["all"]?.logs ||
      attendanceState.historyLogs ||
      [];
    const subjects =
      cacheState.subjects?.subjects || attendanceState.subjects || [];

    if (subjects.length === 0) {
      toast.error("No subjects found in state to heal.");
      return;
    }

    const healedStats = subjects.map((sub: any) => {
      const subLogs = allLogs.filter(
        (l: any) => l.subjectId === sub.id || l.subject?.id === sub.id,
      );
      let att = 0;
      let tot = 0;
      let missed = 0;
      let off = 0;
      subLogs.forEach((l: any) => {
        const st = String(l.status || "").toLowerCase();
        if (["present", "attended", "medical", "od"].includes(st)) {
          att++;
          tot++;
        } else if (["absent", "missed"].includes(st)) {
          missed++;
          tot++;
        } else if (["off", "cancelled"].includes(st)) {
          off++;
        }
      });
      const pct = tot > 0 ? (att / tot) * 100 : 0;
      return {
        ...sub,
        attended: att,
        total: tot,
        missed,
        off,
        percentage: Number(pct.toFixed(1)),
        target: sub.target || user?.targetAttendance || 75,
      };
    });

    cacheState.setCache("subjects", {
      subjects,
      stats: healedStats,
      activeSemesterId: attendanceState.activeSemesterId,
    });

    useAttendanceStore.setState({ subjects: healedStats });
    addLog(
      "success",
      `Healed ${healedStats.length} subjects from ${allLogs.length} ground-truth logs.`,
    );
    toast.success("Repaired subject cache from ground-truth logs!");
    window.dispatchEvent(new Event("attendance-updated"));
  };

  const cachedSubjectStats = cacheState.subjects?.stats || [];
  const cacheTotalClasses = cachedSubjectStats.reduce(
    (acc: number, s: any) => acc + (s.total || 0),
    0,
  );
  const isCacheZeroed =
    cachedSubjectStats.length > 0 && cacheTotalClasses === 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#080808] text-slate-900 dark:text-white p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto transition-colors">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-slate-200 dark:border-white/10 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-normal text-slate-900 dark:text-white flex items-center gap-2">
              AttendX Offline Mutation Lab
            </h1>
            <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-white/10 text-[11px] font-semibold text-slate-700 dark:text-white/70 border border-slate-300 dark:border-white/10">
              Dev Suite
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-white/50 mt-1">
            Real-time mutation stream, offline playback resolution, and cache
            ground-truth inspector
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleFlushQueue}
            disabled={queue.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-black transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
            />
            <span>Flush Queue Now ({queue.length})</span>
          </button>
          <button
            onClick={() => {
              if (
                confirm(
                  "Are you sure you want to discard all queued offline actions?",
                )
              ) {
                clearQueue();
                addLog("warn", "Queue manually purged by user.");
                toast.success("Queue cleared");
              }
            }}
            disabled={queue.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-500/20 transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Queue</span>
          </button>
        </div>
      </div>

      {/* Connectivity & Engine Status HUD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Browser Network */}
        <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none rounded-2xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-white/40 font-semibold">
              Browser Network
            </p>
            <p className="text-base font-bold flex items-center gap-2">
              {isBrowserOnline ? (
                <span className="text-emerald-500 dark:text-emerald-400 flex items-center gap-1.5">
                  <Wifi className="w-4 h-4" /> ONLINE
                </span>
              ) : (
                <span className="text-rose-500 dark:text-rose-400 flex items-center gap-1.5">
                  <WifiOff className="w-4 h-4" /> OFFLINE
                </span>
              )}
            </p>
          </div>
          <div
            className={`p-2.5 rounded-xl ${isBrowserOnline ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400" : "bg-rose-500/10 text-rose-500 dark:text-rose-400"}`}
          >
            {isBrowserOnline ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
          </div>
        </div>

        {/* Card 2: Server Heartbeat */}
        <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none rounded-2xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-white/40 font-semibold">
              Backend Port 3000
            </p>
            <p className="text-base font-bold flex items-center gap-2">
              {serverPingStatus === "connected" ? (
                <span className="text-emerald-500 dark:text-emerald-400 flex items-center gap-1.5">
                  <Server className="w-4 h-4" /> REACHABLE
                </span>
              ) : (
                <span className="text-rose-500 dark:text-rose-400 flex items-center gap-1.5">
                  <Server className="w-4 h-4" /> REFUSED
                </span>
              )}
            </p>
            {serverLatencyMs !== null && (
              <p className="text-[10px] text-slate-500 dark:text-white/40">
                Latency: {serverLatencyMs}ms
              </p>
            )}
          </div>
          <div
            className={`p-2.5 rounded-xl ${serverPingStatus === "connected" ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400" : "bg-rose-500/10 text-rose-500 dark:text-rose-400"}`}
          >
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Sync Status */}
        <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none rounded-2xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-white/40 font-semibold">
              Sync Engine
            </p>
            <p className="text-base font-bold flex items-center gap-2">
              {isSyncing ? (
                <span className="text-sky-500 dark:text-sky-400 flex items-center gap-1.5 animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin" /> REPLAYING
                </span>
              ) : (
                <span className="text-slate-800 dark:text-white/80 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> IDLE
                </span>
              )}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-white/40">
              {queue.length} pending mutation(s)
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/70">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Global Attendance Ground Truth */}
        <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none rounded-2xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-white/40 font-semibold">
              Store Percentage
            </p>
            <p className="text-base font-bold text-emerald-500 dark:text-emerald-400">
              {Number(attendanceState.overallPercentage || 0).toFixed(2)}%
            </p>
            <p className="text-[10px] text-slate-500 dark:text-white/40">
              {attendanceState.totalAttended} / {attendanceState.totalClasses}{" "}
              classes attended
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 dark:text-emerald-400">
            <Database className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Quick Test Mutation Generators */}
      <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-white/90">
              1-Click Mutation Test Suite
            </h2>
            <p className="text-xs text-slate-500 dark:text-white/40">
              Inject simulated actions directly into the offline queue to
              observe resolution
            </p>
          </div>
          {isCacheZeroed && (
            <button
              onClick={handleSelfHealCache}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Repair Corrupted 0% Cache</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
          <button
            onClick={() => simulateFullDayMark("present")}
            className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition-all active:scale-95 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Queue: Full Day Present</span>
          </button>
          <button
            onClick={() => simulateFullDayMark("absent")}
            className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 text-xs font-bold transition-all active:scale-95 cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
            <span>Queue: Full Day Absent</span>
          </button>
          <button
            onClick={() => simulateFullDayMark("off")}
            className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition-all active:scale-95 cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Queue: Full Day Off</span>
          </button>
          <button
            onClick={() => simulateFullDayMark("clear")}
            className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-100 dark:bg-white/10 border border-slate-300 dark:border-white/20 text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20 text-xs font-bold transition-all active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Queue: Undo Day (Clear)</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Queue Stream & Replay Console */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Live Offline Queue */}
        <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none rounded-2xl p-5 flex flex-col space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-500 dark:text-sky-400" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-white">
                Live Offline Queue ({queue.length})
              </h2>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-white/40">FIFO Order</span>
          </div>

          <div className="flex-1 space-y-3 min-h-[350px] max-h-[550px] overflow-y-auto pr-1">
            {queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center text-slate-400 dark:text-white/30 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-slate-300 dark:text-white/20" />
                <p className="text-sm font-semibold">Offline Queue is Clean</p>
                <p className="text-xs max-w-xs">
                  All local mutations have synced with the server. Use the
                  buttons above to inject test actions.
                </p>
              </div>
            ) : (
              queue.map((item, index) => {
                const methodColor =
                  item.method.toLowerCase() === "delete"
                    ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30"
                    : item.method.toLowerCase() === "post"
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30";

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-all space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 dark:text-white/30 font-bold">
                          #{index + 1}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${methodColor}`}
                        >
                          {item.method}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-white truncate max-w-[180px] sm:max-w-[240px]">
                          {item.url}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleReplaySingle(item)}
                          className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500 hover:text-black transition-all cursor-pointer"
                          title="Replay this single mutation"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            dequeue(item.id);
                            addLog(
                              "warn",
                              `Manually dropped item [${item.id}] from queue.`,
                            );
                          }}
                          className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
                          title="Discard from queue"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Summary badge */}
                    <div className="text-[11px] text-slate-600 dark:text-white/60 bg-slate-100 dark:bg-black/40 rounded-lg p-2 border border-slate-200 dark:border-white/5 space-y-1">
                      <div className="flex items-center justify-between text-slate-500 dark:text-white/40 text-[10px]">
                        <span>ID: {item.id}</span>
                        <span>
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {item.data && (
                        <div className="text-[11px] text-slate-700 dark:text-white/80 font-mono truncate">
                          {item.data.status && (
                            <span>
                              Status:{" "}
                              <b className="text-emerald-600 dark:text-emerald-400">
                                {item.data.status}
                              </b>{" "}
                              •{" "}
                            </span>
                          )}
                          {item.data.date && (
                            <span>Date: {item.data.date}</span>
                          )}
                          {item.data.subjectId && (
                            <span>
                              Subj: {item.data.subjectId.slice(0, 8)}...
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Live Resolution Console */}
        <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none rounded-2xl p-5 flex flex-col space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-white">
                Live Resolution Console
              </h2>
            </div>
            <button
              onClick={() => setLogs([])}
              className="text-[11px] text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
            >
              Clear Logs
            </button>
          </div>

          <div
            ref={logTerminalRef}
            className="flex-1 bg-black/90 dark:bg-black/60 rounded-xl p-3.5 border border-slate-800 dark:border-white/10 min-h-[350px] max-h-[550px] overflow-y-auto space-y-1.5 font-mono text-xs"
          >
            {logs.length === 0 ? (
              <div className="text-white/30 text-center py-20">
                Console idle. Trigger actions to inspect output.
              </div>
            ) : (
              logs.map((log) => {
                const color =
                  log.type === "success"
                    ? "text-emerald-400"
                    : log.type === "warn"
                      ? "text-amber-400"
                      : log.type === "error"
                        ? "text-rose-400"
                        : "text-white/70";

                return (
                  <div
                    key={log.id}
                    className="leading-relaxed flex items-start gap-2"
                  >
                    <span className="text-white/30 shrink-0">[{log.time}]</span>
                    <span className={`${color} break-all`}>
                      {log.type === "success" && "✅ "}
                      {log.type === "warn" && "⚠️ "}
                      {log.type === "error" && "❌ "}
                      {log.text}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
