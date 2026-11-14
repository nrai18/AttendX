import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Loader2,
  ArrowLeft,
  Megaphone,
  Plus,
  AlertCircle,
  Clock,
  User,
  X,
  Send,
  BellRing,
  Trash2,
  AlertTriangle,
  GraduationCap,
  Users,
  Lock,
  ShieldCheck,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Download,
  ExternalLink
} from "lucide-react";
import { ClassroomRosterModal } from "../../components/classroom/ClassroomRosterModal";
import { downloadBlob } from "../../lib/download";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { SoundFX } from "../../utils/soundEffects";
import { hapticMedium, hapticLight, hapticSuccess, hapticHeavy } from "../../utils/haptics";
import { triggerDynamicHUD } from "../../components/ui/dynamic-island-hud";
import { useBackHandlerStore } from "../../stores/backHandlerStore";
import { getClassroomBannerTheme } from "../../components/classroom/ClassroomBanner";
import { useCacheStore } from "../../stores/cacheStore";

export interface AnnouncementAttachment {
  name: string;
  type: string;
  size: number;
  url: string;
}

interface Announcement {
  id: string;
  title: string;
  content?: string;
  body?: string;
  importance?: "low" | "medium" | "high";
  isPinned?: boolean;
  category?: string;
  attachmentUrls?: string[];
  createdAt: string;
  createdBy?: { name: string };
  author?: { name: string };
}

interface FeedData {
  role: "admin" | "member";
  classroom?: { 
    id: string; 
    name: string; 
    section?: string; 
    department?: string; 
    batch?: string;
    broadcastPermission?: "admins" | "everyone" | "only_selected" | "everyone_except";
    allowedPosterIds?: string[];
    deniedPosterIds?: string[];
  };
  canPost?: boolean;
  broadcastPermission?: "admins" | "everyone" | "only_selected" | "everyone_except";
  allowedPosterIds?: string[];
  deniedPosterIds?: string[];
  isDeleted?: boolean;
  announcements: Announcement[];
}

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const compressImage = (file: File): Promise<AnnouncementAttachment> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        const maxDim = 1280;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({
            name: file.name,
            type: file.type || "image/jpeg",
            size: file.size,
            url: e.target?.result as string,
          });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedUrl = canvas.toDataURL("image/jpeg", 0.8);
        const approxSize = Math.round((compressedUrl.length * 3) / 4);
        resolve({
          name: file.name.replace(/\.[^/.]+$/, "") + ".jpg",
          type: "image/jpeg",
          size: approxSize,
          url: compressedUrl,
        });
      };
      img.onerror = () => reject(new Error("Unable to decode image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
};

const readPdf = (file: File): Promise<AnnouncementAttachment> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve({
        name: file.name,
        type: "application/pdf",
        size: file.size,
        url: e.target?.result as string,
      });
    };
    reader.onerror = () => reject(new Error("Unable to read PDF"));
    reader.readAsDataURL(file);
  });
};

const parseAttachment = (raw: string): AnnouncementAttachment | null => {
  if (!raw) return null;
  if (raw.startsWith("{")) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const isPdf = raw.includes("application/pdf") || raw.toLowerCase().endsWith(".pdf");
  return {
    name: isPdf ? "Document.pdf" : "Attachment.jpg",
    type: isPdf ? "application/pdf" : "image/jpeg",
    size: 0,
    url: raw,
  };
};

export const ClassroomFeedPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const cachedFeed = id ? useCacheStore.getState().classroom_feeds?.[id] : null;
  const [feed, setFeed] = useState<FeedData | null>(cachedFeed || null);
  const [isLoading, setIsLoading] = useState(!cachedFeed);

  // Modals state
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newImportance, setNewImportance] = useState<"low" | "medium" | "high">("low");
  const [attachments, setAttachments] = useState<AnnouncementAttachment[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<AnnouncementAttachment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Classroom Management & Transition Modals
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [transitionTermNote, setTransitionTermNote] = useState("");

  const fetchFeed = async (showLoading = true) => {
    try {
      if (showLoading && !feed) setIsLoading(true);
      const res = await api.get(`/classrooms/${id}/feed`, { params: { t: Date.now() } });
      const data = typeof res.data === "string" ? { role: "member", announcements: [] } : res.data;
      if (data.isDeleted) {
        triggerDynamicHUD({
          type: "trash",
          label: "Section Hub Disbanded",
          subtitle: "The CR has disbanded this section hub. Returning to classrooms.",
          durationMs: 4200,
        });
        hapticHeavy();
        navigate("/classrooms", { replace: true });
        return;
      }
      setFeed(data);
      if (id) {
        useCacheStore.getState().cacheClassroomFeed(id, data);
      }
    } catch (error) {
      console.error("Failed to fetch feed:", error);
      if (id) {
        const cached = useCacheStore.getState().classroom_feeds?.[id];
        if (cached) {
          setFeed(cached);
        }
      }
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    fetchFeed(true);

    const unsubCache = useCacheStore.subscribe((state) => {
      if (id && state.classroom_feeds?.[id]) {
        setFeed(state.classroom_feeds[id]);
      }
    });

    const handleBroadcastReceived = (e: any) => {
      const detail = e.detail;
      const evtClassroomId = String(detail?.classroomId || detail?.classroom_id || detail?.id || "");
      if (!evtClassroomId || evtClassroomId === String(id)) {
        fetchFeed(false);
        hapticLight();
      }
    };

    const handleAccessUpdated = (e: any) => {
      const detail = e.detail;
      const evtClassroomId = String(detail?.classroomId || detail?.classroom_id || detail?.id || "");
      if (!evtClassroomId || evtClassroomId === String(id)) {
        fetchFeed(false);
        hapticMedium();
        triggerDynamicHUD({
          type: "success",
          label: "Broadcast Rights Refreshed",
          subtitle: "Your section posting permissions were updated",
          durationMs: 3500,
        });
      }
    };

    const handleClassroomDeleted = (e: any) => {
      const detail = e.detail;
      const evtClassroomId = String(detail?.classroomId || detail?.classroom_id || detail?.id || "");
      if (!evtClassroomId || evtClassroomId === String(id)) {
        triggerDynamicHUD({
          type: "trash",
          label: "Section Hub Disbanded",
          subtitle: "The CR has disbanded this section hub. Returning to classrooms.",
          durationMs: 4200,
        });
        hapticHeavy();
        navigate("/classrooms", { replace: true });
      }
    };

    const handleFocus = () => {
      fetchFeed(false);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchFeed(false);
      }
    };

    window.addEventListener("fcm_classroom_broadcast", handleBroadcastReceived);
    window.addEventListener("fcm_classroom_access_updated", handleAccessUpdated);
    window.addEventListener("fcm_classroom_deleted", handleClassroomDeleted);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    // Snappy 2.5s polling while active on screen for instant real-time message stream
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchFeed(false);
      }
    }, 2500);

    return () => {
      unsubCache();
      window.removeEventListener("fcm_classroom_broadcast", handleBroadcastReceived);
      window.removeEventListener("fcm_classroom_access_updated", handleAccessUpdated);
      window.removeEventListener("fcm_classroom_deleted", handleClassroomDeleted);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, [id]);

  // Hardware back button support for open modals
  useEffect(() => {
    const unregister = useBackHandlerStore.getState().register(() => {
      if (previewAttachment) {
        setPreviewAttachment(null);
        return true;
      }
      if (showRosterModal) {
        setShowRosterModal(false);
        return true;
      }
      if (showCreateModal) {
        setShowCreateModal(false);
        return true;
      }
      if (showDeleteModal) {
        setShowDeleteModal(false);
        return true;
      }
      if (showTransitionModal) {
        setShowTransitionModal(false);
        return true;
      }
      return false;
    });
    return unregister;
  }, [previewAttachment, showRosterModal, showCreateModal, showDeleteModal, showTransitionModal]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (attachments.length >= 2) {
      toast.error("Maximum 2 attachments allowed per announcement");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    const isImage = fileType.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(fileName);
    const isPdf = fileType === "application/pdf" || fileName.endsWith(".pdf");

    if (!isImage && !isPdf) {
      toast.error("Only image (JPG, PNG, WebP) and PDF files are allowed");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      setIsProcessingFile(true);
      if (isPdf) {
        // Enforce strict 1.5MB limit to prevent database storage bloat
        if (file.size > 1.5 * 1024 * 1024) {
          toast.error("PDF exceeds 1.5MB limit. Please compress before attaching.");
          return;
        }
        const pdfAttachment = await readPdf(file);
        setAttachments((prev) => [...prev, pdfAttachment]);
        hapticLight();
        toast.success(`Attached ${file.name}`);
      } else {
        // Image compression via Canvas (scales to max 1280px, 80% JPEG)
        const imgAttachment = await compressImage(file);
        if (imgAttachment.size > 2 * 1024 * 1024) {
          toast.error("Compressed image exceeds size limit. Please choose a smaller image.");
          return;
        }
        setAttachments((prev) => [...prev, imgAttachment]);
        hapticLight();
        toast.success(`Attached ${file.name}`);
      }
    } catch (err: any) {
      console.error("Failed to process attachment:", err);
      toast.error("Could not process file. Please try another.");
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAttachment = (index: number) => {
    hapticLight();
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDownloadAttachment = async (att: AnnouncementAttachment) => {
    try {
      hapticLight();
      let blob: Blob;
      if (att.url.startsWith("data:")) {
        const parts = att.url.split(",");
        const mime = parts[0].match(/:(.*?);/)?.[1] || att.type || "application/octet-stream";
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        blob = new Blob([u8arr], { type: mime });
      } else {
        const res = await fetch(att.url);
        blob = await res.blob();
      }
      await downloadBlob(blob, att.name || "document");
      toast.success(`Downloaded ${att.name || "file"}`);
    } catch (err) {
      console.error("Error downloading attachment:", err);
      toast.error("Failed to download attachment");
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error("Title and announcement details are required");
      return;
    }

    try {
      setIsSubmitting(true);
      const serializedAttachments = attachments.map((att) => JSON.stringify(att));
      const optimisticAnnouncement = {
        id: `temp-${Date.now()}`,
        title: newTitle.trim(),
        content: newContent.trim(),
        body: newContent.trim(),
        importance: newImportance,
        isPinned: false,
        attachmentUrls: serializedAttachments,
        createdAt: new Date().toISOString(),
        createdBy: { name: "You" },
        author: { name: "You" },
      };
      if (id) {
        useCacheStore.getState().appendClassroomAnnouncement(id, optimisticAnnouncement);
      }

      await api.post(`/classrooms/${id}/announcements`, {
        title: newTitle.trim(),
        content: newContent.trim(),
        importance: newImportance,
        attachmentUrls: serializedAttachments,
      });

      hapticSuccess();
      triggerDynamicHUD({
        type: "plane",
        label: "Notice Broadcasted!",
        subtitle: `${newTitle.trim()} posted to section feed`,
        durationMs: 4200,
        silent: true,
      });
      setShowCreateModal(false);
      setNewTitle("");
      setNewContent("");
      setNewImportance("low");
      setAttachments([]);
      fetchFeed();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to post announcement");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLeaveAndExit = async () => {
    try {
      setIsSubmitting(true);
      const hubName = feed?.classroom?.name || "Section Hub";
      SoundFX.playWhooshSound(0.28);
      hapticMedium();
      triggerDynamicHUD({
        type: "trash",
        label: "Classroom Hub Removed",
        subtitle: `${hubName} cleared from your dashboard`,
        durationMs: 4000,
      });
      await api.delete(`/classrooms/${id}/leave`);
      navigate("/classrooms");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to remove classroom");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClassroom = async () => {
    try {
      setIsSubmitting(true);
      const hubName = feed?.classroom?.name || "Classroom Hub";
      SoundFX.playWhooshSound(0.32);
      hapticHeavy();
      triggerDynamicHUD({
        type: "trash",
        label: "Classroom Hub Disbanded",
        subtitle: `${hubName} • Enrolled peers alerted via push`,
        durationMs: 4500,
      });
      setShowDeleteModal(false);
      navigate("/classrooms", { replace: true });
      await api.delete(`/classrooms/${id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to disband classroom");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBroadcastTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const note = transitionTermNote.trim() || "The academic term has transitioned to the next semester. Please verify and synchronize your weekly schedules.";
      await api.post(`/classrooms/${id}/announcements`, {
        title: "🎓 Academic Term Transition & Schedule Revision",
        content: note,
        importance: "high",
      });
      SoundFX.playWhooshSound(0.26);
      SoundFX.playLevelUpCelebrationSound();
      hapticSuccess();
      triggerDynamicHUD({
        type: "hub",
        label: "Academic Term Transition Broadcasted",
        subtitle: "Classroom schedule revision posted to section",
        durationMs: 4600,
      });
      setShowTransitionModal(false);
      setTransitionTermNote("");
      fetchFeed();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to broadcast transition notice");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-900 dark:text-white" />
        <p className="text-xs text-muted-foreground font-mono tracking-wider uppercase">Loading section feed...</p>
      </div>
    );
  }

  if (!feed) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center p-6">
        <AlertCircle className="w-10 h-10 text-muted-foreground opacity-50" />
        <div className="space-y-1">
          <h3 className="text-base font-bold text-foreground">Classroom Not Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            You might not be enrolled in this section, or the hub was removed.
          </p>
        </div>
        <Link 
          to="/classrooms"
          className="px-4 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-black text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all"
        >
          Return to Classrooms
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto w-full pb-28 md:pb-12 animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out">
      {/* Google Classroom Thematic Hero Header Banner */}
      {(() => {
        const bannerTheme = getClassroomBannerTheme(
          feed.classroom?.name || "Section",
          feed.classroom?.department,
          feed.classroom?.section
        );

        return (
          <div className="space-y-4">
            <div className="relative rounded-3xl overflow-hidden border border-neutral-200 dark:border-white/10 shadow-md p-6 sm:p-8 flex flex-col justify-between min-h-[175px] sm:min-h-[210px] select-none">
              {/* Full-Bleed Vector SVG Artwork */}
              {bannerTheme.renderIllustration()}

              {/* Top Row inside Hero: Back Button & Badges */}
              <div className="relative z-10 flex items-center justify-between gap-3">
                <Link
                  to="/classrooms"
                  onClick={() => {
                    hapticLight();
                  }}
                  className="p-2 sm:p-2.5 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-all border border-white/15 cursor-pointer active:scale-95 shadow-xs"
                  title="Back to Classrooms"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Link>

                <div className="flex items-center gap-2">
                  {feed.isDeleted ? (
                    <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-full bg-rose-500/80 backdrop-blur-md text-white shadow-xs">
                      Disbanded by CR
                    </span>
                  ) : feed.role === "admin" ? (
                    <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-full bg-emerald-500/80 backdrop-blur-md text-white shadow-xs inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      CR Admin
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Bottom Area inside Hero: Title, Section & Department */}
              <div className="relative z-10 mt-6 sm:mt-8 space-y-1">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white drop-shadow-md">
                  {feed.classroom?.name || "Classroom Feed"}
                </h1>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-white/80 font-medium drop-shadow-xs flex-wrap">
                  {feed.classroom?.department && <span>{feed.classroom.department}</span>}
                  {feed.classroom?.department && feed.classroom?.section && <span>•</span>}
                  {feed.classroom?.section && <span>Section {feed.classroom.section}</span>}
                  {feed.classroom?.batch && (
                    <>
                      <span>•</span>
                      <span>Batch {feed.classroom.batch}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Action Bar Below Banner */}
            {!feed.isDeleted && (
              <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* View Classmates / Roster (Clickable by EVERYONE) */}
                  <button 
                    onClick={() => {
                      hapticLight();
                      setShowRosterModal(true);
                    }}
                    title="View enrolled classmates & permissions"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#0c0d0e] hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-800 dark:text-neutral-200 px-3.5 py-2 rounded-xl transition-all shadow-xs active:scale-[0.98] cursor-pointer"
                  >
                    <Users className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                    <span>Classmates Roster</span>
                  </button>

                  {/* Academic Term Transition (CR Admin only) */}
                  {feed.role === "admin" && (
                    <button 
                      onClick={() => {
                        hapticMedium();
                        setShowTransitionModal(true);
                      }}
                      title="Classroom Semester Transition"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold border border-neutral-200 dark:border-white/10 bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-800 dark:text-neutral-200 px-3.5 py-2 rounded-xl transition-all shadow-xs active:scale-[0.98] cursor-pointer"
                    >
                      <GraduationCap className="w-4 h-4 text-emerald-500" />
                      <span className="hidden sm:inline">Transition Term</span>
                      <span className="sm:hidden">Transition</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Post Notice Button (Enabled for CR or authorized members) */}
                  {feed.canPost || feed.role === "admin" ? (
                    <button 
                      onClick={() => {
                        hapticMedium();
                        setShowCreateModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-neutral-900 dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-100 px-4 py-2 rounded-xl transition-all shadow-xs active:scale-[0.98] cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Post Broadcast</span>
                    </button>
                  ) : (
                    <div 
                      title="Broadcasting in this classroom is restricted to Class Representatives and approved members"
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground px-3 py-2 rounded-xl border border-neutral-200/60 dark:border-white/5 bg-neutral-50 dark:bg-white/[0.02]"
                    >
                      <Lock className="w-3.5 h-3.5 opacity-60 text-amber-500" />
                      <span className="hidden sm:inline">Broadcasting Restricted</span>
                    </div>
                  )}

                  {/* Delete Hub (CR Admin only) */}
                  {feed.role === "admin" && (
                    <button
                      onClick={() => {
                        hapticMedium();
                        setShowDeleteModal(true);
                      }}
                      title="Disband Section Hub"
                      className="p-2 rounded-xl border border-neutral-200 dark:border-white/10 hover:border-rose-500/40 text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Disbanded Classroom Alert Banner */}
      {feed.isDeleted && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>This section hub was disbanded by the Class Representative. Clean it up from your dashboard.</span>
          </div>
          <button
            onClick={handleLeaveAndExit}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs tracking-wide shrink-0 transition-all inline-flex items-center gap-1.5 active:scale-[0.98]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove Hub
          </button>
        </div>
      )}

      {/* Announcements Stream */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-widest text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
            <Megaphone className="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-300" />
            Section Broadcast Stream ({feed.announcements.length})
          </h2>
        </div>

        {feed.announcements.length === 0 ? (
          <div className="p-10 text-center bg-white dark:bg-[#08080a] border border-neutral-200 dark:border-white/10 rounded-2xl space-y-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 flex items-center justify-center text-neutral-600 dark:text-neutral-400 mx-auto">
              <BellRing className="w-5 h-5 opacity-60" />
            </div>
            <h3 className="text-sm font-bold text-foreground">No broadcasts yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              When your Class Representative or faculty post timetable revisions, lab notices, or notes, they will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {feed.announcements.map((ann) => {
              const authorName = ann.createdBy?.name || ann.author?.name || "Section Representative";
              const isHigh = ann.importance === "high" || ann.isPinned;
              const isMed = ann.importance === "medium";
              const contentText = ann.content || ann.body || "";

              return (
                <div
                  key={ann.id}
                  className={`p-5 rounded-2xl bg-white dark:bg-[#08080a] border transition-all duration-200 shadow-xs relative overflow-hidden ${
                    isHigh 
                      ? "border-rose-500/40 bg-rose-500/[0.02]" 
                      : isMed 
                        ? "border-amber-500/40 bg-amber-500/[0.02]" 
                        : "border-neutral-200 dark:border-white/10"
                  }`}
                >
                  {/* Importance Color Bar */}
                  {isHigh && <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500" />}
                  {isMed && <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-foreground text-sm sm:text-base">{ann.title}</h3>
                      {isHigh && (
                        <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                          Urgent Broadcast
                        </span>
                      )}
                      {isMed && (
                        <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          Important Notice
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {new Date(ann.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {contentText}
                  </p>

                  {/* Broadcast Attachments (Images & PDFs) */}
                  {(() => {
                    const rawAttachments = ann.attachmentUrls || [];
                    const parsed = rawAttachments
                      .map(parseAttachment)
                      .filter(Boolean) as AnnouncementAttachment[];

                    if (parsed.length === 0) return null;

                    return (
                      <div className="mt-3.5 pt-3 border-t border-border/40 space-y-2">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Paperclip className="w-3 h-3 text-neutral-500 dark:text-neutral-400" />
                          <span>Attached Documents ({parsed.length})</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {parsed.map((att, idx) => {
                            const isPdf = att.type === "application/pdf" || att.name.toLowerCase().endsWith(".pdf");

                            if (isPdf) {
                              return (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-white/[0.03] border border-neutral-200 dark:border-white/10 hover:border-neutral-300 dark:hover:border-white/20 transition-all text-xs group"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                                      <FileText className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-semibold text-foreground truncate text-xs" title={att.name}>
                                        {att.name}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground font-mono">
                                        {formatFileSize(att.size) || "PDF Document"}
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadAttachment(att)}
                                    title="Download PDF Document"
                                    className="p-2 rounded-lg bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 transition-all active:scale-95 shrink-0 cursor-pointer shadow-2xs"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              );
                            }

                            // Compressed Image Attachment
                            return (
                              <div
                                key={idx}
                                className="relative rounded-xl overflow-hidden border border-neutral-200 dark:border-white/10 group bg-neutral-900 shadow-2xs"
                              >
                                <img
                                  src={att.url}
                                  alt={att.name}
                                  onClick={() => setPreviewAttachment(att)}
                                  className="w-full h-36 object-cover cursor-pointer transition-transform duration-300 group-hover:scale-105"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white pointer-events-auto">
                                  <span className="text-[11px] font-medium truncate max-w-[70%] drop-shadow-xs">
                                    {att.name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadAttachment(att)}
                                    title="Download Image"
                                    className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-all active:scale-95 cursor-pointer border border-white/20"
                                  >
                                    <Download className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="mt-3.5 pt-3 border-t border-border/40 text-[11px] font-mono text-muted-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3 h-3 text-neutral-500 dark:text-neutral-400" />
                      Broadcasted by <strong className="text-foreground font-semibold">{authorName}</strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Announcement Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0c0d0e] border border-neutral-200 dark:border-white/15 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">New Class Announcement</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Broadcast an update to all enrolled section members.</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full hover:bg-neutral-100 dark:hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                  Subject / Heading <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-[#050507] border border-neutral-300 dark:border-white/15 rounded-xl px-3.5 py-2.5 text-foreground text-sm focus:border-neutral-900 dark:focus:border-white focus:ring-1 focus:ring-neutral-900/10 dark:focus:ring-white/10 outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                  Importance Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setNewImportance("low");
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      newImportance === "low"
                        ? "bg-neutral-200 dark:bg-white/10 text-neutral-900 dark:text-white border-neutral-300 dark:border-white/20 shadow-xs"
                        : "border-neutral-200 dark:border-white/10 text-muted-foreground hover:bg-neutral-100 dark:hover:bg-white/5"
                    }`}
                  >
                    Routine
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setNewImportance("medium");
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      newImportance === "medium"
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 shadow-xs"
                        : "border-neutral-200 dark:border-white/10 text-muted-foreground hover:bg-neutral-100 dark:hover:bg-white/5"
                    }`}
                  >
                    Important
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setNewImportance("high");
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      newImportance === "high"
                        ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40 shadow-xs"
                        : "border-neutral-200 dark:border-white/10 text-muted-foreground hover:bg-neutral-100 dark:hover:bg-white/5"
                    }`}
                  >
                    Urgent
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                  Announcement Details <span className="text-rose-500">*</span>
                </label>
                <textarea 
                  rows={4}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-[#050507] border border-neutral-300 dark:border-white/15 rounded-xl p-3.5 text-foreground text-sm focus:border-neutral-900 dark:focus:border-white focus:ring-1 focus:ring-neutral-900/10 dark:focus:ring-white/10 outline-none transition-all resize-none"
                  required
                />
              </div>

              {/* Attachments Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Attachments ({attachments.length}/2)
                  </label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    PDF ≤ 1.5MB • Images auto-compressed
                  </span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {attachments.length < 2 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingFile}
                    className="w-full py-2.5 px-3.5 rounded-xl border border-dashed border-neutral-300 dark:border-white/20 hover:border-neutral-400 dark:hover:border-white/30 bg-neutral-50/50 dark:bg-white/[0.02] hover:bg-neutral-100/50 dark:hover:bg-white/[0.04] text-xs font-medium text-foreground transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-50"
                  >
                    {isProcessingFile ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                        <span>Compressing & reading file...</span>
                      </>
                    ) : (
                      <>
                        <Paperclip className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                        <span>Attach Document or Image</span>
                      </>
                    )}
                  </button>
                )}

                {attachments.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {attachments.map((att, idx) => {
                      const isPdf = att.type === "application/pdf" || att.name.toLowerCase().endsWith(".pdf");
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isPdf ? "bg-rose-500/10 text-rose-500" : "bg-sky-500/10 text-sky-500"
                            }`}>
                              {isPdf ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate text-xs">{att.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                {formatFileSize(att.size)}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(idx)}
                            className="p-1 rounded-lg hover:bg-neutral-200 dark:hover:bg-white/10 text-muted-foreground hover:text-rose-500 transition-colors"
                            title="Remove attachment"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                  disabled={isSubmitting || !newTitle.trim() || !newContent.trim()} 
                  className="px-5 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-100 rounded-xl text-xs font-semibold tracking-wide transition-all disabled:opacity-40 inline-flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Publish Broadcast
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Disband Hub Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0c0d0e] border border-neutral-200 dark:border-white/15 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Disband Classroom Hub</h3>
                  <p className="text-xs text-muted-foreground">CR Deletion Confirmation</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="w-8 h-8 rounded-full hover:bg-neutral-100 dark:hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-[#050507] border border-neutral-200 dark:border-white/10 space-y-1.5 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">
                Disband this section classroom?
              </p>
              <p>
                • All enrolled peers will be notified via high-priority push notification that this hub was disbanded.
              </p>
              <p>
                • The hub will be greyed out on peers' devices with an alert to remove it from their dashboards.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button 
                type="button" 
                onClick={() => setShowDeleteModal(false)} 
                className="px-4 py-2.5 text-xs font-semibold rounded-xl text-muted-foreground hover:text-foreground hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button"
                disabled={isSubmitting}
                onClick={handleDeleteClassroom}
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

      {/* Classroom Academic Term Transition Modal */}
      {showTransitionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0c0d0e] border border-neutral-200 dark:border-white/15 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Semester Term Transition</h3>
                  <p className="text-xs text-muted-foreground">Broadcast Academic Progression</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowTransitionModal(false)}
                className="w-8 h-8 rounded-full hover:bg-neutral-100 dark:hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBroadcastTransition} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-[#050507] border border-neutral-200 dark:border-white/10 space-y-1.5 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">
                  Transitioning to next semester or revised schedule?
                </p>
                <p>
                  This sends an urgent broadcast to all enrolled section peers notifying them of the term shift and prompting them to synchronize updated timetables.
                </p>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                  Transition Instructions & Details
                </label>
                <textarea 
                  rows={3}
                  value={transitionTermNote}
                  onChange={(e) => setTransitionTermNote(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-[#050507] border border-neutral-300 dark:border-white/15 rounded-xl p-3.5 text-foreground text-sm focus:border-neutral-900 dark:focus:border-white focus:ring-1 focus:ring-neutral-900/10 dark:focus:ring-white/10 outline-none transition-all resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowTransitionModal(false)} 
                  className="px-4 py-2.5 text-xs font-semibold rounded-xl text-muted-foreground hover:text-foreground hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="px-5 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-100 rounded-xl text-xs font-semibold tracking-wide transition-all disabled:opacity-40 inline-flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Broadcasting...
                    </>
                  ) : (
                    <>
                      <GraduationCap className="w-3.5 h-3.5 text-emerald-500" />
                      Broadcast Term Shift
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Classroom Roster & Classmates Modal */}
      {showRosterModal && (
        <ClassroomRosterModal
          isOpen={showRosterModal}
          onClose={() => setShowRosterModal(false)}
          classroomId={id!}
          classroomName={feed.classroom?.name || "Classroom"}
          isCrOrAdmin={feed.role === "admin"}
          initialPermission={feed.broadcastPermission || feed.classroom?.broadcastPermission || "admins"}
          initialAllowedPosterIds={feed.allowedPosterIds || feed.classroom?.allowedPosterIds || []}
          initialDeniedPosterIds={feed.deniedPosterIds || feed.classroom?.deniedPosterIds || []}
          onPermissionsUpdated={() => {
            fetchFeed();
          }}
        />
      )}

      {/* Attachment Image Preview Lightbox */}
      {previewAttachment && (
        <div 
          onClick={() => setPreviewAttachment(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200 cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="relative max-w-3xl w-full flex flex-col items-center gap-3 cursor-default"
          >
            {/* Top Toolbar */}
            <div className="w-full flex items-center justify-between px-3 py-2 rounded-2xl bg-black/60 backdrop-blur-md border border-white/15 text-white">
              <span className="text-xs font-mono truncate max-w-[60%]">
                {previewAttachment.name}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadAttachment(previewAttachment)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-all inline-flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lightbox Image */}
            <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl max-h-[80vh] flex items-center justify-center bg-black/40">
              <img
                src={previewAttachment.url}
                alt={previewAttachment.name}
                className="max-h-[80vh] w-auto max-w-full object-contain rounded-2xl select-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
