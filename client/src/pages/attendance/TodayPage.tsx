import React, { useState, useEffect } from "react";
import { Capacitor } from '@capacitor/core';
import { Loader2, CheckCircle2, XCircle, AlertCircle, PartyPopper, BookOpen, Palmtree, Timer, TrendingUp, TrendingDown, Plus, MessageSquare, Sparkles, ChevronRight, ChevronLeft, X, Trash2 } from "lucide-react";
import { PageSkeleton } from "../../components/common/PageSkeleton";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { useAuthStore } from "../../stores/authStore";
import { useCacheStore } from "../../stores/cacheStore";
import { CreateSemesterModal } from "../../components/semester/CreateSemesterModal";
import { OnboardingChecklist } from "../../components/ui/onboarding-checklist";

import { useSearchParams, useNavigate } from "react-router-dom";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { triggerAttendancePopup, AnimationType } from "../../stores/animationPopupStore";
import { HOLIDAY_ASSETS } from "../../constants/holidayAssets";
import { HolidayIconRenderer } from "../../components/common/HolidayIconRenderer";
import { HolidayGreetingOverlay } from "../../components/common/HolidayGreetingOverlay";
import { NeurosyncWaves } from "../../components/ui/neurosync-waves";
import { format } from "date-fns";
import { FIXED_HOLIDAYS, RESTRICTED_HOLIDAYS } from "../semester/HolidayListTab";


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
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get("date");
  const today = new Date();
  const localTodayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const targetDateStr = dateParam || localTodayStr;

  const getHolidayFromList = (dateStr: string) => {
    try {
      const dateObj = new Date(dateStr);
      const formattedForMatch = format(dateObj, "dd MMMM");
      const altFormatted = format(dateObj, "d MMMM");
      
      const fixed = FIXED_HOLIDAYS.find(h => h.date === formattedForMatch || h.date === altFormatted);
      if (fixed) return { title: fixed.name, eventType: "holiday" };
      
      const restricted = RESTRICTED_HOLIDAYS.find(h => h.date === formattedForMatch || h.date === altFormatted);
      if (restricted) return { title: restricted.name, eventType: "restricted_holiday" };
    } catch (e) {
      // Ignore invalid dates
    }
    return null;
  };

  const syntheticHoliday = getHolidayFromList(targetDateStr);
  const cachedData = useCacheStore(state => state.today);
  const setCache = useCacheStore(state => state.setCache);
  
  const dayCache = cachedData?.[targetDateStr];

  const [agenda, setAgenda] = useState<AgendaItem[]>(dayCache?.agenda || []);
  const [todayStatus, setTodayStatus] = useState<any>(dayCache?.todayStatus || null);
  const activeEvent = syntheticHoliday || todayStatus?.activeEvent;
  const [activeSemester, setActiveSemester] = useState<any>(dayCache?.activeSemester || null);
  const [onboardingStatus, setOnboardingStatus] = useState<any>(dayCache?.onboarding || null);
  const [isLoading, setIsLoading] = useState(!dayCache);
  const [isCreateSemesterOpen, setIsCreateSemesterOpen] = useState(false);

  // Extra Lecture Modal State
  const [isAddExtraModalOpen, setIsAddExtraModalOpen] = useState(false);
  const [subjectsForExtra, setSubjectsForExtra] = useState<any[]>([]);
  const [isAddingExtra, setIsAddingExtra] = useState(false);

  // Remark Modal / Prompt State
  const [selectedRemarkItem, setSelectedRemarkItem] = useState<{ item: AgendaItem; status: string } | null>(null);
  const [remarkInput, setRemarkInput] = useState("");

  const [isMarkingFullDayOff, setIsMarkingFullDayOff] = useState(false);

  // Overlay state
  const [lastGreetedDate, setLastGreetedDate] = useState<string | null>(null);
  const [showGreetingOverlay, setShowGreetingOverlay] = useState(false);


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
  const handleMarkFullDayOff = async () => {
    if (agenda.length === 0) return;
    try {
      setIsMarkingFullDayOff(true);

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
          s.percentage = s.total > 0 ? Number(((s.attended / s.total) * 100).toFixed(1)) : 0;
          subjects[subjectIndex] = s;
        }
      });
      const totalAttended = subjects.reduce((sum, sub) => sum + sub.attended, 0);
      const totalClasses = subjects.reduce((sum, sub) => sum + sub.total, 0);
      const overallPercentage = totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 0;
      useAttendanceStore.setState({ subjects, totalAttended, totalClasses, overallPercentage });
      // ---------------------------------

      // Optimistically mark all agenda items as "off"
      setAgenda(prev => prev.map(a => ({ ...a, status: "off" as any })));

      // Trigger full day off celebration popup animation!
      const { animType, animMsg } = getHolidayAnimation(activeEvent);
      triggerAttendancePopup(animType, animMsg);

      // Save all to backend
      await Promise.all(
        agenda.filter(item => item.subject?.id).map(item =>
          api.post("/attendance/mark", {
            subjectId: item.subject!.id,
            date: targetDateStr,
            status: "off",
            timetableSlotId: item.type === "slot" ? item.id : undefined,
            overrideId: item.type === "override" ? item.id : undefined,
          })
        )
      );

      fetchData();
      fetchStats();
      useCacheStore.getState().setCache('insights', null);
      window.dispatchEvent(new Event("attendance-updated"));
    } catch (error) {
      console.error("Failed to mark full day off:", error);
      fetchData();
    } finally {
      setIsMarkingFullDayOff(false);
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
    try {
      setIsAddingExtra(true);
      await api.post("/timetable/extra-class", {
        semesterId: activeSemester?.id,
        subjectId,
        date: targetDateStr,
        startTime: "00:00",
        endTime: "00:00",
        reason: "Extra Lecture"
      });
      setIsAddExtraModalOpen(false);
      fetchData();
      fetchStats();
      window.dispatchEvent(new Event("attendance-updated"));
    } catch (err) {
      console.error("Failed to add extra lecture:", err);
    } finally {
      setIsAddingExtra(false);
    }
  };

  const handleDeleteExtraClass = async (overrideId: string) => {
    toast("Delete Extra Class", {
      description: "Are you sure you want to delete this extra class?",
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            await api.delete(`/timetable/extra-class/${overrideId}`);
            fetchData();
            fetchStats();
            window.dispatchEvent(new Event("attendance-updated"));
            toast.success("Extra class deleted");
          } catch (err) {
            toast.error("Failed to delete extra class");
            console.error("Failed to delete extra class:", err);
          }
        }
      },
      cancel: { label: "Cancel", onClick: () => {} }
    });
  };

  const fetchData = async () => {
    try {
      if (!cachedData) setIsLoading(true);
      // Fetch active semester first
      const semRes = await api.get("/semesters/active");
      
      let statusPromise = Promise.resolve({ data: null });
      if (semRes.data) {
        setActiveSemester(semRes.data);
        const semesterId = semRes.data.id;
        statusPromise = api.get(`/events/today-status?semesterId=${semesterId}&date=${targetDateStr}`);
      } else {
        setActiveSemester(null);
      }

      // Fetch today status and attendance in parallel
      const [statusRes, res, onboardRes] = await Promise.allSettled([
        statusPromise,
        api.get(`/attendance/today?date=${targetDateStr}`),
        api.get("/users/onboarding-status")
      ]);

      if (res.status === 'rejected') throw res.reason;

      let nextTodayStatus = null;
      let nextAgenda: AgendaItem[] = [];
      let nextOnboarding = null;

      if (statusRes.status === 'fulfilled') {
        nextTodayStatus = statusRes.value.data;
        setTodayStatus(nextTodayStatus);
      }
      
      if (res.status === 'fulfilled') {
        nextAgenda = Array.isArray(res.value.data) ? res.value.data : [];
        setAgenda(nextAgenda);
      } else {
        setAgenda([]);
      }

      if (onboardRes.status === 'fulfilled') {
        nextOnboarding = onboardRes.value.data;
        setOnboardingStatus(nextOnboarding);
      }

      setCache('today', { 
        ...useCacheStore.getState().today,
        [targetDateStr]: {
          agenda: nextAgenda, 
          todayStatus: nextTodayStatus, 
          activeSemester: semRes.data || null,
          onboarding: nextOnboarding
        }
      });

    } catch (error) {
      console.error("Failed to fetch today data:", error);
      
      const todayCache = useCacheStore.getState().today?.[targetDateStr];
      const isToday = targetDateStr === format(new Date(), "yyyy-MM-dd");
      
      // Attempt to load active semester from global cache if not in today cache
      const semesterCache = useCacheStore.getState().semester;
      setActiveSemester(todayCache?.activeSemester || semesterCache?.active || null);

      if (todayCache && todayCache.agenda && todayCache.agenda.length > 0) {
        setAgenda(todayCache.agenda);
        setTodayStatus(todayCache.todayStatus || null);
      } else {
        // Construct agenda by merging timetable slots with attendance logs for the day
        const subjectsCache = useCacheStore.getState().subject_logs || {};
        const allLogs = subjectsCache["all"]?.logs || [];
        const logsForDay = allLogs.filter((l: any) => l.date && l.date.startsWith(targetDateStr));

        const timetableCache = useCacheStore.getState().timetable;
        const dateObj = new Date(targetDateStr);
        const jsDay = dateObj.getDay();
        const ttDay = jsDay === 0 ? 6 : jsDay - 1;

        let pseudoAgenda: AgendaItem[] = [];

        if (timetableCache && timetableCache.slots) {
          // Merge active and archived slots
          const archivedVersions = timetableCache.archivedSlots || [];
          const archivedSlotsArray = archivedVersions.flatMap((v: any) => v.slots || []);
          const allSlots = [...timetableCache.slots, ...archivedSlotsArray];

          // Filter slots active on this historical date
          const slotsForDay = allSlots.filter((s: any) => {
            if (s.dayOfWeek !== ttDay) return false;
            if (!s.validFrom) return true;
            const validFrom = new Date(s.validFrom);
            validFrom.setHours(0,0,0,0);
            const validUntil = s.validUntil ? new Date(s.validUntil) : new Date("2099-01-01");
            validUntil.setHours(23,59,59,999);
            const target = new Date(targetDateStr);
            target.setHours(12,0,0,0);
            return target >= validFrom && target <= validUntil;
          });

          // Deduplicate by startTime and subjectId
          const uniqueSlotsMap = new Map();
          slotsForDay.forEach((s: any) => {
            const key = `${s.startTime}-${s.subjectId}`;
            if (!uniqueSlotsMap.has(key)) uniqueSlotsMap.set(key, s);
          });
          const deduplicatedSlotsForDay = Array.from(uniqueSlotsMap.values());

          pseudoAgenda = deduplicatedSlotsForDay.map((slot: any) => {
            const subjectsOverview = useCacheStore.getState().subjects_overview || [];
            const subject = subjectsOverview.find((sub: any) => sub.id === slot.subjectId) || { id: slot.subjectId, name: "Unknown" };
            
            // Find if there is a log for this specific timetable slot
            const logMatch = logsForDay.find((l: any) => l.timetableSlotId === slot.id || (l.subjectId === slot.subjectId && l.startTime === slot.startTime));
            
            return {
              id: slot.id,
              type: "slot",
              subject,
              startTime: slot.startTime,
              endTime: slot.endTime,
              room: slot.room || undefined,
              slotType: slot.type || "Lecture",
              status: logMatch && logMatch.status !== "not_marked" ? logMatch.status : null,
              remarks: logMatch ? logMatch.remarks : undefined,
              attendanceId: logMatch && logMatch.status !== "not_marked" ? logMatch.id : null
            };
          });
        }

        // Add any logs that didn't match a timetable slot (Extra classes, overrides)
        logsForDay.forEach((l: any) => {
          const exists = pseudoAgenda.some(item => item.id === l.timetableSlotId || (item.subject.id === l.subjectId && item.startTime === l.startTime));
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

        if (pseudoAgenda.length > 0) {
          pseudoAgenda.sort((a,b) => a.startTime.localeCompare(b.startTime));
          setAgenda(pseudoAgenda);
          setTodayStatus(null);
        } else {
          setAgenda([]);
          setTodayStatus(null);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Scroll to top when date changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [targetDateStr]);

  useEffect(() => {
    const cachedDay = useCacheStore.getState().today?.[targetDateStr];
    if (cachedDay) {
      setAgenda(cachedDay.agenda || []);
      setTodayStatus(cachedDay.todayStatus || null);
      setActiveSemester(cachedDay.activeSemester || null);
      setOnboardingStatus(cachedDay.onboarding || null);
    } else {
      setAgenda([]);
      setTodayStatus(null);
      setIsLoading(true);
    }
    fetchData();

    const handleUpdate = () => {
      fetchData();
      fetchStats();
    };
    window.addEventListener("attendance-updated", handleUpdate);
    return () => window.removeEventListener("attendance-updated", handleUpdate);
  }, [targetDateStr]);

  // Greeting overlay effect
  useEffect(() => {
    if (!isLoading) {
      const shouldShowOverlay = activeEvent && ["holiday", "restricted_holiday", "vacation", "fest", "institute", "lab_exam", "midsem", "endsem", "ct", "exam"].includes(activeEvent.eventType || "");
      if (isBirthday || shouldShowOverlay) {
        if (lastGreetedDate !== targetDateStr) {
          setShowGreetingOverlay(true);
          setLastGreetedDate(targetDateStr);
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
    const updatedAgenda = agenda.map(a => 
      a.id === item.id ? { ...a, status: status as any, remarks: remarks || a.remarks } : a
    );
    setAgenda(updatedAgenda);

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


    // Trigger Popup Animation
    if (status === "absent") {
      triggerAttendancePopup("crying", "Attendance Dropped! 😭");
    } else if (status === "present" || status === "medical" || status === "od") {
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
      const allOthersOff = updatedAgenda.every(a => a.status === "off" || a.status === "cancelled");
      if (allOthersOff && updatedAgenda.length > 0) {
        const { animType, animMsg } = getHolidayAnimation(activeEvent);
        triggerAttendancePopup(animType, animMsg);
      } else {
        triggerAttendancePopup("off_class", "Yay! Off class today! 🎈🛌");
      }
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

      setAgenda(prev => prev.map(a => 
        a.id === item.id 
          ? { ...a, attendanceId: status === "clear" ? null : res.data.id } 
          : a
      ));

      // Update global offline caches optimistically
      const state = useCacheStore.getState();
      
      // 1. Update Today Cache
      state.setCache('today', { 
        ...state.today,
        [targetDateStr]: {
          ...state.today?.[targetDateStr],
          agenda: updatedAgenda, 
          todayStatus 
        }
      });
      
      // 2. Update Calendar Cache
      const monthStr = targetDateStr.substring(0, 7);
      const calCache = state.calendar?.[monthStr] || { details: {}, days: [], events: [], insights: [], isComplete: false };
      
      const details = calCache.details[targetDateStr] || [];
      const existingIdx = details.findIndex((d: any) => d.subjectName === item.subject?.name);
      
      if (status === "clear") {
         if (existingIdx >= 0) details.splice(existingIdx, 1);
      } else {
         if (existingIdx >= 0) {
           details[existingIdx].status = status;
           details[existingIdx].remarks = remarks;
         } else {
           details.push({
             id: item.attendanceId || `optimistic-${Date.now()}`,
             subjectName: item.subject?.name,
             status,
             remarks
           });
         }
      }
      
      state.setCache('calendar', {
        ...state.calendar,
        [monthStr]: {
          ...calCache,
          details: {
            ...calCache.details,
            [targetDateStr]: details
          }
        }
      });
      
      // 3. Update Subject Logs Cache
      const updateSubjectLog = (cacheKey: string) => {
         const subjCache = state.subject_logs?.[cacheKey];
         if (subjCache && subjCache.logs) {
           const logIdx = subjCache.logs.findIndex((l: any) => l.date === targetDateStr && l.subjectId === item.subject?.id);
           if (status === "clear") {
             if (logIdx >= 0) subjCache.logs.splice(logIdx, 1);
           } else {
             if (logIdx >= 0) {
               subjCache.logs[logIdx].status = status;
               subjCache.logs[logIdx].remarks = remarks;
             } else {
               subjCache.logs.unshift({
                 id: item.attendanceId || `optimistic-${Date.now()}`,
                 subjectId: item.subject?.id,
                 subjectName: item.subject?.name,
                 subjectColorHex: item.subject?.colorHex,
                 date: targetDateStr,
                 dateFormatted: new Date(targetDateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                 status,
                 remarks,
                 time: item.startTime
               });
             }
           }
           state.setCache('subject_logs', { ...state.subject_logs, [cacheKey]: subjCache });
         }
      };
      
      updateSubjectLog('all');
      if (item.subject?.id) updateSubjectLog(item.subject.id);

      fetchStats();
      window.dispatchEvent(new Event("attendance-updated"));
    } catch (error) {
      console.error("Failed to mark attendance offline or error:", error);
      // Offline fallback relies on the global optimistic update we just fired above);
      window.dispatchEvent(new Event("attendance-updated"));
    }
  };

  const handleStatusClick = (item: AgendaItem, status: string) => {
    // If clicking the currently active status, unmark it (void)
    if (item.status === status) {
      markAttendance(item, "clear");
      return;
    }

    if (status === "absent") {
      setSelectedRemarkItem({ item, status });
      setRemarkInput(item.remarks || "");
    } else {
      markAttendance(item, status);
    }
  };

  const handleSaveRemark = () => {
    if (!selectedRemarkItem) return;
    markAttendance(selectedRemarkItem.item, selectedRemarkItem.status, remarkInput.trim() || undefined);
    setSelectedRemarkItem(null);
    setRemarkInput("");
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
        onMarkOff={handleMarkFullDayOff}
        onClose={() => setShowGreetingOverlay(false)}
      />
      
      {todayStatus?.nextEvent && !activeEvent && (
        <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200/60 dark:border-sky-800/40 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <Timer className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <span className="text-sm font-medium text-sky-800 dark:text-sky-200">Upcoming: <span className="font-bold text-sky-900 dark:text-sky-100">{todayStatus.nextEvent.title}</span></span>
          </div>
          <span className="text-xs font-bold bg-sky-100/80 dark:bg-sky-800/40 text-sky-800 dark:text-sky-300 px-3 py-1 rounded-full uppercase tracking-wider">
            {new Date(todayStatus.nextEvent.date.split('T')[0] + "T00:00:00").toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      )}

      {/* Overall Attendance & Forecast Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className={`rounded-2xl border p-4 flex items-center justify-between gap-4 transition-colors ${
          overallPercentage >= targetPercentage
            ? "bg-emerald-500/10 border-emerald-500/20"
            : "bg-rose-500/10 border-rose-500/20"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              overallPercentage >= targetPercentage ? "bg-emerald-500/20" : "bg-rose-500/20"
            }`}>
              {overallPercentage >= targetPercentage
                ? <TrendingUp className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                : <TrendingDown className="w-5 h-5 text-rose-500 dark:text-rose-400" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Overall Attendance</p>
              <p className={`text-xs mt-0.5 font-medium ${
                overallPercentage >= targetPercentage ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              }`}>
                {overallPercentage >= targetPercentage
                  ? `${((overallPercentage ?? 0) - targetPercentage).toFixed(1)}% above target (${targetPercentage}%)`
                  : `${(targetPercentage - (overallPercentage ?? 0)).toFixed(1)}% below target (${targetPercentage}%)`}
              </p>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-mono font-bold text-sm ${
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
          className="relative overflow-hidden rounded-[16px] border border-[#74313A]/20 dark:border-[#EED3CF]/20 bg-[#EED3CF] dark:bg-[#74313A] p-5 flex items-center justify-between gap-3 cursor-pointer group shadow-sm transition-transform hover:scale-[1.01]"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {/* Frovia Ambient Animated Gradients */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-black/20 dark:to-transparent z-0 pointer-events-none" />
          
          {/* Frovia Berry Animation Container */}
          <div className="absolute -right-4 -top-6 w-32 h-32 opacity-20 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-0">
            <div className="absolute inset-0 flex items-center justify-center animate-spin-slow" style={{ animationDuration: '15s' }}>
              <div className="w-8 h-8 bg-[#e11d48] rounded-full absolute top-4 left-4 shadow-xl flex flex-col items-center justify-start pt-0.5">
                <div className="w-2.5 h-1 bg-green-500 rounded-full" />
              </div>
              <div className="w-6 h-6 bg-[#be123c] rounded-full absolute bottom-4 right-8 shadow-xl flex flex-col items-center justify-start pt-0.5">
                <div className="w-2 h-1 bg-green-500 rounded-full" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 min-w-0 relative z-10">
            <div className="w-12 h-12 rounded-[12px] bg-[#74313A] dark:bg-[#EED3CF] text-[#EED3CF] dark:text-[#74313A] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-all shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-base font-medium text-[#111827] dark:text-white truncate tracking-tight">Forecast Engine</p>
              </div>
              <p className="text-[13px] text-[#4B5563] dark:text-white/70 truncate transition-colors">
                Calculate consecutive classes needed for {targetPercentage}% target
              </p>
            </div>
          </div>
          <div className="p-2 rounded-full bg-[#7E2430]/10 dark:bg-black/20 text-[#74313A] dark:text-[#EED3CF] group-hover:bg-[#74313A] dark:group-hover:bg-[#EED3CF] group-hover:text-white dark:group-hover:text-[#74313A] transition-colors shrink-0 relative z-10">
            <ChevronRight className="w-4 h-4" />
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
                  const prev = new Date(targetDateStr);
                  prev.setDate(prev.getDate() - 1);
                  const dateStr = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}-${String(prev.getDate()).padStart(2,'0')}`;
                  navigate(`/today?date=${dateStr}`);
                }}
                className="p-1 hover:bg-muted rounded-lg text-muted-foreground transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <p className="text-sm font-semibold text-muted-foreground min-w-[140px]">
                {new Date(targetDateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              
              <button 
                onClick={() => {
                  const next = new Date(targetDateStr);
                  next.setDate(next.getDate() + 1);
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
              <BookOpen size={14} /> View Assignments
            </button>
            {activeSemester && (
              <button
                onClick={openAddExtraModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 hover:bg-yellow-500/20 transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Extra
              </button>
            )}
            {activeSemester && agenda.length > 0 && (
              <button
                onClick={handleMarkFullDayOff}
                disabled={isMarkingFullDayOff}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                title="Mark all today's classes as Off"
              >
                <Palmtree className="w-4 h-4" />
                {isMarkingFullDayOff ? "Marking..." : "Full Day Off"}
              </button>
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
            📌 Event highlighted for today. Use <span className="font-bold text-foreground">Mark Full Day Off</span> if classes are suspended.
          </div>
        </div>
      )}

      {onboardingStatus && (!onboardingStatus.hasSemester || !onboardingStatus.hasSubjects || !onboardingStatus.hasTimetable || !onboardingStatus.hasCalendar || !onboardingStatus.hasAttendance) && (
        <div className="flex flex-col items-center justify-center py-6">
          <OnboardingChecklist 
            title="Getting Started"
            steps={[
              { id: 1, title: "Create an active semester", isCompleted: onboardingStatus.hasSemester, onClick: () => !onboardingStatus.hasSemester ? setIsCreateSemesterOpen(true) : navigate("/settings") },
              { id: 2, title: "Add subjects and set targets", isCompleted: onboardingStatus.hasSubjects, onClick: () => navigate("/subjects") },
              { id: 3, title: "Set up weekly timetable", isCompleted: onboardingStatus.hasTimetable, onClick: () => navigate("/timetable") },
              { id: 4, title: "Sync your academic calendar", isCompleted: onboardingStatus.hasCalendar, onClick: () => navigate("/calendar") },
              { id: 5, title: "Log your first attendance", isCompleted: onboardingStatus.hasAttendance, onClick: () => navigate("/today") }
            ]} 
          />
          {!onboardingStatus.hasSemester && (
            <button
              onClick={() => setIsCreateSemesterOpen(true)}
              className="mt-6 inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-md shadow-primary/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Semester Now</span>
            </button>
          )}
        </div>
      )}

      {isLoading && !dayCache ? (
        <div className="space-y-4 animate-pulse">
           {[1, 2, 3].map(i => (
             <div key={i} className="h-28 bg-[var(--ts-surface)] rounded-xl border border-[var(--ts-border)] w-full"></div>
           ))}
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
          {agenda.map(item => (
            <div 
              key={item.id} 
              className={`p-4 md:p-5 rounded-2xl border transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                item.status 
                  ? "bg-card/40 border-border/50 opacity-80 backdrop-blur-sm" 
                  : "bg-card/60 border-border/50 shadow-[0_0_15px_rgba(0,0,0,0.1)] backdrop-blur-md hover:bg-card/80 hover:border-border/80"
              }`}
            >
              <div className="flex items-center gap-4 min-w-0 flex-1">
                
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 flex-wrap">
                    <span className="truncate">{item.subject?.name || "Unknown Subject"}</span>
                    {(item.isExtra || item.type === "override" || item.slotType === "Extra") && (
                      <span className="bg-amber-500/20 text-amber-500 border border-amber-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm shrink-0">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        Extra
                      </span>
                    )}
                    {item.remarks && (
                      <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                        <MessageSquare className="w-3 h-3 text-primary" />
                        {item.remarks}
                      </span>
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
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
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
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
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
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    item.status === "off"
                      ? "bg-amber-500 text-white font-bold shadow-md shadow-amber-500/20"
                      : "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 hover:text-amber-600"
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  Off
                </button>
                {/* Delete Extra Class Button */}
                {(item.type === "override" && item.isExtra) && (
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
          ))}
        </div>
      )}

      {/* Contextual Remark Modal */}
      {selectedRemarkItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/40 dark:bg-black/60 backdrop-blur-sm">
          <div className="bg-card/90 backdrop-blur-xl border border-border/50 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Log Contextual Remark
            </h3>
            <p className="text-xs text-muted-foreground">
              Logging status <span className="font-bold uppercase text-primary">{selectedRemarkItem.status}</span> for <span className="font-semibold text-foreground">{selectedRemarkItem.item.subject?.name || "Unknown Subject"}</span>. Add an optional remark (e.g., "Medical Leave", "OD for Techfest").
            </p>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Remark / Reason</label>
              <input
                type="text"
                
                value={remarkInput}
                onChange={(e) => setRemarkInput(e.target.value)}
                className="w-full px-3 py-2 bg-foreground/5 border border-foreground/10 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <div className="flex flex-wrap gap-1.5 mt-2 max-h-32 overflow-y-auto pr-1">
                {[
                  "Medical", "Fever", "College OD", "Personal", "Event",
                  "Sports", "Placement", "Hackathon", "Transport Issue",
                  "Family Emergency", "Sick Leave", "Club Activity",
                  "Overslept", "Exam Prep", "Project Work", "Meeting",
                  "Out of Station", "Doctor Appt.", "Techfest", "Rain/Weather"
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setRemarkInput(tag)}
                    className="px-2.5 py-1 rounded-lg text-xs bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary transition-colors font-semibold cursor-pointer whitespace-nowrap"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedRemarkItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRemark}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
              >
                Save Attendance Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Extra Lecture Modal */}
      {isAddExtraModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-card border border-border/80 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-extrabold text-foreground tracking-tight">
                Add extra lecture
              </h3>
              <button
                onClick={() => setIsAddExtraModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1 no-scrollbar">
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
                    className="w-full text-left p-4 rounded-2xl bg-muted/30 hover:bg-muted/70 border border-border/40 hover:border-primary/40 transition-all font-semibold text-foreground text-sm flex items-center justify-between group cursor-pointer"
                  >
                    <span>{sub.name}</span>
                    <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <CreateSemesterModal
        isOpen={isCreateSemesterOpen}
        onClose={() => setIsCreateSemesterOpen(false)}
        onSuccess={fetchData}
      />
    </div>
    </div>
  );
};


