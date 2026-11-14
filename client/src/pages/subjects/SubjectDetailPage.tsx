import { useCacheStore } from "../../stores/cacheStore";
import { useOfflineStore } from "../../stores/offlineStore";
import React, { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  SlidersHorizontal,
  Check,
  X,
  Minus,
  Ban,
  Pencil,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Activity,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  ChevronDown,
  Sparkles,
  MessageSquare
} from "lucide-react";
import { api } from "../../lib/api";
import { triggerAttendancePopup } from "../../stores/animationPopupStore";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { useAuthStore } from "../../stores/authStore";
import { useBackHandlerStore } from "../../stores/backHandlerStore";
import { toast } from "sonner";
import { hapticSelection, hapticSuccess } from "../../utils/haptics";

interface AttendanceLogItem {
  id: string;
  date: string;
  dateFormatted: string;
  timestamp: number;
  subjectId: string;
  subjectName: string;
  subjectCode?: string;
  subjectColor?: string;
  target: number;
  currentPercentage: number;
  canMiss: number;
  needAttend: number;
  statusText: string;
  slotType: string;
  isExtra?: boolean;
  startTime?: string;
  endTime?: string;
  status: "present" | "absent" | "off" | "not_marked" | "medical" | "od" | string;
  remarks?: string | null;
  timetableSlotId?: string;
  overrideId?: string;
  attendanceId?: string;
}

interface SubjectHeaderStats {
  id: string;
  name: string;
  code?: string;
  target: number;
  attended: number;
  total: number;
  percentage: number;
  statusText: string;
  canMiss: number;
  needAttend: number;
}

export const SubjectDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const isOverall = !id || id === "overall" || id === "all";
  const querySubject = isOverall ? "all" : id;
  const cachedLogsData = useCacheStore.getState().subject_logs?.[querySubject]
    || (isOverall ? useCacheStore.getState().subject_logs?.["overall"] : null);
  const initialLogs = cachedLogsData?.logs || [];
  const initialSubjects = cachedLogsData?.subjects || useAttendanceStore.getState().subjects || [];

  const [logs, setLogs] = useState<AttendanceLogItem[]>(initialLogs);
  const [subjectsList, setSubjectsList] = useState<any[]>(initialSubjects);
  const [headerStats, setHeaderStats] = useState<SubjectHeaderStats | null>(() => {
    if (initialSubjects.length === 0) return null;
    if (isOverall) {
      let totalAttended = 0;
      let totalClasses = 0;
      initialSubjects.forEach((s: any) => {
        totalAttended += s.attended || 0;
        totalClasses += s.total || 0;
      });
      const pct = totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 0;
      const avgTarget = useAuthStore.getState().user?.targetAttendance ?? 75;
      const totalCanMiss = Math.floor((totalAttended - (avgTarget / 100) * totalClasses) / (avgTarget / 100));
      return {
        id: "overall",
        name: "Overall",
        target: avgTarget,
        attended: totalAttended,
        total: totalClasses,
        percentage: pct,
        canMiss: totalCanMiss > 0 ? totalCanMiss : 0,
        needAttend: 0,
        statusText: totalClasses === 0 ? "No classes recorded yet" : `${totalAttended}/${totalClasses} classes`,
      };
    }
    const sub = initialSubjects.find((s: any) => s.id === id || s.subjectId === id);
    if (!sub) return null;
    return {
      id: sub.id || sub.subjectId,
      name: sub.name,
      code: sub.code,
      target: sub.target || (useAuthStore.getState().user?.targetAttendance ?? 75),
      attended: sub.attended || 0,
      total: sub.total || 0,
      percentage: sub.percentage || 0,
      canMiss: sub.canMiss || 0,
      needAttend: sub.needAttend || 0,
      statusText: sub.statusText || `${sub.attended || 0}/${sub.total || 0} classes`,
    };
  });
  const [isLoading, setIsLoading] = useState(() => initialLogs.length === 0);

  // Filters
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>(isOverall ? "all" : id);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");

  // Filter Dropdown Visibility
  const [showSubjectMenu, setShowSubjectMenu] = useState(false);
  const [showDateMenu, setShowDateMenu] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  // Edit Mode Toggle
  const [isEditMode, setIsEditMode] = useState(false);
  const initialLogsSnapshotRef = useRef<AttendanceLogItem[] | null>(null);
  const pendingEditsRef = useRef<Map<string, { item: AttendanceLogItem; newStatus: "present" | "absent" | "off" | "not_marked" }>>(new Map());


  // Remark Modal State
  const [selectedRemarkLog, setSelectedRemarkLog] = useState<{ item: AttendanceLogItem; status: string } | null>(null);
  const [remarkInput, setRemarkInput] = useState<string>("");
  const [isSavingRemark, setIsSavingRemark] = useState<boolean>(false);

  const getContextualRemarkChips = (status: string) => {
    switch (status) {
      case "off":
        return [
          "Class Cancelled",
          "Bunk",
          "Holiday",
          "Dept Meeting",
          "College Fest",
          "Weather / Rain",
        ];
      case "present":
      case "attended":
        return [
          "Regular Class",
          "Proxy",
          "Extra Class",
          "Guest Lecture",
        ];
      case "absent":
      case "missed":
      default:
        return [
          "Bunk",
          "Overslept",
          "Medical / Sick",
          "Home",
          "Personal",
          "College OD",
          "Exam Prep",
        ];
    }
  };

  // Active Tab: Logs vs Simulator (for single subject)
  const [activeTab, setActiveTab] = useState<"logs" | "simulator">("logs");

  // Simulator state for single subject
  const [simAttended, setSimAttended] = useState(0);
  const [simMissed, setSimMissed] = useState(0);

  const storeSubjects = useAttendanceStore(state => state.subjects);
  
  useEffect(() => {
    if (headerStats && !isOverall) {
      setSimAttended(headerStats.attended);
      setSimMissed(headerStats.total - headerStats.attended);
    }
  }, [headerStats, isOverall]);

  useEffect(() => {
    const unregister = useBackHandlerStore.getState().register(() => {
      if (showStatusMenu) { setShowStatusMenu(false); return true; }
      if (showSubjectMenu) { setShowSubjectMenu(false); return true; }
      if (showDateMenu) { setShowDateMenu(false); return true; }
      if (isEditMode) {
        handleDiscardEdits();
        return true;
      }
      navigate("/subjects", { replace: true });
      return true;
    });
    return () => unregister();
  }, [showStatusMenu, showSubjectMenu, showDateMenu, isEditMode, navigate]);

  const fetchLogsData = async (silent = false) => {
    const querySubject = isOverall ? "all" : id;
    try {
      if (!silent && logs.length === 0) setIsLoading(true);
      const res = await api.get(`/attendance/logs?subjectId=${querySubject}`);
      let rawLogs: AttendanceLogItem[] = res.data.logs || [];
      const subjects = res.data.subjects || [];

      // Cache the response for offline use
      const existingCache = useCacheStore.getState().subject_logs || {};
      useCacheStore.getState().setCache('subject_logs', { ...existingCache, [querySubject]: res.data });
      // Overlay any pending offline mutations so queued edits are never wiped
      const pendingQueue = useOfflineStore.getState().queue || [];
      pendingQueue.forEach((q: any) => {
        const p = q.data || q.payload || {};
        const url = String(q.url || "");
        const targetDate = String(p.date || "").slice(0, 10);
        if (url.includes("/attendance/mark-day")) {
          const fullStatus = String(p.status || "").toLowerCase();
          rawLogs = rawLogs.map((log: any) => {
            if (log.date === targetDate || String(log.date || "").slice(0, 10) === targetDate) {
              return {
                ...log,
                status: fullStatus === "clear" ? "not_marked" : fullStatus,
                remarks: p.remarks !== undefined ? p.remarks : log.remarks,
              };
            }
            return log;
          });
        } else if (url.includes("/attendance/mark")) {
          rawLogs = rawLogs.map((log: any) => {
            const match =
              (p.attendanceId && log.id === p.attendanceId) ||
              (p.timetableSlotId && log.timetableSlotId === p.timetableSlotId) ||
              (p.overrideId && log.overrideId === p.overrideId) ||
              (log.date === targetDate && log.subjectId === p.subjectId);
            return match ? { ...log, status: p.status, remarks: p.remarks !== undefined ? p.remarks : log.remarks } : log;
          });
        }
      });

      setLogs(rawLogs);
      setSubjectsList(subjects);

      if (isOverall) {
        // Calculate overall header stats
        let totalAttended = 0;
        let totalClasses = 0;
        subjects.forEach((s: any) => {
          totalAttended += s.attended;
          totalClasses += s.total;
        });
        const pct = totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 0;
        const user = useAuthStore.getState().user;
        // Always use user.targetAttendance as the single source of truth
        const avgTarget = user?.targetAttendance ?? 75;

        const totalCanMiss = Math.floor((totalAttended - (avgTarget / 100) * totalClasses) / (avgTarget / 100));

        setHeaderStats({
          id: "overall",
          name: "Overall",
          target: avgTarget,
          attended: totalAttended,
          total: totalClasses,
          percentage: pct,
          canMiss: totalCanMiss > 0 ? totalCanMiss : 0,
          needAttend: 0,
          statusText: totalClasses === 0
            ? "No classes recorded yet"
            : totalCanMiss > 0
            ? `can miss ${totalCanMiss} lecture${totalCanMiss > 1 ? "s" : ""}`
            : "can't miss the next lecture",
        });
      } else {
        const sub = subjects.find((s: any) => s.id === id);
        if (sub) {
          setHeaderStats({
            id: sub.id,
            name: sub.name,
            code: sub.code,
            target: useAuthStore.getState().user?.targetAttendance ?? 75,
            attended: sub.attended,
            total: sub.total,
            percentage: sub.percentage,
            canMiss: sub.canMiss,
            needAttend: sub.needAttend,
            statusText: sub.statusText,
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch attendance logs:", error);
      // Offline Fallback
      const existingCache = useCacheStore.getState().subject_logs || {};
      const cachedData = existingCache[querySubject];
      const allLogsFallback = existingCache["all"]?.logs || useCacheStore.getState().all_logs || [];

      let rawLogs: AttendanceLogItem[] = [];
      let subjects: any[] = [];

      if (cachedData) {
        rawLogs = cachedData.logs || [];
        subjects = cachedData.subjects || [];
      } else if (allLogsFallback.length > 0) {
        if (isOverall) {
          rawLogs = allLogsFallback;
        } else {
          rawLogs = allLogsFallback.filter((l: any) => l.subjectId === id || l.subject?.id === id);
        }
        subjects = existingCache["all"]?.subjects || useAttendanceStore.getState().subjects || [];
      } else {
        // Fallback to global store
        rawLogs = [];
        subjects = useAttendanceStore.getState().subjects || [];
      }
      // Overlay pendingQueue in offline catch fallback as well
      const pendingQueue = useOfflineStore.getState().queue || [];
      pendingQueue.forEach((q: any) => {
        const p = q.data || q.payload || {};
        const url = String(q.url || "");
        const targetDate = String(p.date || "").slice(0, 10);
        if (url.includes("/attendance/mark-day")) {
          const fullStatus = String(p.status || "").toLowerCase();
          rawLogs = rawLogs.map((log: any) => {
            if (log.date === targetDate || String(log.date || "").slice(0, 10) === targetDate) {
              return { ...log, status: fullStatus === "clear" ? "not_marked" : fullStatus, remarks: p.remarks !== undefined ? p.remarks : log.remarks };
            }
            return log;
          });
        } else if (url.includes("/attendance/mark")) {
          rawLogs = rawLogs.map((log: any) => {
            const match =
              (p.attendanceId && log.id === p.attendanceId) ||
              (p.timetableSlotId && log.timetableSlotId === p.timetableSlotId) ||
              (p.overrideId && log.overrideId === p.overrideId) ||
              (log.date === targetDate && log.subjectId === p.subjectId);
            return match ? { ...log, status: p.status, remarks: p.remarks !== undefined ? p.remarks : log.remarks } : log;
          });
        }
      });


      setLogs(rawLogs);
      setSubjectsList(subjects);

      if (isOverall) {
        let totalAttended = 0;
        let totalClasses = 0;
        subjects.forEach((s: any) => {
          totalAttended += (s.attended || 0);
          totalClasses += (s.total || 0);
        });
        const pct = totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 0;
        const user = useAuthStore.getState().user;
        const avgTarget = user?.targetAttendance ?? 75;
        const totalCanMiss = Math.floor((totalAttended - (avgTarget / 100) * totalClasses) / (avgTarget / 100));

        setHeaderStats({
          id: "overall",
          name: "Overall",
          target: avgTarget,
          attended: totalAttended,
          total: totalClasses,
          percentage: pct,
          canMiss: totalCanMiss > 0 ? totalCanMiss : 0,
          needAttend: 0,
          statusText: totalClasses === 0
            ? "No classes recorded yet"
            : totalCanMiss > 0
            ? `can miss ${totalCanMiss} lecture${totalCanMiss > 1 ? "s" : ""}`
            : "can't miss the next lecture",
        });
      } else {
        let sub = subjects.find((s: any) => s.id === id);
        if (!sub) {
          sub = useAttendanceStore.getState().subjects.find((s: any) => s.id === id || s.subjectId === id);
        }
        if (sub) {
          setHeaderStats({
            id: sub.id || sub.subjectId,
            name: sub.name,
            code: sub.code,
            target: sub.target || (useAuthStore.getState().user?.targetAttendance ?? 75),
            attended: sub.attended || 0,
            total: sub.total || 0,
            percentage: sub.percentage || 0,
            canMiss: sub.canMiss || 0,
            needAttend: sub.needAttend || 0,
            statusText: sub.statusText || (sub.total === 0 ? "No classes recorded yet" : `${sub.attended}/${sub.total} classes`),
          });
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogsData();

    const handleUpdate = (e: any) => {
      if (e?.detail?.source === "subject-detail-page") return;
      fetchLogsData();
    };
    window.addEventListener("attendance-updated", handleUpdate);
    return () => window.removeEventListener("attendance-updated", handleUpdate);
  }, [id]);

    const getLogItemKey = (item: AttendanceLogItem) => {
    return item.id || `${item.subjectId}_${item.date}_${item.timetableSlotId || item.overrideId || "slot"}`;
  };

  // Mark/Edit Attendance
  const handleMarkAttendance = async (
    item: AttendanceLogItem,
    newStatus: "present" | "absent" | "off" | "not_marked"
  ) => {
    if (!isEditMode) return;
    // Trigger Popup Animation
    if (newStatus === "absent") {
      triggerAttendancePopup("crying", "Attendance Dropped! 😭");
    } else if (newStatus === "present") {
      const { overallPercentage, totalAttended, totalClasses } =
        useAttendanceStore.getState();
      const targetPct = useAuthStore.getState().user?.targetAttendance ?? 75;

      let newAttended = totalAttended;
      let newClasses = totalClasses;

      if (
        item.status !== "present" &&
        item.status !== "medical" &&
        item.status !== "od"
      ) {
        newAttended += 1;
        if (
          item.status === null ||
          item.status === "not_marked" ||
          item.status === "off" ||
          item.status === "cancelled"
        ) {
          newClasses += 1;
        }
      }

      const newPercentage =
        newClasses > 0 ? (newAttended / newClasses) * 100 : 0;

      if (overallPercentage < targetPct && newPercentage >= targetPct) {
        triggerAttendancePopup(
          "target_hit",
          `Target ${targetPct}% Touched! 🎯`,
        );
      } else {
        triggerAttendancePopup("thumbs_up", "Awesome! Marked Present 👍");
      }
    }

    // Stage edit in memory
    const itemKey = getLogItemKey(item);
    pendingEditsRef.current.set(itemKey, { item, newStatus });
    
    // Update local state for immediate UI feedback
    setLogs((prev) =>
      prev.map((l) =>
      getLogItemKey(l) === itemKey ? { ...l, status: newStatus } : l,
    )
    );
  };

  const handleStartEditMode = () => {
    initialLogsSnapshotRef.current = JSON.parse(JSON.stringify(logs));
    pendingEditsRef.current.clear();
    setIsEditMode(true);
  };

  const handleDiscardEdits = () => {
    if (initialLogsSnapshotRef.current) {
      setLogs(initialLogsSnapshotRef.current);
      initialLogsSnapshotRef.current = null;
    }
    pendingEditsRef.current.clear();
    setIsEditMode(false);
  };

  const handleCommitEdits = async () => {
    if (pendingEditsRef.current.size === 0) {
      initialLogsSnapshotRef.current = null;
      setIsEditMode(false);
      return;
    }

    const state = useCacheStore.getState();
    const currentSubjectLogs = { ...(state.subject_logs || {}) };

    // 1. Gather baseline subjects to calculate accurate deltas
    const store = useAttendanceStore.getState();
    const existingSubjects =
      store.subjects && store.subjects.length > 0
        ? store.subjects
        : state.subjects?.stats ||
          state.subjects?.subjects ||
          subjectsList ||
          [];
    const updatedSubjects = existingSubjects.map((s: any) => ({ ...s }));

    const isAttendedStatus = (st: string) =>
      ["present", "attended", "medical", "od"].includes(st);
    const isMissedStatus = (st: string) => ["absent", "missed"].includes(st);
    const isOffStatus = (st: string) => ["off", "cancelled"].includes(st);

    for (const [
      itemKey,
      { item, newStatus },
    ] of pendingEditsRef.current.entries()) {
      // Optimistically update subject stats delta
      const subIndex = updatedSubjects.findIndex(
        (s: any) => s.id === item.subjectId || s.subjectId === item.subjectId,
      );
      if (subIndex !== -1) {
        const s = { ...updatedSubjects[subIndex] };
        const oldSt = String(item.status || "").toLowerCase();
        const newSt = String(newStatus || "").toLowerCase();

        if (oldSt !== newSt) {
          // Roll back previous status
          if (isAttendedStatus(oldSt)) {
            s.attended = Math.max(0, (Number(s.attended) || 0) - 1);
            s.total = Math.max(0, (Number(s.total) || 0) - 1);
          } else if (isMissedStatus(oldSt)) {
            s.missed = Math.max(0, (Number(s.missed) || 0) - 1);
            s.total = Math.max(0, (Number(s.total) || 0) - 1);
          } else if (isOffStatus(oldSt)) {
            s.off = Math.max(0, (Number(s.off) || 0) - 1);
          }

          // Apply newly edited status
          if (isAttendedStatus(newSt)) {
            s.attended = (Number(s.attended) || 0) + 1;
            s.total = (Number(s.total) || 0) + 1;
          } else if (isMissedStatus(newSt)) {
            s.missed = (Number(s.missed) || 0) + 1;
            s.total = (Number(s.total) || 0) + 1;
          } else if (isOffStatus(newSt)) {
            s.off = (Number(s.off) || 0) + 1;
          }

          s.percentage =
            s.total > 0 ? Number(((s.attended / s.total) * 100).toFixed(1)) : 0;
          const target =
            Number(s.target) ||
            (useAuthStore.getState().user?.targetAttendance ?? 75);
          const canMiss =
            s.percentage >= target && target > 0
              ? Math.floor(
                  (s.attended - (target / 100) * s.total) / (target / 100),
                )
              : 0;
          const needAttend =
            s.percentage < target && target < 100
              ? Math.ceil(
                  ((target / 100) * s.total - s.attended) / (1 - target / 100),
                )
              : 0;
          s.canMiss = canMiss;
          s.needAttend = needAttend;
          s.statusText =
            s.total === 0
              ? "No classes recorded yet"
              : canMiss > 0
                ? `can miss ${canMiss} lecture${canMiss > 1 ? "s" : ""}`
                : needAttend > 0
                  ? `need ${needAttend} lecture${needAttend > 1 ? "s" : ""}`
                  : "on track";

          updatedSubjects[subIndex] = s;
        }
      }

      // Update Subject Logs Cache
      const updateCacheEntry = (key: string) => {
        const entry = currentSubjectLogs[key];
        if (entry && Array.isArray(entry.logs)) {
          currentSubjectLogs[key] = {
            ...entry,
            logs: entry.logs.map((l: any) => {
              if (getLogItemKey(l) === itemKey) {
                const sub = updatedSubjects.find(
                  (s: any) =>
                    s.id === l.subjectId || s.subjectId === l.subjectId,
                );
                return {
                  ...l,
                  status: newStatus,
                  currentPercentage: sub?.percentage ?? l.currentPercentage,
                  statusText: sub?.statusText ?? l.statusText,
                };
              }
              return l;
            }),
          };
        }
      };
      updateCacheEntry("all");
      if (item.subjectId) updateCacheEntry(item.subjectId);

      // Update Today cache
      const todayEntry = state.today?.[item.date];
      if (todayEntry && Array.isArray(todayEntry.agenda)) {
        const nextAgenda = todayEntry.agenda.map((a: any) => {
          const match =
            (item.id && a.attendanceId === item.id) ||
            (item.timetableSlotId && a.id === item.timetableSlotId) ||
            (item.overrideId && a.id === item.overrideId) ||
            a.subject?.id === item.subjectId;
          return match
            ? { ...a, status: newStatus === "not_marked" ? null : newStatus }
            : a;
        });
        state.setCache("today", {
          ...state.today,
          [item.date]: { ...todayEntry, agenda: nextAgenda },
        });
      }

      // Update Calendar Cache so dot colors reflect edited status
      const monthStr = item.date.substring(0, 7);
      const existingMonth = state.calendar?.[monthStr];
      if (existingMonth && existingMonth.details?.[item.date]) {
        const nextDayDetails = (existingMonth.details[item.date] || []).map(
          (d: any) => {
            const match =
              (item.id && d.id === item.id) ||
              (item.timetableSlotId &&
                d.timetableSlotId === item.timetableSlotId) ||
              (item.overrideId && d.overrideId === item.overrideId) ||
              d.subjectId === item.subjectId;
            return match ? { ...d, status: newStatus } : d;
          },
        );

        const marked = nextDayDetails.filter(
          (d: any) =>
            d.status && d.status !== "not_marked" && d.status !== "future",
        );
        const isFullyMarked =
          nextDayDetails.length > 0 && marked.length === nextDayDetails.length;
        const todayDateStr = new Date().toISOString().slice(0, 10);
        let nextDayStatus = item.date > todayDateStr ? "future" : "not_marked";
        if (isFullyMarked) {
          const hasAttended = marked.some((d: any) =>
            isAttendedStatus(String(d.status).toLowerCase()),
          );
          const hasMissed = marked.some((d: any) =>
            isMissedStatus(String(d.status).toLowerCase()),
          );
          const allOff = marked.every((d: any) =>
            isOffStatus(String(d.status).toLowerCase()),
          );
          if (allOff) nextDayStatus = "off";
          else if (hasAttended && hasMissed) nextDayStatus = "mixed";
          else if (hasAttended) nextDayStatus = "attended";
          else if (hasMissed) nextDayStatus = "missed";
          else nextDayStatus = "off";
        }

        state.setCache("calendar", {
          ...state.calendar,
          [monthStr]: {
            ...existingMonth,
            days: { ...(existingMonth.days || {}), [item.date]: nextDayStatus },
            details: {
              ...(existingMonth.details || {}),
              [item.date]: nextDayDetails,
            },
          },
        });
      }

      // Send or queue mutation
      try {
        await api.post("/attendance/mark", {
          subjectId: item.subjectId,
          date: item.date,
          status: newStatus,
          timetableSlotId: item.timetableSlotId,
          overrideId: item.overrideId,
          attendanceId: item.id || (item as any).attendanceId,
          remarks: item.remarks || undefined,
        });
      } catch (err) {
        console.warn("Failed to mark via network, enqueuing offline:", err);
        useOfflineStore.getState().enqueue({
          method: "POST",
          url: "/attendance/mark",
          data: {
            subjectId: item.subjectId,
            date: item.date,
            status: newStatus,
            timetableSlotId: item.timetableSlotId,
            overrideId: item.overrideId,
            attendanceId: item.id || (item as any).attendanceId,
            remarks: item.remarks || undefined,
          },
        });
      }
    }

    // 2. Compute overall totals across all subjects
    const totalAttended = updatedSubjects.reduce(
      (sum: number, s: any) => sum + (Number(s.attended) || 0),
      0,
    );
    const totalClasses = updatedSubjects.reduce(
      (sum: number, s: any) => sum + (Number(s.total) || 0),
      0,
    );
    const overallPercentage =
      totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 0;
    const avgTarget = useAuthStore.getState().user?.targetAttendance ?? 75;
    const totalCanMiss = Math.floor(
      (totalAttended - (avgTarget / 100) * totalClasses) / (avgTarget / 100),
    );
    const totalNeedAttend = Math.ceil(
      ((avgTarget / 100) * totalClasses - totalAttended) /
        (1 - avgTarget / 100),
    );

    // 3. Immediately update useAttendanceStore (instantly updates TopBar global percentage)
    useAttendanceStore.setState({
      subjects: updatedSubjects,
      totalAttended,
      totalClasses,
      overallPercentage,
    });

    // 4. Update Cache Store so SubjectsPage and other screens load updated stats offline/online
    state.setCache("subjects", {
      ...(state.subjects || {}),
      stats: updatedSubjects,
      subjects: state.subjects?.subjects || [],
      activeSemesterId: state.subjects?.activeSemesterId || null,
    });
    state.setCache("subject_logs", currentSubjectLogs);

    // 5. Update local state on SubjectDetailPage
    setSubjectsList(updatedSubjects);
    setLogs((prev) =>
      prev.map((l) => {
        const sub = updatedSubjects.find(
          (s: any) => s.id === l.subjectId || s.subjectId === l.subjectId,
        );
        if (sub) {
          return {
            ...l,
            currentPercentage: sub.percentage,
            statusText: sub.statusText,
          };
        }
        return l;
      }),
    );

    if (isOverall) {
      setHeaderStats({
        id: "overall",
        name: "Overall",
        target: avgTarget,
        attended: totalAttended,
        total: totalClasses,
        percentage: overallPercentage,
        canMiss: totalCanMiss > 0 ? totalCanMiss : 0,
        needAttend: totalNeedAttend > 0 ? totalNeedAttend : 0,
        statusText:
          totalClasses === 0
            ? "No classes recorded yet"
            : totalCanMiss > 0
              ? `can miss ${totalCanMiss} lecture${totalCanMiss > 1 ? "s" : ""}`
              : "can't miss the next lecture",
      });
    } else {
      const currentSub = updatedSubjects.find(
        (s: any) => s.id === id || s.subjectId === id,
      );
      if (currentSub) {
        setHeaderStats({
          id: currentSub.id || currentSub.subjectId,
          name: currentSub.name,
          code: currentSub.code,
          target: currentSub.target || avgTarget,
          attended: currentSub.attended || 0,
          total: currentSub.total || 0,
          percentage: currentSub.percentage || 0,
          canMiss: currentSub.canMiss || 0,
          needAttend: currentSub.needAttend || 0,
          statusText:
            currentSub.statusText ||
            `${currentSub.attended}/${currentSub.total} classes`,
        });
      }
    }

    pendingEditsRef.current.clear();
    initialLogsSnapshotRef.current = null;
    setIsEditMode(false);
    useAttendanceStore.getState().fetchStats(true);
    window.dispatchEvent(
      new CustomEvent("attendance-updated", {
        detail: { source: "subject-detail-page" },
      }),
    );
  };

  const handleOpenRemarkModal = (item: AttendanceLogItem) => {
    hapticSelection();
    setSelectedRemarkLog({ item, status: item.status || "present" });
    setRemarkInput(item.remarks || "");
  };

  const handleSaveRemark = async () => {
    if (!selectedRemarkLog) return;
    const finalRemark = remarkInput.trim() || null;
    setIsSavingRemark(true);
    try {
      const item = selectedRemarkLog.item;
      const statusToSave = selectedRemarkLog.status === "not_marked" ? "not_marked" : selectedRemarkLog.status;

      await api.post("/attendance/mark", {
        subjectId: item.subjectId,
        date: item.date,
        status: statusToSave,
        timetableSlotId: item.timetableSlotId,
        overrideId: item.overrideId,
        attendanceId: item.id || (item as any).attendanceId,
        remarks: finalRemark,
      });

      const itemKey = getLogItemKey(item);
      const updatedWithRemark = logs.map((l) => (getLogItemKey(l) === itemKey ? { ...l, remarks: finalRemark } : l));
      setLogs(updatedWithRemark);

      const currentCache = useCacheStore.getState().subject_logs || {};
      const existingEntry = currentCache[querySubject] || {};
      useCacheStore.getState().setCache('subject_logs', {
        ...currentCache,
        [querySubject]: { ...existingEntry, logs: updatedWithRemark }
      });

      toast.success(finalRemark ? "Remark saved" : "Remark cleared");
      hapticSuccess();
      setSelectedRemarkLog(null);
      setRemarkInput("");

      useAttendanceStore.getState().fetchStats(true);
      window.dispatchEvent(new CustomEvent("attendance-updated", { detail: { source: "subject-detail-page" } }));
    } catch (err) {
      console.error("Failed to save remark:", err);
      toast.error("Failed to save remark");
    } finally {
      setIsSavingRemark(false);
    }
  };

  const handleRemoveRemarkOnly = async () => {
    if (!selectedRemarkLog) return;
    setRemarkInput("");
    setIsSavingRemark(true);
    try {
      const item = selectedRemarkLog.item;
      const statusToSave = selectedRemarkLog.status === "not_marked" ? "not_marked" : selectedRemarkLog.status;

      await api.post("/attendance/mark", {
        subjectId: item.subjectId,
        date: item.date,
        status: statusToSave,
        timetableSlotId: item.timetableSlotId,
        overrideId: item.overrideId,
        attendanceId: item.id || (item as any).attendanceId,
        remarks: null,
      });

      const itemKey = getLogItemKey(item);
      setLogs((prev) =>
        prev.map((l) => (getLogItemKey(l) === itemKey ? { ...l, remarks: null } : l))
      );

      toast.success("Remark removed");
      hapticSuccess();
      setSelectedRemarkLog(null);
      setRemarkInput("");

      useAttendanceStore.getState().fetchStats(true);
      useCacheStore.getState().setCache("calendar", {});
      useCacheStore.getState().setCache("today", {});
      window.dispatchEvent(new CustomEvent("attendance-updated", { detail: { source: "subject-detail-page" } }));
    } catch (err) {
      console.error("Failed to remove remark:", err);
      toast.error("Failed to remove remark");
    } finally {
      setIsSavingRemark(false);
    }
  };

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    // Subject filter
    if (selectedSubjectFilter !== "all" && log.subjectId !== selectedSubjectFilter) {
      return false;
    }
    // Status filter
    if (selectedStatusFilter !== "all") {
      if (selectedStatusFilter === "attended" && log.status !== "present" && log.status !== "medical" && log.status !== "od") return false;
      if (selectedStatusFilter === "missed" && log.status !== "absent") return false;
      if (selectedStatusFilter === "off" && log.status !== "off" && log.status !== "cancelled") return false;
      if (selectedStatusFilter === "not_marked" && log.status !== "not_marked") return false;
    }
    // Date filter
    if (selectedDateFilter === "7days") {
      const now = Date.now();
      const diffDays = (now - log.timestamp) / (1000 * 60 * 60 * 24);
      if (diffDays > 7) return false;
    } else if (selectedDateFilter === "30days") {
      const now = Date.now();
      const diffDays = (now - log.timestamp) / (1000 * 60 * 60 * 24);
      if (diffDays > 30) return false;
    }

    return true;
  });

// Sort filteredLogs strictly by date descending first so offline/optimistic edits never jump out of date order
  const sortedFilteredLogs = [...filteredLogs].sort((a, b) =>
    String(b.date || "").slice(0, 10).localeCompare(String(a.date || "").slice(0, 10))
  );

  // Group filtered logs by normalized dateFormatted and sort each date's classes chronologically by startTime
  const groupedByDate: Record<string, AttendanceLogItem[]> = {};
  sortedFilteredLogs.forEach((log) => {
    const dateStr = String(log.date || "").slice(0, 10);
    const label =
      dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
        ? new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
            timeZone: "UTC",
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : log.dateFormatted;
    if (!groupedByDate[label]) {
      groupedByDate[label] = [];
    }
    groupedByDate[label].push(log);
  });

  const resolveLogStartTime = (log: AttendanceLogItem): string => {
    if (log.startTime && log.startTime !== "00:00") return log.startTime;
    if ((log as any).time && (log as any).time !== "00:00") {
      log.startTime = (log as any).time;
      return (log as any).time;
    }
    try {
      const cacheState = useCacheStore.getState();
      const dateStr = String(log.date || "").slice(0, 10);
      const normName = String(log.subjectName || "").trim().toLowerCase();
      const logIsExtra = Boolean(log.isExtra || log.overrideId || log.slotType === "Extra");

      const todayAgenda: any[] = cacheState.today?.[dateStr]?.agenda || [];
      const matchAgenda =
        todayAgenda.find(
          (a: any) =>
            (log.overrideId && a.id === log.overrideId) ||
            (log.timetableSlotId && a.id === log.timetableSlotId) ||
            (Boolean(a.type === "override" || a.isExtra) === logIsExtra &&
              ((log.subjectId && a.subject?.id === log.subjectId) ||
                String(a.subject?.name || a.subjectName || "").trim().toLowerCase() === normName))
        ) ||
        todayAgenda.find(
          (a: any) =>
            (log.subjectId && a.subject?.id === log.subjectId) ||
            String(a.subject?.name || a.subjectName || "").trim().toLowerCase() === normName
        );
      if (matchAgenda?.startTime && matchAgenda.startTime !== "00:00") {
        log.startTime = matchAgenda.startTime;
        return matchAgenda.startTime;
      }

      const ttStore = cacheState.timetable;
      const activeSlots: any[] = Array.isArray(ttStore) ? ttStore : (ttStore?.slots || []);
      const semId =
        (!Array.isArray(ttStore) && ttStore?.activeSemester?.id) ||
        cacheState.semester?.activeSemester?.id ||
        useAttendanceStore.getState().activeSemesterId;
      const archivedVersions: any[] =
        (!Array.isArray(ttStore) && ttStore?.archivedSlots) ||
        (semId && (cacheState as any)[`archived_timetables_${semId}`]) ||
        cacheState.archived_timetables ||
        [];
      const archivedSlots: any[] = archivedVersions
        .filter((v: any) => !v?.isCurrent && v?.id !== "current_version")
        .flatMap((v: any) => v?.slots || []);
      const allSlots = [...archivedSlots, ...activeSlots];
      const d = new Date(dateStr + "T00:00:00");
      const jsDay = d.getDay();
      const dbDay = jsDay === 0 ? 6 : jsDay - 1;

      const subjectSlots = allSlots.filter(
        (s: any) =>
          s.subjectId === log.subjectId ||
          String(s.subject?.name || s.subjectName || "").trim().toLowerCase() === normName
      );
      const sortedSubjectSlots = [...subjectSlots].sort((a: any, b: any) => {
        const aUntil = a.validUntil ? String(a.validUntil).slice(0, 10) : null;
        const bUntil = b.validUntil ? String(b.validUntil).slice(0, 10) : null;
        const aValidOnDate = !aUntil || aUntil >= dateStr;
        const bValidOnDate = !bUntil || bUntil >= dateStr;
        if (aValidOnDate !== bValidOnDate) return aValidOnDate ? -1 : 1;
        if (aUntil && bUntil && aUntil !== bUntil) return aUntil.localeCompare(bUntil);
        if (aUntil && !bUntil) return -1;
        if (!aUntil && bUntil) return 1;
        const aFrom = a.validFrom ? String(a.validFrom).slice(0, 10) : "0000-00-00";
        const bFrom = b.validFrom ? String(b.validFrom).slice(0, 10) : "0000-00-00";
        return aFrom.localeCompare(bFrom);
      });

      const matchSlot =
        sortedSubjectSlots.find(
          (s: any) =>
            s.dayOfWeek === dbDay &&
            (!s.validFrom || String(s.validFrom).slice(0, 10) <= dateStr) &&
            (!s.validUntil || String(s.validUntil).slice(0, 10) >= dateStr)
        ) ||
        sortedSubjectSlots.find(
          (s: any) =>
            s.dayOfWeek === dbDay &&
            (!s.validUntil || String(s.validUntil).slice(0, 10) >= dateStr)
        ) ||
        sortedSubjectSlots.find((s: any) => s.dayOfWeek === dbDay) ||
        sortedSubjectSlots[0];
      if (matchSlot?.startTime && matchSlot.startTime !== "00:00") {
        log.startTime = matchSlot.startTime;
        if (!log.endTime || log.endTime === "00:00") {
          log.endTime = matchSlot.endTime || log.endTime;
        }
        return matchSlot.startTime;
      }
    } catch {
      // ignore
    }
    return "99:99";
  };

  Object.keys(groupedByDate).forEach((dateKey) => {
    groupedByDate[dateKey].sort((a, b) => resolveLogStartTime(a).localeCompare(resolveLogStartTime(b)));
  });

  if (isLoading && logs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const pct = Number(headerStats?.percentage ?? 0);
  const targetPct = headerStats ? headerStats.target : (useAuthStore.getState().user?.targetAttendance ?? 75);

  const getRemainingClasses = () => {
    if (!headerStats) return 30; // fallback
    if (isOverall) {
      return storeSubjects.reduce((acc, sub) => acc + (sub.remainingClasses || 0), 0);
    } else {
      const sub = storeSubjects.find(s => s.id === id);
      return sub?.remainingClasses || 30;
    }
  };
  const remaining = getRemainingClasses();


  return (
    <div className="min-h-screen pb-40 md:pb-28 relative bg-[#F4EED0] dark:bg-[#050508] text-foreground">
      {/* 3D Fluid Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Grain overlay for cinematic feel */}
        <div
          className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06]"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")',
          }}
        />
      </div>

      <div className="relative z-10">
        {/* Transparent Glassmorphism Header */}
        <div className="sticky top-0 z-30 bg-[#F4EED0]/60 dark:bg-[#050508]/60 backdrop-blur-xl border-b border-black/5 dark:border-white/5 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                if (isEditMode) handleDiscardEdits();
                navigate("/subjects", { replace: true });
              }}
              className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors text-black/70 dark:text-white/70"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              className="p-2 rounded-xl text-black/70 dark:text-white/70 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              title="Filter options"
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cinematic Edge-to-Edge Hero Section */}
        <div className="px-6 pt-16 pb-12 max-w-4xl mx-auto text-center flex flex-col items-center justify-center min-h-[35vh]">
          <h1 className="cinematic-font text-5xl md:text-7xl lg:text-8xl text-black dark:text-white leading-[0.9] text-balance drop-shadow-2xl flex flex-wrap justify-center items-center gap-x-3">
            {(() => {
              const name =
                headerStats?.name ||
                (isOverall
                  ? "Overall"
                  : storeSubjects.find((s) => s.id === id)?.name || "Subject");
              // Split by 'and' or '&' to inject the gold accent
              const parts = name.split(/(\bAND\b|\&)/i);
              return parts.map((part, i) =>
                part.toUpperCase() === "AND" || part === "&" ? (
                  <span key={i} className="text-[#D4AF37] dark:text-[#FFD700]">
                    &amp;
                  </span>
                ) : (
                  <span key={i}>{part}</span>
                ),
              );
            })()}
          </h1>

          <div className="mt-10 flex items-center justify-center gap-8">
            <div className="flex flex-col items-center">
              <span className="cinematic-font text-4xl md:text-5xl text-[#D4AF37] dark:text-[#FFD700] drop-shadow-lg">
                {Number(pct ?? 0).toFixed(1)}%
              </span>
              <span className="text-[10px] font-bold text-black/50 dark:text-white/50 tracking-[0.2em] uppercase mt-1">
                Current
              </span>
            </div>
            <div className="w-px h-12 bg-black/10 dark:bg-white/10" />
            <div className="flex flex-col items-center">
              <span className="cinematic-font text-4xl md:text-5xl text-black dark:text-white drop-shadow-lg">
                {targetPct}%
              </span>
              <span className="text-[10px] font-bold text-black/50 dark:text-white/50 tracking-[0.2em] uppercase mt-1">
                Target
              </span>
            </div>
          </div>

          <p className="mt-8 text-sm md:text-base font-medium px-5 py-2.5 bg-black/5 dark:bg-white/5 backdrop-blur-md rounded-full border border-black/10 dark:border-white/10 text-black/80 dark:text-white/80 shadow-xl">
            {headerStats?.statusText || "can miss 0 lectures"}
          </p>
        </div>

        <div className="max-w-3xl mx-auto px-4 pt-4 space-y-4">
          {/* Toggle between Logs & Simulator for single subject */}
          {!isOverall && (
            <div className="flex bg-muted/50 p-1 rounded-2xl border border-border">
              <button
                onClick={() => setActiveTab("logs")}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  activeTab === "logs"
                    ? "bg-card text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Attendance Logs
              </button>
              <button
                onClick={() => setActiveTab("simulator")}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  activeTab === "simulator"
                    ? "bg-card text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Attendance Simulator
              </button>
            </div>
          )}

          {activeTab === "logs" ? (
            <>
              {/* Click-away backdrop for dropdown menus */}
              {(showDateMenu || showSubjectMenu || showStatusMenu) && (
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => {
                    setShowDateMenu(false);
                    setShowSubjectMenu(false);
                    setShowStatusMenu(false);
                  }}
                />
              )}

              {/* Filter Pills Bar */}
              <div className="flex flex-wrap items-center gap-2 pb-1 text-xs relative z-40">
                {/* Total Records Pill */}
                <span className="bg-emerald-500/10 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-xl font-medium shrink-0">
                  {filteredLogs.length} record
                  {filteredLogs.length !== 1 ? "s" : ""}
                </span>

                {/* Date Filter Pill */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => {
                      setShowDateMenu(!showDateMenu);
                      setShowSubjectMenu(false);
                      setShowStatusMenu(false);
                    }}
                    className="bg-muted/60 border border-border hover:border-foreground/20 text-foreground px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <span>
                      {selectedDateFilter === "all"
                        ? "All dates"
                        : selectedDateFilter === "7days"
                          ? "Last 7 days"
                          : "Last 30 days"}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>

                  {showDateMenu && (
                    <div className="absolute top-full left-0 mt-1.5 w-36 bg-card border border-border rounded-2xl shadow-xl z-40 p-1 space-y-0.5">
                      {[
                        { id: "all", label: "All dates" },
                        { id: "7days", label: "Last 7 days" },
                        { id: "30days", label: "Last 30 days" },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => {
                            setSelectedDateFilter(opt.id);
                            setShowDateMenu(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                            selectedDateFilter === opt.id
                              ? "bg-primary/20 text-primary"
                              : "hover:bg-muted text-foreground"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Subject Filter Pill (if overall) */}
                {isOverall && (
                  <div className="relative shrink-0">
                    <button
                      onClick={() => {
                        setShowSubjectMenu(!showSubjectMenu);
                        setShowDateMenu(false);
                        setShowStatusMenu(false);
                      }}
                      className="bg-muted/60 border border-border hover:border-foreground/20 text-foreground px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <span>
                        {selectedSubjectFilter === "all"
                          ? "All subjects"
                          : subjectsList.find(
                              (s) => s.id === selectedSubjectFilter,
                            )?.name ||
                            storeSubjects.find(
                              (s) => s.id === selectedSubjectFilter,
                            )?.name ||
                            "Subject"}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>

                    {showSubjectMenu && (
                      <div className="absolute top-full left-0 mt-1.5 w-44 bg-card border border-border rounded-2xl shadow-xl z-40 p-1 space-y-0.5 max-h-48 overflow-y-auto">
                        <button
                          onClick={() => {
                            setSelectedSubjectFilter("all");
                            setShowSubjectMenu(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                            selectedSubjectFilter === "all"
                              ? "bg-primary/20 text-primary"
                              : "hover:bg-muted text-foreground"
                          }`}
                        >
                          All subjects
                        </button>
                        {subjectsList.map((sub) => (
                          <button
                            key={sub.id}
                            onClick={() => {
                              setSelectedSubjectFilter(sub.id);
                              setShowSubjectMenu(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors truncate ${
                              selectedSubjectFilter === sub.id
                                ? "bg-primary/20 text-primary"
                                : "hover:bg-muted text-foreground"
                            }`}
                          >
                            {sub.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Status Filter Pill */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => {
                      setShowStatusMenu(!showStatusMenu);
                      setShowDateMenu(false);
                      setShowSubjectMenu(false);
                    }}
                    className="bg-muted/60 border border-border hover:border-foreground/20 text-foreground px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <span className="capitalize">
                      {selectedStatusFilter === "all"
                        ? "All attendance"
                        : selectedStatusFilter.replace("_", " ")}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>

                  {showStatusMenu && (
                    <div className="absolute top-full right-0 mt-1.5 w-36 bg-card border border-border rounded-2xl shadow-xl z-40 p-1 space-y-0.5">
                      {[
                        { id: "all", label: "All attendance" },
                        { id: "attended", label: "Attended" },
                        { id: "missed", label: "Missed" },
                        { id: "off", label: "Off" },
                        { id: "not_marked", label: "Not Marked" },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => {
                            setSelectedStatusFilter(opt.id);
                            setShowStatusMenu(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                            selectedStatusFilter === opt.id
                              ? "bg-primary/20 text-primary"
                              : "hover:bg-muted text-foreground"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Attendance Timeline grouped by Date */}
              {Object.keys(groupedByDate).length === 0 ? (
                <div className="text-center py-12 bg-card border border-border rounded-3xl p-6">
                  <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <h3 className="text-sm font-bold text-foreground">
                    No Attendance Logs Found
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try adjusting your filter options or mark attendance from
                    the Today page.
                  </p>
                </div>
              ) : (
                <div className="space-y-6 pt-2">
                  {Object.entries(groupedByDate).map(([dateLabel, items]) => (
                    <div key={dateLabel} className="space-y-2">
                      {/* Date Section Header */}
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                        {dateLabel}
                      </h3>

                      {/* Class Cards for this date */}
                      <div className="space-y-3">
                        {items.map((item) => {
                          const isAttended =
                            item.status === "present" ||
                            item.status === "medical" ||
                            item.status === "od";
                          const isMissed = item.status === "absent";
                          const isOff =
                            item.status === "off" ||
                            item.status === "cancelled";
                          const isNotMarked =
                            !item.status || item.status === "not_marked";

                          return (
                            <div
                              key={item.id}
                              className="bg-card/90 border border-border/80 hover:border-border rounded-2xl p-4 shadow-sm transition-all relative overflow-hidden"
                            >
                              {/* Color accent line */}
                              <div
                                className="absolute top-0 left-0 w-1 h-full rounded-l-2xl"
                                style={{
                                  backgroundColor:
                                    item.subjectColor || "#8b5cf6",
                                }}
                              />

                              <div className="pl-2 space-y-1">
                                {/* If overall view: show Subject Mini Card Header */}
                                {isOverall && (
                                  <div className="flex items-start justify-between gap-3 pb-1">
                                    <div className="flex items-center gap-3">
                                      {/* Subject badge e.g. 90.00 / 75 */}
                                      <div className="flex flex-col items-center justify-center bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-2 py-1 min-w-[50px]">
                                        {(() => {
                                          const itemPct =
                                            item.currentPercentage ??
                                            subjectsList.find(
                                              (s: any) =>
                                                s.id === item.subjectId,
                                            )?.percentage ??
                                            0;
                                          const itemTarget =
                                            item.target ??
                                            subjectsList.find(
                                              (s: any) =>
                                                s.id === item.subjectId,
                                            )?.target ??
                                            useAuthStore.getState().user
                                              ?.targetAttendance ??
                                            75;
                                          return (
                                            <>
                                              <span className="text-xs font-bold text-emerald-500 leading-none">
                                                {Number(itemPct ?? 0).toFixed(
                                                  1,
                                                )}
                                                %
                                              </span>
                                              <div className="w-full h-px bg-emerald-500/20 my-0.5" />
                                              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 leading-none">
                                                {itemTarget}
                                              </span>
                                            </>
                                          );
                                        })()}
                                      </div>

                                      <div>
                                        <h4 className="text-sm font-bold text-foreground leading-tight">
                                          {item.subjectName}
                                        </h4>
                                        <p className="text-[11px] text-emerald-500 font-medium">
                                          {item.statusText}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Slot Line & Attendance Actions */}
                                <div className="flex items-center justify-between gap-3 pt-0.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={`text-sm font-semibold ${item.isExtra || item.slotType === "Extra" ? "text-amber-600 dark:text-amber-400 font-bold" : "text-emerald-600 dark:text-emerald-400"}`}
                                    >
                                      {item.slotType}
                                    </span>
                                    {(item.isExtra ||
                                      item.slotType === "Extra") && (
                                      <span className="bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                                        <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                        Extra Lecture
                                      </span>
                                    )}
                                  </div>

                                  {/* Attendance Status Controls */}
                                  {isEditMode ? (
                                    /* 4 Quick Action Icons in Edit Mode */
                                    <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-full border border-border">
                                      {/* Off 🚫 */}
                                      <button
                                        onClick={() =>
                                          handleMarkAttendance(item, "off")
                                        }
                                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                                          isOff
                                            ? "bg-amber-500 text-white shadow-sm"
                                            : "text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"
                                        }`}
                                        title="Mark Off"
                                      >
                                        <Ban className="w-3.5 h-3.5" />
                                      </button>

                                      {/* Clear / Not Marked ➖ */}
                                      <button
                                        onClick={() =>
                                          handleMarkAttendance(
                                            item,
                                            "not_marked",
                                          )
                                        }
                                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                                          isNotMarked
                                            ? "bg-muted-foreground text-background shadow-sm"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                        }`}
                                        title="Clear Attendance"
                                      >
                                        <Minus className="w-3.5 h-3.5" />
                                      </button>

                                      {/* Missed / Absent ✕ */}
                                      <button
                                        onClick={() =>
                                          handleMarkAttendance(item, "absent")
                                        }
                                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                                          isMissed
                                            ? "bg-rose-500 text-white shadow-sm"
                                            : "text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                                        }`}
                                        title="Mark Missed"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>

                                      {/* Attended / Present ✓ */}
                                      <button
                                        onClick={() =>
                                          handleMarkAttendance(item, "present")
                                        }
                                        className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-[transform,opacity] duration-75 active:scale-95 ${
                                          isAttended
                                            ? "bg-emerald-500 text-white shadow-sm"
                                            : "text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"
                                        }`}
                                        title="Mark Attended"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    /* Read-Only Status Badge in View Mode (Updates strictly via Edit Attendance)
                                     */
                                    <div
                                      className={`px-3 py-1.5 rounded-2xl text-xs font-bold border flex items-center gap-1.5 shadow-sm select-none cursor-default ${
                                        isAttended
                                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                          : isMissed
                                            ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                                            : isOff
                                              ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                              : "border-border bg-muted/40 text-muted-foreground"
                                      }`}
                                    >
                                      <span>
                                        {isAttended
                                          ? "Attended"
                                          : isMissed
                                            ? "Missed"
                                            : isOff
                                              ? "Off"
                                              : "Not Marked"}
                                      </span>
                                      {isAttended && (
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                      )}
                                      {isMissed && (
                                        <XCircle className="w-3.5 h-3.5" />
                                      )}
                                      {isOff && <Ban className="w-3.5 h-3.5" />}
                                      {isNotMarked && (
                                        <Minus className="w-3.5 h-3.5" />
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Log Remarks Context */}
                                {item.remarks ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenRemarkModal(item);
                                    }}
                                    className="mt-1.5 bg-muted/40 hover:bg-muted/70 border border-border/60 hover:border-primary/40 rounded-xl px-3 py-2 flex items-start justify-between gap-2 transition-all cursor-pointer text-left group w-full"
                                    title="Click to edit or remove remark"
                                  >
                                    <div className="flex items-start gap-2 min-w-0 flex-1">
                                      <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                                      <div className="flex-1 min-w-0">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1.5 opacity-70">
                                          Remark:
                                        </span>
                                        <span className="text-xs text-foreground/90 font-medium leading-relaxed italic truncate">
                                          {item.remarks}
                                        </span>
                                      </div>
                                    </div>
                                    <Pencil className="w-3 h-3 text-muted-foreground opacity-40 group-hover:opacity-100 group-hover:text-primary shrink-0 mt-0.5 transition-opacity" />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenRemarkModal(item);
                                    }}
                                    className="mt-1.5 text-xs text-muted-foreground/70 hover:text-primary border border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 rounded-xl px-2.5 py-1 flex items-center gap-1.5 transition-all cursor-pointer w-fit"
                                    title="Add a remark (Bunk reason, teacher absent, proxy, etc.)"
                                  >
                                    <MessageSquare className="w-3 h-3 text-muted-foreground/60 group-hover:text-primary shrink-0" />
                                    <span className="text-[11px] font-medium">
                                      + Add Remark
                                    </span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Attendance What-If Simulator for single subject */
            <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    Attendance Simulator
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Project attendance to the end of the semester.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <label className="text-xs font-semibold text-emerald-500">
                          Classes to ATTEND
                        </label>
                        <span className="text-base font-bold text-foreground">
                          {simAttended}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={headerStats?.attended || 0}
                        max={(headerStats?.attended || 0) + remaining}
                        value={simAttended}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setSimAttended(val);
                          const expectedTotal =
                            (headerStats?.total || 0) + remaining;
                          if (val + simMissed > expectedTotal) {
                            setSimMissed(expectedTotal - val);
                          }
                        }}
                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <label className="text-xs font-semibold text-rose-500">
                          Classes to MISS
                        </label>
                        <span className="text-base font-bold text-foreground">
                          {simMissed}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={
                          (headerStats?.total || 0) -
                          (headerStats?.attended || 0)
                        }
                        max={
                          (headerStats?.total || 0) -
                          (headerStats?.attended || 0) +
                          remaining
                        }
                        value={simMissed}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setSimMissed(val);
                          const expectedTotal =
                            (headerStats?.total || 0) + remaining;
                          if (val + simAttended > expectedTotal) {
                            setSimAttended(expectedTotal - val);
                          }
                        }}
                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-rose-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Simulation Result */}
                {headerStats &&
                  (() => {
                    const projAtt = simAttended;
                    const projTot = simAttended + simMissed;
                    const projPct = projTot > 0 ? (projAtt / projTot) * 100 : 0;
                    const isSafe = projPct >= headerStats.target;

                    return (
                      <div className="flex flex-col items-center justify-center p-6 bg-muted/30 border border-border rounded-2xl">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                          Projected Percentage
                        </span>
                        <span
                          className={`text-4xl font-extrabold ${
                            isSafe ? "text-emerald-500" : "text-rose-500"
                          }`}
                        >
                          {Number(projPct ?? 0).toFixed(1)}%
                        </span>
                        <div className="flex flex-col items-center gap-1 mt-1 text-center">
                          <span className="text-xs text-muted-foreground">
                            Target: {headerStats.target}%
                          </span>
                          <span className="text-[10px] text-muted-foreground/80 max-w-[200px]">
                            Expected Classes by End of Semester:{" "}
                            {headerStats.total + remaining}
                          </span>
                        </div>

                        <div className="mt-4">
                          {isSafe ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              <ShieldCheck className="w-3.5 h-3.5" /> On Track
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                              <AlertTriangle className="w-3.5 h-3.5" /> Below
                              Target
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
              </div>
            </div>
          )}
        </div>

        {/* Floating Bottom Pill Button: [ ✏️ Edit Attendance ] */}
        <div className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] md:bottom-8 left-1/2 -translate-x-1/2 z-40">
          <button
            onClick={() =>
              isEditMode ? handleCommitEdits() : handleStartEditMode()
            }
            className={`flex items-center gap-2.5 px-6 py-3 rounded-full text-sm font-bold shadow-xl border transition-all transform active:scale-95 ${
              isEditMode
                ? "bg-primary text-primary-foreground border-primary shadow-primary/20"
                : "bg-emerald-950/80 text-emerald-300 border-emerald-500/30 backdrop-blur-md hover:bg-emerald-900/90"
            }`}
          >
            {isEditMode ? (
              <>
                <Eye className="w-4 h-4" />
                <span>Done Editing</span>
              </>
            ) : (
              <>
                <Pencil className="w-4 h-4" />
                <span>Edit Attendance</span>
              </>
            )}
          </button>
        </div>

        {/* Contextual Remark Modal */}
        {selectedRemarkLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-card border border-border/80 rounded-3xl p-4 sm:p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary shrink-0" />
                <span>Class Remark & Reason</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Class on{" "}
                <span className="font-semibold text-foreground">
                  {selectedRemarkLog.item.dateFormatted ||
                    selectedRemarkLog.item.date}
                </span>{" "}
                (Status:{" "}
                <span className="font-bold uppercase text-primary">
                  {selectedRemarkLog.status}
                </span>
                ). Tag why you missed, if class was cancelled, or if it was a
                bunk.
              </p>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Remark / Reason
                </label>
                <input
                  type="text"
                  value={remarkInput}
                  onChange={(e) => setRemarkInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
                  autoFocus
                />
                <div className="flex flex-wrap gap-1.5 mt-2.5 max-h-32 overflow-y-auto pr-1">
                  {getContextualRemarkChips(selectedRemarkLog.status).map(
                    (tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setRemarkInput(tag)}
                        className={`px-2.5 py-1 rounded-lg text-xs border transition-colors font-semibold cursor-pointer whitespace-nowrap ${
                          remarkInput === tag
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-primary/10 border-primary/20 hover:bg-primary/20 text-primary"
                        }`}
                      >
                        + {tag}
                      </button>
                    ),
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRemarkLog(null)}
                    disabled={isSavingRemark}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  {selectedRemarkLog.item.remarks && (
                    <button
                      type="button"
                      onClick={handleRemoveRemarkOnly}
                      disabled={isSavingRemark}
                      className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer text-center"
                    >
                      Remove Remark
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSaveRemark}
                  disabled={isSavingRemark}
                  className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition-all shadow-md shadow-primary/20 cursor-pointer text-center flex items-center gap-1.5"
                >
                  {isSavingRemark && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>Save Remark</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
