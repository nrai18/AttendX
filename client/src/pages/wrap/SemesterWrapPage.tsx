import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Play,
  Share2,
  X,
  Volume2,
  VolumeX,
  Pause,
  Sparkles,
  Calendar,
  Clock,
  GraduationCap,
  PartyPopper,
  Loader2,
} from "lucide-react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import { useBackHandlerStore } from "../../stores/backHandlerStore";
import { wrapAudio } from "../../utils/wrapAudio";
import { useLocalAvatar } from "../../utils/avatarCache";
import {
  WrapSnapshot,
  WrapCopyPayload,
  buildOfflineWrapSnapshot,
  buildLocalWrapCopy,
  buildLocalRemarkQuip,
  normalizeWrapCopy,
  hasWrapReplayData,
  getCachedWrapBundle,
  saveCachedWrapBundle,
} from "../../utils/wrapEngine";
import { WrapShareSheet } from "../../components/wrap/WrapShareSheet";

const SLIDES = [
  { id: 0, title: "Intro", bg: "radial-gradient(circle at 55% 24%, #2c302c 0%, #171917 58%, #101110 100%)", duration: 6500 },
  { id: 1, title: "Timeline Forecast", bg: "radial-gradient(circle at 50% 42%, #556f12 0%, #314209 55%, #161d06 100%)", duration: 7500 },
  { id: 2, title: "Upcoming Fests & Exams", bg: "linear-gradient(175deg, #272321 0%, #181514 55%, #110f0f 100%)", duration: 7500 },
  { id: 3, title: "Top Subjects", bg: "radial-gradient(circle at 80% 18%, #2e2926 0%, #181514 56%, #110f0f 100%)", duration: 7500 },
  { id: 4, title: "Monthly Arc", bg: "radial-gradient(circle at 80% 18%, #523422 0%, #2b1b13 55%, #150e0a 100%)", duration: 8500 },
  { id: 5, title: "Streaks & Purple Days", bg: "radial-gradient(circle at 30% 25%, #37233f 0%, #1e1323 58%, #100b13 100%)", duration: 7500 },
  { id: 6, title: "Class Miss Pattern", bg: "radial-gradient(circle at 50% 35%, #415822 0%, #243312 58%, #111909 100%)", duration: 8000 },
  { id: 7, title: "Witty Remarks", bg: "radial-gradient(circle at 25% 25%, #3d242e 0%, #22141a 58%, #130b0e 100%)", duration: 11500 },
  { id: 8, title: "Poster Finale", bg: "radial-gradient(circle at 50% 25%, #5b1826 0%, #2f0e15 58%, #14080b 100%)", duration: 9500 },
];

const SLIDE_TRANSITION_VARIANTS = {
  enter: (dir: number) => ({
    opacity: 0,
    x: dir >= 0 ? 44 : -44,
    scale: 0.96,
  }),
  center: {
    opacity: 1,
    x: 0,
    scale: 1,
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir >= 0 ? -36 : 36,
    scale: 0.97,
  }),
};

export const SemesterWrapPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [snapshot, setSnapshot] = useState<WrapSnapshot | null>(() => {
    const localSnap = buildOfflineWrapSnapshot();
    const cached = localSnap ? getCachedWrapBundle(localSnap.user.id, localSnap.semester.id) : null;
    return cached?.snapshot || localSnap;
  });

  const [copy, setCopy] = useState<WrapCopyPayload | null>(() => {
    const snap = buildOfflineWrapSnapshot();
    if (!snap) return null;
    const cached = getCachedWrapBundle(snap.user.id, snap.semester.id);
    return cached?.copy ? normalizeWrapCopy(snap, cached.copy) : buildLocalWrapCopy(snap);
  });

  const [loadingRemote, setLoadingRemote] = useState(false);
  const [hubScope, setHubScope] = useState<"progress" | "forecast" | "labs" | "streaks">("progress");
  const [inStory, setInStory] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideDir, setSlideDir] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [audioOn, setAudioOn] = useState(() => !wrapAudio.isMuted());
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareSnapshotSlide, setShareSnapshotSlide] = useState<number>(-1);
  const [shareSnapshotMonthIdx, setShareSnapshotMonthIdx] = useState<number>(0);
  const [shareSnapshotRemark, setShareSnapshotRemark] = useState<string>("");
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(0);
  const [isMonthHovering, setIsMonthHovering] = useState<boolean>(false);
  const [selectedRemarkText, setSelectedRemarkText] = useState<string>("");
  const [activeRemarkIdx, setActiveRemarkIdx] = useState<number>(0);

  const [progressRatio, setProgressRatio] = useState(0);
  const prevSlideRef = useRef<number>(-1);
  const wasInStoryRef = useRef<boolean>(false);
  const holdPausedRef = useRef<boolean>(false);
  const holdTimerRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; time: number; moved: boolean } | null>(null);
  const rafRef = useRef<number | null>(null);
  const slideStartRef = useRef<number>(0);
  const pauseElapsedRef = useRef<number>(0);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  // Sync live backend snapshot & optional Gemini AI copy with 0ms local fallback
  useEffect(() => {
    let active = true;
    const loadWrap = async () => {
      if (!navigator.onLine) return;
      setLoadingRemote(true);
      try {
        const res = await api.get("/semesters/wrap", { silent: true, skipToast: true } as any);
        if (!active || !res.data?.snapshot) return;
        const freshSnap: WrapSnapshot = res.data.snapshot;
        const fallbackCopy: WrapCopyPayload = normalizeWrapCopy(freshSnap, res.data.localCopy);
        setSnapshot(freshSnap);

        const cached = getCachedWrapBundle(freshSnap.user.id, freshSnap.semester.id);
        if (cached?.snapshot?.signature === freshSnap.signature && cached.copy?.source === "gemini") {
          setCopy(normalizeWrapCopy(freshSnap, cached.copy));
        } else {
          setCopy(fallbackCopy);
          saveCachedWrapBundle(freshSnap.user.id, freshSnap.semester.id, { snapshot: freshSnap, copy: fallbackCopy });

          // Dynamically only call Gemini if there is real attendance data to narrate
          if (hasWrapReplayData(freshSnap)) {
            api
              .post("/semesters/wrap/ai-copy", { snapshot: freshSnap }, { silent: true, skipToast: true } as any)
              .then((aiRes) => {
                if (!active || !aiRes.data) return;
                const merged = normalizeWrapCopy(freshSnap, aiRes.data);
                setCopy(merged);
                saveCachedWrapBundle(freshSnap.user.id, freshSnap.semester.id, { snapshot: freshSnap, copy: merged });
              })
              .catch(() => {});
          }
        }
      } catch {
        // Offline / local build remains active cleanly
      } finally {
        if (active) setLoadingRemote(false);
      }
    };
    loadWrap();
    return () => {
      active = false;
    };
  }, []);

  // Initialize default interactive selections when snapshot updates
  useEffect(() => {
    if (!snapshot) return;
    if (snapshot.months.length > 0) {
      setSelectedMonthIdx(snapshot.months.length - 1);
    }
    if (snapshot.remarksTape.length > 0 && !selectedRemarkText) {
      setSelectedRemarkText(snapshot.remarksTape[0].text);
    }
  }, [snapshot]);

  // Keep Replay soundtrack playing across the entire /wrap page; stop strictly on page exit / Back!
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) {
        wrapAudio.pause();
      } else if (!wrapAudio.isMuted()) {
        wrapAudio.start();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      clearHoldTimer();
      wrapAudio.stop();
    };
  }, [clearHoldTimer]);

  const stopStoryTimer = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const exitStory = useCallback(() => {
    clearHoldTimer();
    pointerStartRef.current = null;
    holdPausedRef.current = false;
    stopStoryTimer();
    setInStory(false);
  }, [clearHoldTimer, stopStoryTimer]);

  // Android Hardware Back stack priority: Story Overlay (returns to Hub, music keeps playing) -> Page Exit (stops music)
  useEffect(() => {
    if (!inStory) return;
    const unregister = useBackHandlerStore.getState().register(() => {
      exitStory();
      return true;
    });
    return () => unregister();
  }, [inStory, exitStory]);

  useEffect(() => {
    const unregister = useBackHandlerStore.getState().register(() => {
      wrapAudio.stop();
      navigate(-1);
      return true;
    });
    return () => unregister();
  }, [navigate]);

  const hasReplayData = hasWrapReplayData(snapshot);

  useEffect(() => {
    if (!hasReplayData) return;
    wrapAudio.start();
    setAudioOn(!wrapAudio.isMuted());
  }, [hasReplayData]);

  const activeSlides = useMemo(() => {
    if (!snapshot || !hasReplayData) return [];
    const t = snapshot.totals;
    const f = snapshot.forecast;
    const cp = snapshot.calendarPatterns;
    const mp = snapshot.missingPatterns;
    return SLIDES.filter((s) => {
      switch (s.id) {
        case 0:
          return true;
        case 1:
          return t.conducted > 0 || f.totalForecastedClasses > 0;
        case 2:
          return (
            snapshot.upcomingHorizon.exams.length > 0 ||
            snapshot.upcomingHorizon.festsAndBreaks.length > 0
          );
        case 3:
          return snapshot.subjectsRanked.some((sub) => sub.total > 0);
        case 4:
          return snapshot.months.some((m) => m.conducted > 0);
        case 5:
          return (
            cp.perfectDaysCount > 0 ||
            cp.mixedPurpleDaysCount > 0 ||
            cp.fullCancelledDaysCount > 0 ||
            (snapshot.extraClasses?.missed || 0) > 0 ||
            (snapshot.unmarked?.daysCount || 0) > 0
          );
        case 6:
          return mp.weekdays.some((w) => w.present + w.absent > 0) && t.absent > 0;
        case 7:
          return snapshot.remarksTape.length > 0;
        case 8:
          return t.conducted > 0;
        default:
          return true;
      }
    });
  }, [snapshot, hasReplayData]);

  const currentStoryPos = Math.max(
    0,
    activeSlides.findIndex((s) => s.id === currentSlide),
  );
  const currentSlideMeta = SLIDES.find((s) => s.id === currentSlide) || SLIDES[0];

  const nextSlide = useCallback(() => {
    if (!inStory || activeSlides.length === 0) return;
    const idx = activeSlides.findIndex((s) => s.id === currentSlide);
    if (idx >= 0 && idx < activeSlides.length - 1) {
      const nextId = activeSlides[idx + 1].id;
      setSlideDir(1);
      pauseElapsedRef.current = 0;
      slideStartRef.current = performance.now();
      setProgressRatio(0);
      setIsPaused(false);
      setCurrentSlide(nextId);
      wrapAudio.playCardSweep(idx + 1);
    } else {
      exitStory();
    }
  }, [inStory, activeSlides, currentSlide, exitStory]);

  const prevSlide = useCallback(() => {
    if (!inStory || activeSlides.length === 0) return;
    const idx = activeSlides.findIndex((s) => s.id === currentSlide);
    setSlideDir(-1);
    pauseElapsedRef.current = 0;
    slideStartRef.current = performance.now();
    setProgressRatio(0);
    setIsPaused(false);
    if (idx > 0) {
      const prevIdx = idx - 1;
      setCurrentSlide(activeSlides[prevIdx].id);
      wrapAudio.playCardSweep(prevIdx);
    } else {
      wrapAudio.playCardSweep(0);
    }
  }, [inStory, activeSlides, currentSlide]);

  useEffect(() => {
    stopStoryTimer();
    if (!inStory || isPaused || isShareOpen || activeSlides.length === 0) return;

    const remarkSteps = Math.max(1, snapshot?.remarksTape?.length || 1);
    const monthSteps = Math.max(1, snapshot?.months?.length || 1);
    const subjectSteps = Math.max(1, snapshot?.subjectsRanked?.length || 1);
    const dur =
      currentSlide === 7
        ? Math.max(9200, remarkSteps * 2200)
        : currentSlide === 4
          ? Math.max(8500, monthSteps * 1850)
          : currentSlide === 3
            ? Math.max(8000, subjectSteps * 1050)
            : currentSlideMeta.duration;
    slideStartRef.current = performance.now() - pauseElapsedRef.current;

    const tick = (ts: number) => {
      const ratio = Math.min(1, (ts - slideStartRef.current) / dur);
      setProgressRatio(ratio);
      if (ratio >= 1) {
        pauseElapsedRef.current = 0;
        if (currentStoryPos < activeSlides.length - 1) {
          nextSlide();
        } else {
          setIsPaused(true);
        }
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => stopStoryTimer();
  }, [inStory, isPaused, isShareOpen, currentSlide, currentStoryPos, currentSlideMeta.duration, activeSlides.length, snapshot?.remarksTape?.length, snapshot?.months?.length, nextSlide, stopStoryTimer]);

  // Only reset Slide 4 / Slide 7 indices when entering story or changing slides (never when Share opens/closes!)
  useEffect(() => {
    const prev = prevSlideRef.current;
    const enteredStory = !wasInStoryRef.current && inStory;
    prevSlideRef.current = currentSlide;
    wasInStoryRef.current = inStory;
    if (!inStory || (!enteredStory && prev === currentSlide)) return;

    if (currentSlide === 4 && (snapshot?.months?.length || 0) > 0) {
      setSelectedMonthIdx(0);
    }
    if (currentSlide === 7 && (snapshot?.remarksTape?.length || 0) > 0) {
      setActiveRemarkIdx(0);
      setSelectedRemarkText(snapshot!.remarksTape[0].text);
    }
  }, [inStory, currentSlide, snapshot]);

  // Auto-progress through monthly timeline dots one by one on Slide 4 (Jul -> Aug -> Sep -> Oct -> Nov)
  useEffect(() => {
    if (!inStory || currentSlide !== 4 || isPaused || isShareOpen || isMonthHovering) return;
    const months = snapshot?.months || [];
    if (months.length <= 1) return;

    const iv = window.setInterval(() => {
      setSelectedMonthIdx((prev) => {
        if (prev >= months.length - 1) return prev;
        const nextIdx = prev + 1;
        wrapAudio.playCardSweep(nextIdx);
        return nextIdx;
      });
    }, 1750);
    return () => window.clearInterval(iv);
  }, [inStory, currentSlide, isPaused, isShareOpen, isMonthHovering, snapshot?.months]);

  // Auto-play sequential excuses one by one on Slide 7 (Remarks Roast Deck) without overwriting paused/shared state
  useEffect(() => {
    if (!inStory || currentSlide !== 7 || isPaused || isShareOpen) return;
    const tape = snapshot?.remarksTape || [];
    if (tape.length === 0) return;

    const iv = window.setInterval(() => {
      setActiveRemarkIdx((prev) => {
        const nextIdx = (prev + 1) % tape.length;
        setSelectedRemarkText(tape[nextIdx].text);
        wrapAudio.playCardSweep(nextIdx);
        return nextIdx;
      });
    }, 2200);
    return () => window.clearInterval(iv);
  }, [inStory, currentSlide, isPaused, isShareOpen, snapshot]);

  useEffect(() => {
    if (!inStory || currentSlide !== 7) return;
    const el = document.getElementById(`wrap-remark-row-${activeRemarkIdx}`);
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [inStory, currentSlide, activeRemarkIdx]);

  useEffect(() => {
    pauseElapsedRef.current = 0;
    setProgressRatio(0);
  }, [currentSlide]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!inStory || isShareOpen) return;
      if (e.key === "ArrowRight") nextSlide();
      else if (e.key === "ArrowLeft") prevSlide();
      else if (e.key === "Escape") exitStory();
      else if (e.key === " ") {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inStory, isShareOpen, nextSlide, prevSlide, exitStory]);

  const startStory = (slideId?: number) => {
    if (!hasReplayData || activeSlides.length === 0) return;
    const targetId =
      typeof slideId === "number" && activeSlides.some((s) => s.id === slideId)
        ? slideId
        : activeSlides[0].id;
    pauseElapsedRef.current = 0;
    setSlideDir(targetId >= currentSlide ? 1 : -1);
    setCurrentSlide(targetId);
    setIsPaused(false);
    setInStory(true);
    if (!wrapAudio.isMuted()) {
      wrapAudio.start();
      setAudioOn(true);
    }
  };

  const togglePause = () => {
    setIsPaused((p) => {
      if (!p) {
        pauseElapsedRef.current = performance.now() - slideStartRef.current;
      }
      return !p;
    });
  };

  const handleToggleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    const active = wrapAudio.toggleMute();
    setAudioOn(active);
  };

  const openShareModal = (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    clearHoldTimer();
    pointerStartRef.current = null;
    holdPausedRef.current = false;
    if (inStory && !isPaused) {
      pauseElapsedRef.current = Math.max(0, performance.now() - slideStartRef.current);
    }
    const dispRemarks = snapshot?.remarksTape || [];
    const activeRem =
      dispRemarks[activeRemarkIdx]?.text ||
      selectedRemarkText ||
      snapshot?.remarksTape?.[0]?.text ||
      "";
    setShareSnapshotSlide(inStory ? currentSlide : -1);
    setShareSnapshotMonthIdx(selectedMonthIdx);
    setShareSnapshotRemark(activeRem);
    setIsShareOpen(true);
  };

  const rawAvatarUrl = snapshot?.user?.avatarUrl || user?.avatarUrl;
  const avatarUrl = useLocalAvatar(snapshot?.user?.id || user?.id, rawAvatarUrl);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  if (!snapshot || !copy) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-4">
        <GraduationCap className="w-12 h-12 mx-auto text-primary opacity-80" />
        <h2 className="text-xl font-bold font-geist">No Semester Data Yet</h2>
        <p className="text-sm text-muted-foreground">
          Mark at least a few attendance records or set up your active semester timetable to unlock your live Replay.
        </p>
        <button
          onClick={() => navigate("/semester")}
          className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold cursor-pointer"
        >
          Go to Semester Overview
        </button>
      </div>
    );
  }

  const activeMonth = snapshot.months[selectedMonthIdx] || snapshot.months[0];
  const heroTitle = snapshot.semester.isPastTeachingDay
    ? `${snapshot.semester.name} Wrap`
    : `${snapshot.semester.name} Replay`;

  return (
    <div className="preserve-dark max-w-2xl mx-auto pb-12 space-y-5 font-geist text-white">
      {/* Dark BitChord Editorial Wrapper */}
      <div className="rounded-3xl bg-[#121312] border border-white/10 p-5 sm:p-6 shadow-2xl space-y-5">
        {/* Top Bar with Back + Audio + Share + User Avatar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              wrapAudio.stop();
              navigate(-1);
            }}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center cursor-pointer transition"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            {loadingRemote && <Loader2 className="w-3.5 h-3.5 animate-spin text-white/50" />}
            {hasReplayData && (
              <button
                type="button"
                onClick={handleToggleAudio}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center cursor-pointer transition"
                aria-label="Toggle Replay music"
                title={audioOn ? "Mute Replay music" : "Unmute Replay music"}
              >
                {audioOn ? <Volume2 className="w-4 h-4 text-[#b7f357]" /> : <VolumeX className="w-4 h-4 text-white/70" />}
              </button>
            )}
            {hasReplayData && (
              <button
                type="button"
                onClick={(e) => openShareModal(e)}
                className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
            )}
            {avatarUrl && !avatarFailed ? (
              <img
                src={avatarUrl}
                alt={snapshot.user.name}
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="w-9 h-9 rounded-full object-cover border border-white/25"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-sm font-bold">
                {snapshot.user.name.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Title & Scope Pills */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{heroTitle}</h1>
          <p className="text-xs text-white/60 mt-0.5">{copy.phaseRoast}</p>
        </div>

        {hasReplayData ? (
          <>
            <div className="flex items-center bg-[#1c1d1c] p-1 rounded-full border border-white/10 text-xs font-medium">
              {(
                [
                  { id: "progress", label: "So Far" },
                  { id: "forecast", label: "Left / Forecast" },
                  { id: "labs", label: "Top Subjects" },
                  { id: "streaks", label: "Streaks" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setHubScope(tab.id)}
                  className={`flex-1 py-1.5 rounded-full cursor-pointer transition ${
                    hubScope === tab.id ? "bg-white text-black font-semibold" : "text-white/60 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* BitChord Hero Record Card */}
            <div
              className="rounded-3xl p-5 border border-white/12 relative overflow-hidden"
              style={{ background: "radial-gradient(circle at 82% 18%, #343934 0%, #202220 58%, #171817 100%)" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-[0.14em] uppercase text-white/60 font-semibold font-mono">
                  {hubScope === "forecast"
                    ? "REMAINING FORECAST"
                    : hubScope === "labs"
                      ? "SUBJECT LEADERBOARD"
                      : hubScope === "streaks"
                        ? "GREEN & PURPLE STREAKS"
                        : "YOUR SEMESTER RECORD"}
                </span>
                <span className="font-extrabold tracking-tight text-sm text-white/90">AttendX</span>
              </div>

              <div className="mt-5">
                {hubScope === "forecast" ? (
                  <>
                    <div className="text-4xl font-bold font-mono tabular-nums text-[#b7f357]">
                      {snapshot.forecast.remainingClasses} left
                    </div>
                    <div className="text-xs text-white/70 mt-1">
                      {snapshot.totals.conducted} done of ~{snapshot.forecast.totalForecastedClasses} forecasted · safe bunks remaining: {snapshot.forecast.maxSafeBunksAcrossRemaining}
                    </div>
                  </>
                ) : hubScope === "labs" ? (
                  <>
                    <div className="text-3xl font-bold tabular-nums">
                      {snapshot.subjectsRanked[0]?.pct ?? snapshot.totals.percentage}%
                    </div>
                    <div className="text-xs text-white/70 mt-1">
                      #1: {snapshot.subjectsRanked[0]?.name || "No subjects yet"}
                    </div>
                  </>
                ) : hubScope === "streaks" ? (
                  <>
                    <div className="text-4xl font-bold font-mono tabular-nums">
                      {snapshot.calendarPatterns.bestGreenStreak.length}d · {snapshot.calendarPatterns.mixedPurpleDaysCount}p
                    </div>
                    <div className="text-xs text-white/70 mt-1">
                      Best 100% streak · Mixed purple dot days · {snapshot.calendarPatterns.fullCancelledDaysCount} full cancelled days
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-4xl font-bold font-mono tabular-nums">
                      {snapshot.totals.percentage}%
                    </div>
                    <div className="text-xs tracking-wide uppercase text-white/70 mt-1 font-mono">
                      {snapshot.totals.present} OF {snapshot.totals.conducted} CONDUCTED ({snapshot.forecast.timelineProgressPct}% SEMESTER DONE)
                    </div>
                  </>
                )}
              </div>

              {/* Forecast Timeline Progress Track */}
              <div className="mt-4">
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#b7f357] transition-all duration-700"
                    style={{ width: `${snapshot.forecast.timelineProgressPct}%` }}
                  />
                </div>
              </div>

              <div className="mt-5 pt-3.5 border-t border-white/10 flex items-end justify-between text-xs">
                <div>
                  <div className="tracking-[0.18em] font-semibold text-white/90 uppercase">
                    {snapshot.user.name}
                  </div>
                  <div className="text-[11px] text-white/50 mt-0.5">
                    {copy.archetypeTitle} · Target {snapshot.totals.targetPercentage}%
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-[9px] text-white/45 uppercase">Member Since</div>
                  <div className="font-semibold text-white/90">{snapshot.user.memberSince}</div>
                </div>
              </div>
            </div>

            {/* Play Story Button */}
            <button
              onClick={() => startStory()}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#222422] hover:bg-[#2a2d2a] border border-white/15 flex items-center justify-between cursor-pointer transition group"
            >
              <span className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-[#b7f357] text-[#111508] flex items-center justify-center group-hover:scale-105 transition">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </span>
                <span className="text-sm font-bold text-white">
                  Play your {snapshot.semester.isPastTeachingDay ? "Wrap" : "Replay"}
                </span>
              </span>
              <Sparkles className="w-4 h-4 text-[#b7f357]" />
            </button>
          </>
        ) : (
          <div className="rounded-3xl bg-[#181a18] border border-white/12 p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#b7f357]/15 text-[#b7f357] border border-[#b7f357]/25 flex items-center justify-center mx-auto">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-white">Replay unlocks once classes begin</h2>
              <p className="text-xs text-white/60 max-w-sm mx-auto leading-relaxed">
                You have 0 logged attendance records in {snapshot.semester.name} yet. Mark classes on Today or set up your timetable &amp; calendar first so Replay cards show real stats instead of empty zeroes.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => navigate("/today")}
                className="px-4 py-2 rounded-xl bg-[#b7f357] hover:brightness-95 text-[#111508] text-xs font-bold cursor-pointer transition"
              >
                Go to Today
              </button>
              <button
                type="button"
                onClick={() => navigate("/calendar")}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/15 text-xs font-bold cursor-pointer transition"
              >
                View Calendar
              </button>
            </div>
          </div>
        )}

        {/* Quick Upcoming Preview (Chronological Semester Milestones, Fests & Exams) */}
        {(snapshot.upcomingHorizon.exams.length > 0 || snapshot.upcomingHorizon.festsAndBreaks.length > 0) && (() => {
          const combined = [
            ...snapshot.upcomingHorizon.exams.map((e) => ({ ...e, kind: "exam" as const })),
            ...snapshot.upcomingHorizon.festsAndBreaks.map((f) => ({ ...f, kind: "break" as const })),
          ]
            .sort((a, b) => a.daysLeft - b.daysLeft || a.date.localeCompare(b.date))
            .slice(0, 4);
          return (
            <div className="rounded-2xl bg-[#181918] border border-white/10 p-4 space-y-2.5">
              <div className="text-[11px] font-mono uppercase tracking-wider text-white/55">
                Coming Up Next
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {combined.map((ev, i) => {
                  const whenLabel = ev.daysLeft === 0 ? "Today" : ev.daysLeft === 1 ? "Tomorrow" : `In ${ev.daysLeft}d`;
                  return ev.kind === "exam" ? (
                    <div key={`${ev.title}-${i}`} className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-400/20 flex items-center gap-2.5">
                      <GraduationCap className="w-4 h-4 text-rose-300 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{ev.title}</div>
                        <div className="text-[10.5px] text-rose-200/75 font-mono">{whenLabel} · {ev.date}</div>
                      </div>
                    </div>
                  ) : (
                    <div key={`${ev.title}-${i}`} className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
                      <PartyPopper className="w-4 h-4 text-[#b7f357] shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{ev.title}</div>
                        <div className="text-[10.5px] text-white/50 font-mono">{whenLabel} · {ev.date}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Log Discipline & Extra Classes Callout */}
        {hasReplayData && (
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-[#181918] border border-white/10 p-3.5">
              <div className="text-[10px] font-mono uppercase text-white/50">Unmarked Days</div>
              <div className="text-xl font-bold font-mono text-white mt-0.5">
                {snapshot.unmarked?.daysCount ?? 0}
              </div>
              <div className="text-[10.5px] text-white/55 mt-0.5 leading-snug">
                {(snapshot.unmarked?.daysCount ?? 0) > 0
                  ? `${snapshot.unmarked?.slotsCount} slots unlogged`
                  : "Every working day logged"}
              </div>
            </div>
            <div className="rounded-2xl bg-[#181918] border border-white/10 p-3.5">
              <div className="text-[10px] font-mono uppercase text-white/50">Extra Classes</div>
              <div className={`text-xl font-bold font-mono mt-0.5 ${snapshot.extraClasses?.missed ? "text-amber-300" : "text-[#b7f357]"}`}>
                {snapshot.extraClasses?.missed
                  ? `${snapshot.extraClasses.missed} missed`
                  : `${snapshot.extraClasses?.total ?? 0} logged`}
              </div>
              <div className="text-[10.5px] text-white/55 mt-0.5 leading-snug truncate">
                {snapshot.extraClasses?.missed
                  ? `${snapshot.extraClasses.missedSamples[0]?.subjectName || "Bonus class"}`
                  : "No bonus classes skipped"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FULLSCREEN STORY PORTAL */}
      {inStory &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="preserve-dark fixed inset-0 z-[110] flex flex-col text-white select-none transition-all duration-500 font-geist"
            style={{ background: currentSlideMeta.bg }}
          >
            {/* Segmented Top Progress Bars */}
            <div className="px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center gap-1.5 z-30">
              {activeSlides.map((s, idx) => {
                const width =
                  idx < currentStoryPos ? "100%" : idx === currentStoryPos ? `${(progressRatio * 100).toFixed(2)}%` : "0%";
                return (
                  <button
                    key={s.id}
                    onClick={() => startStory(s.id)}
                    className="flex-1 h-[3px] rounded-full bg-white/25 overflow-hidden cursor-pointer"
                    aria-label={`Jump to slide ${idx + 1}`}
                  >
                    <div className="h-full bg-white rounded-full" style={{ width }} />
                  </button>
                );
              })}
            </div>

            {/* Header Row */}
            <div className="px-4 py-3 flex items-center justify-between z-30">
              <div className="flex items-center gap-2">
                <button
                  onClick={exitStory}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
                  aria-label="Back to Hub"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold text-white/90">
                  {snapshot.semester.isPastTeachingDay ? "Wrap" : "Replay"} · {snapshot.semester.name}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="font-extrabold tracking-tight text-sm">AttendX</span>
                <button
                  onClick={handleToggleAudio}
                  className="h-7 px-2.5 rounded-full bg-white/12 hover:bg-white/20 flex items-center gap-1.5 text-[11px] font-mono cursor-pointer"
                  aria-label="Toggle instrumental music"
                >
                  {audioOn ? <Volume2 className="w-3.5 h-3.5 text-[#b7f357]" /> : <VolumeX className="w-3.5 h-3.5" />}
                  <span>{audioOn ? "ON" : "MUTE"}</span>
                </button>
                <button
                  onClick={exitStory}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Main Animated Story Body — Instagram-Style Left/Right Tap, Swipe & Hold-to-Pause */}
            <div
              className="flex-1 relative overflow-hidden flex flex-col w-full cursor-pointer select-none touch-none"
              style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
              onContextMenu={(e) => {
                if ((e.target as HTMLElement).closest("button,a,input,g,[data-interactive]")) return;
                e.preventDefault();
              }}
              onPointerDown={(e) => {
                if (e.button !== 0 && e.pointerType === "mouse") return;
                if ((e.target as HTMLElement).closest("button,a,input,g,[data-interactive]")) return;
                clearHoldTimer();
                pointerStartRef.current = {
                  x: e.clientX,
                  y: e.clientY,
                  time: performance.now(),
                  moved: false,
                };
                holdTimerRef.current = window.setTimeout(() => {
                  holdTimerRef.current = null;
                  if (!pointerStartRef.current || pointerStartRef.current.moved) return;
                  if (!isPaused) {
                    holdPausedRef.current = true;
                    pauseElapsedRef.current = Math.max(0, performance.now() - slideStartRef.current);
                    setIsPaused(true);
                  }
                }, 200);
              }}
              onPointerMove={(e) => {
                const start = pointerStartRef.current;
                if (!start || start.moved) return;
                if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 18) {
                  start.moved = true;
                  clearHoldTimer();
                }
              }}
              onPointerUp={(e) => {
                if (e.button !== 0 && e.pointerType === "mouse") return;
                clearHoldTimer();
                if ((e.target as HTMLElement).closest("button,a,input,g,[data-interactive]")) {
                  pointerStartRef.current = null;
                  holdPausedRef.current = false;
                  return;
                }
                const start = pointerStartRef.current;
                pointerStartRef.current = null;

                if (holdPausedRef.current) {
                  holdPausedRef.current = false;
                  setIsPaused(false);
                  return;
                }

                if (!start) return;
                const dx = e.clientX - start.x;
                const dy = e.clientY - start.y;
                const dist = Math.hypot(dx, dy);

                if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
                  if (dx < 0) nextSlide();
                  else prevSlide();
                  return;
                }

                if (dist > 16) return;

                const bounds = e.currentTarget.getBoundingClientRect();
                const relX = bounds.width > 0 ? (e.clientX - bounds.left) / bounds.width : 0.5;
                if (relX < 0.38) {
                  prevSlide();
                } else {
                  nextSlide();
                }
              }}
              onPointerCancel={() => {
                clearHoldTimer();
                pointerStartRef.current = null;
                if (holdPausedRef.current) {
                  holdPausedRef.current = false;
                  setIsPaused(false);
                }
              }}
            >
              <div className="flex-1 relative overflow-hidden flex flex-col max-w-lg w-full mx-auto px-5 pb-4">
                <AnimatePresence mode="wait" custom={slideDir}>
                  <motion.div
                    key={currentSlide}
                    custom={slideDir}
                    variants={SLIDE_TRANSITION_VARIANTS}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="flex-1 flex flex-col justify-between overflow-y-auto py-2 z-10"
                  >
                  {/* SLIDE 0: INTRO COLLAGE (5 Synchronized Floating Collage Cards) */}
                  {currentSlide === 0 && (() => {
                    const perfectLabsCount = snapshot.subjectsRanked.filter((s) => s.pct === 100).length;
                    const topMonth = [...snapshot.months].sort((a, b) => b.pct - a.pct)[0];
                    const bestWeekday = [...snapshot.missingPatterns.weekdays].sort((a, b) => b.attendPct - a.attendPct)[0];
                    return (
                      <>
                        <motion.div
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.42 }}
                          className="space-y-2"
                        >
                          <h2 className="text-3xl font-bold leading-tight">
                            Your <span className="font-extrabold">{snapshot.semester.name}</span>{" "}
                            {snapshot.semester.isPastTeachingDay ? "Wrap" : "Replay"} is ready.
                          </h2>
                          <p className="text-sm text-white/70">{copy.introSubtitle}</p>
                        </motion.div>

                        <div className="relative h-[340px] my-2 flex items-center justify-center">
                          {/* Center Avatar + Percentage Tile */}
                          <motion.div
                            initial={{ opacity: 0, scale: 0.84, rotate: -6 }}
                            animate={{ opacity: 1, scale: 1, rotate: -2 }}
                            transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.06 }}
                            className="w-48 h-48 rounded-3xl overflow-hidden border border-white/20 shadow-2xl relative z-10 bg-[#202220]"
                          >
                            {avatarUrl && !avatarFailed ? (
                              <img
                                src={avatarUrl}
                                alt={snapshot.user.name}
                                referrerPolicy="no-referrer"
                                onError={() => setAvatarFailed(true)}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-5xl font-bold">
                                {snapshot.user.name.slice(0, 1)}
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent flex flex-col justify-end p-3.5">
                              <span className="text-[10px] font-mono uppercase text-[#b7f357]">
                                {snapshot.forecast.timelineProgressPct}% SEMESTER DONE
                              </span>
                              <span className="text-2xl font-bold font-mono tabular-nums">{snapshot.totals.percentage}%</span>
                            </div>
                          </motion.div>

                          {/* Top-Left Collage Badge */}
                          <motion.div
                            initial={{ opacity: 0, x: -24, y: 12, rotate: -14 }}
                            animate={{ opacity: 1, x: 0, y: [0, -5, 0], rotate: -8 }}
                            transition={{
                              opacity: { duration: 0.4, delay: 0.14 },
                              x: { type: "spring", stiffness: 240, damping: 20, delay: 0.14 },
                              y: { duration: 4.8, repeat: Infinity, ease: "easeInOut", delay: 0.5 },
                            }}
                            className="absolute top-3 left-1 w-28 rounded-2xl bg-[#314209] border border-lime-300/25 p-2.5 shadow-xl flex flex-col justify-between"
                          >
                            <div className="text-[10px] font-mono text-lime-200/80 uppercase">
                              {perfectLabsCount > 0 ? `${perfectLabsCount} LABS` : "REMAINING"}
                            </div>
                            <div className="text-lg font-bold font-mono text-white">
                              {perfectLabsCount > 0 ? "100%" : `${snapshot.forecast.remainingClasses} left`}
                            </div>
                          </motion.div>

                          {/* Top-Right Peak Month Collage Badge */}
                          {topMonth && (
                            <motion.div
                              initial={{ opacity: 0, x: 24, y: 12, rotate: 14 }}
                              animate={{ opacity: 1, x: 0, y: [0, -4, 0], rotate: 7 }}
                              transition={{
                                opacity: { duration: 0.4, delay: 0.2 },
                                x: { type: "spring", stiffness: 240, damping: 20, delay: 0.2 },
                                y: { duration: 5.4, repeat: Infinity, ease: "easeInOut", delay: 0.8 },
                              }}
                              className="absolute top-6 right-1 w-28 rounded-2xl bg-[#523422] border border-amber-200/20 p-2.5 shadow-xl"
                            >
                              <div className="text-[10px] font-mono text-amber-200/80 uppercase">
                                {topMonth.label} PEAK
                              </div>
                              <div className="text-base font-bold font-mono text-white">{topMonth.pct}%</div>
                            </motion.div>
                          )}

                          {/* Bottom-Left Circular Streak Chip */}
                          <motion.div
                            initial={{ opacity: 0, scale: 0.7, rotate: 10 }}
                            animate={{ opacity: 1, scale: 1, y: [0, -4, 0], rotate: 4 }}
                            transition={{
                              opacity: { duration: 0.4, delay: 0.26 },
                              scale: { type: "spring", stiffness: 260, damping: 20, delay: 0.26 },
                              y: { duration: 5.1, repeat: Infinity, ease: "easeInOut", delay: 1.0 },
                            }}
                            className="absolute bottom-4 left-3 w-20 h-20 rounded-full bg-[#242824] border border-white/20 shadow-xl flex flex-col items-center justify-center text-center"
                          >
                            <div className="text-lg font-bold font-mono leading-none text-[#b7f357]">
                              {snapshot.calendarPatterns.bestGreenStreak.length}d
                            </div>
                            <div className="text-[9px] text-white/65 uppercase tracking-wider mt-1">Streak</div>
                          </motion.div>

                          {/* Bottom-Right Best Day Chip */}
                          {bestWeekday && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                              animate={{ opacity: 1, scale: 1, y: [0, -5, 0], rotate: -5 }}
                              transition={{
                                opacity: { duration: 0.4, delay: 0.32 },
                                scale: { type: "spring", stiffness: 260, damping: 20, delay: 0.32 },
                                y: { duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1.2 },
                              }}
                              className="absolute bottom-6 right-2 max-w-[145px] overflow-hidden px-3 py-2 rounded-full bg-[#1a1c1a] border border-white/20 shadow-xl text-center"
                            >
                              <div className="text-[10px] text-white/55">Best Day</div>
                              <div className="text-xs font-bold text-white truncate">
                                {bestWeekday.day} · {bestWeekday.attendPct}%
                              </div>
                            </motion.div>
                          )}
                        </div>

                        <motion.p
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: 0.36 }}
                          className="text-xs text-white/65"
                        >
                          {copy.phaseRoast}
                        </motion.p>
                      </>
                    );
                  })()}

                  {/* SLIDE 1: TIMELINE SO FAR & FORECAST */}
                  {currentSlide === 1 && (() => {
                    const ringR = 85;
                    const ringC = 2 * Math.PI * ringR;
                    const ringOffset = ringC * (1 - Math.min(100, Math.max(0, snapshot.totals.percentage)) / 100);
                    const pctDisplay = `${snapshot.totals.percentage}%`;
                    const isLongPct = pctDisplay.length >= 6;
                    return (
                      <>
                        <motion.div
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4 }}
                          className="space-y-1.5"
                        >
                          <div className="text-[11px] font-mono uppercase tracking-wider text-lime-200/80">
                            CONDUCTED SO FAR: {snapshot.totals.conducted} / ~{snapshot.forecast.totalForecastedClasses}
                          </div>
                          <h2 className="text-3xl font-bold leading-tight">
                            You showed up to <span className="font-mono">{snapshot.totals.present}</span> classes.
                          </h2>
                          <p className="text-xs text-white/75">{copy.phaseRoast}</p>
                        </motion.div>

                        <div className="my-auto py-4 space-y-5">
                          <motion.div
                            initial={{ opacity: 0, scale: 0.88 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: "spring", stiffness: 240, damping: 20, delay: 0.1 }}
                            className="flex justify-center"
                          >
                            <div className="relative w-48 h-48 sm:w-52 sm:h-52 px-6 flex flex-col items-center justify-center rounded-full bg-black/25 shadow-2xl text-center">
                              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 196 196">
                                <circle
                                  cx="98"
                                  cy="98"
                                  r={ringR}
                                  fill="none"
                                  stroke="rgba(190,242,100,0.18)"
                                  strokeWidth="10"
                                />
                                <motion.circle
                                  cx="98"
                                  cy="98"
                                  r={ringR}
                                  fill="none"
                                  stroke="#b7f357"
                                  strokeWidth="10"
                                  strokeLinecap="round"
                                  strokeDasharray={ringC}
                                  initial={{ strokeDashoffset: ringC }}
                                  animate={{ strokeDashoffset: ringOffset }}
                                  transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1], delay: 0.18 }}
                                />
                              </svg>
                              <span
                                className={`${
                                  isLongPct ? "text-2xl sm:text-[28px]" : "text-3xl sm:text-4xl"
                                } font-extrabold font-mono tracking-tight leading-none relative z-10 tabular-nums whitespace-nowrap`}
                              >
                                {pctDisplay}
                              </span>
                              <span className="text-[11px] font-mono text-lime-200 mt-1.5 relative z-10 whitespace-nowrap">
                                Target {snapshot.totals.targetPercentage}%
                              </span>
                            </div>
                          </motion.div>

                          <motion.div
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.42, delay: 0.22 }}
                            className="rounded-2xl bg-black/30 border border-white/12 p-4 space-y-2.5"
                          >
                            <div className="flex justify-between text-xs font-mono">
                              <span>Semester Progress</span>
                              <span className="text-[#b7f357]">{snapshot.forecast.timelineProgressPct}%</span>
                            </div>
                            <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                              <motion.div
                                className="h-full bg-[#b7f357] rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${snapshot.forecast.timelineProgressPct}%` }}
                                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.28 }}
                              />
                            </div>
                            <div className="grid grid-cols-3 gap-2 pt-1 text-center text-xs">
                              <div className="p-2 rounded-xl bg-white/5">
                                <div className="font-bold font-mono">{snapshot.forecast.remainingClasses}</div>
                                <div className="text-[10px] text-white/55">Classes Left</div>
                              </div>
                              <div className="p-2 rounded-xl bg-white/5">
                                <div className="font-bold font-mono text-lime-300">{snapshot.forecast.maxSafeBunksAcrossRemaining}</div>
                                <div className="text-[10px] text-white/55">Safe Bunks</div>
                              </div>
                              <div className="p-2 rounded-xl bg-white/5">
                                <div className="font-bold font-mono">{snapshot.forecast.projectedIfAttendAll}%</div>
                                <div className="text-[10px] text-white/55">Max Ceiling</div>
                              </div>
                            </div>
                          </motion.div>
                        </div>

                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.36 }}
                          className="text-xs text-white/75"
                        >
                          {copy.totalHeadline}
                        </motion.p>
                      </>
                    );
                  })()}

                  {/* SLIDE 2: UPCOMING FESTS, BREAKS & EXAMINATIONS */}
                  {currentSlide === 2 && (
                    <>
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="space-y-1.5"
                      >
                        <div className="text-[11px] font-mono uppercase tracking-wider text-amber-200/80">
                          WHAT MORE IS LEFT
                        </div>
                        <h2 className="text-3xl font-bold leading-tight">
                          Fests, breaks & <span className="text-amber-300">exams</span> ahead.
                        </h2>
                      </motion.div>

                      <div className="space-y-3 my-auto py-3">
                        <motion.div
                          initial={{ opacity: 0, x: -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.42, delay: 0.1 }}
                          className="rounded-2xl bg-white/[0.06] border border-white/10 p-3.5 space-y-2"
                        >
                          <div className="text-[10px] font-mono uppercase text-[#b7f357] flex items-center gap-1.5">
                            <PartyPopper className="w-3.5 h-3.5" /> Fests & Breaks Coming In
                          </div>
                          {snapshot.upcomingHorizon.festsAndBreaks.length > 0 ? (
                            snapshot.upcomingHorizon.festsAndBreaks.slice(0, 3).map((e, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.16 + i * 0.06 }}
                                className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0"
                              >
                                <span className="font-semibold truncate pr-2">{e.title}</span>
                                <span className="font-mono text-lime-200 shrink-0">In {e.daysLeft}d</span>
                              </motion.div>
                            ))
                          ) : (
                            <p className="text-xs text-white/55">No upcoming breaks left — sprint straight to exams.</p>
                          )}
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, x: 16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.42, delay: 0.22 }}
                          className="rounded-2xl bg-rose-500/10 border border-rose-400/25 p-3.5 space-y-2"
                        >
                          <div className="text-[10px] font-mono uppercase text-rose-200 flex items-center gap-1.5">
                            <GraduationCap className="w-3.5 h-3.5" /> Incoming Examinations
                          </div>
                          {snapshot.upcomingHorizon.exams.length > 0 ? (
                            snapshot.upcomingHorizon.exams.slice(0, 3).map((e, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.26 + i * 0.06 }}
                                className="flex items-center justify-between text-xs py-1 border-b border-white/10 last:border-0"
                              >
                                <span className="font-semibold truncate pr-2">{e.title}</span>
                                <span className="font-mono text-rose-200 shrink-0">In {e.daysLeft}d</span>
                              </motion.div>
                            ))
                          ) : (
                            <p className="text-xs text-white/55">No exam events scheduled yet on Calendar.</p>
                          )}
                        </motion.div>
                      </div>

                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.35 }}
                        className="text-xs text-white/65"
                      >
                        Post-Last Teaching Day alerts automatically mute timetable reminders and switch strictly to exam briefings.
                      </motion.p>
                    </>
                  )}

                  {/* SLIDE 3: TOP SUBJECTS (BitChord Featured #1 Hero + All Ranked Courses) */}
                  {currentSlide === 3 && (() => {
                    const heroSub = snapshot.subjectsRanked[0];
                    const restSubs = snapshot.subjectsRanked.slice(1);
                    const isDense = restSubs.length > 4;
                    return (
                      <>
                        <motion.div
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4 }}
                        >
                          <h2 className="text-2xl font-bold leading-tight">
                            Subjects ranked by showing up.
                          </h2>
                          <p className="text-xs text-white/65 mt-1">{copy.topSubjectCaption}</p>
                        </motion.div>

                        {heroSub && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.94, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ type: "spring", stiffness: 250, damping: 22, delay: 0.08 }}
                            className={`${isDense ? "my-2 p-3" : "my-2.5 p-4"} rounded-2xl bg-white/[0.08] border border-white/[0.15] flex items-center gap-3`}
                          >
                            <div className={`${isDense ? "w-14 h-14" : "w-16 h-16"} rounded-2xl bg-[#314209] border border-lime-300/35 flex flex-col items-center justify-center shrink-0`}>
                              <span className="font-mono text-xs font-bold text-[#b7f357]">{heroSub.pct}%</span>
                              <span className="text-[10px] text-white/75 font-mono">
                                {heroSub.present}/{heroSub.total}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] font-mono uppercase text-lime-300">
                                Rank #1 {heroSub.faculty ? `· ${heroSub.faculty}` : ""}
                              </div>
                              <div className="text-base font-bold text-white leading-tight mt-0.5 truncate">
                                {heroSub.name}
                              </div>
                              <div className="text-[11px] text-white/55 mt-0.5">
                                {heroSub.absent === 0 ? "0 misses all semester" : `${heroSub.absent} missed`} · {heroSub.off} off
                              </div>
                            </div>
                          </motion.div>
                        )}

                        <div
                          data-interactive={restSubs.length > 7 ? "true" : undefined}
                          className={`${isDense ? "space-y-1" : "space-y-2"} flex-1 overflow-y-auto pr-1 min-h-0`}
                        >
                          {restSubs.map((s, idx) => (
                            <motion.div
                              key={s.id}
                              initial={{ opacity: 0, x: -18 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.32, delay: Math.min(0.45, 0.12 + idx * 0.045) }}
                              className={`flex items-center gap-2.5 ${isDense ? "py-1.5" : "py-2"} border-b border-white/[0.08] last:border-0`}
                            >
                              <span className="w-5 font-mono text-xs font-bold text-white/45 shrink-0">#{s.rank}</span>
                              <span className={`${isDense ? "w-8 h-8 text-[9.5px]" : "w-9 h-9 text-[10px]"} rounded-full bg-white/10 font-mono font-bold flex items-center justify-center shrink-0 text-white/90`}>
                                {(s.code || s.name).replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase()}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className={`${isDense ? "text-[13px]" : "text-sm"} font-semibold text-white truncate`}>{s.name}</div>
                                <div className="text-[10.5px] text-white/50 font-mono truncate">
                                  {s.present}/{s.total} classes {s.faculty ? `· ${s.faculty}` : ""}
                                </div>
                              </div>
                              <span className="font-mono text-xs font-bold text-[#b7f357] shrink-0">{s.pct}%</span>
                            </motion.div>
                          ))}
                        </div>

                        <div className="text-xs text-white/60 pt-1.5 shrink-0">
                          All {snapshot.subjectsRanked.length} active courses ranked this semester.
                        </div>
                      </>
                    );
                  })()}

                  {/* SLIDE 4: PROGRESSING MONTHLY TIMELINE (Auto-hovering dots one by one) */}
                  {currentSlide === 4 && (() => {
                    const monthsList = snapshot.months;
                    const monthCoords = monthsList.map((m, i) => ({
                      m,
                      i,
                      x: monthsList.length === 1 ? 150 : 24 + (i / (monthsList.length - 1)) * 252,
                      y: 85 - (Math.max(0, m.pct) / 100) * 65,
                    }));
                    return (
                    <>
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="flex items-start justify-between gap-2"
                      >
                        <div>
                          <div className="text-[10.5px] font-mono uppercase text-amber-200/80">
                            PROGRESSING TIMELINE · MONTH BY MONTH
                          </div>
                          <h2 className="text-2xl font-bold mt-1">{copy.monthlyArcCaption}</h2>
                        </div>
                        {monthsList.length > 0 && (
                          <span className="px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-300/30 font-mono text-[10px] text-amber-200 shrink-0">
                            {monthsList[selectedMonthIdx]?.label || ""} · {selectedMonthIdx + 1}/{monthsList.length}
                          </span>
                        )}
                      </motion.div>

                      {monthsList.length > 0 && (
                        <div className="space-y-3 my-auto py-2">
                          <motion.div
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.45, delay: 0.08 }}
                            className="rounded-2xl bg-black/30 border border-white/10 p-3"
                          >
                            <svg viewBox="0 0 300 105" className="w-full h-24 overflow-visible">
                              {/* Full dim baseline track */}
                              <polyline
                                fill="none"
                                stroke="rgba(245,158,11,0.2)"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points={monthCoords.map((p) => `${p.x},${p.y.toFixed(1)}`).join(" ")}
                              />

                              {/* Segment-by-segment progressive amber line up to active timeline dot */}
                              {monthCoords.slice(0, -1).map((p, i) => {
                                const next = monthCoords[i + 1];
                                const reached = selectedMonthIdx >= i + 1;
                                return (
                                  <motion.line
                                    key={`seg-${p.m.monthIso}`}
                                    x1={p.x}
                                    y1={p.y}
                                    x2={next.x}
                                    y2={next.y}
                                    stroke="#fbbf24"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    initial={{ pathLength: 0, opacity: 0.25 }}
                                    animate={{
                                      pathLength: reached ? 1 : 0,
                                      opacity: reached ? 1 : 0.2,
                                    }}
                                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                                  />
                                );
                              })}

                              {monthCoords.map(({ m, i, x, y }) => {
                                const active = i === selectedMonthIdx;
                                const visited = i <= selectedMonthIdx;
                                return (
                                  <g
                                    key={m.monthIso}
                                    onMouseEnter={() => {
                                      setIsMonthHovering(true);
                                      setSelectedMonthIdx(i);
                                    }}
                                    onMouseLeave={() => setIsMonthHovering(false)}
                                    onClick={() => {
                                      setSelectedMonthIdx(i);
                                      setIsPaused(true);
                                    }}
                                    style={{ cursor: "pointer" }}
                                  >
                                    {active && (
                                      <motion.circle
                                        cx={x}
                                        cy={y}
                                        fill="rgba(251,191,36,0.22)"
                                        stroke="rgba(251,191,36,0.6)"
                                        strokeWidth="1.5"
                                        initial={{ r: 8, opacity: 0.7 }}
                                        animate={{ r: [9, 14, 9], opacity: [0.65, 0.12, 0.65] }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                      />
                                    )}
                                    <motion.circle
                                      cx={x}
                                      cy={y}
                                      r={active ? 6.5 : 4.5}
                                      fill={active ? "#fbbf24" : visited ? "#f59e0b" : "#1c1410"}
                                      stroke={visited ? "#fbbf24" : "rgba(251,191,36,0.45)"}
                                      strokeWidth={active ? 2.5 : 2}
                                      animate={{ scale: active ? 1.18 : 1 }}
                                      transition={{ type: "spring", stiffness: 320, damping: 20 }}
                                    />
                                    <text
                                      x={x}
                                      y={y - 11}
                                      textAnchor="middle"
                                      fill={active ? "#ffffff" : visited ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)"}
                                      fontSize={active ? "10.5" : "9"}
                                      fontWeight={active ? "700" : "500"}
                                      fontFamily="monospace"
                                    >
                                      {m.pct}%
                                    </text>
                                    <text
                                      x={x}
                                      y="102"
                                      textAnchor="middle"
                                      fill={active ? "#fbbf24" : visited ? "rgba(255,255,255,0.8)" : "#777"}
                                      fontSize="9.5"
                                      fontWeight={active ? "700" : "500"}
                                    >
                                      {m.label}
                                    </text>
                                  </g>
                                );
                              })}
                            </svg>
                          </motion.div>

                          {/* Month Timeline Step Chips */}
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="flex gap-1.5 justify-between"
                          >
                            {snapshot.months.map((m, i) => {
                              const active = i === selectedMonthIdx;
                              const passed = i < selectedMonthIdx;
                              return (
                                <button
                                  key={m.monthIso}
                                  onMouseEnter={() => {
                                    setIsMonthHovering(true);
                                    setSelectedMonthIdx(i);
                                  }}
                                  onMouseLeave={() => setIsMonthHovering(false)}
                                  onClick={() => {
                                    setSelectedMonthIdx(i);
                                    setIsPaused(true);
                                  }}
                                  className={`flex-1 py-1.5 rounded-xl text-[11px] font-mono font-semibold cursor-pointer transition-all duration-300 border ${
                                    active
                                      ? "bg-amber-400 text-black border-amber-300 scale-[1.04] shadow-md"
                                      : passed
                                        ? "bg-amber-400/20 text-amber-200 border-amber-300/35"
                                        : "bg-black/25 text-white/60 border-white/10 hover:bg-white/10"
                                  }`}
                                >
                                  {m.label}
                                </button>
                              );
                            })}
                          </motion.div>

                          {activeMonth && (
                            <AnimatePresence mode="wait">
                              <motion.div
                                key={activeMonth.monthIso}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.25 }}
                                className="rounded-2xl bg-black/35 border border-amber-300/25 p-3.5 space-y-2"
                              >
                                <div className="flex justify-between items-center gap-2 text-xs">
                                  <span className="font-bold min-w-0 truncate">
                                    {activeMonth.key} {activeMonth.isPerfectMonth ? "★ 100% Month" : ""}
                                  </span>
                                  <span className="font-mono text-amber-300 shrink-0">
                                    {activeMonth.present}p · {activeMonth.absent}a · {activeMonth.off} off
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {activeMonth.remarks.length > 0 ? (
                                    activeMonth.remarks.map((r) => (
                                      <span key={r.text} className="px-2 py-0.5 rounded-full bg-white/10 text-[11px] font-mono">
                                        {r.text} ×{r.count}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[11px] text-white/55">Clean attendance month — no remarks logged.</span>
                                  )}
                                </div>
                              </motion.div>
                            </AnimatePresence>
                          )}
                        </div>
                      )}
                      <div />
                    </>
                    );
                  })()}

                  {/* SLIDE 5: CALENDAR STREAKS — 100% DAYS, MIXED PURPLE DOT DAYS & MAZE HI MAZE */}
                  {currentSlide === 5 && (
                    <>
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="space-y-1.5"
                      >
                        <div className="text-[11px] font-mono uppercase text-purple-200/80">CALENDAR DOT SIGNATURE</div>
                        <h2 className="text-3xl font-bold leading-tight">
                          Green streaks, <span className="text-purple-300">purple mixed dots</span> & free days.
                        </h2>
                      </motion.div>

                      <div className="space-y-3 my-auto py-3">
                        <motion.div
                          initial={{ opacity: 0, x: -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.08 }}
                          className="p-3.5 rounded-2xl bg-black/30 border border-emerald-400/25 flex items-center justify-between gap-3 overflow-hidden"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 shrink-0" />
                            <div className="min-w-0">
                              <div className="text-sm font-bold truncate">100% Green Days & Streak</div>
                              <div className="text-xs text-white/60 break-words">
                                {snapshot.calendarPatterns.perfectMonths.length > 0
                                  ? `100% Months: ${snapshot.calendarPatterns.perfectMonths.join(", ")}`
                                  : `${snapshot.calendarPatterns.perfectDaysCount} full attendance days`}
                              </div>
                            </div>
                          </div>
                          <span className="text-xl font-bold font-mono text-emerald-300 shrink-0">
                            {snapshot.calendarPatterns.bestGreenStreak.length}d
                          </span>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, x: -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.16 }}
                          className="p-3.5 rounded-2xl bg-black/30 border border-purple-400/35 flex items-center justify-between gap-3 overflow-hidden"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="w-3.5 h-3.5 rounded-full bg-purple-400 shrink-0" />
                            <div className="min-w-0">
                              <div className="text-sm font-bold truncate">Mixed Purple-Dot Days</div>
                              <div className="text-xs text-white/60 break-words">
                                Attended half the schedule, skipped the rest · streak of {snapshot.calendarPatterns.bestMixedPurpleStreak.length}d
                              </div>
                            </div>
                          </div>
                          <span className="text-xl font-bold font-mono text-purple-300 shrink-0">
                            {snapshot.calendarPatterns.mixedPurpleDaysCount}
                          </span>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, x: -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.24 }}
                          className="p-3.5 rounded-2xl bg-black/30 border border-amber-400/30 flex items-center justify-between gap-3 overflow-hidden"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="w-3.5 h-3.5 rounded-full bg-amber-400 shrink-0" />
                            <div className="min-w-0">
                              <div className="text-sm font-bold truncate">Full-Day Cancelled</div>
                              <div className="text-xs text-white/60 break-words">
                                {snapshot.calendarPatterns.fullCancelledDaysCount > 0
                                  ? "Maze hi maze — every single class off!"
                                  : "Not a single full-day cancellation yet."}
                              </div>
                            </div>
                          </div>
                          <span className="text-xl font-bold font-mono text-amber-300 shrink-0">
                            {snapshot.calendarPatterns.fullCancelledDaysCount}
                          </span>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.32 }}
                          className="grid grid-cols-2 gap-2.5 pt-1"
                        >
                          <div className="p-3 rounded-2xl bg-black/30 border border-white/12">
                            <div className="text-[10px] font-mono uppercase text-white/55">Unmarked Days</div>
                            <div className="text-lg font-bold font-mono text-white mt-0.5">
                              {snapshot.unmarked?.daysCount ?? 0}d
                            </div>
                            <div className="text-[10px] text-white/55">
                              {snapshot.unmarked?.daysCount
                                ? `${snapshot.unmarked.slotsCount} unlogged slots`
                                : "Clean 100% logging"}
                            </div>
                          </div>
                          <div className="p-3 rounded-2xl bg-black/30 border border-amber-400/25">
                            <div className="text-[10px] font-mono uppercase text-white/55">Extra Class</div>
                            <div className="text-lg font-bold font-mono text-amber-300 mt-0.5">
                              {snapshot.extraClasses?.missed
                                ? `${snapshot.extraClasses.missed} Missed`
                                : `${snapshot.extraClasses?.total ?? 0} Logged`}
                            </div>
                            <div className="text-[10px] text-white/55 truncate">
                              {snapshot.extraClasses?.missed
                                ? snapshot.extraClasses.missedSamples[0]?.subjectName || "Missed bonus slot"
                                : "No extra class missed"}
                            </div>
                          </div>
                        </motion.div>
                      </div>

                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.38 }}
                        className="text-xs text-white/70"
                      >
                        {copy.cancelledDayLine}
                      </motion.p>
                    </>
                  )}

                  {/* SLIDE 6: CLASS MISSING PATTERN (Animated Progress Bars + BEST/PEAK MISS + Risk Slots) */}
                  {currentSlide === 6 && (() => {
                    const bestDay = [...snapshot.missingPatterns.weekdays].sort((a, b) => b.attendPct - a.attendPct)[0]?.day;
                    const worstDay = [...snapshot.missingPatterns.weekdays].sort((a, b) => b.missPct - a.missPct)[0]?.day;
                    return (
                      <>
                        <motion.div
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4 }}
                        >
                          <h2 className="text-2xl font-bold leading-tight">{copy.missingPatternHeadline}</h2>
                        </motion.div>

                        <div className="space-y-2.5 my-auto py-2">
                          {snapshot.missingPatterns.weekdays.map((w, idx) => {
                            const isBest = w.day === bestDay;
                            const isPeakMiss = w.day === worstDay && w.missPct > 0;
                            return (
                              <motion.div
                                key={w.day}
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.08 + idx * 0.06 }}
                                className="space-y-1"
                              >
                                <div className="flex justify-between items-center gap-2 text-xs font-mono">
                                  <span className="font-semibold text-white flex items-center gap-1.5 min-w-0">
                                    <span className="truncate">{w.day}</span>
                                    {isBest && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-lime-400/20 text-lime-300 shrink-0">
                                        BEST
                                      </span>
                                    )}
                                    {isPeakMiss && !isBest && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200 shrink-0">
                                        PEAK MISS
                                      </span>
                                    )}
                                  </span>
                                  <span className="shrink-0">
                                    {w.attendPct}% <span className="text-white/50">({w.missPct}% miss)</span>
                                  </span>
                                </div>
                                <div className="h-2 rounded-full bg-black/35 overflow-hidden">
                                  <motion.div
                                    className={`h-full rounded-full ${isPeakMiss && !isBest ? "bg-amber-400" : "bg-[#b7f357]"}`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${w.attendPct}%` }}
                                    transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1], delay: 0.14 + idx * 0.06 }}
                                  />
                                </div>
                              </motion.div>
                            );
                          })}

                          {snapshot.missingPatterns.timeSlots.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.36 }}
                              className="rounded-2xl bg-black/30 border border-white/10 p-3 mt-3"
                            >
                              <div className="text-[10px] font-mono uppercase text-white/60 mb-2 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" /> Highest-Risk Time Slots
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {snapshot.missingPatterns.timeSlots.slice(0, 4).map((t) => (
                                  <div key={t.slot} className="p-2 rounded-xl bg-white/[0.06] flex items-center justify-between gap-1.5 text-xs font-mono overflow-hidden">
                                    <span className="min-w-0 truncate">{t.slot}</span>
                                    <span className="text-amber-300 font-bold shrink-0">{t.missPct}% miss</span>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </div>
                        <div />
                      </>
                    );
                  })()}

                  {/* SLIDE 7: AUTO-PLAYING REMARKS ROAST DECK (All Logged Remarks) */}
                  {currentSlide === 7 && (() => {
                    const displayRemarks = snapshot.remarksTape;
                    const focusedRemark =
                      displayRemarks[activeRemarkIdx]?.text ||
                      selectedRemarkText ||
                      snapshot.remarksTape[0]?.text ||
                      "Clean Record";
                    const roastText =
                      copy?.remarkQuips?.[focusedRemark] ||
                      buildLocalRemarkQuip(focusedRemark, snapshot.totals.percentage);
                    return (
                      <>
                        <motion.div
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4 }}
                          className="flex items-start justify-between gap-2"
                        >
                          <div>
                            <div className="text-[10.5px] font-mono uppercase tracking-wider text-rose-200/80">
                              REMARKS ARCHIVE
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-bold leading-tight mt-1">
                              Every excuse you logged, <span className="text-rose-300">roasted.</span>
                            </h2>
                          </div>
                          {displayRemarks.length > 0 && (
                            <span className="px-2.5 py-1 rounded-full bg-rose-400/15 border border-rose-300/30 font-mono text-[10px] text-rose-200 shrink-0">
                              {String(activeRemarkIdx + 1).padStart(2, "0")} / {String(displayRemarks.length).padStart(2, "0")}
                            </span>
                          )}
                        </motion.div>

                        <div className="space-y-3 my-auto py-3 min-h-0 flex flex-col">
                          {displayRemarks.length > 0 ? (
                            <div
                              data-interactive={displayRemarks.length > 5 ? "true" : undefined}
                              className="space-y-1.5 max-h-[260px] sm:max-h-[310px] overflow-y-auto pr-1"
                            >
                              {displayRemarks.map((r, i) => {
                                const isActive = i === activeRemarkIdx;
                                return (
                                  <motion.button
                                    key={r.text}
                                    id={`wrap-remark-row-${i}`}
                                    onClick={() => {
                                      setActiveRemarkIdx(i);
                                      setSelectedRemarkText(r.text);
                                      wrapAudio.playCardSweep(i);
                                    }}
                                    initial={{ opacity: 0, x: -14 }}
                                    animate={{
                                      opacity: isActive ? 1 : 0.72,
                                      x: 0,
                                      scale: isActive ? 1.01 : 1,
                                    }}
                                    transition={{ duration: 0.28, delay: Math.min(0.4, 0.04 * i) }}
                                    className={`w-full px-3 py-2 rounded-xl flex items-center justify-between text-xs font-mono border cursor-pointer transition ${
                                      isActive
                                        ? "bg-rose-400/20 text-white border-rose-300 shadow-lg"
                                        : "bg-black/30 text-white/80 border-white/10 hover:bg-black/45"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <span className={`text-[10px] ${isActive ? "text-rose-200 font-bold" : "text-rose-300/60"}`}>
                                        {String(i + 1).padStart(2, "0")}
                                      </span>
                                      <span className="font-semibold truncate">"{r.text}"</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-[10px] text-white/45 hidden sm:inline">
                                        {r.sampleSubject?.split(" ").slice(0, 2).join(" ")}
                                      </span>
                                      <span
                                        className={`px-2 py-0.5 rounded-full font-bold text-[10.5px] ${
                                          isActive ? "bg-rose-400 text-black" : "bg-white/12 text-white"
                                        }`}
                                      >
                                        {r.count}×
                                      </span>
                                    </div>
                                  </motion.button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-xs text-white/60">No custom remarks logged yet this semester.</div>
                          )}

                          <AnimatePresence mode="wait">
                            <motion.div
                              key={focusedRemark}
                              initial={{ opacity: 0, y: 10, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -8, scale: 0.98 }}
                              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                              className="rounded-2xl bg-black/45 border border-rose-300/35 p-3.5 space-y-1.5"
                            >
                              <div className="text-[10px] font-mono uppercase text-rose-300 flex items-center justify-between gap-2">
                                <span className="min-w-0 truncate">ROASTING: "{focusedRemark}"</span>
                                <span className="shrink-0">
                                  {displayRemarks[activeRemarkIdx]?.sampleDate || "Semester Log"}
                                </span>
                              </div>
                              <p className="text-sm text-rose-50 leading-relaxed break-words">{roastText}</p>
                            </motion.div>
                          </AnimatePresence>
                        </div>
                        <div />
                      </>
                    );
                  })()}

                  {/* SLIDE 8: PERSONA & BIT-CHORD POSTER */}
                  {currentSlide === 8 && (
                    <>
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-mono uppercase text-white/55 truncate">
                            {copy.archetypeBadge}
                          </div>
                          <h2 className="text-2xl font-bold leading-tight break-words">{copy.archetypeTitle}</h2>
                        </div>
                        {avatarUrl && !avatarFailed && (
                          <motion.img
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 250, damping: 18, delay: 0.1 }}
                            src={avatarUrl}
                            alt={snapshot.user.name}
                            referrerPolicy="no-referrer"
                            onError={() => setAvatarFailed(true)}
                            className="w-12 h-12 rounded-full object-cover border border-white/25 shrink-0"
                          />
                        )}
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, scale: 0.94, y: 14 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.45, delay: 0.14 }}
                        className="rounded-3xl p-4 bg-black/40 border border-white/15 space-y-3 my-auto overflow-hidden"
                      >
                        <div className="grid grid-cols-2 gap-3 pb-3 border-b border-white/10">
                          <div>
                            <div className="text-[10px] text-white/55 uppercase">So Far</div>
                            <div className="text-3xl font-bold font-mono text-[#b7f357]">{snapshot.totals.percentage}%</div>
                            <div className="text-[11px] text-white/60 font-mono">
                              {snapshot.totals.present}/{snapshot.totals.conducted} classes
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-white/55 uppercase">Remaining</div>
                            <div className="text-3xl font-bold font-mono text-white">{snapshot.forecast.remainingClasses}</div>
                            <div className="text-[11px] text-white/60 font-mono">
                              {snapshot.forecast.maxSafeBunksAcrossRemaining} safe bunks
                            </div>
                          </div>
                        </div>

                        <p className="font-instrument italic text-lg text-white/90 leading-snug break-words">
                          "{copy.oneLiner}"
                        </p>

                        <div className="pt-2.5 border-t border-white/10 flex items-center justify-between gap-4 text-xs">
                          <span className="font-extrabold tracking-tight text-base shrink-0">AttendX</span>
                          <span className="font-mono text-[11px] text-white/55 min-w-0 flex-1 text-right break-words leading-snug">
                            {copy.finaleLine}
                          </span>
                        </div>
                      </motion.div>

                      <motion.button
                        type="button"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.28 }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onPointerUp={(e) => e.stopPropagation()}
                        onClick={(e) => openShareModal(e)}
                        className="w-full py-3.5 rounded-2xl bg-white text-black font-bold text-xs cursor-pointer hover:bg-white/90 transition"
                      >
                        Create Share Card →
                      </motion.button>
                    </>
                  )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="max-w-lg w-full mx-auto px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] flex items-center justify-between z-30">
              <div className="flex items-center gap-2 text-xs font-mono text-white/65">
                <span>
                  {String(currentStoryPos + 1).padStart(2, "0")} / {String(activeSlides.length).padStart(2, "0")}
                </span>
                <span>·</span>
                <button type="button" onClick={togglePause} className="underline text-white cursor-pointer flex items-center gap-1">
                  {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                  <span>{isPaused ? "Resume" : "Pause"}</span>
                </button>
              </div>

              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={(e) => openShareModal(e)}
                className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 backdrop-blur-md flex items-center justify-center cursor-pointer transition shadow-lg"
                aria-label="Share current wrap"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>,
          document.body,
        )}

      <WrapShareSheet
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        snapshot={snapshot}
        copy={copy}
        slideIndex={shareSnapshotSlide}
        storyPosition={Math.max(1, activeSlides.findIndex((s) => s.id === shareSnapshotSlide) + 1)}
        totalSlides={Math.max(1, activeSlides.length)}
        selectedRemark={shareSnapshotRemark}
        selectedMonthIdx={shareSnapshotMonthIdx}
      />
    </div>
  );
};
