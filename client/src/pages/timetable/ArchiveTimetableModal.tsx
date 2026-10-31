import React, { useState, useEffect } from "react";
import { X, Calendar as CalendarIcon, Clock, BookOpen, MapPin, Archive, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../../lib/api";
import { useCacheStore } from "../../stores/cacheStore";
import { hapticLight, hapticSelection, hapticHeavy } from "../../utils/haptics";
import { confirmDeleteToast } from "../../components/ui/confirm-delete-toast";
import { triggerDynamicHUD } from "../../components/ui/dynamic-island-hud";
import { SoundFX } from "../../utils/soundEffects";
import { format } from "date-fns";
import { useScrollLock } from "../../hooks/useScrollLock";

interface ArchiveTimetableModalProps {
  isOpen: boolean;
  onClose: () => void;
  semesterId: string;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const safeFormatDate = (dateVal: any, fallback = "Unknown Date") => {
  if (!dateVal) return fallback;
  try {
    const raw = String(dateVal).split("T")[0];
    const d = new Date(raw + "T00:00:00");
    if (isNaN(d.getTime())) return fallback;
    return format(d, "MMM d, yyyy");
  } catch {
    return fallback;
  }
};

export const ArchiveTimetableModal: React.FC<ArchiveTimetableModalProps> = ({ isOpen, onClose, semesterId }) => {
  useScrollLock(isOpen);
  const [versions, setVersions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [isClosePressed, setIsClosePressed] = useState(false);
  const [crumblingVersionId, setCrumblingVersionId] = useState<string | null>(null);
  const [isCascadingClear, setIsCascadingClear] = useState(false);

  const handleCloseWithFeedback = () => {
    if (isClosePressed) return;
    hapticLight();
    setIsClosePressed(true);
    setTimeout(() => {
      setIsClosePressed(false);
      onClose();
    }, 150);
  };

  useEffect(() => {
    if (isOpen) {
      setIsClosePressed(false);
      fetchArchivedVersions();
    }
  }, [isOpen, semesterId]);

  const getCachedVersions = (semId?: string) => {
    const cacheStore = useCacheStore.getState();
    const semKey = semId ? `archived_timetables_${semId}` : null;
    if (semKey && (cacheStore as any)[semKey] && Array.isArray((cacheStore as any)[semKey]) && (cacheStore as any)[semKey].length > 0) {
      return (cacheStore as any)[semKey];
    }
    if (cacheStore.archived_timetables && Array.isArray(cacheStore.archived_timetables) && cacheStore.archived_timetables.length > 0) {
      return cacheStore.archived_timetables;
    }
    if ((cacheStore.timetable as any)?.archivedSlots && Array.isArray((cacheStore.timetable as any).archivedSlots)) {
      return (cacheStore.timetable as any).archivedSlots;
    }
    return [];
  };

  const getEffectiveSemesterId = () => {
    let effective = semesterId || (useCacheStore.getState().timetable as any)?.activeSemester?.id;
    if (!effective || effective === "undefined" || effective === "null" || effective === "active") {
      effective = useCacheStore.getState().semester?.activeSemester?.id;
    }
    return effective;
  };

  const fetchArchivedVersions = async () => {
    let effectiveSemesterId = getEffectiveSemesterId();

    if (!effectiveSemesterId) {
      try {
        const activeSemRes = await api.get("/semesters/active");
        if (activeSemRes.data?.id) {
          effectiveSemesterId = activeSemRes.data.id;
        }
      } catch (err) {
        console.warn("Could not resolve active semester for archives:", err);
      }
    }

    // Load from offline cache first (both keys supported)
    const cached = getCachedVersions(effectiveSemesterId);
    if (cached.length > 0) {
      setVersions(cached);
      if (!selectedVersionId || !cached.some((v: any) => v.id === selectedVersionId)) {
        setSelectedVersionId(cached[0].id);
      }
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsLoading(false);
      return;
    }

    if (!effectiveSemesterId) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.get(`/timetable/semester/${effectiveSemesterId}/archived?force=true`);
      const newData = res.data || [];
      
      // Update cache
      useCacheStore.getState().setCache(`archived_timetables_${effectiveSemesterId}`, newData);
      useCacheStore.getState().setCache('archived_timetables', newData);
      const currentTtCache = useCacheStore.getState().timetable;
      if (currentTtCache) {
        useCacheStore.getState().setCache('timetable', {
          ...currentTtCache,
          archivedSlots: newData,
        });
      }
      
      setVersions(newData);
      if (newData.length > 0) {
        if (!selectedVersionId || !newData.some((v: any) => v.id === selectedVersionId)) {
          setSelectedVersionId(newData[0].id);
        }
      } else {
        setSelectedVersionId(null);
      }
    } catch (error) {
      console.error("Failed to load archived timetables:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteVersion = (version: any) => {
    if (!version || version.isCurrent || crumblingVersionId || isCascadingClear) return;

    SoundFX.warmUp();
    setSelectedVersionId(version.id);
    const effectiveSemesterId = getEffectiveSemesterId();
    const versionLabel = version.isCurrent ? "Current Timetable" : `Version ${version.versionNumber}`;
    const slotCount = version.slots?.length || 0;

    confirmDeleteToast({
      title: `Delete ${versionLabel}?`,
      description: "This archived timetable version will be permanently removed from your archive history.",
      itemName: `${versionLabel} (${slotCount} classes)`,
      confirmLabel: "Delete Version",
      cancelLabel: "Keep Version",
      icon: <Trash2 className="w-5 h-5 text-rose-500" />,
      onConfirm: async () => {
        setSelectedVersionId(version.id);
        setCrumblingVersionId(version.id);
        SoundFX.playPaperCrumpleSound();
        hapticHeavy();
        triggerDynamicHUD({
          type: "origami",
          label: "Origami Paper Crumble",
          subtitle: `${versionLabel} (${slotCount} classes) crumbled & compressed`,
          durationMs: 4500,
        });

        // Smoothly pan & scroll schedule preview container so user sees all day slots crumble
        requestAnimationFrame(() => {
          const container = document.getElementById("archive-modal-schedule-container");
          if (container) {
            container.scrollIntoView({ behavior: "smooth", block: "nearest" });
            container.scrollTo({ top: 0, behavior: "instant" });
            const totalScroll = container.scrollHeight - container.clientHeight;
            if (totalScroll > 0) {
              setTimeout(() => {
                container.scrollTo({ top: Math.round(totalScroll * 0.45), behavior: "smooth" });
              }, 1000);
              setTimeout(() => {
                container.scrollTo({ top: totalScroll, behavior: "smooth" });
              }, 2200);
            }
          }
        });

        const targetSlotIds = Array.isArray(version.slots) ? version.slots.map((s: any) => s.id) : [];
        const deleteReq = api
          .delete(`/timetable/semester/${effectiveSemesterId || "active"}/archived/${version.id}`, {
            data: { slotIds: targetSlotIds },
          })
          .catch((err) => {
            console.error("Failed to delete archived version:", err);
          });

        setTimeout(async () => {
          setVersions((prev) => {
            const updated = prev.filter((v) => v.id !== version.id);
            setSelectedVersionId((curr) => {
              if (curr === version.id) {
                return updated.length > 0 ? updated[0].id : null;
              }
              return curr;
            });
            return updated;
          });
          setCrumblingVersionId(null);

          const cacheStore = useCacheStore.getState();
          const remaining = (versions || []).filter((v) => v.id !== version.id);
          if (effectiveSemesterId) {
            cacheStore.setCache(`archived_timetables_${effectiveSemesterId}`, remaining);
          }
          cacheStore.setCache("archived_timetables", remaining);
          const currentTtCache = cacheStore.timetable;
          if (currentTtCache) {
            cacheStore.setCache("timetable", {
              ...currentTtCache,
              archivedSlots: remaining,
            });
          }

          await deleteReq;
          window.dispatchEvent(new CustomEvent("timetable-updated"));
        }, 3850);
      },
    });
  };

  const handleClearAllArchives = () => {
    const historical = versions.filter((v) => !v.isCurrent);
    if (historical.length === 0 || crumblingVersionId || isCascadingClear) return;

    SoundFX.warmUp();
    const currentSel = versions.find((v) => v.id === selectedVersionId);
    const previewHistorical = !currentSel || currentSel.isCurrent ? historical[0] : currentSel;
    if (previewHistorical) {
      setSelectedVersionId(previewHistorical.id);
    }

    const effectiveSemesterId = getEffectiveSemesterId();

    confirmDeleteToast({
      title: "Delete All Archived Timetables?",
      description: "All historical timetable versions will be permanently removed from your archive history.",
      itemName: `${historical.length} archived version${historical.length > 1 ? "s" : ""}`,
      confirmLabel: "Delete All",
      cancelLabel: "Keep Archives",
      icon: <Trash2 className="w-5 h-5 text-rose-500" />,
      onConfirm: async () => {
        if (previewHistorical) {
          setSelectedVersionId(previewHistorical.id);
        }
        const previewSlotsCount = previewHistorical?.slots?.length || 0;
        const dominoCount = Math.min(Math.max(previewSlotsCount, historical.length, 6), 24);

        setIsCascadingClear(true);
        SoundFX.playDominoCascadeSound();
        hapticHeavy();
        triggerDynamicHUD({
          type: "origami",
          label: "Cascading Schedule Clear",
          subtitle: `${historical.length} archived version${historical.length > 1 ? "s" : ""} • All slots disintegrated`,
          durationMs: 4500,
        });

        // Smoothly pan & scroll schedule preview container through domino topple wave
        requestAnimationFrame(() => {
          const container = document.getElementById("archive-modal-schedule-container");
          if (container) {
            container.scrollIntoView({ behavior: "smooth", block: "nearest" });
            container.scrollTo({ top: 0, behavior: "instant" });
            const totalScroll = container.scrollHeight - container.clientHeight;
            if (totalScroll > 0) {
              setTimeout(() => {
                container.scrollTo({ top: Math.round(totalScroll * 0.5), behavior: "smooth" });
              }, 800);
              setTimeout(() => {
                container.scrollTo({ top: totalScroll, behavior: "smooth" });
              }, 1600);
            }
          }
        });

        const clearReq = api
          .delete(`/timetable/semester/${effectiveSemesterId || "active"}/archived/all`)
          .catch((err) => {
            console.error("Failed to clear archived versions:", err);
          });

        const clearAnimDurationMs = Math.min(Math.max(1800, Math.round((0.15 + dominoCount * 0.142 + 1.05) * 1000)), 3800);

        setTimeout(async () => {
          setVersions((prev) => {
            const onlyCurrent = prev.filter((v) => v.isCurrent);
            setSelectedVersionId(onlyCurrent.length > 0 ? onlyCurrent[0].id : null);
            return onlyCurrent;
          });
          setIsCascadingClear(false);

          const cacheStore = useCacheStore.getState();
          const onlyCurrent = versions.filter((v) => v.isCurrent);
          if (effectiveSemesterId) {
            cacheStore.setCache(`archived_timetables_${effectiveSemesterId}`, onlyCurrent);
          }
          cacheStore.setCache("archived_timetables", onlyCurrent);
          const currentTtCache = cacheStore.timetable;
          if (currentTtCache) {
            cacheStore.setCache("timetable", {
              ...currentTtCache,
              archivedSlots: onlyCurrent,
            });
          }

          await clearReq;
          window.dispatchEvent(new CustomEvent("timetable-updated"));
        }, clearAnimDurationMs);
      },
    });
  };

  // Anti-scroll lock
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const selectedVersion = versions.find(v => v.id === selectedVersionId);
  const historicalVersions = versions.filter(v => !v.isCurrent);

  // Group slots by day
  const slotsByDay: Record<number, any[]> = {};
  if (selectedVersion && Array.isArray(selectedVersion.slots)) {
    selectedVersion.slots.forEach((s: any) => {
      if (!slotsByDay[s.dayOfWeek]) slotsByDay[s.dayOfWeek] = [];
      slotsByDay[s.dayOfWeek].push(s);
    });
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isClosePressed ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          onClick={handleCloseWithFeedback}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/40 dark:bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={
              isClosePressed
                ? { opacity: 0, scale: 0.92, y: 10 }
                : { opacity: 1, scale: 1, y: 0 }
            }
            exit={{ opacity: 0, scale: 0.93, y: 12 }}
            transition={{ type: "spring", damping: 26, stiffness: 360, mass: 0.7 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Archive className="w-5 h-5 text-muted-foreground" />
                Archived Timetables
              </h2>
              <motion.button
                type="button"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.78, rotate: 90 }}
                onClick={handleCloseWithFeedback}
                aria-label="Close Archived Timetables"
                className={`relative w-9 h-9 rounded-xl flex items-center justify-center border transition-all duration-150 cursor-pointer group ${
                  isClosePressed
                    ? "bg-rose-500/25 border-rose-500/50 text-rose-500 ring-4 ring-rose-500/20 scale-90"
                    : "bg-muted/40 hover:bg-rose-500/15 border-border/60 hover:border-rose-500/35 text-muted-foreground hover:text-rose-500 shadow-sm"
                }`}
              >
                <X
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isClosePressed ? "rotate-90 scale-90" : "group-hover:rotate-90"
                  }`}
                />
              </motion.button>
            </div>

            <style>{`
              @keyframes origamiPaperCrumbleArchive {
                0% { transform: perspective(900px) scale(1) rotateX(0deg) rotateY(0deg) rotateZ(0deg) translateY(0); opacity: 1; filter: blur(0px); border-radius: 12px; }
                15% { transform: perspective(900px) scale(0.96) rotateX(24deg) rotateY(-18deg) rotateZ(6deg) translateY(-8px); opacity: 0.98; box-shadow: 0 16px 30px rgba(0,0,0,0.3); }
                35% { transform: perspective(900px) scale(0.82) rotateX(-36deg) rotateY(42deg) rotateZ(-16deg) translateY(-14px); opacity: 0.92; filter: contrast(1.15); border-radius: 18px; }
                55% { transform: perspective(900px) scale(0.65) rotateX(65deg) rotateY(-60deg) rotateZ(35deg) translateY(-8px); opacity: 0.82; border-radius: 35%; }
                75% { transform: perspective(900px) scale(0.42) rotateX(-85deg) rotateY(120deg) rotateZ(-70deg) translateY(15px); opacity: 0.65; border-radius: 50%; filter: blur(0.5px); }
                90% { transform: perspective(900px) scale(0.24) rotateX(160deg) rotateY(240deg) rotateZ(180deg) translateY(65px); opacity: 0.35; border-radius: 50%; filter: blur(2px); }
                100% { transform: perspective(900px) scale(0) rotateX(220deg) rotateY(360deg) rotateZ(270deg) translateY(120px); opacity: 0; filter: blur(6px); visibility: hidden; }
              }
              @keyframes dominoCascadeFallArchive {
                0% { transform: perspective(800px) rotateX(0deg) translateY(0) scale(1); opacity: 1; }
                50% { transform: perspective(800px) rotateX(70deg) translateY(25px) scale(0.92); opacity: 0.8; }
                100% { transform: perspective(800px) rotateX(90deg) translateY(55px) scale(0.7); opacity: 0; visibility: hidden; }
              }
            `}</style>
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              {/* Sidebar - Versions */}
              <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-muted/10 overflow-y-auto flex-none max-h-[160px] md:max-h-none">
                <div className="p-2.5 border-b border-border/50 flex items-center justify-between text-xs text-muted-foreground font-semibold px-3 bg-muted/20">
                  <span>VERSIONS ({historicalVersions.length})</span>
                  {historicalVersions.length > 1 && (
                    <button
                      type="button"
                      onClick={handleClearAllArchives}
                      className="text-[11px] font-bold text-rose-500 hover:text-rose-400 hover:underline cursor-pointer transition-colors"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                {isLoading && versions.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Loading archive...</div>
                ) : versions.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No archived timetables found.</div>
                ) : (
                  <div className="flex flex-col p-3 gap-2">
                    {versions.map((v, i) => {
                      const isVersionCrumbling = crumblingVersionId === v.id;
                      const isVersionDomino = isCascadingClear && !v.isCurrent;
                      return (
                      <div
                        key={v.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (crumblingVersionId || isCascadingClear) return;
                          hapticSelection();
                          setSelectedVersionId(v.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            if (crumblingVersionId || isCascadingClear) return;
                            hapticSelection();
                            setSelectedVersionId(v.id);
                          }
                        }}
                        style={
                          isVersionCrumbling
                            ? {
                                animation: "origamiPaperCrumbleArchive 4.0s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                                pointerEvents: "none",
                                zIndex: 30,
                              }
                            : isVersionDomino
                            ? {
                                transformOrigin: "top center",
                                animation: `dominoCascadeFallArchive 1.1s cubic-bezier(0.25, 1, 0.5, 1) ${0.15 + Math.max(0, i - 1) * 0.142}s forwards`,
                                pointerEvents: "none",
                              }
                            : undefined
                        }
                        className={`group text-left p-3 rounded-xl border transition-all active:scale-[0.98] cursor-pointer relative ${
                          selectedVersionId === v.id
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "bg-card border-border hover:border-primary/30 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <div className="font-bold text-sm mb-1 text-foreground flex items-center justify-between gap-1.5">
                          <span>{v.isCurrent ? "Current Timetable" : `Version ${v.versionNumber || (versions.length - i)}`}</span>
                          {v.isCurrent ? (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                              Active
                            </span>
                          ) : (
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteVersion(v);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.stopPropagation();
                                  handleDeleteVersion(v);
                                }
                              }}
                              title="Delete version"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-rose-500/80 hover:text-rose-500 hover:bg-rose-500/15 transition-all cursor-pointer active:scale-85 shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                        <div className="text-xs space-y-1">
                          <div className="flex items-center gap-1.5">
                            <CalendarIcon className="w-3 h-3 flex-shrink-0" />
                            <span>
                              {safeFormatDate(v.validFrom)} - 
                              {v.validUntil ? safeFormatDate(v.validUntil) : "Present"}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground pl-4.5">
                            {v.slots?.length || 0} classes
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Main Content - Schedule */}
              <div id="archive-modal-schedule-container" className="flex-1 overflow-y-auto bg-card p-4 scroll-smooth">
                {selectedVersion ? (
                  <div className="space-y-6">
                    {!selectedVersion.isCurrent && (
                      <div className="flex items-center justify-between pb-3 border-b border-border">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">
                            Version {selectedVersion.versionNumber}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            • {selectedVersion.slots?.length || 0} classes • Archived {safeFormatDate(selectedVersion.archivedAt || selectedVersion.validUntil)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteVersion(selectedVersion)}
                          disabled={Boolean(crumblingVersionId || isCascadingClear)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-500 hover:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer active:scale-95 shadow-sm disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Version</span>
                        </button>
                      </div>
                    )}

                    {(() => {
                      let globalSlotIndex = 0;
                      const isPreviewCrumbling = crumblingVersionId === selectedVersion.id;
                      const isPreviewDomino = isCascadingClear && !selectedVersion.isCurrent;

                      return DAYS.map((dayName, dayIndex) => {
                        const daySlots = slotsByDay[dayIndex] || [];
                        if (daySlots.length === 0) return null;

                        return (
                          <div key={dayIndex} className="space-y-3">
                            <h3 className="text-sm font-bold text-foreground/80 uppercase tracking-wider border-b border-border pb-2">
                              {dayName}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {daySlots.map((slot) => {
                                const idx = globalSlotIndex++;
                                return (
                                  <div
                                    key={slot.id}
                                    style={
                                      isPreviewCrumbling
                                        ? {
                                            animation: `origamiPaperCrumbleArchive 4.0s cubic-bezier(0.4, 0, 0.2, 1) ${Math.min(idx * 0.035, 0.28)}s forwards`,
                                            pointerEvents: "none",
                                            zIndex: 30,
                                          }
                                        : isPreviewDomino
                                        ? {
                                            transformOrigin: "top center",
                                            animation: `dominoCascadeFallArchive 1.1s cubic-bezier(0.25, 1, 0.5, 1) ${0.15 + Math.min(idx, 23) * 0.142}s forwards`,
                                            pointerEvents: "none",
                                          }
                                        : undefined
                                    }
                                    className="bg-muted/30 border border-border rounded-xl p-3 flex flex-col gap-2"
                                  >
                                    <div className="flex justify-between items-start gap-2">
                                      <div className="font-bold text-sm text-foreground line-clamp-2">
                                        {slot.subject?.code ? `${slot.subject.name} (${slot.subject.code})` : slot.subject?.name || "Unknown Subject"}
                                      </div>
                                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-primary/10 text-primary whitespace-nowrap">
                                        {slot.slotType}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto pt-2 border-t border-border/50">
                                      <div className="flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        {slot.startTime} - {slot.endTime}
                                      </div>
                                      {slot.room && (
                                        <div className="flex items-center gap-1">
                                          <MapPin className="w-3.5 h-3.5" />
                                          {slot.room}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    Select an archived version to view its schedule
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
