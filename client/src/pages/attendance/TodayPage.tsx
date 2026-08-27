import React, { useState, useEffect } from "react";
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
import { HOLIDAY_ASSETS } from "../../components/common/AttendanceAnimationPopup";
import { HolidayIconRenderer } from "../../components/common/HolidayIconRenderer";
import { HolidayGreetingOverlay } from "../../components/common/HolidayGreetingOverlay";
import { format } from "date-fns";
import { FIXED_HOLIDAYS, RESTRICTED_HOLIDAYS } from "../semester/HolidayListTab";


interface AgendaItem {
  id: string;
  type: "slot" | "override";
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

  const [agenda, setAgenda] = useState<AgendaItem[]>(cachedData?.agenda || []);
  const [todayStatus, setTodayStatus] = useState<any>(cachedData?.todayStatus || null);
  const activeEvent = syntheticHoliday || todayStatus?.activeEvent;
  const [activeSemester, setActiveSemester] = useState<any>(cachedData?.activeSemester || null);
  const [isLoading, setIsLoading] = useState(!cachedData);
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
      }
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

      fetchStats();
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
      setSubjectsForExtra(res.data || []);
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
      const [statusRes, res] = await Promise.allSettled([
        statusPromise,
        api.get(`/attendance/today?date=${targetDateStr}`)
      ]);

      let nextTodayStatus = null;
      let nextAgenda: AgendaItem[] = [];

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

      setCache('today', { 
        agenda: nextAgenda, 
        todayStatus: nextTodayStatus, 
        activeSemester: semRes.data || null 
      });

    } catch (error) {
      console.error("Failed to fetch today data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
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
      const isHolidayEvent = activeEvent && ["holiday", "restricted_holiday"].includes(activeEvent.eventType || "");
      if (isBirthday || isHolidayEvent) {
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
        triggerAttendancePopup("thumbs_up", "Awesome! Marked Present 👍");
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
      await api.post("/attendance/mark", {
        subjectId: item.subject.id,
        date: targetDateStr,
        status,
        remarks,
        timetableSlotId: item.type === "slot" ? item.id : undefined,
        overrideId: item.type === "override" ? item.id : undefined,
        attendanceId: item.attendanceId,
      });
      fetchStats();
      window.dispatchEvent(new Event("attendance-updated"));
    } catch (error) {
      console.error("Failed to mark attendance:", error);
      fetchData();
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

  if (isLoading || !agenda) {
    return <PageSkeleton type="today" />;
  }

  // Determine if we should show the holiday/exam state instead of classes
  const isGlobalEventActive = activeEvent && ["holiday", "restricted_holiday", "vacation", "fest", "midsem", "endsem", "institute"].includes(activeEvent.eventType);

  const getEventStateConfig = (type: string) => {
    switch(type) {
      case "midsem":
      case "endsem":
        return { icon: <BookOpen className="w-16 h-16 text-rose-500 mb-4 mx-auto" />, color: "border-rose-500/20 bg-rose-500/5", title: "Exam Mode", msg: "Focus on your exams. No regular classes today." };
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
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto w-full pb-24 md:pb-8">
      
      <HolidayGreetingOverlay
        isOpen={showGreetingOverlay}
        holidayName={isBirthday ? `Happy Birthday, ${user?.name?.split(' ')[0]}!` : (activeEvent?.title || "Holiday")}
        holidayAssetSrc={isBirthday ? "/lottie/happy-birthday.json" : (activeEvent ? HOLIDAY_ASSETS[getHolidayAnimation(activeEvent).animType as AnimationType] : undefined)}
        hasClasses={agenda.some(item => !item.status)}
        onMarkOff={handleMarkFullDayOff}
        onClose={() => setShowGreetingOverlay(false)}
      />
      
      {todayStatus?.nextEvent && !activeEvent && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Timer className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-foreground">Upcoming: <span className="font-bold">{todayStatus.nextEvent.title}</span></span>
          </div>
          <span className="text-xs font-bold bg-primary/20 text-primary px-3 py-1 rounded-full uppercase tracking-wider">
            {new Date(todayStatus.nextEvent.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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

        {/* Forecast AI Quick Access Card */}
        <div 
          onClick={() => navigate("/predictive")}
          className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-card to-card p-4 flex items-center justify-between gap-3 cursor-pointer hover:border-primary/60 transition-all group shadow-sm"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-foreground truncate">Forecast Engine</p>
                <span className="text-[10px] font-extrabold text-primary bg-primary/20 px-1.5 py-0.2 rounded uppercase">Forecast</span>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                Calculate consecutive classes needed for {targetPercentage}% target
              </p>
            </div>
          </div>
          <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all shrink-0">
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              const prev = new Date(targetDateStr);
              prev.setDate(prev.getDate() - 1);
              const dateStr = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}-${String(prev.getDate()).padStart(2,'0')}`;
              navigate(`/today?date=${dateStr}`);
            }}
            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div>
            {isBirthday && (
              <div className="mb-4 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-4">
                <div className="text-3xl">🎂</div>
                <div>
                  <h3 className="font-bold text-amber-500">Happy Birthday, {user?.name?.split(' ')[0]}!</h3>
                  <p className="text-sm text-foreground/80">Hope you have a fantastic day today!</p>
                </div>
              </div>
            )}
            <h1 className="text-2xl font-bold text-foreground">{dateParam ? "Classes on" : "Today's Schedule"}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date(targetDateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <button 
            onClick={() => {
              const next = new Date(targetDateStr);
              next.setDate(next.getDate() + 1);
              const dateStr = `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`;
              navigate(`/today?date=${dateStr}`);
            }}
            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground transition-colors cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {activeSemester && agenda.length > 0 && (
            <button
              onClick={handleMarkFullDayOff}
              disabled={isMarkingFullDayOff}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              title="Mark all today's classes as Off"
            >
              <Palmtree className="w-4 h-4 text-amber-500" />
              <span>
                {isMarkingFullDayOff 
                  ? "Marking..." 
                  : activeEvent 
                    ? `Mark full day off for ${activeEvent.title}`
                    : "Mark Full Day Off"
                }
              </span>
            </button>
          )}
          {activeSemester && (
            <button
              onClick={openAddExtraModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md shadow-primary/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Extra Lecture</span>
            </button>
          )}
          <div className="text-right ml-2">
            <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending</p>
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
            <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center text-xl shadow-xs shrink-0 overflow-hidden">
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
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-card border border-border text-foreground">
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

      {!activeSemester ? (
        <div className="flex flex-col items-center justify-center py-6">
          <OnboardingChecklist 
            title="Getting Started"
            steps={[
              { id: 1, title: "Create an active semester", isCompleted: !!activeSemester },
              { id: 2, title: "Add subjects and set targets", isCompleted: false },
              { id: 3, title: "Set up weekly timetable", isCompleted: false },
              { id: 4, title: "Sync your academic calendar", isCompleted: false },
              { id: 5, title: "Log your first attendance", isCompleted: false }
            ]} 
          />
          <button
            onClick={() => setIsCreateSemesterOpen(true)}
            className="mt-6 inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-md shadow-primary/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Semester Now</span>
          </button>
        </div>
      ) : agenda.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-2xl shadow-sm">
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
                  ? "bg-card/60 border-border/60 opacity-90" 
                  : "bg-card border-border shadow-sm hover:shadow-md"
              }`}
            >
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div 
                  className="w-1.5 h-14 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: item.subject?.colorHex || "#6366f1" }} 
                />
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
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    item.status === "present"
                      ? "bg-emerald-500 text-white font-bold shadow-md shadow-emerald-500/20"
                      : "bg-muted text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
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
                      : "bg-muted text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
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
                      : "bg-muted text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
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
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {["Medical", "Event", "Fever", "College OD", "Personal"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setRemarkInput(tag)}
                    className="px-2.5 py-1 rounded-lg text-xs bg-muted hover:bg-primary/20 hover:text-primary transition-colors text-muted-foreground font-medium cursor-pointer"
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
  );
};
