import React, { useState, useEffect, useRef } from "react";
import { Capacitor } from '@capacitor/core';
import { Loader2, CheckCircle2, CheckCheck, XCircle, AlertCircle, PartyPopper, BookOpen, Palmtree, Timer, TrendingUp, TrendingDown, Plus, MessageSquare, Sparkles, ChevronRight, ChevronLeft, X, Trash2, GraduationCap, RotateCcw, Calendar, CalendarDays, Pencil } from "lucide-react";
import { PageSkeleton } from "../../components/common/PageSkeleton";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { useAuthStore } from "../../stores/authStore";
import { useCacheStore } from "../../stores/cacheStore";
import { CreateSemesterModal } from "../../components/semester/CreateSemesterModal";
import { SemesterTransitionModal } from "../../components/semester/SemesterTransitionModal";
import { OnboardingChecklist } from "../../components/ui/onboarding-checklist";

import { useSearchParams, useNavigate } from "react-router-dom";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { triggerAttendancePopup, AnimationType } from "../../stores/animationPopupStore";
import { HOLIDAY_ASSETS } from "../../constants/holidayAssets";
import { HolidayIconRenderer } from "../../components/common/HolidayIconRenderer";
import { HolidayGreetingOverlay } from "../../components/common/HolidayGreetingOverlay";
import { NeurosyncWaves } from "../../components/ui/neurosync-waves";
import { format } from "date-fns";
import { hapticLight, hapticMedium, hapticSuccess, hapticWarning, hapticSelection } from "../../utils/haptics";
import { SoundFX } from "../../utils/soundEffects";
import { triggerDynamicHUD } from "../../components/ui/dynamic-island-hud";
import { confirmDeleteToast } from "../../components/ui/confirm-delete-toast";


interface AgendaItem {
  id: string;
  type: "slot" | "override" | "manual";
  isExtra?: boolean;
  subject: {
    id: string;
    name: string;
    code?: string;
    colorHex?: string;
  };
  startTime: string;
  endTime: string;
  room?: string;
  slotType: string;
  status: "present" | "absent" | "off" | "cancelled" | "medical" | "od" | null;
  remarks?: string | null;
  attendanceId: string | null;
}

export const TodayPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const dateParam = searchParams.get("date");
  const today = new Date();
  const localTodayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const targetDateStr = dateParam || localTodayStr;

  const cachedData = useCacheStore(state => state.today);
  const setCache = useCacheStore(state => state.setCache);
  
  const dayCache = cachedData?.[targetDateStr];
  const initialActiveSemester = dayCache?.activeSemester || useCacheStore.getState().semester?.activeSemester || null;

  const buildLocalFallbackAgenda = (dateStr: string, semOverride?: any): AgendaItem[] => {
    try {
      const subjectsCache = useCacheStore.getState().subject_logs || {};
      const allLogs = subjectsCache["all"]?.logs || [];
      const logsForDay = allLogs.filter((l: any) => l.date && l.date.startsWith(dateStr));

      const timetableCache = useCacheStore.getState().timetable;
      const [y, m, d] = dateStr.split("-").map(Number);
      const dateObj = new Date(y, (m || 1) - 1, d || 1);
      const jsDay = dateObj.getDay();
      const ttDay = jsDay === 0 ? 6 : jsDay - 1;

      let pseudoAgenda: AgendaItem[] = [];

      if (timetableCache && Array.isArray(timetableCache.slots)) {
        // STRICT INVARIANT: Only active slots (validUntil === null) represent scheduled classes.
        // Archived/deleted slots must NEVER be resurrected onto Today's schedule.
        const allSlots = timetableCache.slots.filter((s: any) => !s.validUntil || s.validUntil === null);

        const cachedSem = semOverride || useCacheStore.getState().semester?.activeSemester;
        const cachedEvts = useCacheStore.getState().semester?.events || (useAttendanceStore.getState().events as any) || [];
        const lastTeachingEvt = cachedEvts.find((e: any) => /last\s*(teaching|working)\s*day/i.test(e.title || ""));
        const lastTeachingStr = lastTeachingEvt ? (lastTeachingEvt.endDate || lastTeachingEvt.date || "").split('T')[0] : null;
        const semEndStr = cachedSem?.endDate ? String(cachedSem.endDate).split('T')[0] : null;
        const isPastTeaching = (lastTeachingStr && dateStr > lastTeachingStr) || (semEndStr && dateStr > semEndStr);

        const slotsForDay = isPastTeaching ? [] : allSlots.filter((s: any) => {
          if (s.dayOfWeek !== ttDay) return false;
          if (!s.validFrom) return true;
          const fromDateKey = String(s.validFrom).slice(0, 10);
          if (fromDateKey > dateStr) return false;
          if (s.validUntil) {
            const untilDateKey = String(s.validUntil).slice(0, 10);
            if (untilDateKey < dateStr) return false;
          }
          return true;
        });

        const uniqueSlotsMap = new Map();
        slotsForDay.forEach((s: any) => {
          const key = `${s.startTime}-${s.subjectId}`;
          if (!uniqueSlotsMap.has(key)) uniqueSlotsMap.set(key, s);
        });
        const deduplicatedSlotsForDay = Array.from(uniqueSlotsMap.values());

        pseudoAgenda = deduplicatedSlotsForDay.map((slot: any) => {
          const subjectsOverview = useCacheStore.getState().subjects_overview || [];
          const subject = slot.subject || subjectsOverview.find((sub: any) => sub.id === slot.subjectId) || { id: slot.subjectId, name: "Unknown" };
          const logMatch = logsForDay.find((l: any) => l.timetableSlotId === slot.id || (l.subjectId === slot.subjectId && (l.startTime === slot.startTime || l.startTime === "00:00")));

          return {
            id: slot.id,
            type: "slot",
            subject,
            startTime: slot.startTime,
            endTime: slot.endTime,
            room: slot.room || undefined,
            slotType: slot.type || slot.slotType || "lecture",
            status: logMatch && logMatch.status !== "not_marked" ? logMatch.status : null,
            remarks: logMatch ? logMatch.remarks : undefined,
            attendanceId: logMatch && logMatch.status !== "not_marked" ? logMatch.id : null
          };
        });
      }

      logsForDay.forEach((l: any) => {
        const exists = pseudoAgenda.some(item => item.id === l.timetableSlotId || (item.subject.id === l.subjectId && (item.startTime === l.startTime || l.startTime === "00:00")));
        if (!exists) {
          pseudoAgenda.push({
            id: l.overrideId || l.id,
            type: l.isExtra ? "override" : "slot",
            isExtra: l.isExtra,
            subject: {
              id: l.subjectId,
              name: l.subjectName || "Unknown",
              code: l.subjectCode,
              colorHex: l.subjectColor
            },
            startTime: l.startTime,
            endTime: l.endTime,
            room: l.room,
            slotType: l.slotType || "Extra",
            status: l.status === "not_marked" ? null : l.status,
            remarks: l.remarks,
            attendanceId: l.status !== "not_marked" ? l.id : null,
          });
        }
      });

      pseudoAgenda.sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
      return pseudoAgenda;
    } catch {
      return [];
    }
  };

  const resolveInitialAgenda = (dateStr: string): AgendaItem[] => {
    const dc = useCacheStore.getState().today?.[dateStr];
    const sem = dc?.activeSemester || useCacheStore.getState().semester?.activeSemester || null;
    if (!sem) return [];
    if (dc?.agenda && dc.agenda.length > 0) return dc.agenda;
    if (dc?.todayStatus?.isHoliday || dc?.todayStatus?.isExam) return [];
    return buildLocalFallbackAgenda(dateStr, sem);
  };

  const [agenda, setAgenda] = useState<AgendaItem[]>(() => resolveInitialAgenda(targetDateStr));
  const agendaRef = useRef<AgendaItem[]>(resolveInitialAgenda(targetDateStr));
  const lastStatusClickRef = useRef<{ [itemId: string]: { status: string; time: number } }>({});
  const inFlightMarksCountRef = useRef<number>(0);
  const fetchSeqRef = useRef<number>(0);
  const targetDateStrRef = useRef<string>(targetDateStr);
  targetDateStrRef.current = targetDateStr;
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasVerifiedSemesterRef = useRef<boolean>(false);
  const inFlightFetchPromiseRef = useRef<Record<string, Promise<void> | undefined>>({});
  const debounceUpdateTimerRef = useRef<any>(null);

  useEffect(() => {
    agendaRef.current = agenda;
  }, [agenda]);
  const [activeSemester, setActiveSemester] = useState<any>(initialActiveSemester);
  const [todayStatus, setTodayStatus] = useState<any>(initialActiveSemester ? (dayCache?.todayStatus || null) : null);
  const activeEvent = activeSemester ? (todayStatus?.activeEvent || null) : null;
  const [onboardingStatus, setOnboardingStatus] = useState<any>(() => {
    return dayCache?.onboarding || null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (dayCache?.agenda && dayCache.agenda.length > 0) return false;
    if (dayCache?.todayStatus?.isHoliday || dayCache?.todayStatus?.isExam) return false;
    const initialAgenda = resolveInitialAgenda(targetDateStr);
    return initialAgenda.length === 0;
  });
  const storeActiveSemesterId = useAttendanceStore((state) => state.activeSemesterId);
  const storeHasActiveSemester = useAttendanceStore((state) => state.hasActiveSemester);
  const cachedActiveSemester = useCacheStore((state) => state.semester?.activeSemester);
  const isSemesterActive = Boolean(
    activeSemester ||
    storeHasActiveSemester ||
    storeActiveSemesterId ||
    onboardingStatus?.hasSemester ||
    cachedActiveSemester
  );

  useEffect(() => {
    if ((storeHasActiveSemester && storeActiveSemesterId) || cachedActiveSemester) {
      const targetSem = cachedActiveSemester || (storeHasActiveSemester ? useCacheStore.getState().semester?.activeSemester : null);
      if (targetSem && (!activeSemester || activeSemester.id !== targetSem.id)) {
        setActiveSemester(targetSem);
        setOnboardingStatus((prev: any) => prev ? { ...prev, hasSemester: true } : prev);
      }
    } else if (!storeHasActiveSemester && !cachedActiveSemester && activeSemester) {
      setActiveSemester(null);
    }
  }, [storeHasActiveSemester, storeActiveSemesterId, cachedActiveSemester, activeSemester]);
  const [isCreateSemesterOpen, setIsCreateSemesterOpen] = useState(false);
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false);
  const [transitionStatus, setTransitionStatus] = useState<any>(null);
  const [glidingExtraId, setGlidingExtraId] = useState<string | null>(null);
  const [poppingExtraId, setPoppingExtraId] = useState<string | null>(null);
  const [hasUsedVoiceMode, setHasUsedVoiceMode] = useState<boolean>(() => {
    return (
      localStorage.getItem("onboarding_voice_mode") === "true" ||
      Boolean(dayCache?.onboarding?.hasUsedVoiceMode)
    );
  });
  const [hasUsedPredictive, setHasUsedPredictive] = useState<boolean>(() => {
    return (
      localStorage.getItem("onboarding_predictive") === "true" ||
      Boolean(dayCache?.onboarding?.hasUsedPredictive)
    );
  });
  const [hasUsedPeerSync, setHasUsedPeerSync] = useState<boolean>(() => {
    return (
      localStorage.getItem("onboarding_peer_sync") === "true" ||
      Boolean(dayCache?.onboarding?.hasUsedPeerSync)
    );
  });
  const [hasConfiguredSound, setHasConfiguredSound] = useState<boolean>(() => {
    return (
      localStorage.getItem("onboarding_sound_effects") === "true" ||
      localStorage.getItem("attendx_sound_effects_configured") === "true" ||
      Boolean(dayCache?.onboarding?.hasConfiguredSound)
    );
  });
  const [hasJoinedClassroom, setHasJoinedClassroom] = useState<boolean>(() => {
    return (
      localStorage.getItem("onboarding_classroom") === "true" ||
      Boolean(dayCache?.onboarding?.hasJoinedClassroom)
    );
  });

  useEffect(() => {
    const handleSoundToggled = () => {
      setHasConfiguredSound(true);
    };
    window.addEventListener("sound-effects-toggled", handleSoundToggled);
    return () => window.removeEventListener("sound-effects-toggled", handleSoundToggled);
  }, []);

  useEffect(() => {
    const handleStepCompleted = (e: any) => {
      const step = e.detail?.step || e.detail;
      if (step === "voice_mode" || step === "onboarding_voice_mode") {
        setHasUsedVoiceMode(true);
        localStorage.setItem("onboarding_voice_mode", "true");
        setOnboardingStatus((prev: any) => prev ? { ...prev, hasUsedVoiceMode: true } : { hasUsedVoiceMode: true });
      } else if (step === "attendance" || step === "hasAttendance" || step === "onboarding_attendance") {
        localStorage.setItem("onboarding_attendance", "true");
        setOnboardingStatus((prev: any) => prev ? { ...prev, hasAttendance: true } : { hasAttendance: true });
      } else if (step === "predictive") {
        setHasUsedPredictive(true);
        localStorage.setItem("onboarding_predictive", "true");
        setOnboardingStatus((prev: any) => prev ? { ...prev, hasUsedPredictive: true } : { hasUsedPredictive: true });
      } else if (step === "peer_sync") {
        setHasUsedPeerSync(true);
        localStorage.setItem("onboarding_peer_sync", "true");
        setOnboardingStatus((prev: any) => prev ? { ...prev, hasUsedPeerSync: true } : { hasUsedPeerSync: true });
      } else if (step === "sound_effects") {
        setHasConfiguredSound(true);
        localStorage.setItem("onboarding_sound_effects", "true");
        localStorage.setItem("attendx_sound_effects_configured", "true");
        setOnboardingStatus((prev: any) => prev ? { ...prev, hasConfiguredSound: true } : { hasConfiguredSound: true });
      } else if (step === "classroom" || step === "onboarding_classroom") {
        setHasJoinedClassroom(true);
        localStorage.setItem("onboarding_classroom", "true");
        setOnboardingStatus((prev: any) => prev ? { ...prev, hasJoinedClassroom: true } : { hasJoinedClassroom: true });
      }
    };
    window.addEventListener("onboarding-step-completed", handleStepCompleted as EventListener);
    return () => window.removeEventListener("onboarding-step-completed", handleStepCompleted as EventListener);
  }, []);

  const timetableCache = useCacheStore((state) => state.timetable);
  const hasActiveTimetable = onboardingStatus?.hasTimetable ?? (timetableCache ? ((timetableCache?.slots || []).filter((s: any) => !s.validUntil || s.validUntil === null).length > 0) : null);

  // Extra Lecture Modal State
  const [isAddExtraModalOpen, setIsAddExtraModalOpen] = useState(false);
  const [subjectsForExtra, setSubjectsForExtra] = useState<any[]>([]);
  const [isAddingExtra, setIsAddingExtra] = useState(false);

  // Remark Modal / Prompt State
  const [selectedRemarkItem, setSelectedRemarkItem] = useState<{ item: AgendaItem; status: string } | null>(null);
  const [remarkInput, setRemarkInput] = useState("");

  // Mark Full Day State
  const [isMarkingFullDay, setIsMarkingFullDay] = useState(false);
  const [showMarkFullDayModal, setShowMarkFullDayModal] = useState(false);
  const [showAbsentRemarkInput, setShowAbsentRemarkInput] = useState(false);
  const [absentRemark, setAbsentRemark] = useState("");

  // Overlay state
  const [lastGreetedDate, setLastGreetedDate] = useState<string | null>(null);
  const [showGreetingOverlay, setShowGreetingOverlay] = useState(false);

  const markOnboardingStep = async (stepKey: "voice_mode" | "predictive" | "peer_sync" | "sound_effects" | "attendance" | "classroom" | "dismiss") => {
    hapticSelection();
    if (stepKey === "classroom") {
      setHasJoinedClassroom(true);
      localStorage.setItem("onboarding_classroom", "true");
      setOnboardingStatus((prev: any) => prev ? { ...prev, hasJoinedClassroom: true } : { hasJoinedClassroom: true });
      api.patch("/users/onboarding-status", { step: "classroom" }).catch(() => {});
      window.dispatchEvent(new CustomEvent("onboarding-step-completed", { detail: { step: "classroom" } }));
    } else if (stepKey === "attendance") {
      localStorage.setItem("onboarding_attendance", "true");
      setOnboardingStatus((prev: any) => prev ? { ...prev, hasAttendance: true } : { hasAttendance: true });
      api.patch("/users/onboarding-status", { step: "attendance" }).catch(() => {});
      window.dispatchEvent(new CustomEvent("onboarding-step-completed", { detail: { step: "attendance" } }));
    } else if (stepKey === "voice_mode") {
      setHasUsedVoiceMode(true);
      localStorage.setItem("onboarding_voice_mode", "true");
      setOnboardingStatus((prev: any) => prev ? { ...prev, hasUsedVoiceMode: true } : { hasUsedVoiceMode: true });
      api.patch("/users/onboarding-status", { step: "voice_mode" }).catch(() => {});
      window.dispatchEvent(new CustomEvent("onboarding-step-completed", { detail: { step: "voice_mode" } }));
    } else if (stepKey === "predictive") {
      setHasUsedPredictive(true);
      localStorage.setItem("onboarding_predictive", "true");
      setOnboardingStatus((prev: any) => prev ? { ...prev, hasUsedPredictive: true } : { hasUsedPredictive: true });
      api.patch("/users/onboarding-status", { step: "predictive" }).catch(() => {});
      window.dispatchEvent(new CustomEvent("onboarding-step-completed", { detail: { step: "predictive" } }));
    } else if (stepKey === "peer_sync") {
      setHasUsedPeerSync(true);
      localStorage.setItem("onboarding_peer_sync", "true");
      setOnboardingStatus((prev: any) => prev ? { ...prev, hasUsedPeerSync: true } : { hasUsedPeerSync: true });
      api.patch("/users/onboarding-status", { step: "peer_sync" }).catch(() => {});
      window.dispatchEvent(new CustomEvent("onboarding-step-completed", { detail: { step: "peer_sync" } }));
    } else if (stepKey === "sound_effects") {
      setHasConfiguredSound(true);
      localStorage.setItem("onboarding_sound_effects", "true");
      localStorage.setItem("attendx_sound_effects_configured", "true");
      setOnboardingStatus((prev: any) => prev ? { ...prev, hasConfiguredSound: true } : { hasConfiguredSound: true });
      api.patch("/users/onboarding-status", { step: "sound_effects" }).catch(() => {});
      window.dispatchEvent(new CustomEvent("onboarding-step-completed", { detail: { step: "sound_effects" } }));
    } else if (stepKey === "dismiss") {
      if (typeof window !== "undefined") {
        localStorage.setItem("onboarding_dismissed", "true");
      }
      setOnboardingStatus((prev: any) => prev ? { ...prev, onboardingDismissed: true } : { onboardingDismissed: true });
      api.patch("/users/onboarding-status", { step: "dismiss" }).catch(() => {});
      triggerDynamicHUD({
        type: "success",
        label: "Checklist Dismissed",
        subtitle: "You can access all features anytime from the sidebar.",
      });
    }
  };

  const isStep1Done = Boolean(isSemesterActive);
  const isStep2Done = Boolean(onboardingStatus?.hasSubjects || (useAttendanceStore.getState().subjects || []).length > 0);
  const isStep3Done = Boolean(onboardingStatus?.hasTimetable || hasActiveTimetable);
  const isStep4Done = Boolean(onboardingStatus?.hasCalendar);
  const isStep5Done = Boolean(
    onboardingStatus?.hasAttendance ||
    localStorage.getItem("onboarding_attendance") === "true" ||
    agenda.some(a => Boolean(a.status) && (a.status as any) !== "not_marked") ||
    (useAttendanceStore.getState().totalClasses || 0) > 0 ||
    (useAttendanceStore.getState().totalAttended || 0) > 0 ||
    (useAttendanceStore.getState().subjects || []).some((s: any) => (s.attended || 0) > 0 || (s.total || 0) > 0)
  );
  const isStep6Done = Boolean(
    hasUsedVoiceMode || 
    localStorage.getItem("onboarding_voice_mode") === "true" ||
    onboardingStatus?.hasUsedVoiceMode
  );
  const isStep7Done = Boolean(
    hasUsedPredictive || 
    localStorage.getItem("onboarding_predictive") === "true" ||
    onboardingStatus?.hasUsedPredictive
  );
  const isStep8Done = Boolean(
    hasUsedPeerSync || 
    localStorage.getItem("onboarding_peer_sync") === "true" ||
    onboardingStatus?.hasUsedPeerSync
  );
  const isStep9Done = Boolean(
    hasConfiguredSound || 
    localStorage.getItem("onboarding_sound_effects") === "true" || 
    localStorage.getItem("attendx_sound_effects_configured") === "true" ||
    onboardingStatus?.hasConfiguredSound
  );
  const isStep10Done = Boolean(
    hasJoinedClassroom ||
    localStorage.getItem("onboarding_classroom") === "true" ||
    onboardingStatus?.hasJoinedClassroom
  );

  const isAllOnboardingDone = (
    isStep1Done &&
    isStep2Done &&
    isStep3Done &&
    isStep4Done &&
    isStep5Done &&
    isStep6Done &&
    isStep7Done &&
    isStep8Done &&
    isStep9Done &&
    isStep10Done
  );

  const isChecklistDismissed = Boolean(
    onboardingStatus?.onboardingDismissed ||
    localStorage.getItem("onboarding_dismissed") === "true"
  );

  const prevAllDoneRef = useRef(false);
  useEffect(() => {
    if (isAllOnboardingDone && !prevAllDoneRef.current && !isChecklistDismissed) {
      prevAllDoneRef.current = true;
      SoundFX.playLevelUpCelebrationSound();
      hapticSuccess();
      triggerDynamicHUD({
        type: "sparkle",
        label: "All Onboarding Steps Completed! 🎉",
        subtitle: "Welcome to AttendX — Your academic cockpit is fully unlocked!",
      });
    }
  }, [isAllOnboardingDone, isChecklistDismissed]);

  const checklistSteps = [
    { id: 1, title: "Create an active semester", isCompleted: isStep1Done, onClick: () => !isSemesterActive ? setIsCreateSemesterOpen(true) : navigate("/semester") },
    { id: 2, title: "Add subjects and set targets", isCompleted: isStep2Done, onClick: () => navigate("/subjects") },
    { id: 3, title: "Set up weekly timetable", isCompleted: isStep3Done, onClick: () => navigate("/timetable") },
    { id: 4, title: "Sync your academic calendar", isCompleted: isStep4Done, onClick: () => navigate("/calendar") },
    { 
      id: 5, 
      title: "Log your first attendance", 
      isCompleted: isStep5Done, 
      onClick: () => {
        const firstClassEl = document.querySelector('[id^="agenda-item-"]') || document.querySelector('.agenda-card');
        if (firstClassEl) {
          firstClassEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          navigate("/today");
        }
      } 
    },
    { 
      id: 6, 
      title: "Explore Hands-Free Voice Mode", 
      isCompleted: isStep6Done, 
      onClick: () => {
        setHasUsedVoiceMode(true);
        localStorage.setItem("onboarding_voice_mode", "true");
        setOnboardingStatus((prev: any) => prev ? { ...prev, hasUsedVoiceMode: true } : { hasUsedVoiceMode: true });
        markOnboardingStep("voice_mode");
        window.dispatchEvent(new Event("open-voice-mode"));
      } 
    },
    { id: 7, title: "Unlock Predictive Analytics", isCompleted: isStep7Done, onClick: () => {
        markOnboardingStep("predictive");
        navigate("/predictive");
    } },
    { id: 8, title: "Mirror Timetable with Peer Sync", isCompleted: isStep8Done, onClick: () => {
        markOnboardingStep("peer_sync");
        navigate("/settings/peer-sync");
    } },
    { id: 9, title: "Configure Animation Sounds", isCompleted: isStep9Done, onClick: () => {
        markOnboardingStep("sound_effects");
        navigate("/settings?section=sounds");
    } },
    { id: 10, title: "Join your section classroom", isCompleted: isStep10Done, onClick: () => {
        markOnboardingStep("classroom");
        navigate("/classrooms");
    } }
  ];


  const getHolidayAnimation = (activeEvent: any) => {
    let animType: any = "full_day_off";
    let animMsg = "Congratulations on a full day off! 🎉🥳";

    if (activeEvent?.title) {
      const title = activeEvent.title.toLowerCase();
      if (title.includes("diwali") || title.includes("deepavali")) {
        animType = "diwali"; animMsg = "Lighting candles & firecrackers for Diwali! 🪔✨";
      } else if (title.includes("republic")) {
        animType = "republic_day"; animMsg = "Happy Republic Day! 🇮🇳";
      } else if (title.includes("independence")) {
        animType = "independence_day"; animMsg = "Happy Independence Day! 🇮🇳✨";
      } else if (title.includes("christmas eve")) {
        animType = "christmas_eve"; animMsg = "Christmas Eve! 🎄✨";
      } else if (title.includes("christmas")) {
        animType = "christmas"; animMsg = "Santa Claus is here! Merry Christmas! 🎅🎄";
      } else if (title.includes("bakrid") || title.includes("zuha")) {
        animType = "bakrid"; animMsg = "Eid al-Adha Mubarak! 🌙✨";
      } else if (title.includes("bhai duj")) {
        animType = "bhai_duj"; animMsg = "Happy Bhai Duj! ✨";
      } else if (title.includes("buddha") || title.includes("purnima")) {
        animType = "buddha_purnima"; animMsg = "Happy Buddha Purnima! ☸️🕊️";
      } else if (title.includes("dussehra")) {
        animType = "dussehra"; animMsg = "Happy Dussehra! 🏹✨";
      } else if (title.includes("eid") || title.includes("id-ul") || title.includes("id-e") || title.includes("fitr")) {
        animType = "eid"; animMsg = "Eid special! Eid Mubarak! 🌙🕌";
      } else if (title.includes("good friday")) {
        animType = "good_friday"; animMsg = "Blessed Good Friday! ✝️🕊️";
      } else if (title.includes("holi") || title.includes("dolyatra")) {
        animType = "holi"; animMsg = "Happy Holi! 🎨";
      } else if (title.includes("makar sankranti")) {
        animType = "makar_sankranti"; animMsg = "Happy Makar Sankranti! 🪁✨";
      } else if (title.includes("new year")) {
        animType = "new_year"; animMsg = "Happy New Year! 🎉✨";
      } else if (title.includes("pongal")) {
        animType = "pongal"; animMsg = "Happy Pongal! 🌾✨";
      } else if (title.includes("ram navami")) {
        animType = "ram_navami"; animMsg = "Happy Ram Navami! 🏹";
      } else if (title.includes("maha shivaratri") || title.includes("shivaratri")) {
        animType = "maha_shivaratri"; animMsg = "Happy Maha Shivaratri! 🕉️✨";
      } else if (title.includes("mahavir")) {
        animType = "mahavir_jayanti"; animMsg = "Happy Mahavir Jayanti! 🪷";
      } else if (title.includes("milad") || title.includes("nabi")) {
        animType = "milad_un_nabi"; animMsg = "Milad-Un-Nabi Mubarak! 🌙✨";
      } else if (title.includes("rakshabandhan") || title.includes("raksha bandhan")) {
        animType = "rakshabandhan"; animMsg = "Happy Raksha Bandhan! ✨";
      } else if (title.includes("gandhi")) {
        animType = "gandhi_jayanti"; animMsg = "Happy Gandhi Jayanti! 👓";
      } else if (title.includes("ganesh") || title.includes("vinayaka")) {
        animType = "ganesh_chaturthi"; animMsg = "Happy Ganesh Chaturthi! 🐘✨";
      } else if (title.includes("nanak") || title.includes("gurpurab")) {
        animType = "guru_nanak"; animMsg = "Happy Gurpurab! 🛕";
      } else if (title.includes("janmashtami")) {
        animType = "janmashtami"; animMsg = "Happy Krishna Janmashtami! 🦚";
      } else if (title.includes("muharram")) {
        animType = "muharram"; animMsg = "Muharram special 🕌";
      } else if (title.includes("makar") || title.includes("sankranti") || title.includes("pongal") || title.includes("lohari") || title.includes("lohri")) {
        animType = "makar_sankranti"; animMsg = "Happy Makar Sankranti/Pongal! 🌾✨";
      } else if (title.includes("shivaratri") || title.includes("shivratri")) {
        animType = "maha_shivaratri"; animMsg = "Happy Maha Shivaratri! 🕉️✨";
      } else if (title.includes("raksha") || title.includes("rakhi")) {
        animType = "rakshabandhan"; animMsg = "Happy Rakshabandhan! ✨";
      } else if (
        title.includes("midsem") || title.includes("mid sem") || title.includes("mid-sem") || title.includes("midterm") || title.includes("mid term") ||
        title.includes("endsem") || title.includes("end sem") || title.includes("end-sem") || title.includes("exam")
      ) {
        animType = "exam"; animMsg = "Focus mode activated. Best of luck on your exams! 📝✨";
      } else if (title.includes("lab") || title.includes("practical") || title.includes("demo") || title.includes("viva")) {
        animType = "practical"; animMsg = "Practical / Lab Exams today. Best of luck! 🔬💻";
      }
    } else if (activeEvent?.eventType === "midsem" || activeEvent?.eventType === "endsem" || activeEvent?.eventType === "exam") {
      animType = "exam"; animMsg = "Focus mode activated. Best of luck on your exams! 📚💪";
    } else if (activeEvent?.eventType === "lab_exam" || activeEvent?.eventType === "practical" || activeEvent?.eventType === "lab") {
      animType = "practical"; animMsg = "Practical / Lab Exams today. Best of luck! 🔬💻";
    } else if (activeEvent?.eventType === "ct") {
      animType = "exam"; animMsg = "Cycle Test today. Stay focused! 📝";
    }
    return { animType, animMsg };
  };

  const fetchStats = useAttendanceStore((state) => state.fetchStats);
  const user = useAuthStore((state) => state.user);
  const targetPercentage = user?.targetAttendance ?? 75;

  const isBirthday = React.useMemo(() => {
    if (!user?.birthday) return false;
    const targetMonth = parseInt(targetDateStr.split('-')[1]);
    const targetDay = parseInt(targetDateStr.split('-')[2]);
    const bMonth = parseInt(user.birthday.split('T')[0].split('-')[1]);
    const bDay = parseInt(user.birthday.split('T')[0].split('-')[2]);
    return targetMonth === bMonth && targetDay === bDay;
  }, [user?.birthday, targetDateStr]);
  const { overallPercentage } = useAttendanceStore();

  const handleMarkFullDayAction = async (status: "present" | "absent" | "off" | "clear", remark?: string) => {
    if (agenda.length === 0) return;
    fetchSeqRef.current += 1;
    useAttendanceStore.getState().invalidateInFlightStats();
    try {
      setIsMarkingFullDay(true);

      const normalizedStatus = status === "clear" ? null : (status as any);

      // --- OFFLINE OPTIMISTIC UPDATE ---
      const store = useAttendanceStore.getState();
      const subjects = [...store.subjects];
      agenda.forEach(item => {
        const subjectIndex = subjects.findIndex(s => s.subjectId === item.subject?.id || s.id === item.subject?.id);
        if (subjectIndex !== -1) {
          const s = { ...subjects[subjectIndex] };
          if (item.status === "present" || item.status === "medical" || item.status === "od") {
            s.attended -= 1;
            s.total -= 1;
          } else if (item.status === "absent") {
            s.total -= 1;
          }
          if (status === "present") {
            s.attended += 1;
            s.total += 1;
          } else if (status === "absent") {
            s.total += 1;
          }
          s.percentage = s.total > 0 ? Number(((s.attended / s.total) * 100).toFixed(1)) : 0;
          subjects[subjectIndex] = s;
        }
      });
      const totalAttended = subjects.reduce((sum, sub) => sum + sub.attended, 0);
      const totalClasses = subjects.reduce((sum, sub) => sum + sub.total, 0);
      const overallPercentage = totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 0;
      useAttendanceStore.setState({ subjects, totalAttended, totalClasses, overallPercentage });
      // ---------------------------------

      // Optimistically update agenda
      const nextAgenda = agenda.map(a => ({
        ...a,
        status: normalizedStatus,
        remarks: status === "clear" ? undefined : (status === "absent" ? (remark || a.remarks) : a.remarks)
      }));
      setAgenda(nextAgenda);
      agendaRef.current = nextAgenda;

      // Update Today cache immediately
      const state = useCacheStore.getState();
      const currentTodayEntry = state.today?.[targetDateStr] || {};
      const nextTodayEntry: any = {
        ...currentTodayEntry,
        agenda: nextAgenda,
        activeSemester,
        onboarding: onboardingStatus
      };
      if (status === "off") {
        nextTodayEntry.todayStatus = "off";
      } else {
        delete nextTodayEntry.todayStatus;
      }
      state.setCache('today', {
        ...state.today,
        [targetDateStr]: nextTodayEntry
      });

      // Update Calendar cache
      const monthStr = targetDateStr.substring(0, 7);
      const existingMonthCache = state.calendar?.[monthStr];
      if (existingMonthCache) {
        const nextDays = { ...existingMonthCache.days };
        if (status === "off") {
          nextDays[targetDateStr] = "off";
        } else if (status === "present") {
          nextDays[targetDateStr] = "present";
        } else if (status === "absent") {
          nextDays[targetDateStr] = "absent";
        } else {
          delete nextDays[targetDateStr];
        }
        state.setCache('calendar', {
          ...state.calendar,
          [monthStr]: {
            ...existingMonthCache,
            days: nextDays,
          }
        });
      }

      if (status === "present") {
        localStorage.setItem("onboarding_attendance", "true");
        setOnboardingStatus((prev: any) => ({ ...(prev || {}), hasAttendance: true }));
        api.patch("/users/onboarding-status", { step: "attendance" }).catch(() => {});
        window.dispatchEvent(new CustomEvent("onboarding-step-completed", { detail: { step: "attendance" } }));
        hapticSuccess();
        triggerAttendancePopup("thumbs_up", "All Classes Marked Present 👍");
        triggerDynamicHUD({
          type: "success",
          label: "Full Day Attended",
          subtitle: `All ${agenda.length} scheduled classes marked present`,
        });
      } else if (status === "absent") {
        localStorage.setItem("onboarding_attendance", "true");
        setOnboardingStatus((prev: any) => ({ ...(prev || {}), hasAttendance: true }));
        api.patch("/users/onboarding-status", { step: "attendance" }).catch(() => {});
        window.dispatchEvent(new CustomEvent("onboarding-step-completed", { detail: { step: "attendance" } }));
        hapticWarning();
        triggerAttendancePopup("crying", "Full Day Marked Absent 😭");
        triggerDynamicHUD({
          type: "trash",
          label: "Full Day Absent",
          subtitle: remark ? `Reason: ${remark}` : `All ${agenda.length} classes marked missed`,
        });
      } else if (status === "off") {
        localStorage.setItem("onboarding_attendance", "true");
        setOnboardingStatus((prev: any) => ({ ...(prev || {}), hasAttendance: true }));
        api.patch("/users/onboarding-status", { step: "attendance" }).catch(() => {});
        window.dispatchEvent(new CustomEvent("onboarding-step-completed", { detail: { step: "attendance" } }));
        hapticMedium();
        const { animType, animMsg } = getHolidayAnimation(activeEvent);
        triggerAttendancePopup(animType, animMsg);
        triggerDynamicHUD({
          type: "origami",
          label: "Full Day Off",
          subtitle: activeEvent?.title ? `${activeEvent.title} • Classes suspended` : "Classes suspended for today (no penalty)",
        });
      } else {
        setTodayStatus(null);
        hapticLight();
        triggerDynamicHUD({
          type: "trash",
          label: "Full Day Attendance Cleared",
          subtitle: `All ${agenda.length} classes reset to unrecorded`,
        });
      }

      // Close modal and reset state
      setShowMarkFullDayModal(false);
      setShowAbsentRemarkInput(false);
      setAbsentRemark("");

      // Backend API call: try dedicated batch endpoint, with fallback to per-slot
      try {
        await api.post("/attendance/mark-day", {
          date: targetDateStr,
          status,
          remarks: remark,
          semesterId: activeSemester?.id,
        });
      } catch (batchErr) {
        console.warn("mark-day endpoint failed, falling back to per-slot marking:", batchErr);
        await Promise.all(
          agenda.filter(item => item.subject?.id).map(item =>
            api.post("/attendance/mark", {
              subjectId: item.subject!.id,
              date: targetDateStr,
              status,
              remarks: status === "absent" ? remark : undefined,
              timetableSlotId: item.type === "slot" ? item.id : undefined,
              overrideId: item.type === "override" ? item.id : undefined,
              attendanceId: item.attendanceId,
            })
          )
        );
      }

      fetchData();
      fetchStats();
      useCacheStore.getState().setCache('insights', null);
      window.dispatchEvent(new CustomEvent("attendance-updated", { detail: { source: "today-page" } }));
    } catch (error) {
      console.error("Failed to mark full day:", error);
      toast.error("Failed to update full day attendance");
      fetchData();
    } finally {
      setIsMarkingFullDay(false);
    }
  };

  const openAddExtraModal = async () => {
    try {
      const res = await api.get("/subjects");
      setSubjectsForExtra(Array.isArray(res.data) ? res.data : []);
      setIsAddExtraModalOpen(true);
    } catch (err) {
      console.error("Failed to load subjects:", err);
    }
  };

  const handleAddExtraLecture = async (subjectId: string) => {
    // 1. Optimistic 0ms UI Update
    const tempId = `temp_extra_${Date.now()}`;
    const selectedSub = subjectsForExtra.find(s => s.id === subjectId) || { id: subjectId, name: "Extra Lecture" };

    const optimisticItem: AgendaItem = {
      id: tempId,
      type: "override",
      isExtra: true,
      subject: {
        id: selectedSub.id,
        name: selectedSub.name,
        code: selectedSub.code,
        colorHex: selectedSub.colorHex
      },
      startTime: "00:00",
      endTime: "00:00",
      slotType: "Extra",
      status: null,
      remarks: "Extra Lecture",
      attendanceId: null
    };

    // Close modal and trigger 4.0s Spark Pop Entrance
    setIsAddExtraModalOpen(false);
    hapticSuccess();
    setPoppingExtraId(tempId);
    SoundFX.playSnapPopSound();
    triggerDynamicHUD({ type: "sparkle", label: "Extra Lecture Added", durationMs: 4500 });
    setTimeout(() => {
      setPoppingExtraId((curr) => (curr === tempId ? null : curr));
    }, 4000);
    setAgenda(prev => {
      const next = [...prev, optimisticItem];
      agendaRef.current = next;
      const existing = useCacheStore.getState().today?.[targetDateStr];
      if (existing) {
        useCacheStore.getState().setCache('today', {
          ...useCacheStore.getState().today,
          [targetDateStr]: { ...existing, agenda: next }
        });
      }
      return next;
    });

    // Smoothly scroll down to the newly added extra class card so the user witnesses the entrance animation
    setTimeout(() => {
      const el = document.getElementById(`agenda-item-${tempId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 80);

    try {
      setIsAddingExtra(true);
      const res = await api.post("/timetable/extra-class", {
        semesterId: activeSemester?.id,
        subjectId,
        date: targetDateStr,
        startTime: "00:00",
        endTime: "00:00",
        reason: "Extra Lecture"
      });
      const realId = res.data?.id;
      if (realId) {
        setAgenda(prev => {
          const next = prev.map(item => item.id === tempId ? { ...item, id: realId } : item);
          agendaRef.current = next;
          const existing = useCacheStore.getState().today?.[targetDateStr];
          if (existing) {
            useCacheStore.getState().setCache('today', {
              ...useCacheStore.getState().today,
              [targetDateStr]: { ...existing, agenda: next }
            });
          }
          return next;
        });
      }
      fetchStats();
      window.dispatchEvent(new CustomEvent("attendance-updated", { detail: { source: "today-page" } }));
    } catch (err) {
      console.error("Failed to add extra lecture:", err);
      toast.error("Failed to add extra lecture");
      // Roll back optimistic card
      setAgenda(prev => {
        const reverted = prev.filter(item => item.id !== tempId);
        agendaRef.current = reverted;
        return reverted;
      });
    } finally {
      setIsAddingExtra(false);
    }
  };

  const handleDeleteExtraClass = async (overrideId: string) => {
    const itemToDelete = agendaRef.current.find(item => item.id === overrideId);
    confirmDeleteToast({
      title: "Delete Extra Class",
      description: "Are you sure you want to remove this extra class? It will be deleted from your daily schedule.",
      itemName: itemToDelete?.subject?.name ? `${itemToDelete.subject.name} (${itemToDelete.startTime})` : undefined,
      confirmLabel: "Delete Class",
      onConfirm: async () => {
        // 1. Trigger 4.0s Paper Aeroplane Glider Deletion choreography
        hapticSuccess();
        setGlidingExtraId(overrideId);
        SoundFX.playPaperAirplaneSound();
        triggerDynamicHUD({ type: "plane", label: "Extra Class Glided Away", durationMs: 4500 });

        setTimeout(async () => {
          setAgenda(prev => {
              const next = prev.filter(item => item.id !== overrideId);
              agendaRef.current = next;
              const existing = useCacheStore.getState().today?.[targetDateStr];
              if (existing) {
                useCacheStore.getState().setCache('today', {
                  ...useCacheStore.getState().today,
                  [targetDateStr]: { ...existing, agenda: next }
                });
              }

              // Evict from subject_logs cache so Subject Details history is immediately clean
              const evictFromSubjectLogs = (cacheKey: string) => {
                const subjCache = useCacheStore.getState().subject_logs?.[cacheKey];
                if (subjCache && subjCache.logs) {
                  const nextLogs = subjCache.logs.filter((l: any) => {
                    if (l.date !== targetDateStr || l.subjectId !== itemToDelete?.subject?.id) return true;
                    if (l.overrideId) return l.overrideId !== overrideId;
                    if (itemToDelete?.attendanceId && l.id === itemToDelete.attendanceId) return false;
                    if (!l.overrideId && !l.slotId && itemToDelete?.startTime && l.time === itemToDelete.startTime) return false;
                    return true;
                  });
                  useCacheStore.getState().setCache('subject_logs', {
                    ...useCacheStore.getState().subject_logs,
                    [cacheKey]: { ...subjCache, logs: nextLogs }
                  });
                }
              };
              evictFromSubjectLogs('all');
              if (itemToDelete?.subject?.id) evictFromSubjectLogs(itemToDelete.subject.id);

              return next;
            });
            setGlidingExtraId(null);

            try {
              await api.delete(`/timetable/extra-class/${overrideId}`);
              fetchStats();
              window.dispatchEvent(new CustomEvent("attendance-updated", { detail: { source: "today-page" } }));
            } catch (err) {
              console.error("Failed to delete extra class:", err);
              toast.error("Failed to delete extra class");
              // Roll back if deletion failed
              if (itemToDelete) {
                setAgenda(prev => {
                  const next = [...prev, itemToDelete];
                  agendaRef.current = next;
                  return next;
                });
              }
            }
          }, 4000);
        }
      });
  };

  const fetchData = async (overrideDate?: string, signal?: AbortSignal) => {
    const reqDate = overrideDate || targetDateStrRef.current;
    if (inFlightFetchPromiseRef.current[reqDate] && !signal?.aborted) {
      return inFlightFetchPromiseRef.current[reqDate];
    }
    delete inFlightFetchPromiseRef.current[reqDate];
    const myFetchSeq = ++fetchSeqRef.current;

    // Safety timeout to guarantee isLoading never gets permanently stuck
    const safetyTimer = setTimeout(() => {
      if (myFetchSeq === fetchSeqRef.current) {
        setIsLoading(false);
      }
    }, 3500);

    const runPromise = (async () => {
    try {
      const existingDayCache = useCacheStore.getState().today?.[reqDate];
      const cachedSem = existingDayCache?.activeSemester || useCacheStore.getState().semester?.activeSemester || null;
      const validCachedSem = cachedSem?.id && cachedSem.id !== "active-semester" ? cachedSem : null;
      const knownSem = activeSemester || validCachedSem || null;
      const knownSemesterId = knownSem?.id || useAttendanceStore.getState().activeSemesterId || useCacheStore.getState().semester?.activeSemester?.id;

      if (!existingDayCache && agendaRef.current.length === 0) {
        setIsLoading(true);
      }

      // If we haven't synced with the server yet, or if knownSem is missing/unverified, verify with /api/semesters/active
      const shouldQuerySem = !hasVerifiedSemesterRef.current || !knownSem;
      const [semSettled, statusSettledInitial, res, onboardRes] = await Promise.allSettled([
        !shouldQuerySem ? Promise.resolve({ data: knownSem }) : api.get("/semesters/active", { signal }),
        api.get(`/events/today-status?${knownSemesterId ? `semesterId=${knownSemesterId}&` : ''}date=${reqDate}`, { signal }),
        api.get(`/attendance/today?date=${reqDate}`, { signal }),
        api.get("/users/onboarding-status", { signal })
      ]);

      // CRITICAL RACE CONDITION GUARD:
      // If signal was aborted OR user has already navigated to a different date, DISCARD immediately!
      if (signal?.aborted || reqDate !== targetDateStrRef.current || myFetchSeq !== fetchSeqRef.current) {
        return;
      }

      if (semSettled.status === "fulfilled") {
        hasVerifiedSemesterRef.current = true;
      }
      const semData = semSettled.status === "fulfilled" ? semSettled.value.data : knownSem;
      let statusRes = statusSettledInitial;

      if (semData) {
        setActiveSemester(semData);
        const semesterId = semData.id;
        useAttendanceStore.setState({ activeSemesterId: semesterId, hasActiveSemester: true });

        if (knownSemesterId && knownSemesterId !== semesterId) {
          const [lateStatus] = await Promise.allSettled([
            api.get(`/events/today-status?semesterId=${semesterId}&date=${reqDate}`, { signal })
          ]);
          if (signal?.aborted || reqDate !== targetDateStrRef.current || myFetchSeq !== fetchSeqRef.current) {
            return;
          }
          statusRes = lateStatus;
        }

        const semEndDate = new Date(semData.endDate);
        semEndDate.setHours(23, 59, 59, 999);
        const now = new Date();
        const hasPromptParam = searchParams.get("promptSemesterTransition") === "true";
        const shouldPrompt = hasPromptParam || now > semEndDate;
        if (shouldPrompt) {
          const dismissed = sessionStorage.getItem(`attendx_dismissed_transition_${semData.id}`);
          if (!dismissed) {
            setIsTransitionModalOpen(true);
          }
        }
        if (hasPromptParam) {
          const nextParams = new URLSearchParams(searchParams);
          nextParams.delete("promptSemesterTransition");
          setSearchParams(nextParams, { replace: true });
        }
      } else if (semSettled.status === "fulfilled" && !semSettled.value.data) {
        setActiveSemester(null);
        setTodayStatus(null);
        setAgenda([]);
        agendaRef.current = [];
        useAttendanceStore.getState().resetAttendanceStore();
        useCacheStore.getState().setCache("semester", {
          ...useCacheStore.getState().semester,
          activeSemester: null,
        });
      }

      if (res.status === 'rejected') throw res.reason;

      let nextTodayStatus = existingDayCache?.todayStatus || null;
      let nextAgenda: AgendaItem[] = [];
      let nextOnboarding = existingDayCache?.onboarding || null;

      if (statusRes.status === 'fulfilled' && statusRes.value.data !== null) {
        nextTodayStatus = statusRes.value.data;
        setTodayStatus(nextTodayStatus);
      }
      
      if (res.status === 'fulfilled') {
        nextAgenda = Array.isArray(res.value.data) ? res.value.data : [];
        // Self-heal ONLY if active timetable slots exist in cache
        if (nextAgenda.length === 0 && semData && !(nextTodayStatus?.isHoliday || nextTodayStatus?.isExam)) {
          const currentTtCache = useCacheStore.getState().timetable;
          const hasActiveSlots = (currentTtCache?.slots || []).filter((s: any) => !s.validUntil || s.validUntil === null).length > 0;
          if (hasActiveSlots) {
            const localFallback = buildLocalFallbackAgenda(reqDate, semData);
            if (localFallback.length > 0) {
              nextAgenda = localFallback;
            }
          }
        }
        if (inFlightMarksCountRef.current > 0) {
          setAgenda(prev => {
            const merged = nextAgenda.map(serverItem => {
              const localItem = prev.find(p => p.id === serverItem.id);
              if (localItem && localItem.status !== null) {
                return { ...serverItem, status: localItem.status, remarks: localItem.remarks, attendanceId: localItem.attendanceId ?? serverItem.attendanceId };
              }
              return serverItem;
            });
            agendaRef.current = merged;
            return merged;
          });
        } else {
          setAgenda(nextAgenda);
          agendaRef.current = nextAgenda;
        }
      } else if (myFetchSeq === fetchSeqRef.current) {
        setAgenda([]);
        agendaRef.current = [];
      }

      if (onboardRes.status === 'fulfilled') {
        const rawOnboarding = onboardRes.value.data || {};
        const isDismissed = Boolean(
          rawOnboarding?.onboardingDismissed ||
          localStorage.getItem("onboarding_dismissed") === "true"
        );
        const semActiveNow = Boolean(
          rawOnboarding.hasSemester ||
          semData ||
          activeSemester ||
          useAttendanceStore.getState().hasActiveSemester ||
          useAttendanceStore.getState().activeSemesterId ||
          useCacheStore.getState().semester?.activeSemester
        );
        const localAtt = localStorage.getItem("onboarding_attendance") === "true";
        const hasAttendanceNow = Boolean(
          rawOnboarding.hasAttendance ||
          localAtt ||
          agendaRef.current.some(a => Boolean(a.status) && (a.status as any) !== "not_marked") ||
          (useAttendanceStore.getState().totalClasses || 0) > 0 ||
          (useAttendanceStore.getState().totalAttended || 0) > 0 ||
          (useAttendanceStore.getState().subjects || []).some((s: any) => (s.attended || 0) > 0 || (s.total || 0) > 0)
        );
        if (hasAttendanceNow) {
          localStorage.setItem("onboarding_attendance", "true");
        }
        nextOnboarding = {
          ...rawOnboarding,
          hasSemester: semActiveNow,
          hasAttendance: hasAttendanceNow,
          onboardingDismissed: isDismissed,
        };
        if (isDismissed) {
          localStorage.setItem("onboarding_dismissed", "true");
        }
        setOnboardingStatus(nextOnboarding);

        const serverVoice = Boolean(nextOnboarding.hasUsedVoiceMode);
        const serverPred = Boolean(nextOnboarding.hasUsedPredictive);
        const serverSync = Boolean(nextOnboarding.hasUsedPeerSync);
        const serverSound = Boolean(nextOnboarding.hasConfiguredSound);
        const serverAtt = Boolean(nextOnboarding.hasAttendance);

        const localVoice = localStorage.getItem("onboarding_voice_mode") === "true";
        const localPred = localStorage.getItem("onboarding_predictive") === "true";
        const localSync = localStorage.getItem("onboarding_peer_sync") === "true";
        const localSound = localStorage.getItem("onboarding_sound_effects") === "true" || localStorage.getItem("attendx_sound_effects_configured") === "true";
        const localDismissed = localStorage.getItem("onboarding_dismissed") === "true";

        const effectiveVoice = serverVoice || localVoice;
        const effectivePred = serverPred || localPred;
        const effectiveSync = serverSync || localSync;
        const effectiveSound = serverSound || localSound;

        setHasUsedVoiceMode(effectiveVoice);
        setHasUsedPredictive(effectivePred);
        setHasUsedPeerSync(effectiveSync);
        setHasConfiguredSound(effectiveSound);

        if (effectiveVoice) localStorage.setItem("onboarding_voice_mode", "true");
        if (effectivePred) localStorage.setItem("onboarding_predictive", "true");
        if (effectiveSync) localStorage.setItem("onboarding_peer_sync", "true");
        if (effectiveSound) {
          localStorage.setItem("onboarding_sound_effects", "true");
          localStorage.setItem("attendx_sound_effects_configured", "true");
        }

        if ((localVoice && !serverVoice) || (localPred && !serverPred) || (localSync && !serverSync) || (localSound && !serverSound) || (hasAttendanceNow && !serverAtt) || (localDismissed && !rawOnboarding?.onboardingDismissed)) {
          api.patch("/users/onboarding-status", {
            hasUsedVoiceMode: effectiveVoice,
            hasUsedPredictive: effectivePred,
            hasUsedPeerSync: effectiveSync,
            onboardingDismissed: isDismissed,
            ...(hasAttendanceNow && !serverAtt ? { step: "attendance" } : {}),
            ...(localSound && !serverSound ? { step: "sound_effects" } : {})
          }).catch(() => {});
        }
      } else {
        // Fallback when network is offline/error: compute from local state and stores so checklist never flickers
        const localVoice = localStorage.getItem("onboarding_voice_mode") === "true";
        const localPred = localStorage.getItem("onboarding_predictive") === "true";
        const localSync = localStorage.getItem("onboarding_peer_sync") === "true";
        const localSound = localStorage.getItem("onboarding_sound_effects") === "true" || localStorage.getItem("attendx_sound_effects_configured") === "true";
        const localDismissed = localStorage.getItem("onboarding_dismissed") === "true";
        const hasAttendanceNow = Boolean(
          localStorage.getItem("onboarding_attendance") === "true" ||
          agendaRef.current.some(a => Boolean(a.status) && (a.status as any) !== "not_marked") ||
          (useAttendanceStore.getState().totalClasses || 0) > 0 ||
          (useAttendanceStore.getState().totalAttended || 0) > 0 ||
          (useAttendanceStore.getState().subjects || []).some((s: any) => (s.attended || 0) > 0 || (s.total || 0) > 0)
        );

        nextOnboarding = {
          ...(onboardingStatus || {}),
          hasSemester: Boolean(semData || activeSemester || isSemesterActive),
          hasSubjects: Boolean((useAttendanceStore.getState().subjects || []).length > 0 || onboardingStatus?.hasSubjects),
          hasTimetable: Boolean(hasActiveTimetable || onboardingStatus?.hasTimetable),
          hasCalendar: Boolean(onboardingStatus?.hasCalendar),
          hasAttendance: hasAttendanceNow,
          hasUsedVoiceMode: localVoice || Boolean(hasUsedVoiceMode),
          hasUsedPredictive: localPred || Boolean(hasUsedPredictive),
          hasUsedPeerSync: localSync || Boolean(hasUsedPeerSync),
          hasConfiguredSound: localSound || Boolean(hasConfiguredSound),
          onboardingDismissed: localDismissed || Boolean(onboardingStatus?.onboardingDismissed),
        };
        setOnboardingStatus(nextOnboarding);
      }

      setCache('today', { 
        ...useCacheStore.getState().today,
        [reqDate]: {
          agenda: agendaRef.current, 
          todayStatus: nextTodayStatus, 
          activeSemester: semData || null,
          onboarding: nextOnboarding
        }
      });

    } catch (error: any) {
      if (signal?.aborted || error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED' || reqDate !== targetDateStrRef.current || myFetchSeq !== fetchSeqRef.current) {
        return;
      }
      console.error("Failed to fetch today data:", error);
      
      const todayCache = useCacheStore.getState().today?.[reqDate];
      const semesterCache = useCacheStore.getState().semester;
      const resolvedActiveSemester = todayCache?.activeSemester || semesterCache?.activeSemester || null;
      setActiveSemester(resolvedActiveSemester);

      if (todayCache && todayCache.agenda && todayCache.agenda.length > 0 && resolvedActiveSemester) {
        setAgenda(todayCache.agenda);
        agendaRef.current = todayCache.agenda;
        setTodayStatus(todayCache.todayStatus || null);
      } else {
        const pseudoAgenda = buildLocalFallbackAgenda(reqDate, resolvedActiveSemester);
        setAgenda(pseudoAgenda);
        agendaRef.current = pseudoAgenda;
        setTodayStatus(todayCache?.todayStatus || null);
      }
    } finally {
      clearTimeout(safetyTimer);
      delete inFlightFetchPromiseRef.current[reqDate];
      if (reqDate === targetDateStrRef.current && myFetchSeq === fetchSeqRef.current) {
        setIsLoading(false);
      }
    }
    })();

    inFlightFetchPromiseRef.current[reqDate] = runPromise;
    return runPromise;
  };

  // Scroll to top when date changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [targetDateStr]);

  useEffect(() => {
    targetDateStrRef.current = targetDateStr;

    // Abort any in-flight fetch for the previous date
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Clear stale in-flight promise reference for this targetDateStr so fresh request runs
    delete inFlightFetchPromiseRef.current[targetDateStr];

    const cachedDay = useCacheStore.getState().today?.[targetDateStr];
    const resolvedSem = cachedDay?.activeSemester || useCacheStore.getState().semester?.activeSemester || null;
    const nextInitialAgenda = resolveInitialAgenda(targetDateStr);
    if (cachedDay?.agenda || nextInitialAgenda.length > 0 || cachedDay?.todayStatus?.isHoliday || cachedDay?.todayStatus?.isExam) {
      setAgenda(cachedDay?.agenda || nextInitialAgenda);
      agendaRef.current = cachedDay?.agenda || nextInitialAgenda;
      setTodayStatus(resolvedSem ? (cachedDay?.todayStatus || null) : null);
      setActiveSemester(resolvedSem);
      if (cachedDay?.onboarding) setOnboardingStatus(cachedDay.onboarding);
      setIsLoading(false);
    } else {
      setAgenda([]);
      agendaRef.current = [];
      setTodayStatus(null);
      if (resolvedSem) setActiveSemester(resolvedSem);
      setIsLoading(true);
    }
    fetchData(targetDateStr, controller.signal);

    const handleUpdate = (e: any) => {
      // If TodayPage itself marked attendance, only fetch stats; do not refetch and clobber local optimistic agenda!
      if (e?.detail?.source === "today-page") {
        fetchStats();
        return;
      }
      if (debounceUpdateTimerRef.current) clearTimeout(debounceUpdateTimerRef.current);
      debounceUpdateTimerRef.current = setTimeout(() => {
        delete inFlightFetchPromiseRef.current[targetDateStrRef.current];
        fetchData(targetDateStrRef.current);
        fetchStats();
      }, 100);
    };

    const handleSemesterChange = () => {
      hasVerifiedSemesterRef.current = false;
      delete inFlightFetchPromiseRef.current[targetDateStrRef.current];
      useCacheStore.getState().setCache("today", null);
      fetchData(targetDateStrRef.current);
      fetchStats();
    };

    window.addEventListener("attendance-updated", handleUpdate);
    window.addEventListener("semester-updated", handleSemesterChange);
    window.addEventListener("timetable-updated", handleSemesterChange);
    return () => {
      controller.abort();
      if (debounceUpdateTimerRef.current) clearTimeout(debounceUpdateTimerRef.current);
      window.removeEventListener("attendance-updated", handleUpdate);
      window.removeEventListener("semester-updated", handleSemesterChange);
      window.removeEventListener("timetable-updated", handleSemesterChange);
    };
  }, [targetDateStr]);

  // Greeting overlay effect (persisted per session to avoid re-triggering on tab switches)
  useEffect(() => {
    if (!isLoading) {
      const shouldShowOverlay = activeEvent && ["holiday", "restricted_holiday", "vacation", "fest", "institute", "lab_exam", "midsem", "endsem", "ct", "exam"].includes(activeEvent.eventType || "");
      if (isBirthday || shouldShowOverlay) {
        const storageKey = `attendx_greeted_${targetDateStr}`;
        const alreadyGreeted = sessionStorage.getItem(storageKey) === "true";
        if (!alreadyGreeted && lastGreetedDate !== targetDateStr) {
          setShowGreetingOverlay(true);
          setLastGreetedDate(targetDateStr);
          sessionStorage.setItem(storageKey, "true");
        }
      } else {
        setShowGreetingOverlay(false);
        if (lastGreetedDate !== targetDateStr) {
          setLastGreetedDate(targetDateStr); // Keeps track that we visited a non-holiday date so we can reset and re-trigger if we go back
        }
      }
    }
  }, [isLoading, activeEvent, targetDateStr, lastGreetedDate, isBirthday]);

  const markAttendance = async (item: AgendaItem, status: string, remarks?: string) => {
    inFlightMarksCountRef.current += 1;
    fetchSeqRef.current += 1;
    useAttendanceStore.getState().invalidateInFlightStats();

    const normalizedStatus = status === "clear" ? null : (status as any);
    let updatedAgenda: AgendaItem[] = [];
    setAgenda(prev => {
      updatedAgenda = prev.map(a => 
        a.id === item.id ? { ...a, status: normalizedStatus, remarks: status === "clear" ? undefined : (remarks || a.remarks) } : a
      );
      agendaRef.current = updatedAgenda;
      return updatedAgenda;
    });

    // --- OFFLINE OPTIMISTIC UPDATE ---
    const store = useAttendanceStore.getState();
    const subjects = [...store.subjects];
    const subjectIndex = subjects.findIndex(s => s.subjectId === item.subject?.id || s.id === item.subject?.id);
    if (subjectIndex !== -1) {
      const s = { ...subjects[subjectIndex] };
      if (item.status === "present" || item.status === "medical" || item.status === "od") {
        s.attended -= 1;
        s.total -= 1;
      } else if (item.status === "absent") {
        s.total -= 1;
      }
      
      if (status === "present" || status === "medical" || status === "od") {
        s.attended += 1;
        s.total += 1;
      } else if (status === "absent") {
        s.total += 1;
      }
      
      s.percentage = s.total > 0 ? Number(((s.attended / s.total) * 100).toFixed(1)) : 0;
      subjects[subjectIndex] = s;
      
      const totalAttended = subjects.reduce((sum, sub) => sum + sub.attended, 0);
      const totalClasses = subjects.reduce((sum, sub) => sum + sub.total, 0);
      const overallPercentage = totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 0;
      
      useAttendanceStore.setState({ subjects, totalAttended, totalClasses, overallPercentage });
    }
    // ---------------------------------

    // 0ms Optimistic Onboarding Step 5 completion
    if (status !== "clear") {
      localStorage.setItem("onboarding_attendance", "true");
      setOnboardingStatus((prev: any) => ({ ...(prev || {}), hasAttendance: true }));
      api.patch("/users/onboarding-status", { step: "attendance" }).catch(() => {});
      window.dispatchEvent(new CustomEvent("onboarding-step-completed", { detail: { step: "attendance" } }));
    }


    // Trigger Popup Animation & Haptics
    if (status === "absent") {
      hapticWarning();
      triggerAttendancePopup("crying", "Attendance Dropped! 😭");
    } else if (status === "present" || status === "medical" || status === "od") {
      hapticSuccess();
      const { overallPercentage, totalAttended, totalClasses } = useAttendanceStore.getState();
      const targetPct = useAuthStore.getState().user?.targetAttendance ?? 75;
      
      let newAttended = totalAttended;
      let newClasses = totalClasses;
      
      if (item.status !== "present" && item.status !== "medical" && item.status !== "od") {
         newAttended += 1;
         if (item.status === null || item.status === "off" || item.status === "cancelled") {
            newClasses += 1;
         }
      }
      
      const newPercentage = newClasses > 0 ? (newAttended / newClasses) * 100 : 0;
      
      if (overallPercentage < targetPct && newPercentage >= targetPct) {
        triggerAttendancePopup("target_hit", `Target ${targetPct}% Touched! 🎯`);
      } else {
        const slotTypeLower = (item.slotType || "").toLowerCase();
        const isExamDay = activeEvent && ["exam", "midsem", "endsem"].includes((activeEvent.eventType || "").toLowerCase());
        
        if (isExamDay || slotTypeLower.includes('exam') || slotTypeLower.includes('mid') || slotTypeLower.includes('end')) {
          triggerAttendancePopup("exam", "Good luck on your exam! 📝");
        } else if (slotTypeLower.includes('practical') || slotTypeLower.includes('lab')) {
          triggerAttendancePopup("practical", "Awesome! Practical marked! 🔬");
        } else {
          triggerAttendancePopup("thumbs_up", "Awesome! Marked Present 👍");
        }
      }
    } else if (status === "off" || status === "cancelled") {
      hapticMedium();
      const allOthersOff = updatedAgenda.every(a => a.status === "off" || a.status === "cancelled");
      if (allOthersOff && updatedAgenda.length > 0) {
        const { animType, animMsg } = getHolidayAnimation(activeEvent);
        triggerAttendancePopup(animType, animMsg);
      } else {
        triggerAttendancePopup("off_class", "Yay! Off class today! 🎈🛌");
      }
    } else if (status === "clear") {
      hapticLight();
    }

    try {
      if (!item.subject?.id) {
        throw new Error("Subject is missing for this agenda item");
      }
      const res = await api.post("/attendance/mark", {
        subjectId: item.subject.id,
        date: targetDateStr,
        status,
        remarks,
        timetableSlotId: item.type === "slot" ? item.id : undefined,
        overrideId: item.type === "override" ? item.id : undefined,
        attendanceId: item.attendanceId,
      });

      let finalAgenda: AgendaItem[] = [];
      setAgenda(prev => {
        const next = prev.map(a => 
          a.id === item.id 
            ? { ...a, status: normalizedStatus, attendanceId: status === "clear" ? null : (res.data?.id || a.attendanceId) } 
            : a
        );
        finalAgenda = next;
        agendaRef.current = next;
        return next;
      });

      if (status !== "clear") {
        localStorage.setItem("onboarding_attendance", "true");
        setOnboardingStatus((prev: any) => ({ ...(prev || {}), hasAttendance: true }));
        window.dispatchEvent(new CustomEvent("onboarding-step-completed", { detail: { step: "attendance" } }));
      }

      // Update global offline caches optimistically
      const state = useCacheStore.getState();
      
      // 1. Update Today Cache with the finalized agenda (including the saved attendanceId)
      const isStillAllOff = finalAgenda.length > 0 && finalAgenda.every(a => a.status === "off");
      const computedTodayStatus = isStillAllOff ? "off" : null;
      if (!isStillAllOff && todayStatus === "off") {
        setTodayStatus(null);
      }

      state.setCache('today', { 
        ...state.today,
        [targetDateStr]: {
          ...state.today?.[targetDateStr],
          agenda: finalAgenda.length > 0 ? finalAgenda : agendaRef.current,
          todayStatus: computedTodayStatus,
          activeSemester,
          onboarding: { ...(onboardingStatus || {}), hasAttendance: status !== "clear" ? true : onboardingStatus?.hasAttendance }
        }
      });
      
      // 2. Update Calendar Cache only if this month is already cached (never inject a partial skeleton object)
      const monthStr = targetDateStr.substring(0, 7);
      const existingMonthCache = state.calendar?.[monthStr];
      if (existingMonthCache && existingMonthCache.days && !Array.isArray(existingMonthCache.days)) {
        const currentAgenda = finalAgenda.length > 0 ? finalAgenda : agendaRef.current;
        const nextDayDetails = currentAgenda.map((a) => ({
          id: a.attendanceId || `unmarked-${a.id}`,
          subjectName: a.subject?.name || "Class",
          status: a.status || "not_marked",
          remarks: a.remarks || null,
        }));

        const isFullyMarked = currentAgenda.length > 0 && currentAgenda.every((a) => a.status && a.status !== ("not_marked" as any));
        let nextDayStatus = "not_marked";
        if (isFullyMarked) {
          const hasAttended = currentAgenda.some((a) => ["present", "medical", "od"].includes(String(a.status)));
          const hasMissed = currentAgenda.some((a) => a.status === "absent");
          if (hasAttended && hasMissed) nextDayStatus = "mixed";
          else if (hasAttended) nextDayStatus = "attended";
          else if (hasMissed) nextDayStatus = "missed";
          else nextDayStatus = "off";
        }

        state.setCache('calendar', {
          ...state.calendar,
          [monthStr]: {
            ...existingMonthCache,
            days: {
              ...existingMonthCache.days,
              [targetDateStr]: nextDayStatus,
            },
            details: {
              ...(existingMonthCache.details || {}),
              [targetDateStr]: nextDayDetails,
            },
          },
        });
      }
      
      // 3. Update Subject Logs Cache
      const updateSubjectLog = (cacheKey: string) => {
         const subjCache = state.subject_logs?.[cacheKey];
         if (subjCache && subjCache.logs) {
           const logIdx = subjCache.logs.findIndex((l: any) => {
             if (item.attendanceId && l.id === item.attendanceId) return true;
             if (l.date !== targetDateStr || l.subjectId !== item.subject?.id) return false;
             if (item.type === "override" || l.overrideId) {
               return l.overrideId === item.id;
             }
             if (item.type === "slot" || l.slotId) {
               return l.slotId === item.id;
             }
             if (item.startTime && l.time) {
               return l.time === item.startTime;
             }
             return !l.time && !l.slotId && !l.overrideId;
           });
           if (status === "clear") {
             if (logIdx >= 0) subjCache.logs.splice(logIdx, 1);
           } else {
             if (logIdx >= 0) {
               subjCache.logs[logIdx].status = status;
               subjCache.logs[logIdx].remarks = remarks;
               if (res.data?.id) subjCache.logs[logIdx].id = res.data.id;
             } else {
               subjCache.logs.unshift({
                 id: res.data?.id || item.attendanceId || `optimistic-${Date.now()}`,
                 subjectId: item.subject?.id,
                 subjectName: item.subject?.name,
                 subjectColorHex: item.subject?.colorHex,
                 date: targetDateStr,
                 dateFormatted: new Date(targetDateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                 status,
                 remarks,
                 time: item.startTime,
                 slotId: item.type === "slot" ? item.id : undefined,
                 overrideId: item.type === "override" ? item.id : undefined,
               });
             }
           }
           state.setCache('subject_logs', { ...state.subject_logs, [cacheKey]: subjCache });
         }
      };
      
      updateSubjectLog('all');
      if (item.subject?.id) updateSubjectLog(item.subject.id);

      fetchStats();
      window.dispatchEvent(new CustomEvent("attendance-updated", { detail: { source: "today-page" } }));
    } catch (error) {
      console.error("Failed to mark attendance offline or error:", error);
      // Offline fallback relies on the global optimistic update we just fired above);
      window.dispatchEvent(new CustomEvent("attendance-updated", { detail: { source: "today-page" } }));
    } finally {
      inFlightMarksCountRef.current = Math.max(0, inFlightMarksCountRef.current - 1);
    }
  };

  const handleStatusClick = (item: AgendaItem, status: string) => {
    if (item.id.startsWith("temp_")) {
      toast.info("Preparing extra lecture, please tap again in a moment...");
      return;
    }
    const currentItem = agendaRef.current.find(a => a.id === item.id) || item;
    const now = Date.now();
    const lastClick = lastStatusClickRef.current[item.id];

    // Debounce rapid repeat taps on the same status (prevents accidental toggling to clear on fast multi-click)
    if (lastClick && lastClick.status === status && (now - lastClick.time) < 450) {
      return;
    }

    lastStatusClickRef.current[item.id] = { status, time: now };

    // If clicking the currently active status after deliberate delay, unmark it (void)
    if (currentItem.status === status) {
      markAttendance(currentItem, "clear");
      return;
    }

    if (status === "absent" || status === "off") {
      setSelectedRemarkItem({ item: currentItem, status });
      setRemarkInput(currentItem.remarks || "");
    } else {
      markAttendance(currentItem, status);
    }
  };

  const handleOpenRemarkModal = (item: AgendaItem, targetStatus?: string) => {
    hapticSelection();
    setSelectedRemarkItem({ item, status: targetStatus || item.status || "present" });
    setRemarkInput(item.remarks || "");
  };

  const handleSaveRemark = () => {
    if (!selectedRemarkItem) return;
    const finalRemark = remarkInput.trim() || undefined;
    markAttendance(selectedRemarkItem.item, selectedRemarkItem.status, finalRemark);
    setSelectedRemarkItem(null);
    setRemarkInput("");
  };

  const handleClearRemarkOnly = () => {
    if (!selectedRemarkItem) return;
    markAttendance(selectedRemarkItem.item, selectedRemarkItem.status, undefined);
    setSelectedRemarkItem(null);
    setRemarkInput("");
  };

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
        return [
          "Regular Class",
          "Proxy",
          "Extra Class",
          "Guest Lecture",
        ];
      case "absent":
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

  const pendingCount = agenda.filter(a => a.status === null).length;



  // Determine if we should show the holiday/exam state instead of classes
  const isGlobalEventActive = activeEvent && ["holiday", "restricted_holiday", "vacation", "fest", "midsem", "endsem", "exam", "lab_exam", "practical", "lab", "institute"].includes(activeEvent.eventType);

  const getEventStateConfig = (type: string) => {
    switch(type) {
      case "midsem":
      case "endsem":
      case "exam":
        return { icon: <BookOpen className="w-16 h-16 text-rose-500 mb-4 mx-auto" />, color: "border-rose-500/20 bg-rose-500/5", title: "Exam Mode", msg: "Focus on your exams. No regular classes today." };
      case "lab_exam":
      case "practical":
      case "lab":
        return { icon: <BookOpen className="w-16 h-16 text-indigo-500 mb-4 mx-auto" />, color: "border-indigo-500/20 bg-indigo-500/5", title: "Practical Exam", msg: "Practical exams in progress. Best of luck!" };
      case "fest":
      case "institute":
        return { icon: <PartyPopper className="w-16 h-16 text-purple-500 mb-4 mx-auto" />, color: "border-purple-500/20 bg-purple-500/5", title: "Festivities", msg: "Enjoy the celebrations! Classes are suspended." };
      case "vacation":
        return { icon: <Palmtree className="w-16 h-16 text-emerald-500 mb-4 mx-auto" />, color: "border-emerald-500/20 bg-emerald-500/5", title: "Vacation", msg: "You're officially on vacation. Recharge and relax!" };
      case "holiday":
      case "restricted_holiday": {
        const { animType } = getHolidayAnimation(activeEvent);
        if (HOLIDAY_ASSETS[animType as AnimationType]) {
          return {
            icon: <HolidayIconRenderer src={HOLIDAY_ASSETS[animType as AnimationType] as string} alt="Holiday Icon" className="w-16 h-16 drop-shadow-md mb-4 mx-auto" />,
            color: type === "holiday" ? "border-emerald-500/20 bg-emerald-500/5" : "border-cyan-500/20 bg-cyan-500/5",
            title: type === "holiday" ? "Holiday" : "Restricted Holiday",
            msg: "Enjoy your day off!"
          };
        }
        return { 
          icon: <Palmtree className={`w-16 h-16 mb-4 mx-auto ${type === 'holiday' ? 'text-emerald-500' : 'text-cyan-500'}`} />, 
          color: type === "holiday" ? "border-emerald-500/20 bg-emerald-500/5" : "border-cyan-500/20 bg-cyan-500/5", 
          title: type === "holiday" ? "Holiday" : "Restricted Holiday", 
          msg: "Enjoy your day off!" 
        };
      }
      default:
        return { icon: <Palmtree className="w-16 h-16 text-emerald-500 mb-4 mx-auto" />, color: "border-emerald-500/20 bg-emerald-500/5", title: "Holiday", msg: "Enjoy your day off!" };
    }
  };

  const displayDate = new Date(targetDateStr);
  const userTimezoneOffset = displayDate.getTimezoneOffset() * 60000;
  const adjustedDate = new Date(displayDate.getTime() + userTimezoneOffset);

  if (isLoading && !dayCache && agenda.length === 0) {
    return (
      <div className="theme-terrascape min-h-screen transition-colors duration-300">
        <div className="fixed inset-0 pointer-events-none z-0 opacity-50 dark:opacity-60"
             style={{
               background: 'radial-gradient(circle at 30% 90%, #059669 0%, transparent 60%), radial-gradient(circle at 80% 80%, #D97706 0%, transparent 50%)',
               filter: 'blur(90px)'
             }} 
        />
        <div className="relative z-10">
          <PageSkeleton type="today" />
        </div>
      </div>
    );
  }

  return (
    <div className="theme-terrascape min-h-screen transition-colors duration-300">
      
      
      {/* Terrascape Ambient Gradient Background (replaces NeurosyncWaves) */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-50 dark:opacity-60"
           style={{
             background: 'radial-gradient(circle at 30% 90%, #059669 0%, transparent 60%), radial-gradient(circle at 80% 80%, #D97706 0%, transparent 50%)',
             filter: 'blur(90px)'
           }} 
      />

      <div className="p-4 md:p-8 space-y-8 w-full pb-32 md:pb-8 relative z-10">


      
      <HolidayGreetingOverlay
        isOpen={showGreetingOverlay}
        holidayName={isBirthday ? `Happy Birthday, ${user?.name?.split(' ')[0]}!` : (activeEvent?.title || "Holiday")}
        holidayAssetSrc={isBirthday ? "/lottie/happy-birthday.json" : (activeEvent ? HOLIDAY_ASSETS[getHolidayAnimation(activeEvent).animType as AnimationType] : undefined)}
        hasClasses={agenda.some(item => !item.status)}
        onMarkOff={() => handleMarkFullDayAction("off")}
        onClose={() => {
          setShowGreetingOverlay(false);
          sessionStorage.setItem(`attendx_greeted_${targetDateStr}`, "true");
        }}
      />
      
      {isSemesterActive && todayStatus?.nextEvent && !activeEvent && (
        <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200/60 dark:border-sky-800/40 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-xs overflow-hidden">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Timer className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />
            <span className="text-sm font-medium text-sky-800 dark:text-sky-200 truncate">
              Upcoming: <span className="font-bold text-sky-900 dark:text-sky-100">{todayStatus.nextEvent.title}</span>
            </span>
          </div>
          <span className="text-xs font-bold bg-sky-200/90 dark:bg-sky-800/50 text-sky-950 dark:text-sky-200 border border-sky-300/60 dark:border-sky-700/50 px-3 py-1 rounded-full uppercase tracking-wider shrink-0 whitespace-nowrap shadow-xs">
            {new Date(todayStatus.nextEvent.date.split('T')[0] + "T00:00:00").toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      )}

      {isSemesterActive && (
        <>
          {/* Overall Attendance & Forecast Banner */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
        {/* Overall Attendance Card */}
        <div className={`relative overflow-hidden rounded-2xl border p-3.5 sm:p-4.5 flex items-center justify-between gap-3 sm:gap-4 transition-all shadow-xs ${
          overallPercentage >= targetPercentage
            ? "bg-emerald-500/10 border-emerald-500/25"
            : "bg-rose-500/10 border-rose-500/25"
        }`}>
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 ${
              overallPercentage >= targetPercentage ? "bg-emerald-500/20" : "bg-rose-500/20"
            }`}>
              {overallPercentage >= targetPercentage
                ? <TrendingUp className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                : <TrendingDown className="w-5 h-5 text-rose-500 dark:text-rose-400" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm sm:text-base font-bold text-foreground truncate">Overall Attendance</p>
              <p className={`text-xs sm:text-[13px] mt-0.5 font-medium truncate ${
                overallPercentage >= targetPercentage ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              }`}>
                {overallPercentage >= targetPercentage
                  ? `${((overallPercentage ?? 0) - targetPercentage).toFixed(1)}% above target (${targetPercentage}%)`
                  : `${(targetPercentage - (overallPercentage ?? 0)).toFixed(1)}% below target (${targetPercentage}%)`}
              </p>
            </div>
          </div>
          <div className={`shrink-0 flex items-center justify-center rounded-xl px-3 py-1.5 sm:px-3.5 sm:py-2 font-mono font-bold text-sm sm:text-base tracking-tight shadow-xs ${
            overallPercentage >= targetPercentage
              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
              : "bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30"
          }`}>
            <span>{(overallPercentage ?? 0).toFixed(2)}%</span>
          </div>
        </div>

        {/* Frovia Berry Landing - Forecast Engine */}
        <div 
          onClick={() => navigate("/predictive")}
          className="relative overflow-hidden rounded-2xl border border-[#74313A]/25 dark:border-[#EED3CF]/20 bg-[#EED3CF] dark:bg-[#74313A] p-3.5 sm:p-4.5 flex items-center justify-between gap-3 sm:gap-4 cursor-pointer group shadow-xs transition-all hover:scale-[1.008] active:scale-[0.995]"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {/* Frovia Ambient Animated Gradients */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-black/20 dark:to-transparent z-0 pointer-events-none" />
          
          {/* Frovia Berry Animation Container - Contained within bounds */}
          <div className="absolute -right-3 -top-5 w-28 h-28 opacity-20 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-0">
            <div className="absolute inset-0 flex items-center justify-center animate-spin-slow" style={{ animationDuration: '15s' }}>
              <div className="w-7 h-7 bg-[#e11d48] rounded-full absolute top-3 left-3 shadow-xl flex flex-col items-center justify-start pt-0.5">
                <div className="w-2 h-1 bg-green-500 rounded-full" />
              </div>
              <div className="w-5 h-5 bg-[#be123c] rounded-full absolute bottom-3 right-6 shadow-xl flex flex-col items-center justify-start pt-0.5">
                <div className="w-1.5 h-0.5 bg-green-500 rounded-full" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1 relative z-10">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#74313A] dark:bg-[#EED3CF] text-[#EED3CF] dark:text-[#74313A] flex items-center justify-center shrink-0 group-hover:scale-105 transition-all shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm sm:text-base font-bold text-[#111827] dark:text-white truncate tracking-tight">Forecast Engine</p>
              <p className="text-xs sm:text-[13px] text-[#4B5563] dark:text-white/80 truncate font-medium transition-colors">
                Calculate consecutive classes needed for {targetPercentage}% target
              </p>
            </div>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#7E2430]/10 dark:bg-black/25 text-[#74313A] dark:text-[#EED3CF] group-hover:bg-[#74313A] dark:group-hover:bg-[#EED3CF] group-hover:text-white dark:group-hover:text-[#74313A] transition-all flex items-center justify-center shrink-0 relative z-10 shadow-xs">
            <ChevronRight className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 mb-2">
        {/* Row 1: Header and Date Picker */}
        <div className="flex flex-col items-center justify-center text-center">
            {isBirthday && (
              <div className="mb-4 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-4 w-full max-w-sm text-left">
                <div className="text-3xl">🎂</div>
                <div>
                  <h3 className="font-bold text-amber-500">Happy Birthday, {user?.name?.split(' ')[0]}!</h3>
                  <p className="text-sm text-foreground/80">Hope you have a fantastic day today!</p>
                </div>
              </div>
            )}
            <h1 className="text-2xl font-bold text-foreground">{dateParam ? "Classes on" : "Today's Schedule"}</h1>
            
            <div className="flex items-center justify-center gap-4 mt-3">
              <button 
                onClick={() => {
                  hapticSelection();
                  const [y, m, d] = targetDateStr.split("-").map(Number);
                  const prev = new Date(y, (m || 1) - 1, (d || 1) - 1);
                  const dateStr = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}-${String(prev.getDate()).padStart(2,'0')}`;
                  navigate(`/today?date=${dateStr}`);
                }}
                className="p-1 hover:bg-muted rounded-lg text-muted-foreground transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <p className="text-sm font-semibold text-muted-foreground min-w-[140px]">
                {(() => {
                  const [y, m, d] = targetDateStr.split("-").map(Number);
                  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
                })()}
              </p>
              
              <button 
                onClick={() => {
                  hapticSelection();
                  const [y, m, d] = targetDateStr.split("-").map(Number);
                  const next = new Date(y, (m || 1) - 1, (d || 1) + 1);
                  const dateStr = `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`;
                  navigate(`/today?date=${dateStr}`);
                }}
                className="p-1 hover:bg-muted rounded-lg text-muted-foreground transition-colors cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
        </div>

        {/* Row 2: Action Buttons */}
        <div className="flex items-center justify-between gap-3 bg-card/60 border border-border/50 p-2.5 rounded-2xl">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => navigate('/assignments')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-600/15 text-violet-500 border border-violet-500/20 hover:bg-violet-600/25 transition-all shadow-sm cursor-pointer">
              <BookOpen size={14} /> Assignments
            </button>
            {isSemesterActive && (
              <button
                onClick={openAddExtraModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-pink-500/10 text-pink-500 border border-pink-500/20 hover:bg-pink-500/20 transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Extra
              </button>
            )}
            {isSemesterActive && agenda.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    hapticSelection();
                    setShowMarkFullDayModal(true);
                  }}
                  disabled={isMarkingFullDay}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  title="Mark full day as Attended, Absent, or Off"
                >
                  <CheckCheck className="w-4 h-4" />
                  Mark Full Day
                </button>
                {agenda.some(a => a.status != null) && (
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      handleMarkFullDayAction("clear");
                    }}
                    disabled={isMarkingFullDay}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-muted text-muted-foreground border border-border hover:bg-muted/80 hover:text-foreground transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    title="Undo full day attendance and reset classes"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {isMarkingFullDay ? "Clearing..." : "Undo Day"}
                  </button>
                )}
              </>
            )}
          </div>
          <div className="flex flex-col items-center justify-center shrink-0 pr-2 pl-4 border-l border-border/50">
            <p className="text-xl font-bold text-foreground leading-none">{pendingCount}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mt-0.5">Pending</p>
          </div>
        </div>
      </div>

      {/* Event Highlight Banner (Exams, Yalgaar, Fests, Holidays) */}
      {activeEvent && (
        <div className={`p-4 rounded-2xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
          ["midsem", "endsem", "exam"].includes((activeEvent.eventType || "").toLowerCase())
            ? "bg-rose-500/10 border-rose-500/30"
            : ["fest", "institute", "yalgaar"].includes((activeEvent.eventType || "").toLowerCase())
            ? "bg-purple-500/10 border-purple-500/30"
            : "bg-amber-500/10 border-amber-500/30"
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-foreground/10 border border-foreground/20 flex items-center justify-center text-xl shadow-xs shrink-0 overflow-hidden">
              {(() => {
                const { animType } = getHolidayAnimation(activeEvent);
                if (HOLIDAY_ASSETS[animType as AnimationType]) {
                  return <HolidayIconRenderer src={HOLIDAY_ASSETS[animType as AnimationType] as string} alt="Holiday Icon" className="w-7 h-7 drop-shadow-sm" />;
                }
                return ["midsem", "endsem", "exam"].includes((activeEvent.eventType || "").toLowerCase()) ? "📝" : "🎉";
              })()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-foreground/10 border border-foreground/20 text-foreground">
                  {activeEvent.eventType || "Special"} Event
                </span>
                <span className="text-xs font-semibold text-primary">Today</span>
              </div>
              <h3 className="text-base font-extrabold text-foreground mt-0.5">{activeEvent.title}</h3>
            </div>
          </div>
          <div className="text-xs font-medium text-muted-foreground">
            📌 Event highlighted for today. Use <span className="font-bold text-foreground">Mark Full Day</span> to update your schedule.
          </div>
        </div>
      )}

          {/* Semester Completed Banner */}
          {activeSemester && (() => {
            const end = new Date(activeSemester.endDate);
            end.setHours(23, 59, 59, 999);
            return new Date() > end;
          })() && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">
                    {activeSemester.name} has concluded!
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ready for the new semester? Tap to reset app data and transition smoothly.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTransitionModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold transition-all hover:bg-primary/90 shadow-sm shrink-0 cursor-pointer"
              >
                Start Next Semester
              </button>
            </div>
          )}
        </>
      )}

      {!isSemesterActive ? (
        isLoading && !dayCache ? (
          <div className="space-y-4 animate-pulse my-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 bg-[var(--ts-surface)] rounded-xl border border-[var(--ts-border)] w-full"></div>
            ))}
          </div>
        ) : (
          <div className="space-y-6 my-6">
            {!isChecklistDismissed && (
              <div className="flex flex-col items-center justify-center py-4">
                <OnboardingChecklist 
                  title="Getting Started"
                  onDismiss={() => markOnboardingStep("dismiss")}
                  steps={checklistSteps}
                />
              </div>
            )}

            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 my-8 bg-card/60 border border-border/50 backdrop-blur-md rounded-2xl shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-2">
                <GraduationCap className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">No Active Semester</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Please create and activate a semester first to start tracking your daily classes, managing subjects, and viewing attendance.
              </p>
              <button
                onClick={() => setIsCreateSemesterOpen(true)}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-primary/25 transition-all mt-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Active Semester</span>
              </button>
            </div>
          </div>
        )
      ) : (
        <>
          {!isChecklistDismissed && (
            <div className="flex flex-col items-center justify-center py-6">
              <OnboardingChecklist 
                title="Getting Started"
                onDismiss={() => markOnboardingStep("dismiss")}
                steps={checklistSteps}
              />
            </div>
          )}

          {isLoading && !dayCache ? (
            <div className="space-y-4 animate-pulse">
               {[1, 2, 3].map(i => (
                 <div key={i} className="h-28 bg-[var(--ts-surface)] rounded-xl border border-[var(--ts-border)] w-full"></div>
               ))}
            </div>
          ) : agenda.length === 0 && hasActiveTimetable === false && !todayStatus?.isHoliday && !todayStatus?.isExam ? (
        <div className="text-center py-10 bg-card/60 border border-border/50 backdrop-blur-md rounded-2xl shadow-sm px-4">
          <CalendarDays className="w-12 h-12 text-primary mx-auto mb-3 opacity-80" />
          <h3 className="text-lg font-bold text-foreground mb-1">No Active Timetable</h3>
          <p className="text-muted-foreground max-w-sm mx-auto text-xs mb-5">
            You don't have an active weekly schedule for this semester. Set up your timetable slots or log an extra lecture.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => navigate("/timetable")}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-primary/20 cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
              <span>Setup Timetable</span>
            </button>
            <button
              onClick={openAddExtraModal}
              className="inline-flex items-center gap-2 bg-muted hover:bg-muted/80 text-foreground px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border border-border/60 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-primary" />
              <span>Log Extra Class</span>
            </button>
          </div>
        </div>
      ) : agenda.length === 0 ? (
        <div className="text-center py-12 bg-card/60 border border-border/50 backdrop-blur-md rounded-2xl shadow-sm">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4 opacity-80" />
          <h3 className="text-lg font-medium text-foreground mb-2">No classes scheduled today!</h3>
          <p className="text-muted-foreground max-w-sm mx-auto text-sm">
            Enjoy your day off or catch up on reading and self-study.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <style>{`
            @keyframes paperAeroplaneGliderSwoop {
              0% { transform: perspective(1000px) scale(1) rotateX(0deg) rotateY(0deg) rotateZ(0deg) translate(0, 0); opacity: 1; filter: blur(0px); }
              15% { transform: perspective(1000px) scale(0.96) rotateX(28deg) rotateY(-12deg) rotateZ(-8deg) translate(8px, -14px); opacity: 0.98; box-shadow: 0 20px 40px rgba(16, 185, 129, 0.25); }
              30% { transform: perspective(1000px) scale(0.86) rotateX(42deg) rotateY(-22deg) rotateZ(16deg) translate(25px, -35px); opacity: 0.95; }
              50% { transform: perspective(1000px) scale(0.72) rotateX(32deg) rotateY(32deg) rotateZ(-24deg) translate(-45px, -95px); opacity: 0.88; filter: drop-shadow(0 15px 15px rgba(16, 185, 129, 0.35)); }
              75% { transform: perspective(1000px) scale(0.48) rotateX(22deg) rotateY(-38deg) rotateZ(32deg) translate(140px, -210px); opacity: 0.6; filter: blur(1.5px); }
              90% { transform: perspective(1000px) scale(0.24) rotateX(12deg) rotateY(-48deg) rotateZ(42deg) translate(300px, -360px); opacity: 0.25; filter: blur(3.5px); }
              100% { transform: perspective(1000px) scale(0) rotateX(0deg) rotateY(-58deg) rotateZ(52deg) translate(480px, -520px); opacity: 0; filter: blur(6px); visibility: hidden; }
            }
            @keyframes sparkPopEnter {
              0% { transform: scale(0.88) translateY(12px); box-shadow: 0 0 0 rgba(245, 158, 11, 0); }
              25% { transform: scale(1.03) translateY(-4px); box-shadow: 0 0 35px rgba(245, 158, 11, 0.45); }
              60% { transform: scale(1) translateY(0); box-shadow: 0 0 20px rgba(245, 158, 11, 0.25); }
              100% { transform: scale(1) translateY(0); box-shadow: none; }
            }
          `}</style>
          {agenda.map(item => {
            const isHydrating = item.id.startsWith("temp_");
            const isGliding = glidingExtraId === item.id;
            const isPopping = poppingExtraId === item.id;
            return (
            <div 
              key={item.id} 
              id={`agenda-item-${item.id}`}
              style={isGliding ? {
                animation: "paperAeroplaneGliderSwoop 4.0s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                pointerEvents: "none" as const,
                zIndex: 50,
              } : isPopping ? {
                animation: "sparkPopEnter 4.0s cubic-bezier(0.16, 1, 0.3, 1) forwards",
              } : undefined}
              className={`p-4 md:p-5 rounded-2xl border transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                item.status 
                  ? "bg-card/40 border-border/50 opacity-80 backdrop-blur-sm" 
                  : "bg-card/60 border-border/50 shadow-[0_0_15px_rgba(0,0,0,0.1)] backdrop-blur-md hover:bg-card/80 hover:border-border/80"
              }`}
            >
              <div className="flex items-center gap-4 min-w-0 flex-1">
                
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 flex-wrap">
                    <span className="truncate cursor-pointer hover:text-primary transition-colors" onClick={() => item.subject?.id && navigate(`/subjects/${item.subject.id}`)} title="Click to edit subject">{item.subject?.name || "Unknown Subject"}</span>
                    {(item.isExtra || item.type === "override" || item.slotType === "Extra") && (
                      <span className="bg-amber-500/20 text-amber-500 border border-amber-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm shrink-0">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        Extra
                      </span>
                    )}
                    {item.remarks && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenRemarkModal(item);
                        }}
                        className="text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 px-2.5 py-0.5 rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors shadow-xs group"
                        title="Click to edit remark"
                      >
                        <MessageSquare className="w-3 h-3 text-primary shrink-0" />
                        <span className="truncate max-w-[180px] sm:max-w-[260px]">{item.remarks}</span>
                        <Pencil className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 shrink-0 ml-0.5" />
                      </button>
                    )}
                  </h3>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground font-medium flex-wrap">
                    <span className="bg-muted px-2 py-0.5 rounded text-foreground font-mono shrink-0">{item.startTime} - {item.endTime}</span>
                    <span className="uppercase tracking-wide font-semibold shrink-0">{item.slotType}</span>
                    {item.room && <span className="shrink-0">• Room {item.room}</span>}
                  </div>
                </div>
              </div>

              <div className="flex flex-nowrap items-center gap-2 self-end md:self-auto shrink-0">
                <button
                  onClick={() => handleStatusClick(item, "present")}
                  disabled={isHydrating}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-[transform,opacity] duration-75 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                    (item.status === "present" || item.status === "medical" || item.status === "od")
                      ? "bg-emerald-500 text-white font-bold shadow-md shadow-emerald-500/20"
                      : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 hover:text-emerald-600"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Attended
                </button>
                <button
                  onClick={() => handleStatusClick(item, "absent")}
                  disabled={isHydrating}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-[transform,opacity] duration-75 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                    item.status === "absent"
                      ? "bg-rose-500 text-white font-bold shadow-md shadow-rose-500/20"
                      : "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 hover:text-rose-600"
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Missed
                </button>
                <button
                  onClick={() => handleStatusClick(item, "off")}
                  disabled={isHydrating}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-[transform,opacity] duration-75 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                    item.status === "off"
                      ? "bg-amber-500 text-white font-bold shadow-md shadow-amber-500/20"
                      : "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 hover:text-amber-600"
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  Off
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenRemarkModal(item)}
                  disabled={isHydrating}
                  className={`flex items-center justify-center p-2 rounded-xl text-xs font-semibold cursor-pointer transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                    item.remarks
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  title={item.remarks ? `Remark: "${item.remarks}" (Click to edit)` : "Add remark / note (Bunk, reason, etc.)"}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </button>
                {/* Delete Extra Class Button */}
                {((item.type === "override" || item.type === "manual") && item.isExtra) && (
                  <button
                    onClick={() => handleDeleteExtraClass(item.id)}
                    className="flex items-center justify-center p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors cursor-pointer ml-2"
                    title="Delete Extra Class"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {/* Contextual Remark Modal */}
      {selectedRemarkItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-card border border-border/80 rounded-3xl p-4 sm:p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary shrink-0" />
              <span>Log Class Remark / Reason</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Logging status <span className="font-bold uppercase text-primary">{selectedRemarkItem.status}</span> for <span className="font-semibold text-foreground">{selectedRemarkItem.item.subject?.name || "Unknown Subject"}</span>.
              Tag why you missed, if class was cancelled, or if it was a bunk.
            </p>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Remark / Reason</label>
              <input
                type="text"
                value={remarkInput}
                onChange={(e) => setRemarkInput(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
                autoFocus
              />
              <div className="flex flex-wrap gap-1.5 mt-2.5 max-h-32 overflow-y-auto pr-1">
                {getContextualRemarkChips(selectedRemarkItem.status).map((tag) => (
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
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRemarkItem(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>
                {selectedRemarkItem.item.remarks && (
                  <button
                    type="button"
                    onClick={handleClearRemarkOnly}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer text-center"
                  >
                    Remove Remark
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={handleSaveRemark}
                className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition-all shadow-md shadow-primary/20 cursor-pointer text-center"
              >
                Save Attendance Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Extra Lecture Modal */}
      {isAddExtraModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-card border border-border/80 rounded-3xl p-4 sm:p-6 w-full max-w-md shadow-2xl space-y-4 sm:space-y-5 relative max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between shrink-0">
              <h3 className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight">
                Add extra lecture
              </h3>
              <button
                onClick={() => setIsAddExtraModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 overflow-y-auto pr-1 no-scrollbar flex-1">
              {subjectsForExtra.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No subjects found for active semester.
                </div>
              ) : (
                subjectsForExtra.map((sub) => (
                  <button
                    key={sub.id}
                    disabled={isAddingExtra}
                    onClick={() => handleAddExtraLecture(sub.id)}
                    className="w-full text-left p-3.5 sm:p-4 rounded-2xl bg-muted/30 hover:bg-muted/70 border border-border/40 hover:border-primary/40 transition-all font-semibold text-foreground text-sm flex items-center justify-between group cursor-pointer gap-2"
                  >
                    <span className="truncate flex-1 min-w-0">{sub.name}</span>
                    <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mark Full Day Modal */}
      {showMarkFullDayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-card border border-border/80 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 relative max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <CheckCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-foreground tracking-tight">
                    {showAbsentRemarkInput ? "Absent Reason" : "Mark Full Day"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {showAbsentRemarkInput ? "Attach remark to all classes" : `${agenda.length} classes scheduled on ${targetDateStr}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowMarkFullDayModal(false);
                  setShowAbsentRemarkInput(false);
                }}
                className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            {!showAbsentRemarkInput ? (
              <div className="space-y-3 pt-1">
                {/* 1. Attended All */}
                <button
                  type="button"
                  disabled={isMarkingFullDay}
                  onClick={() => handleMarkFullDayAction("present")}
                  className="w-full text-left p-4 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 transition-all group cursor-pointer flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0 group-hover:scale-105 transition-transform">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground text-sm group-hover:text-emerald-500 transition-colors">
                        Attended All
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Mark all {agenda.length} classes as present
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-emerald-500 transition-colors shrink-0" />
                </button>

                {/* 2. Absent All */}
                <button
                  type="button"
                  disabled={isMarkingFullDay}
                  onClick={() => setShowAbsentRemarkInput(true)}
                  className="w-full text-left p-4 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 transition-all group cursor-pointer flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-500 shrink-0 group-hover:scale-105 transition-transform">
                      <XCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground text-sm group-hover:text-rose-500 transition-colors">
                        Absent All
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Mark all missed with an optional remark
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-rose-500 transition-colors shrink-0" />
                </button>

                {/* 3. Full Day Off */}
                <button
                  type="button"
                  disabled={isMarkingFullDay}
                  onClick={() => handleMarkFullDayAction("off")}
                  className="w-full text-left p-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/50 transition-all group cursor-pointer flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 group-hover:scale-105 transition-transform">
                      <Palmtree className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground text-sm group-hover:text-amber-500 transition-colors">
                        Full Day Off
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Holiday or suspended schedule (no penalty)
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-amber-500 transition-colors shrink-0" />
                </button>

                {/* 4. Undo Day (if any marked) */}
                {agenda.some(a => a.status != null) && (
                  <button
                    type="button"
                    disabled={isMarkingFullDay}
                    onClick={() => handleMarkFullDayAction("clear")}
                    className="w-full text-left p-4 rounded-2xl bg-muted/40 hover:bg-muted/70 border border-border hover:border-border/80 transition-all group cursor-pointer flex items-center justify-between gap-3 shadow-xs mt-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0 group-hover:scale-105 transition-transform">
                        <RotateCcw className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-sm">
                          Undo Day
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Clear recorded attendance back to unrecorded
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                  </button>
                )}
              </div>
            ) : (
              /* Absent Remark View */
              <div className="space-y-4 pt-1">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enter a reason for absence. It will be recorded on all <span className="font-bold text-foreground">{agenda.length} scheduled classes and extra classes</span> for today.
                </p>

                {/* Quick Reason Chips */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Sick Leave",
                    "Overslept",
                    "Home",
                    "College OD",
                    "Sports",
                    "College Event"
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setAbsentRemark(chip)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        absentRemark === chip
                          ? "bg-rose-500/20 text-rose-500 border-rose-500/40"
                          : "bg-muted/50 text-muted-foreground border-border/60 hover:bg-muted"
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                <div className="space-y-1">
                  <textarea
                    value={absentRemark}
                    onChange={(e) => setAbsentRemark(e.target.value.slice(0, 200))}
                    className="w-full h-24 bg-muted/40 border border-border/80 rounded-2xl p-3 text-sm text-foreground outline-none focus:border-rose-500/60 resize-none transition-colors"
                  />
                  <div className="flex justify-end pr-1">
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {absentRemark.length}/200
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAbsentRemarkInput(false)}
                    className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={isMarkingFullDay}
                    onClick={() => handleMarkFullDayAction("absent", absentRemark)}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-md shadow-rose-600/20"
                  >
                    {isMarkingFullDay ? "Marking..." : "Confirm Absent"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <CreateSemesterModal
        isOpen={isCreateSemesterOpen}
        onClose={() => setIsCreateSemesterOpen(false)}
        onSuccess={(newSem) => {
          if (newSem) {
            setActiveSemester(newSem);
            setOnboardingStatus((prev: any) => ({
              ...(prev || {}),
              hasSemester: true,
            }));
            useAttendanceStore.setState({ activeSemesterId: newSem.id, hasActiveSemester: true });
            useCacheStore.getState().setCache("semester", {
              ...useCacheStore.getState().semester,
              activeSemester: newSem,
            });
          }
          hasVerifiedSemesterRef.current = false;
          delete inFlightFetchPromiseRef.current[targetDateStrRef.current];
          fetchData();
          fetchStats();
        }}
      />

      <SemesterTransitionModal
        isOpen={isTransitionModalOpen}
        onClose={() => {
          setIsTransitionModalOpen(false);
          if (activeSemester?.id) {
            sessionStorage.setItem(`attendx_dismissed_transition_${activeSemester.id}`, "true");
          }
        }}
        onSuccess={() => {
          fetchData();
          fetchStats();
        }}
        initialStatus={transitionStatus}
      />
    </div>
    </div>
  );
};


