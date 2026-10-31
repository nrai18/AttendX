import React, { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { CalendarDays, Table, BookOpen, Settings, Calendar, LayoutDashboard, Sparkles, BarChart3, GraduationCap } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
import { hapticSelection, hapticMedium } from "../../utils/haptics";

const navItems = [
  {
    label: "Today",
    path: "/today",
    icon: CalendarDays,
    pillClass:
      "bg-purple-500/20 dark:bg-purple-500/25 border-purple-500/30 dark:border-purple-400/35 shadow-[0_4px_20px_rgba(168,85,247,0.22),inset_0_1px_1.5px_rgba(255,255,255,0.75)] dark:shadow-[0_4px_22px_rgba(168,85,247,0.34),inset_0_1px_1.5px_rgba(255,255,255,0.28)]",
    textClass: "text-purple-600 dark:text-purple-300",
    rimClass: "via-purple-300/90 dark:via-purple-300/70",
    grabberClass: "bg-purple-500/45 dark:bg-purple-400/45",
  },
  {
    label: "Timetable",
    path: "/timetable",
    icon: Table,
    pillClass:
      "bg-sky-500/20 dark:bg-sky-400/25 border-sky-500/30 dark:border-sky-400/35 shadow-[0_4px_20px_rgba(14,165,233,0.22),inset_0_1px_1.5px_rgba(255,255,255,0.75)] dark:shadow-[0_4px_22px_rgba(56,189,248,0.34),inset_0_1px_1.5px_rgba(255,255,255,0.28)]",
    textClass: "text-sky-600 dark:text-sky-300",
    rimClass: "via-sky-300/90 dark:via-sky-300/70",
    grabberClass: "bg-sky-500/45 dark:bg-sky-400/45",
  },
  {
    label: "Calendar",
    path: "/calendar",
    icon: Calendar,
    pillClass:
      "bg-orange-500/20 dark:bg-[#ff7657]/25 border-orange-500/30 dark:border-[#ff7657]/40 shadow-[0_4px_20px_rgba(249,115,22,0.22),inset_0_1px_1.5px_rgba(255,255,255,0.75)] dark:shadow-[0_4px_22px_rgba(255,118,87,0.34),inset_0_1px_1.5px_rgba(255,255,255,0.28)]",
    textClass: "text-orange-600 dark:text-[#ff8a70]",
    rimClass: "via-orange-300/90 dark:via-[#ff9e88]/70",
    grabberClass: "bg-orange-500/45 dark:bg-[#ff7657]/45",
  },
  {
    label: "Subjects",
    path: "/subjects",
    icon: BookOpen,
    pillClass:
      "bg-pink-500/20 dark:bg-pink-500/25 border-pink-500/30 dark:border-pink-400/35 shadow-[0_4px_20px_rgba(236,72,153,0.22),inset_0_1px_1.5px_rgba(255,255,255,0.75)] dark:shadow-[0_4px_22px_rgba(244,114,182,0.34),inset_0_1px_1.5px_rgba(255,255,255,0.28)]",
    textClass: "text-pink-600 dark:text-pink-300",
    rimClass: "via-pink-300/90 dark:via-pink-300/70",
    grabberClass: "bg-pink-500/45 dark:bg-pink-400/45",
  },
  {
    label: "Settings",
    path: "/settings",
    icon: Settings,
    pillClass:
      "bg-emerald-500/20 dark:bg-[#00ff88]/20 border-emerald-500/30 dark:border-[#00ff88]/35 shadow-[0_4px_20px_rgba(16,185,129,0.22),inset_0_1px_1.5px_rgba(255,255,255,0.75)] dark:shadow-[0_4px_22px_rgba(0,255,136,0.30),inset_0_1px_1.5px_rgba(255,255,255,0.28)]",
    textClass: "text-emerald-600 dark:text-[#00ff88]",
    rimClass: "via-emerald-300/90 dark:via-[#00ff88]/70",
    grabberClass: "bg-emerald-500/45 dark:bg-[#00ff88]/45",
  },
];

const dynamicSpecialItems = {
  semester: {
    label: "Semester",
    path: "/semester",
    icon: LayoutDashboard,
    pillClass:
      "bg-lime-500/20 dark:bg-[#a3e635]/25 border-lime-500/35 dark:border-[#a3e635]/40 shadow-[0_4px_20px_rgba(132,204,22,0.25),inset_0_1px_1.5px_rgba(255,255,255,0.75)] dark:shadow-[0_4px_22px_rgba(163,230,53,0.36),inset_0_1px_1.5px_rgba(255,255,255,0.28)]",
    textClass: "text-lime-700 dark:text-[#a3e635]",
    rimClass: "via-lime-300/90 dark:via-[#bef264]/75",
    grabberClass: "bg-lime-500/45 dark:bg-[#a3e635]/45",
  },
  predictive: {
    label: "Forecast",
    path: "/predictive",
    icon: Sparkles,
    pillClass:
      "bg-rose-500/20 dark:bg-[#ff4d6d]/25 border-rose-500/35 dark:border-[#ff4d6d]/40 shadow-[0_4px_20px_rgba(244,63,94,0.25),inset_0_1px_1.5px_rgba(255,255,255,0.75)] dark:shadow-[0_4px_22px_rgba(255,77,109,0.38),inset_0_1px_1.5px_rgba(255,255,255,0.28)]",
    textClass: "text-[#74313A] dark:text-[#ffb3c1]",
    rimClass: "via-rose-300/90 dark:via-[#ff8fa3]/75",
    grabberClass: "bg-rose-500/45 dark:bg-[#ff4d6d]/45",
  },
  reports: {
    label: "Reports",
    path: "/report",
    icon: BarChart3,
    pillClass:
      "bg-[#74313A]/20 dark:bg-[#EED3CF]/20 border-[#74313A]/35 dark:border-[#EED3CF]/35 shadow-[0_4px_20px_rgba(116,49,58,0.26),inset_0_1px_1.5px_rgba(255,255,255,0.75)] dark:shadow-[0_4px_22px_rgba(238,211,207,0.32),inset_0_1px_1.5px_rgba(255,255,255,0.28)]",
    textClass: "text-[#74313A] dark:text-[#EED3CF]",
    rimClass: "via-[#74313A]/65 dark:via-[#EED3CF]/70",
    grabberClass: "bg-[#74313A]/45 dark:bg-[#EED3CF]/45",
  },
  classrooms: {
    label: "Classroom",
    path: "/classrooms",
    icon: GraduationCap,
    pillClass:
      "bg-neutral-950/20 dark:bg-white/15 border-neutral-300/60 dark:border-white/25 shadow-[0_4px_20px_rgba(0,0,0,0.15),inset_0_1px_1.5px_rgba(255,255,255,0.75)] dark:shadow-[0_4px_22px_rgba(255,255,255,0.20),inset_0_1px_1.5px_rgba(255,255,255,0.25)]",
    textClass: "text-neutral-950 dark:text-white font-bold",
    rimClass: "via-neutral-400/80 dark:via-white/80",
    grabberClass: "bg-neutral-900/60 dark:bg-white/60",
  },
};

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isReports = location.pathname.startsWith("/report");
  const isSemester = location.pathname.startsWith("/semester");
  const isPredictive = location.pathname.startsWith("/predictive");
  const isClassrooms = location.pathname.startsWith("/classrooms");

  const activeNavItems = useMemo(() => {
    if (isSemester) return [...navItems, dynamicSpecialItems.semester];
    if (isPredictive) return [...navItems, dynamicSpecialItems.predictive];
    if (isReports) return [...navItems, dynamicSpecialItems.reports];
    if (isClassrooms) return [...navItems, dynamicSpecialItems.classrooms];
    return navItems;
  }, [isSemester, isPredictive, isReports, isClassrooms]);

  // Determine active index (including the single dynamic specialised pill when on /semester, /predictive, /report, or /classrooms)
  const currentIndex = useMemo(() => {
    if (isSemester || isPredictive || isReports || isClassrooms) {
      return activeNavItems.length - 1;
    }
    return activeNavItems.findIndex((item) =>
      location.pathname.startsWith(item.path)
    );
  }, [activeNavItems, isSemester, isPredictive, isReports, isClassrooms, location.pathname]);

  // Real-time gesture scrubbing & hover preview state
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const lastScrubIndexRef = useRef(currentIndex);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [optimisticIndex, setOptimisticIndex] = useState<number | null>(null);
  const [isPressing, setIsPressing] = useState(false);

  // Clear optimistic lock whenever route pathname changes so dynamic 6->5 transitions never point out of bounds
  useEffect(() => {
    setOptimisticIndex(null);
  }, [location.pathname]);

  // Visual target index smoothly previews hovered/scrubbed tab and holds dropped tab without 1-frame snapback
  const rawVisualIndex =
    hoveredIndex !== null
      ? hoveredIndex
      : optimisticIndex !== null
      ? optimisticIndex
      : currentIndex;
  const visualIndex =
    rawVisualIndex >= 0 && rawVisualIndex < activeNavItems.length
      ? rawVisualIndex
      : currentIndex;
  const activeVisualItem = visualIndex >= 0 ? activeNavItems[visualIndex] : null;

  // Calculate tab index from clientX coordinate
  const calculateIndexFromX = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return -1;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const clampedX = Math.max(0, Math.min(rect.width - 1, relativeX));
      const tabWidth = rect.width / activeNavItems.length;
      return Math.floor(clampedX / tabWidth);
    },
    [activeNavItems.length]
  );

  // Continuous pointer scrubbing & hover handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;

    isDraggingRef.current = true;
    setIsPressing(true);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if unsupported
    }

    const newIdx = calculateIndexFromX(e.clientX);
    if (newIdx !== -1) {
      lastScrubIndexRef.current = newIdx;
      setHoveredIndex(newIdx);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const newIdx = calculateIndexFromX(e.clientX);
    if (newIdx === -1) return;

    if (isDraggingRef.current) {
      if (newIdx !== lastScrubIndexRef.current) {
        hapticSelection();
        lastScrubIndexRef.current = newIdx;
        setHoveredIndex(newIdx);
      }
    } else if (e.pointerType === "mouse" || e.pointerType === "pen") {
      if (hoveredIndex !== newIdx) {
        setHoveredIndex(newIdx);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsPressing(false);

    const finalIdx = calculateIndexFromX(e.clientX);

    if (finalIdx !== -1 && activeNavItems[finalIdx]) {
      // If navigating from a dynamic 6th tab back to base tabs, don't lock optimistic index in 6-tab width
      if ((isSemester || isPredictive || isReports || isClassrooms) && finalIdx < 5) {
        setOptimisticIndex(null);
      } else {
        setOptimisticIndex(finalIdx);
      }
      if (finalIdx !== currentIndex) {
        hapticMedium();
        navigate(activeNavItems[finalIdx].path);
      }
    }

    if (e.pointerType !== "mouse") {
      setHoveredIndex(null);
    }

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  const handlePointerCancel = () => {
    isDraggingRef.current = false;
    setIsPressing(false);
    setHoveredIndex(null);
  };

  const handlePointerLeave = () => {
    if (!isDraggingRef.current) {
      setHoveredIndex(null);
    }
  };

  const navBg =
    isClassrooms
      ? "bg-white/95 dark:bg-[#08080a]/95 border-neutral-200 dark:border-white/10"
      : isReports || isPredictive
      ? "bg-[#EED3CF]/80 dark:bg-[#1A090C]/85 border-[#EED3CF]/40 dark:border-[#74313A]/40"
      : isSemester
      ? "bg-card/85 dark:bg-[#121216]/85 border-border/40"
      : "bg-white/75 dark:bg-[#121216]/85 border-white/40 dark:border-white/10";

  return (
    <div
      className="bottom-nav-shell fixed bottom-3.5 left-3 right-3 z-40 md:hidden max-w-md mx-auto pointer-events-none select-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeave}
        style={{ touchAction: "none" }}
        className={cn(
          "pointer-events-auto relative rounded-full px-2 py-1.5 transition-all duration-300",
          // iOS Liquid Glass Optical Recipe:
          "backdrop-blur-2xl backdrop-saturate-[190%]",
          "border shadow-[0_12px_36px_rgba(0,0,0,0.16),inset_0_1.5px_2px_rgba(255,255,255,0.7),inset_0_-1px_2px_rgba(0,0,0,0.08)]",
          "dark:shadow-[0_16px_44px_rgba(0,0,0,0.55),inset_0_1px_1.5px_rgba(255,255,255,0.18),inset_0_-1px_2px_rgba(0,0,0,0.3)]",
          navBg
        )}
      >
        {/* Specular Liquid Sheen Overlay */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none opacity-40 mix-blend-overlay"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.05) 50%, transparent 100%)",
          }}
        />

        <nav className="flex items-center justify-around h-13 relative z-10">
          {/* Persistent Single Sliding Liquid Glass Pill (GPU Transform + Smooth Drop Settle) */}
          {visualIndex >= 0 && activeVisualItem && (
            <motion.div
              initial={false}
              animate={{
                x: `${visualIndex * 100}%`,
                scaleX: isPressing ? 1.04 : 1,
                scaleY: isPressing ? 1.06 : 1,
                y: isPressing ? -1 : 0,
              }}
              transition={{
                x: {
                  type: "spring",
                  stiffness: 380,
                  damping: 32,
                  mass: 0.65,
                },
                scaleX: {
                  type: "spring",
                  stiffness: 460,
                  damping: 26,
                  mass: 0.5,
                },
                scaleY: {
                  type: "spring",
                  stiffness: 460,
                  damping: 26,
                  mass: 0.5,
                },
                y: {
                  type: "spring",
                  stiffness: 460,
                  damping: 26,
                  mass: 0.5,
                },
              }}
              style={{ width: `${100 / activeNavItems.length}%`, left: 0 }}
              className="absolute inset-y-0.5 px-1 pointer-events-none z-0 will-change-transform"
            >
              <div
                className={cn(
                  "w-full h-full rounded-full relative overflow-hidden",
                  "backdrop-blur-md border transition-[background-color,border-color,box-shadow] duration-250 ease-out",
                  activeVisualItem.pillClass
                )}
              >
                {/* Top Specular Rim Reflection */}
                <div
                  className={cn(
                    "absolute inset-x-3 top-0 h-[1px] bg-gradient-to-r from-transparent to-transparent pointer-events-none transition-colors duration-250",
                    activeVisualItem.rimClass
                  )}
                />
              </div>
            </motion.div>
          )}

          {activeNavItems.map((item, idx) => {
            const Icon = item.icon;
            const isHighlighted = visualIndex === idx;
            const isActive = currentIndex === idx;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={(e) => {
                  e.preventDefault();
                  if ((isSemester || isPredictive || isReports || isClassrooms) && idx < 5) {
                    setOptimisticIndex(null);
                  } else {
                    setOptimisticIndex(idx);
                  }
                  if (currentIndex !== idx) {
                    hapticSelection();
                    navigate(item.path);
                  }
                }}
                className="relative flex flex-col items-center justify-center flex-1 py-1 z-10"
              >
                {/* Smooth Animated Icon Container */}
                <motion.div
                  animate={{
                    scale: isHighlighted ? (isPressing ? 1.04 : 1.1) : 1,
                    y: isHighlighted ? -1.5 : 0,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 28,
                    mass: 0.7,
                  }}
                  className="p-1 rounded-full flex items-center justify-center"
                >
                  <Icon
                    className={cn(
                      "w-5 h-5 transition-colors duration-300 ease-out",
                      isHighlighted
                        ? item.textClass
                        : isActive
                        ? cn(item.textClass, "opacity-75")
                        : isReports || isPredictive
                        ? "text-[#74313A]/50 dark:text-[#EED3CF]/50"
                        : "text-muted-foreground/75"
                    )}
                  />
                </motion.div>

                {/* Label */}
                <span
                  className={cn(
                    "text-[10px] font-semibold mt-0.5 transition-colors duration-300 ease-out leading-none tracking-tight",
                    isHighlighted
                      ? cn(item.textClass, "font-bold")
                      : isActive
                      ? cn(item.textClass, "opacity-75")
                      : isReports || isPredictive
                      ? "text-[#74313A]/50 dark:text-[#EED3CF]/50"
                      : "text-muted-foreground/75"
                  )}
                >
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </nav>

        {/* Tactile iOS Liquid Glass Bottom Grabber */}
        <div
          className={cn(
            "w-8 h-1 rounded-full mx-auto mt-0.5 mb-0.5 transition-colors duration-300 ease-out",
            activeVisualItem
              ? activeVisualItem.grabberClass
              : "bg-foreground/20"
          )}
        />
      </div>
    </div>
  );
};
