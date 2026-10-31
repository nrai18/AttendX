import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Loader2, 
  Users, 
  Plus, 
  Hash, 
  LogIn, 
  Copy, 
  Check, 
  CalendarDays, 
  Megaphone, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight,
  ArrowLeft,
  BookOpen,
  GraduationCap,
  Layers,
  X,
  Trash2,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { SoundFX } from "../../utils/soundEffects";
import { hapticMedium, hapticLight, hapticSuccess, hapticHeavy, hapticSelection } from "../../utils/haptics";
import { triggerDynamicHUD } from "../../components/ui/dynamic-island-hud";
import { ClassroomRosterModal } from "../../components/classroom/ClassroomRosterModal";
import { getClassroomBannerTheme } from "../../components/classroom/ClassroomBanner";
import { useBackHandlerStore } from "../../stores/backHandlerStore";

interface Classroom {
  id: string;
  name: string;
  section?: string;
  department?: string;
  batch?: string;
  joinCode: string;
  userRole: "admin" | "member";
  _count: { members: number };
  createdBy: { name: string; email?: string };
  isDeleted?: boolean;
}

export const ClassroomsPage = () => {
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals state
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [inlineJoinCode, setInlineJoinCode] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteConfirmClassroom, setDeleteConfirmClassroom] = useState<Classroom | null>(null);
  const [selectedRosterClassroom, setSelectedRosterClassroom] = useState<Classroom | null>(null);
  
  // Form fields for creation
  const [newClassName, setNewClassName] = useState("");
  const [newSection, setNewSection] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [newBatch, setNewBatch] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [whooshingHubIds, setWhooshingHubIds] = useState<string[]>([]);
  const [newlyCreatedHubId, setNewlyCreatedHubId] = useState<string | null>(null);

  const fetchClassrooms = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/classrooms");
      setClassrooms(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Failed to fetch classrooms:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClassrooms();
  }, []);

  // Hardware back button support for open modals
  useEffect(() => {
    const unregister = useBackHandlerStore.getState().register(() => {
      if (selectedRosterClassroom) {
        setSelectedRosterClassroom(null);
        return true;
      }
      if (deleteConfirmClassroom) {
        setDeleteConfirmClassroom(null);
        return true;
      }
      if (showJoinModal) {
        setShowJoinModal(false);
        return true;
      }
      if (showCreateModal) {
        setShowCreateModal(false);
        return true;
      }
      return false;
    });
    return unregister;
  }, [selectedRosterClassroom, deleteConfirmClassroom, showJoinModal, showCreateModal]);

  const handleCopyCode = (code: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    hapticSuccess();
    toast.success(`Join code ${code} copied to clipboard`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleJoin = async (e: React.FormEvent, codeToUse?: string) => {
    e.preventDefault();
    const targetCode = (codeToUse || joinCodeInput || inlineJoinCode).trim().toUpperCase();
    if (!targetCode) {
      toast.error("Please enter a 6-character join code");
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await api.post("/classrooms/join", { joinCode: targetCode });
      SoundFX.playWhooshSound(0.26);
      hapticSuccess();
      triggerDynamicHUD({
        type: "success",
        label: "Classroom Hub Joined!",
        subtitle: `${res.data?.name || targetCode} synced to your agenda`,
        durationMs: 4400,
      });
      setShowJoinModal(false);
      setJoinCodeInput("");
      setInlineJoinCode("");
      if (res.data?.id) {
        setNewlyCreatedHubId(res.data.id);
      }
      try {
        localStorage.setItem("onboarding_classroom", "true");
        window.dispatchEvent(new CustomEvent("onboarding-step-completed", { detail: { step: "classroom" } }));
      } catch (_) {}
      fetchClassrooms();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to join classroom");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) {
      toast.error("Classroom name is required");
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await api.post("/classrooms/create", { 
        name: newClassName.trim(),
        section: newSection.trim() || undefined,
        department: newDepartment.trim() || undefined,
        batch: newBatch.trim() || undefined,
      });
      SoundFX.playWhooshSound(0.28);
      hapticSuccess();
      triggerDynamicHUD({
        type: "hub",
        label: "Classroom Hub Created!",
        subtitle: `${newClassName} • Share code ${res.data?.joinCode || ""} with peers`,
        durationMs: 4600,
      });
      setShowCreateModal(false);
      if (res.data?.id) {
        setNewlyCreatedHubId(res.data.id);
      }
      setNewClassName("");
      setNewSection("");
      setNewDepartment("");
      setNewBatch("");
      try {
        localStorage.setItem("onboarding_classroom", "true");
        window.dispatchEvent(new CustomEvent("onboarding-step-completed", { detail: { step: "classroom" } }));
      } catch (_) {}
      fetchClassrooms();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create classroom");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClassroom = async (classroomId: string) => {
    try {
      const targetClassroom = classrooms.find(c => c.id === classroomId) || deleteConfirmClassroom;
      const targetName = targetClassroom?.name || "Classroom Hub";

      // 1. Instant aerodynamic whoosh flight & haptics
      SoundFX.playWhooshSound(0.32);
      hapticHeavy();

      // 2. Whoosh trajectory on the card
      setWhooshingHubIds(prev => [...prev, classroomId]);
      setDeleteConfirmClassroom(null);

      // 3. Dynamic Island HUD notification as card whooshes off
      setTimeout(() => {
        triggerDynamicHUD({
          type: "trash",
          label: "Classroom Hub Disbanded",
          subtitle: `${targetName} • Enrolled peers alerted via push`,
          durationMs: 4500,
        });
      }, 180);

      // 4. Commit deletion after flight completes
      setTimeout(async () => {
        try {
          setIsSubmitting(true);
          await api.delete(`/classrooms/${classroomId}`);
          fetchClassrooms();
        } catch (error: any) {
          toast.error(error.response?.data?.message || "Failed to disband classroom");
          setWhooshingHubIds(prev => prev.filter(id => id !== classroomId));
        } finally {
          setIsSubmitting(false);
        }
      }, 420);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to disband classroom");
    }
  };

  const handleLeaveClassroom = async (classroomId: string) => {
    try {
      const targetClassroom = classrooms.find(c => c.id === classroomId);
      const targetName = targetClassroom?.name || "Section Hub";

      // 1. Instant aerodynamic whoosh flight & haptics
      SoundFX.playWhooshSound(0.28);
      hapticMedium();

      // 2. Whoosh trajectory on the card
      setWhooshingHubIds(prev => [...prev, classroomId]);

      // 3. Dynamic Island HUD notification
      setTimeout(() => {
        triggerDynamicHUD({
          type: "trash",
          label: "Classroom Hub Removed",
          subtitle: `${targetName} cleared from your dashboard`,
          durationMs: 4000,
        });
      }, 180);

      // 4. Commit removal after flight completes
      setTimeout(async () => {
        try {
          setIsSubmitting(true);
          await api.delete(`/classrooms/${classroomId}/leave`);
          fetchClassrooms();
        } catch (error: any) {
          toast.error(error.response?.data?.message || "Failed to remove classroom");
          setWhooshingHubIds(prev => prev.filter(id => id !== classroomId));
        } finally {
          setIsSubmitting(false);
        }
      }, 420);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to remove classroom");
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-900 dark:text-white" />
        <p className="text-xs text-muted-foreground font-mono tracking-wider uppercase">Loading academic channels...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-5xl mx-auto w-full pb-28 md:pb-12 animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out">
      {/* Header with Academic Context */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-6">
        <div className="flex items-start sm:items-center gap-3.5">
          <button
            onClick={() => {
              hapticLight();
              navigate("/settings");
            }}
            className="p-2.5 mt-1 sm:mt-0 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-xl transition-colors text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white border border-neutral-200 dark:border-white/10 shrink-0 cursor-pointer active:scale-95 shadow-xs"
            title="Back to Settings"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-mono tracking-wide uppercase bg-black/5 dark:bg-white/[0.04] text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-white/10 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Batch Channels & Timetable Sync
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Classrooms & Sections
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Synchronize verified schedules, official CR announcements, and peer section rosters.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button 
            onClick={() => {
              hapticMedium();
              setShowJoinModal(true);
            }}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#0c0d0e] hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-900 dark:text-white text-xs font-semibold tracking-wide transition-all shadow-xs active:scale-[0.98]"
          >
            <LogIn className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
            Join with Code
          </button>
          <button 
            onClick={() => {
              hapticMedium();
              setShowCreateModal(true);
            }}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-100 text-xs font-semibold tracking-wide transition-all shadow-xs active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Create Hub
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {classrooms.length === 0 ? (
        <div className="space-y-6">
          {/* Dual Action Cards (High Density Replacement for the Empty Void) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Action Card 1: Student Join Card */}
            <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#08080a] p-6 flex flex-col justify-between space-y-5 hover:border-neutral-300 dark:hover:border-white/20 transition-all shadow-xs">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 flex items-center justify-center text-neutral-800 dark:text-neutral-200">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-600 dark:text-neutral-400 px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10">
                    Student Access
                  </span>
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  Join Your Section
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enter the 6-character code from your Class Representative (CR) to instantly mirror your section's weekly timetable and lecture alerts.
                </p>
              </div>

              <form 
                onSubmit={(e) => handleJoin(e, inlineJoinCode)}
                className="space-y-3 pt-2 border-t border-border/40"
              >
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Hash className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input 
                      type="text" 
                      value={inlineJoinCode}
                      onChange={(e) => setInlineJoinCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      className="w-full pl-9 pr-3 py-2.5 bg-neutral-50 dark:bg-[#050507] border border-neutral-300 dark:border-white/15 rounded-xl text-neutral-900 dark:text-white font-mono text-sm tracking-widest uppercase focus:border-neutral-900 dark:focus:border-white focus:ring-1 focus:ring-neutral-900/10 dark:focus:ring-white/10 outline-none transition-all"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={isSubmitting || inlineJoinCode.trim().length === 0}
                    onClick={() => hapticMedium()}
                    className="px-4 py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold tracking-wide transition-all inline-flex items-center gap-1.5 shrink-0"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        Join
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground/80 flex items-center gap-1 font-mono">
                  <span>💡</span> Ask your CR or faculty for your 6-digit sync key.
                </p>
              </form>
            </div>

            {/* Action Card 2: CR Hub Creator */}
            <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#08080a] p-6 flex flex-col justify-between space-y-5 hover:border-neutral-300 dark:hover:border-white/20 transition-all shadow-xs">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Layers className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                    CR / Faculty Hub
                  </span>
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  Establish a Batch Hub
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Are you a Class Representative? Set up your department section (e.g. CSE 5A) to broadcast emergency slot shifts, lab demos, and timetable updates.
                </p>
              </div>

              <div className="pt-2 border-t border-border/40">
                <button 
                  onClick={() => {
                    hapticMedium();
                    setShowCreateModal(true);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-[#0c0d0e] hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-900 dark:text-white text-xs font-semibold tracking-wide transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Configure New Section Hub
                </button>
                <p className="text-[11px] text-muted-foreground/80 mt-2 text-center font-mono">
                  Generates an instant 6-character sync key for peers.
                </p>
              </div>
            </div>
          </div>

          {/* Capabilities Grid */}
          <div className="pt-4">
            <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3 px-1">
              Synchronized Section Infrastructure
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#08080a] space-y-2">
                <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                  <CalendarDays className="w-4 h-4 text-neutral-700 dark:text-neutral-300 shrink-0" />
                  Timetable Sync
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Inherit CR-verified lecture and laboratory schedules without manual slot entry.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#08080a] space-y-2">
                <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                  <Megaphone className="w-4 h-4 text-neutral-700 dark:text-neutral-300 shrink-0" />
                  Verified CR Broadcasts
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Direct classroom notices for room changes, cancellations, and syllabus notes.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#08080a] space-y-2">
                <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                  <ShieldCheck className="w-4 h-4 text-neutral-700 dark:text-neutral-300 shrink-0" />
                  Distraction Free
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Academic-only communication channel free from group chat spam or lost attachments.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Active Classrooms Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <style>{`
            @keyframes hubWhooshTrajectory {
              0% {
                transform: perspective(800px) translateY(0) translateX(0) scale(1) rotateY(0deg) rotateZ(0deg);
                opacity: 1;
                filter: blur(0px);
              }
              20% {
                transform: perspective(800px) translateY(-6px) translateX(-18px) scale(1.02) rotateY(-8deg) rotateZ(-2deg);
                opacity: 0.95;
                box-shadow: 0 8px 32px rgba(244, 63, 94, 0.35);
              }
              100% {
                transform: perspective(800px) translateY(-32px) translateX(125%) scale(0.6) rotateY(28deg) rotateZ(12deg);
                opacity: 0;
                filter: blur(10px);
                visibility: hidden;
              }
            }

            @keyframes hubWhooshIn {
              0% {
                transform: perspective(800px) translateY(-35px) scale(0.88) rotateX(16deg);
                opacity: 0;
                filter: blur(8px);
              }
              65% {
                transform: perspective(800px) translateY(4px) scale(1.02) rotateX(-2deg);
                opacity: 1;
                filter: blur(0px);
              }
              100% {
                transform: perspective(800px) translateY(0) scale(1) rotateX(0deg);
                opacity: 1;
                filter: blur(0px);
              }
            }
          `}</style>
          {classrooms.map((cls) => {
            const isAdmin = cls.userRole === "admin";
            const isCopied = copiedCode === cls.joinCode;
            const isWhooshing = whooshingHubIds.includes(cls.id);
            const isNewlyCreated = newlyCreatedHubId === cls.id;
            const bannerTheme = getClassroomBannerTheme(cls.name, cls.department, cls.section);
            
            return (
              <div 
                key={cls.id}
                style={{
                  animation: isWhooshing
                    ? "hubWhooshTrajectory 0.44s cubic-bezier(0.2, 0.9, 0.3, 1) forwards"
                    : isNewlyCreated
                    ? "hubWhooshIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards"
                    : undefined,
                  pointerEvents: isWhooshing ? "none" : undefined,
                }}
                className={`group rounded-2xl sm:rounded-3xl border transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-xl ${
                  cls.isDeleted
                    ? "bg-neutral-100/60 dark:bg-[#070709] border-dashed border-rose-500/30 opacity-70 grayscale filter hover:grayscale-0 hover:opacity-100"
                    : "bg-white dark:bg-[#0c0d0e] border-neutral-200 dark:border-white/10 hover:border-neutral-400 dark:hover:border-white/25"
                }`}
              >
                {/* 1. Google Classroom Thematic Top Header Banner */}
                <div className="relative h-32 sm:h-36 w-full overflow-hidden p-4 sm:p-5 flex flex-col justify-between select-none">
                  {/* Full-Bleed Vector SVG Illustration */}
                  {bannerTheme.renderIllustration()}

                  {/* Top Row: Academic Tags & Status Badges */}
                  <div className="relative z-10 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {cls.department && (
                        <span className="text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-md text-white/80 border border-white/10">
                          {cls.department}
                        </span>
                      )}
                      {cls.section && (
                        <span className="text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-md text-white/80 border border-white/10">
                          Sec {cls.section}
                        </span>
                      )}
                    </div>

                    {cls.isDeleted ? (
                      <span className="inline-flex items-center gap-1 bg-rose-500/80 backdrop-blur-md text-white text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md shadow-xs">
                        <AlertTriangle className="w-3 h-3" />
                        Disbanded
                      </span>
                    ) : isAdmin ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="inline-flex items-center gap-1 bg-emerald-500/80 backdrop-blur-md text-white text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full shadow-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          CR / Admin
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDeleteConfirmClassroom(cls);
                          }}
                          title="Disband Classroom"
                          className="w-7 h-7 rounded-full bg-black/40 hover:bg-rose-500/80 backdrop-blur-md text-white/80 hover:text-white flex items-center justify-center transition-colors border border-white/10 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono uppercase text-white/80 px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-md border border-white/10 shrink-0">
                        Member
                      </span>
                    )}
                  </div>

                  {/* Bottom Row inside Banner: Class Title & Instructor/Creator */}
                  <div className="relative z-10 space-y-0.5">
                    <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white drop-shadow-md line-clamp-1 group-hover:text-amber-200 transition-colors">
                      {cls.name}
                    </h3>
                    <p className="text-xs text-white/80 font-medium drop-shadow-xs line-clamp-1">
                      {cls.isDeleted ? (
                        <span className="text-rose-300 font-semibold">⚠️ Section disbanded by CR</span>
                      ) : (
                        `Created by ${cls.createdBy?.name || "Academic Representative"}`
                      )}
                    </p>
                  </div>
                </div>

                {/* 2. Lower Action Bar */}
                <div className="p-4 sm:p-5 pt-3 sm:pt-3.5 bg-white dark:bg-[#0c0d0e] flex items-center justify-between gap-3 flex-wrap border-t border-neutral-100 dark:border-white/[0.06]">
                  <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        hapticLight();
                        setSelectedRosterClassroom(cls);
                      }}
                      className="inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1.5 rounded-xl bg-neutral-100/90 dark:bg-white/[0.06] border border-neutral-200/90 dark:border-white/10 hover:border-neutral-400 dark:hover:border-white/20 text-neutral-800 dark:text-neutral-200 hover:text-foreground transition-all cursor-pointer shadow-2xs active:scale-95"
                      title="View enrolled classmates"
                    >
                      <Users className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
                      <span className="font-semibold text-foreground">{cls._count.members}</span> {cls._count.members === 1 ? "Peer" : "Peers"}
                    </button>

                    {!cls.isDeleted && (
                      <button
                        type="button"
                        onClick={(e) => handleCopyCode(cls.joinCode, e)}
                        title="Copy Join Code"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-neutral-100/90 dark:bg-white/[0.06] hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-900 dark:text-white font-mono text-[11px] border border-neutral-200/90 dark:border-white/10 transition-colors shadow-2xs active:scale-95"
                      >
                        <Hash className="w-3 h-3 text-neutral-500 dark:text-neutral-400" />
                        <span className="tracking-wider font-semibold">{cls.joinCode}</span>
                        {isCopied ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3 text-neutral-400 hover:text-foreground" />
                        )}
                      </button>
                    )}
                  </div>

                  {cls.isDeleted ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleLeaveClassroom(cls.id);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 transition-all shadow-xs active:scale-[0.98]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove Hub
                    </button>
                  ) : (
                    <Link
                      to={`/classrooms/${cls.id}`}
                      onClick={() => {
                        hapticLight();
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 px-3.5 py-1.5 rounded-xl bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 border border-neutral-200/80 dark:border-white/10 transition-all shadow-2xs active:scale-95 group/link"
                    >
                      Enter Hub
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/link:translate-x-1 text-emerald-500" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete / Disband Classroom Confirmation Modal */}
      {deleteConfirmClassroom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0c0d0e] border border-neutral-200 dark:border-white/15 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Disband Section Hub</h3>
                  <p className="text-xs text-muted-foreground">Permanent CR Deletion</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setDeleteConfirmClassroom(null)}
                className="w-8 h-8 rounded-full hover:bg-neutral-100 dark:hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-[#050507] border border-neutral-200 dark:border-white/10 space-y-1.5 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">
                Are you sure you want to delete <span className="text-rose-500 font-bold">{deleteConfirmClassroom.name}</span>?
              </p>
              <p>
                • All enrolled peers will be notified via high-priority push notification that this classroom was disbanded.
              </p>
              <p>
                • The hub will be greyed out on peers' devices with an alert to remove it from their dashboards.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button 
                type="button" 
                onClick={() => setDeleteConfirmClassroom(null)} 
                className="px-4 py-2.5 text-xs font-semibold rounded-xl text-muted-foreground hover:text-foreground hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button"
                disabled={isSubmitting}
                onClick={() => handleDeleteClassroom(deleteConfirmClassroom.id)}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold tracking-wide transition-all disabled:opacity-40 inline-flex items-center gap-1.5 active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Disbanding...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Disband Classroom
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0c0d0e] border border-neutral-200 dark:border-white/15 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">Join Classroom</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Enter your 6-character section sync key.</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="w-8 h-8 rounded-full hover:bg-neutral-100 dark:hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => handleJoin(e, joinCodeInput)} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
                  6-Digit Join Code
                </label>
                <input 
                  type="text" 
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  maxLength={6}
                  autoFocus
                  className="w-full bg-neutral-50 dark:bg-[#050507] border border-neutral-300 dark:border-white/15 rounded-2xl p-3.5 text-neutral-900 dark:text-white font-mono text-center tracking-[0.4em] text-2xl font-bold focus:border-neutral-900 dark:focus:border-white focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/10 outline-none transition-all uppercase"
                  required
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowJoinModal(false)} 
                  className="px-4 py-2.5 text-xs font-semibold rounded-xl text-muted-foreground hover:text-foreground hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || joinCodeInput.trim().length === 0} 
                  className="px-5 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-100 rounded-xl text-xs font-semibold tracking-wide transition-all disabled:opacity-40 inline-flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    "Join Hub"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0c0d0e] border border-neutral-200 dark:border-white/15 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">Create Section Hub</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Establish an academic group for your batch.</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full hover:bg-neutral-100 dark:hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                  Classroom / Hub Name <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-[#050507] border border-neutral-300 dark:border-white/15 rounded-xl px-3.5 py-2.5 text-neutral-900 dark:text-white text-sm focus:border-neutral-900 dark:focus:border-white focus:ring-1 focus:ring-neutral-900/10 dark:focus:ring-white/10 outline-none transition-all"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                    Section
                  </label>
                  <input 
                    type="text" 
                    value={newSection}
                    onChange={(e) => setNewSection(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-[#050507] border border-neutral-300 dark:border-white/15 rounded-xl px-3.5 py-2.5 text-neutral-900 dark:text-white text-sm focus:border-neutral-900 dark:focus:border-white focus:ring-1 focus:ring-neutral-900/10 dark:focus:ring-white/10 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                    Department
                  </label>
                  <input 
                    type="text" 
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-[#050507] border border-neutral-300 dark:border-white/15 rounded-xl px-3.5 py-2.5 text-neutral-900 dark:text-white text-sm focus:border-neutral-900 dark:focus:border-white focus:ring-1 focus:ring-neutral-900/10 dark:focus:ring-white/10 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                  Academic Batch / Year (Optional)
                </label>
                <input 
                  type="text" 
                  value={newBatch}
                  onChange={(e) => setNewBatch(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-[#050507] border border-neutral-300 dark:border-white/15 rounded-xl px-3.5 py-2.5 text-neutral-900 dark:text-white text-sm focus:border-neutral-900 dark:focus:border-white focus:ring-1 focus:ring-neutral-900/10 dark:focus:ring-white/10 outline-none transition-all"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)} 
                  className="px-4 py-2.5 text-xs font-semibold rounded-xl text-muted-foreground hover:text-foreground hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || !newClassName.trim()} 
                  className="px-5 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-100 rounded-xl text-xs font-semibold tracking-wide transition-all disabled:opacity-40 inline-flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Hub"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Classroom Roster & Classmates Modal */}
      {selectedRosterClassroom && (
        <ClassroomRosterModal
          isOpen={Boolean(selectedRosterClassroom)}
          onClose={() => setSelectedRosterClassroom(null)}
          classroomId={selectedRosterClassroom.id}
          classroomName={selectedRosterClassroom.name}
          isCrOrAdmin={selectedRosterClassroom.userRole === "admin"}
        />
      )}
    </div>
  );
};
