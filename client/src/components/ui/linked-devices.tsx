import { FaWindows, FaApple, FaLinux } from "react-icons/fa";
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "../../stores/authStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Globe,
  Laptop,
  LogOut,
  Trash2,
} from "lucide-react";
import { api, detectRealHostOS } from "../../lib/api";
import { toast } from "sonner";
import { useHardwareBack } from "../../hooks/useHardwareBack";
import { useScrollLock } from "../../hooks/useScrollLock";
import { SoundFX } from "../../utils/soundEffects";
import { confirmDeleteToast } from "./confirm-delete-toast";
import { triggerDynamicHUD } from "./dynamic-island-hud";
import { hapticMedium, hapticHeavy, hapticSelection } from "../../utils/haptics";

interface Session {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  location: string | null;
  deviceType: string | null;
  os: string | null;
  browser: string | null;
  lastActive: string;
  createdAt: string;
  isCurrent: boolean;
}

interface LinkedDevicesProps {
  isOpen: boolean;
  onClose: () => void;
}



function DeviceAvatar({ os, browser }: { os: string | null; browser: string | null }) {
  const osLower = (os || "windows").toLowerCase();
  const browserLower = (browser || "unknown").toLowerCase();
  
  // Resolve OS Logo
  let osLogo = "windows.svg";
  if (osLower.includes("mac")) osLogo = "macos.svg";
  else if (osLower.includes("ios") || osLower.includes("iphone") || osLower.includes("ipad")) osLogo = "ios.svg";
  else if (osLower.includes("android")) osLogo = "android.svg";
  else if (osLower.includes("ubuntu")) osLogo = "ubuntu.svg";
  else if (osLower.includes("linux")) osLogo = "linux.svg";

  // Resolve Browser Badge
  let browserBadge = null;
  if (browserLower.includes("chrome")) browserBadge = "chrome.svg";
  else if (browserLower.includes("edge")) browserBadge = "edge.svg";
  else if (browserLower.includes("brave")) browserBadge = "brave.svg";
  else if (browserLower.includes("firefox")) browserBadge = "firefox.svg";
  else if (browserLower.includes("safari")) browserBadge = "safari.svg";
  else if (browserLower.includes("opera") && !browserLower.includes("mini")) browserBadge = "opera.svg";
  else if (browserLower.includes("opera mini")) browserBadge = "opera_mini.svg";
  else if (browserLower.includes("vivaldi")) browserBadge = "vivaldi.svg";
  else if (browserLower.includes("duckduckgo")) browserBadge = "duckduckgo.svg";
  else if (browserLower.includes("samsung")) browserBadge = "samsung-browser.svg";
  else if (browserLower.includes("midori")) browserBadge = "midori.svg";
  else if (browserLower.includes("comet")) browserBadge = "696ec0dc4c5ef-Comet-Browser.svg";
  else if (browserLower.includes("zen")) browserBadge = "zen-browser.svg";
  else if (browserLower.includes("arc")) browserBadge = "arc.svg";

  const isMobileApp = browserLower.includes("attendx");

  return (
    <div className="relative w-[50px] h-[50px] shrink-0">
      <img 
        src={`/icons/os/${osLogo}`} 
        className="w-full h-full object-contain drop-shadow-sm" 
        alt={os || "OS"} 
        onError={(e) => { e.currentTarget.src = '/icons/os/windows.svg'; }}
      />
      
      {!isMobileApp && browserBadge && browserLower !== "unknown browser" && (
        <div className="absolute -bottom-1 -right-1 w-[20px] h-[20px] rounded-full bg-white shadow-sm flex items-center justify-center p-[2px] border border-gray-100 dark:border-gray-800">
          <img 
            src={`/icons/browsers/${browserBadge}`} 
            className="w-full h-full object-contain" 
            alt={browser || undefined}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
      )}
    </div>
  );
}

function getSessionTitle(session: Session) {
  const os = session.os || "Unknown";
  const browser = session.browser || "Unknown";
  
  // Try to extract hardware model if backend provided it
  // e.g. "AttendX 3.0.0 (Nothing Phone (3a))" -> "Nothing Phone (3a)"
  const hardwareMatch = browser.match(/\((.*)\)/);
  if (hardwareMatch) {
    const raw = hardwareMatch[1];
    if (/nothing\s+a059/i.test(raw) || /^a059$/i.test(raw)) return "Nothing Phone (3a)";
    if (/nothing\s+a063/i.test(raw) || /^a063$/i.test(raw)) return "Nothing Phone (1)";
    if (/nothing\s+a065/i.test(raw) || /^a065$/i.test(raw)) return "Nothing Phone (2)";
    if (/nothing\s+a142p/i.test(raw) || /^a142p$/i.test(raw)) return "Nothing Phone (2a) Plus";
    if (/nothing\s+a142/i.test(raw) || /^a142$/i.test(raw)) return "Nothing Phone (2a)";
    if (/nothing\s+a015/i.test(raw) || /^a015$/i.test(raw) || /cmf\s+a015/i.test(raw)) return "CMF Phone 1";
    return raw;
  }

  if (browser !== "AttendX App" && !browser.startsWith("AttendX") && browser !== "Unknown Browser" && browser !== "Browser") {
    return `${browser} on ${os}`;
  }
  
  if (os.toLowerCase().includes("android")) return "Android Device";
  if (os.toLowerCase().includes("ios")) return "Apple iPhone/iPad";
  if (os.toLowerCase().includes("mac")) return "Apple Mac";
  if (os.toLowerCase().includes("windows")) return "Windows PC";
  
  return session.userAgent || "Unknown Device";
}

function getSessionSubtitle(session: Session) {
  const os = session.os || "Unknown OS";
  const browser = session.browser || "Unknown";
  
  if (browser.startsWith("AttendX")) {
    const isNative = browser.includes("Native App") || browser.includes("(");
    if (isNative) {
      // Extract version like "AttendX 3.0.0" or fallback
      const match = browser.match(/AttendX(?: App)?\s+([\d\.]+)/);
      const version = match ? match[1] : (localStorage.getItem("app_version") || "");
      const versionStr = version ? ` ${version}` : "";
      return `AttendX ${os}${versionStr}`;
    }
  }
  
  return `AttendX Web ${os}`;
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (diffDays < 7) return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" }); // Jul 15
}

function SessionRow({
  session,
  onRevoke,
  isTerminating,
  staggerDelay = 0,
  onRequestLocation,
}: {
  session: Session;
  onRevoke: () => void;
  isTerminating?: boolean;
  staggerDelay?: number;
  onRequestLocation?: () => void;
}) {
  const locationText = session.location && session.location !== "Unknown Location" ? session.location : null;
  const subtitle = getSessionSubtitle(session);

  return (
    <div
      style={
        isTerminating
          ? {
              animation: `sessionWhooshTrajectory 1.2s cubic-bezier(0.22, 1, 0.36, 1) ${staggerDelay}ms forwards`,
              pointerEvents: "none",
              zIndex: 50,
            }
          : undefined
      }
      className={`w-full flex items-center justify-between gap-3.5 px-4 py-3 hover:bg-accent/60 active:bg-accent/80 transition-all text-left relative overflow-hidden select-none ${
        isTerminating ? "bg-rose-500/10 border-rose-500/40" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => {
          hapticSelection();
          onRevoke();
        }}
        className="flex items-center gap-3.5 flex-1 min-w-0 text-left cursor-pointer"
      >
        <DeviceAvatar os={session.os} browser={session.browser} />
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <p className="text-[15px] font-semibold text-foreground leading-tight truncate">
              {getSessionTitle(session)}
            </p>
            {session.isCurrent && (
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0">
                Current
              </span>
            )}
          </div>
          <p className="text-[13px] text-muted-foreground leading-snug mt-0.5 truncate">{subtitle}</p>
          <p className="text-[13px] text-muted-foreground/80 leading-snug truncate">
            {locationText && <span>{locationText}{" \u2022 "}</span>}
            {session.isCurrent
              ? <span className="text-emerald-500 font-medium">online</span>
              : <span>{formatShortDate(session.lastActive)}</span>
            }
            {session.isCurrent && !locationText && onRequestLocation && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestLocation();
                }}
                className="inline-flex items-center gap-1 text-[11px] text-amber-500/90 hover:text-amber-400 font-semibold underline underline-offset-2 ml-1.5 cursor-pointer"
              >
                • Enable location
              </span>
            )}
          </p>
        </div>
      </button>

      {/* Direct Terminate Action Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          hapticMedium();
          onRevoke();
        }}
        className={`p-2.5 rounded-xl transition-all cursor-pointer shrink-0 flex items-center justify-center active:scale-95 ${
          session.isCurrent
            ? "text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20"
            : "text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20"
        }`}
        title={session.isCurrent ? "Log out this device" : "Terminate this session"}
        aria-label={session.isCurrent ? "Log Out" : "Terminate Session"}
      >
        {session.isCurrent ? (
          <LogOut className="w-4 h-4 text-rose-500" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}

const SESSIONS_CACHE_KEY = "attendx_cached_linked_devices";

function createLocalFallbackSession(): Session {
  const os = detectRealHostOS();
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  let browser = "Google Chrome";
  if (ua.includes("Firefox")) browser = "Mozilla Firefox";
  else if (ua.includes("Edg")) browser = "Microsoft Edge";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Apple Safari";
  else if (ua.includes("Brave")) browser = "Brave Browser";

  return {
    id: "current-local-session",
    userAgent: ua || null,
    ipAddress: "127.0.0.1",
    location: "This device",
    deviceType: /Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop",
    os: os,
    browser: browser,
    lastActive: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    isCurrent: true,
  };
}

function getPersistedSessions(): Session[] {
  try {
    const raw = localStorage.getItem(SESSIONS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return [createLocalFallbackSession()];
}

function savePersistedSessions(data: Session[]) {
  try {
    if (Array.isArray(data) && data.length > 0) {
      localStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify(data));
    }
  } catch (_) {}
}

let cachedSessions: Session[] | null = getPersistedSessions();
let cachedGpsCoords: { lat: number; lon: number; ts: number } | null = null;

async function resolveDeviceGpsCoords(forceFresh = false): Promise<{ lat: number; lon: number } | null> {
  if (!forceFresh && cachedGpsCoords && Date.now() - cachedGpsCoords.ts < 5 * 60 * 1000) {
    return { lat: cachedGpsCoords.lat, lon: cachedGpsCoords.lon };
  }
  try {
    const raw = sessionStorage.getItem("attendx_live_coords");
    if (!forceFresh && raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.lat && parsed?.lon && Date.now() - (parsed.ts || 0) < 5 * 60 * 1000) {
        cachedGpsCoords = parsed;
        return { lat: parsed.lat, lon: parsed.lon };
      }
    }
  } catch {}

  try {
    const { Capacitor } = await import("@capacitor/core");
    const { Geolocation } = await import("@capacitor/geolocation");
    if (Capacitor.isNativePlatform()) {
      const perms = await Geolocation.checkPermissions();
      if (perms.location !== "granted" && perms.coarseLocation !== "granted") {
        const reqPerms = await Geolocation.requestPermissions().catch(() => null);
        if (reqPerms && reqPerms.location !== "granted" && reqPerms.coarseLocation !== "granted") {
          return null;
        }
      }
    }
    const pos = await Geolocation.getCurrentPosition({
      timeout: 6000,
      maximumAge: forceFresh ? 30000 : 180000,
      enableHighAccuracy: false,
    });
    const coords = {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      ts: Date.now(),
    };
    cachedGpsCoords = coords;
    try {
      sessionStorage.setItem("attendx_live_coords", JSON.stringify(coords));
    } catch {}
    return { lat: coords.lat, lon: coords.lon };
  } catch {
    return null;
  }
}

export const LinkedDevicesModal: React.FC<LinkedDevicesProps> = ({ isOpen, onClose }) => {
  useHardwareBack(isOpen, onClose);
  useScrollLock(isOpen);
  const { user, setUser } = useAuthStore();
  const [sessions, setSessions] = useState<Session[]>(() => {
    const list =
      cachedSessions && cachedSessions.length > 0
        ? cachedSessions
        : getPersistedSessions();
    return list && list.length > 0 ? list : [createLocalFallbackSession()];
  });
  const [loading, setLoading] = useState(false);
  const [terminatingSessionIds, setTerminatingSessionIds] = useState<string[]>([]);

  const rawCurrentSession =
    sessions.find((s) => s.isCurrent) ||
    sessions[0] ||
    createLocalFallbackSession();
  const realHostOS = detectRealHostOS();
  const currentSession = rawCurrentSession && (realHostOS === "Windows" || realHostOS === "macOS" || realHostOS === "Linux") && !String(rawCurrentSession.browser || "").startsWith("AttendX")
    ? {
        ...rawCurrentSession,
        os: realHostOS,
        deviceType: "desktop",
        browser: (rawCurrentSession.browser || "Google Chrome").replace(/^Mobile\s+/i, ""),
      }
    : rawCurrentSession;
  const otherSessions = sessions.filter((s) => s.id !== currentSession.id && !s.isCurrent);

  // Pre-warm sessions and live GPS coordinates on mount so opening Linked Devices is instant (0ms spinner)
  useEffect(() => {
    if (!cachedSessions) {
      api.get("/users/sessions")
        .then((res) => {
          if (Array.isArray(res.data)) {
            cachedSessions = res.data;
            savePersistedSessions(res.data);
            setSessions(res.data);
          }
        })
        .catch(() => {
          const persisted = getPersistedSessions();
          if (persisted) {
            cachedSessions = persisted;
            setSessions(persisted);
          }
        });
    }
    resolveDeviceGpsCoords(false).then((loc) => {
      if (loc) {
        api.get("/users/sessions", {
          headers: { "x-attendx-lat": String(loc.lat), "x-attendx-lon": String(loc.lon) },
          params: { _loc: 1 },
        })
          .then((res) => {
            if (Array.isArray(res.data)) {
              cachedSessions = res.data;
              savePersistedSessions(res.data);
              setSessions(res.data);
            }
          })
          .catch(() => {});
      }
    });
  }, []);

  useEffect(() => {
    let timeout: any;
    let isMounted = true;
    
    const refresh = async (isBackground = false) => {
      if (!isMounted) return;
      await fetchSessions(isBackground);
      if (isMounted) {
        timeout = setTimeout(() => refresh(true), 30000);
      }
    };
    
    if (isOpen) {
      refresh(false);
      if (!cachedGpsCoords) {
        resolveDeviceGpsCoords(true).then((loc) => {
          if (loc && isMounted) {
            api.get("/users/sessions", {
              headers: { "x-attendx-lat": String(loc.lat), "x-attendx-lon": String(loc.lon) },
              params: { _locSync: Date.now() },
            }).then((res) => {
              if (Array.isArray(res.data) && isMounted) {
                cachedSessions = res.data;
                savePersistedSessions(res.data);
                setSessions(res.data);
              }
            }).catch(() => {});
          }
        });
      }
    }
    
    return () => { 
      isMounted = false;
      if (timeout) clearTimeout(timeout); 
    };
  }, [isOpen]);

  const fetchSessions = async (isBackground = false) => {
    try {
      if (!cachedSessions || cachedSessions.length === 0) {
        setLoading(true);
      }
      const knownCoords = cachedGpsCoords;
      const res = await api.get("/users/sessions", {
        headers: knownCoords
          ? { "x-attendx-lat": String(knownCoords.lat), "x-attendx-lon": String(knownCoords.lon) }
          : undefined,
      });
      if (Array.isArray(res.data)) {
        cachedSessions = res.data;
        savePersistedSessions(res.data);
        setSessions(res.data);
      } else {
        const persisted = getPersistedSessions();
        setSessions(persisted || []);
      }

      // Non-blocking live GPS coordinate refresh so traveling between cities updates location automatically
      resolveDeviceGpsCoords(!isBackground).then((freshLoc) => {
        if (!freshLoc) return;
        const coordChanged =
          !knownCoords ||
          Math.abs(freshLoc.lat - knownCoords.lat) > 0.01 ||
          Math.abs(freshLoc.lon - knownCoords.lon) > 0.01;
        const currentLoc = (Array.isArray(res.data) ? res.data : []).find((s: Session) => s.isCurrent)?.location;
        if (coordChanged || !currentLoc || currentLoc === "Unknown Location") {
          api.get("/users/sessions", {
            headers: { "x-attendx-lat": String(freshLoc.lat), "x-attendx-lon": String(freshLoc.lon) },
            params: { _locSync: Date.now() },
          })
            .then((freshRes) => {
              if (Array.isArray(freshRes.data)) {
                cachedSessions = freshRes.data;
                savePersistedSessions(freshRes.data);
                setSessions(freshRes.data);
              }
            })
            .catch(() => {});
        }
      });
    } catch (e: any) {
      // Offline fallback: load persisted sessions seamlessly with zero annoying error toasts
      const persisted = getPersistedSessions();
      if (persisted && persisted.length > 0) {
        cachedSessions = persisted;
        setSessions(persisted);
      } else if (!isBackground && (!cachedSessions || cachedSessions.length === 0)) {
        if (navigator.onLine) {
          toast.error(e.response?.data?.message || "Failed to load devices");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = (session: Session) => {
    if (!session.isCurrent && typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Internet connection required to terminate remote sessions.");
      return;
    }
    SoundFX.warmUp();
    confirmDeleteToast({
      title: session.isCurrent ? "Log Out Current Device?" : "Terminate Linked Device?",
      description: session.isCurrent
        ? "You will be logged out of AttendX on this device. You will need to sign in again to access your attendance."
        : `Do you want to log out and terminate the active session for ${getSessionTitle(session)}?`,
      itemName: getSessionTitle(session) + (session.isCurrent ? " (Current Device)" : ""),
      confirmLabel: session.isCurrent ? "Log Out" : "Terminate Session",
      cancelLabel: "Keep Active",
      icon: session.isCurrent ? <LogOut className="w-5 h-5 text-rose-500" /> : <Trash2 className="w-5 h-5 text-rose-500" />,
      onConfirm: async () => {
        if (!session.isCurrent && typeof navigator !== "undefined" && !navigator.onLine) {
          toast.error("Internet connection required to terminate remote sessions.");
          return;
        }
        // 1. Instant aerodynamic whoosh sound & tactile kick
        SoundFX.playWhooshSound();
        hapticHeavy();

        // 2. Trigger whoosh flight trajectory animation
        setTerminatingSessionIds((prev) => [...prev, session.id]);

        if (session.isCurrent) {
          if (typeof navigator !== "undefined" && navigator.onLine) {
            api.delete(`/users/sessions/${session.id}`).catch(() => {});
          }
        }

        // 3. Dynamic Island HUD notification fires as row whooshes off
        setTimeout(() => {
          triggerDynamicHUD({
            type: "trash",
            label: session.isCurrent ? "Device Logged Out" : "Session Terminated",
            durationMs: 3500,
          });
        }, 550);

        // 4. Smooth eviction & logout right when the 1.2s whoosh animation completes
        setTimeout(async () => {
          if (session.isCurrent) {
            onClose();
            useAuthStore.getState().logout(true);
            return;
          }

          setSessions((prev) => {
            const next = prev.filter((s) => s.id !== session.id);
            cachedSessions = next;
            savePersistedSessions(next);
            return next;
          });
          setTerminatingSessionIds((prev) => prev.filter((id) => id !== session.id));

          try {
            await api.delete(`/users/sessions/${session.id}`);
          } catch (e: any) {
            toast.error(e.response?.data?.message || "Failed to terminate session");
            fetchSessions(true);
          }
        }, 1200);
      },
    });
  };

  const handleSignOutAllOthers = () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Internet connection required to terminate remote sessions.");
      return;
    }
    SoundFX.warmUp();
    confirmDeleteToast({
      title: "Terminate All Other Sessions?",
      description: "This will immediately sign out all linked devices and active sessions across all platforms except this device.",
      itemName: `${otherSessions.length} active session${otherSessions.length > 1 ? "s" : ""}`,
      confirmLabel: "Terminate All",
      cancelLabel: "Keep Active",
      icon: <Trash2 className="w-5 h-5 text-rose-500" />,
      onConfirm: async () => {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          toast.error("Internet connection required to terminate remote sessions.");
          return;
        }
        SoundFX.playWhooshSound();
        hapticHeavy();

        const ids = otherSessions.map((s) => s.id);
        setTerminatingSessionIds(ids);

        setTimeout(() => {
          triggerDynamicHUD({
            type: "trash",
            label: "All Other Sessions Terminated",
            durationMs: 3800,
          });
        }, 600);

        setTimeout(async () => {
          setSessions((prev) => {
            const next = prev.filter((s) => s.isCurrent);
            cachedSessions = next;
            savePersistedSessions(next);
            return next;
          });
          setTerminatingSessionIds([]);

          try {
            await api.delete("/users/sessions");
            fetchSessions(true);
          } catch (e: any) {
            toast.error(e.response?.data?.message || "Failed to terminate sessions");
            fetchSessions(true);
          }
        }, 1250);
      },
    });
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="theme-nova-green fixed inset-0 z-[100] flex items-center justify-center px-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] sm:p-4 touch-none">
          {/* Liquid glass backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            onClick={onClose}
            className="fixed inset-0 bg-white/50 dark:bg-black/60 backdrop-blur-md will-change-[opacity]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            transition={{ type: "spring", damping: 28, stiffness: 380, mass: 0.8 }}
            className="relative z-10 w-full max-h-[86dvh] sm:max-h-[85vh] max-w-md bg-white/85 dark:bg-[#0d0e11]/85 backdrop-blur-2xl backdrop-saturate-150 rounded-3xl flex flex-col overflow-hidden shadow-2xl border border-slate-900/10 dark:border-white/15 pointer-events-auto will-change-transform"
          >
            {/* Header */}
            <div className="flex items-center gap-4 px-4 py-3.5 bg-white/60 dark:bg-[#111216]/70 backdrop-blur-xl border-b border-border shrink-0">
              <button 
                onClick={onClose} 
                className="w-9 h-9 flex items-center justify-center -ml-1 rounded-full hover:bg-accent active:bg-accent/80 transition-colors"
                aria-label="Close Devices"
              >
                <X className="w-5 h-5 text-foreground" />
              </button>
              <h2 className="text-[19px] font-semibold text-foreground tracking-tight">Devices</h2>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto pb-[calc(2rem+env(safe-area-inset-bottom))] pr-1">
              {!navigator.onLine && sessions.length > 0 && (
                <div className="mx-4 mt-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-mono text-amber-500 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span>📶</span>
                    <span>Showing cached devices (Offline)</span>
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider">Cached</span>
                </div>
              )}
              {loading && sessions.length === 0 ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full" />
                </div>
              ) : (
                <div className="space-y-6 pt-2">
                  {/* This Device */}
                  <style>{`
                    @keyframes sessionWhooshTrajectory {
                      0% {
                        transform: perspective(700px) translateY(0) translateX(0) scale(1) rotateY(0deg) rotateZ(0deg);
                        opacity: 1;
                        filter: blur(0px);
                      }
                      22% {
                        transform: perspective(700px) translateY(-3px) translateX(-14px) scale(1.02) rotateY(-8deg) rotateZ(-1.5deg);
                        opacity: 0.95;
                        box-shadow: 0 4px 24px rgba(239, 68, 68, 0.45);
                      }
                      100% {
                        transform: perspective(700px) translateY(-22px) translateX(130%) scale(0.6) rotateY(26deg) rotateZ(12deg);
                        opacity: 0;
                        filter: blur(6px);
                        visibility: hidden;
                      }
                    }
                  `}</style>
                  {currentSession && (
                    <div className="bg-card sm:rounded-xl border-y sm:border border-border mx-0 sm:mx-4 overflow-hidden shadow-sm">
                      <p className="text-[13px] font-semibold text-[#2AABEE] px-4 pt-3 pb-1">
                        This device
                      </p>
                      <SessionRow
                        session={currentSession}
                        onRevoke={() => handleRevoke(currentSession)}
                        isTerminating={terminatingSessionIds.includes(currentSession.id)}
                        onRequestLocation={async () => {
                          hapticSelection();
                          triggerDynamicHUD({
                            type: "sparkle",
                            label: "Resolving Location",
                            subtitle: "Requesting location permission for active session",
                            durationMs: 3500,
                          });
                          try {
                            const loc = await resolveDeviceGpsCoords(true);
                            if (loc) {
                              const res = await api.get("/users/sessions", {
                                headers: { "x-attendx-lat": String(loc.lat), "x-attendx-lon": String(loc.lon) },
                                params: { _locSync: Date.now() },
                              });
                              if (Array.isArray(res.data)) {
                                cachedSessions = res.data;
                                savePersistedSessions(res.data);
                                setSessions(res.data);
                              }
                            }
                          } catch {
                            toast.error("Unable to refresh device location right now.");
                          }
                        }}
                      />
                      {otherSessions.length > 0 && (
                        <>
                          <div className="h-px bg-border/60 mx-4" />
                          <button
                            type="button"
                            onClick={handleSignOutAllOthers}
                            className="w-full flex items-center gap-4 px-4 py-3 hover:bg-accent/60 active:bg-accent/80 transition-colors text-left cursor-pointer"
                          >
                            <div className="w-11 h-11 flex items-center justify-center shrink-0">
                              <svg className="w-6 h-6 text-[#E53935]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 10V6a2 2 0 1 0-4 0v4M14 10V4a2 2 0 1 0-4 0v6M10 10V5a2 2 0 1 0-4 0v9M6 14v-2a2 2 0 1 0-4 0v6c0 4.4 3.6 8 8 8h1.8c2.1 0 4.2-1 5.4-2.7l4.5-6.3a2.3 2.3 0 0 0-3.8-2.6l-2.9 4.1" />
                              </svg>
                            </div>
                            <span className="text-[15px] font-medium text-[#E53935]">Terminate All Other Sessions</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {otherSessions.length > 0 && currentSession && (
                    <p className="text-[13px] text-muted-foreground px-4 -mt-4 text-center sm:text-left">
                      Logs out all devices except for this one.
                    </p>
                  )}

                  {/* Active Sessions */}
                  {otherSessions.length > 0 && (
                    <div className="bg-card sm:rounded-xl border-y sm:border border-border mx-0 sm:mx-4 overflow-hidden shadow-sm">
                      <p className="text-[13px] font-semibold text-[#2AABEE] px-4 pt-3 pb-1">
                        Active sessions
                      </p>
                      {otherSessions.map((session, idx) => (
                        <div key={session.id}>
                          {idx > 0 && <div className="h-[0.5px] bg-border/60 ml-[68px]" />}
                          <SessionRow
                            session={session}
                            onRevoke={() => handleRevoke(session)}
                            isTerminating={terminatingSessionIds.includes(session.id)}
                            staggerDelay={terminatingSessionIds.length > 1 ? idx * 45 : 0}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-[14px] text-muted-foreground px-4 text-center sm:text-left leading-relaxed">
                    The official AttendX app is currently available for Windows, macOS, and Android.
                  </p>

                  {/* Auto-terminate setting */}
                  <div className="bg-card sm:rounded-xl border-y sm:border border-border mx-0 sm:mx-4 overflow-hidden mb-6 shadow-sm">
                    <p className="text-[13px] font-semibold text-[#2AABEE] px-4 pt-3 pb-1">
                      Automatically terminate old sessions
                    </p>
                    <div className="flex items-center justify-between px-4 py-3.5">
                      <span className="text-[15px] text-foreground">If inactive for</span>
                      <select 
                        value={user?.autoTerminateMonths || 0}
                        onChange={async (e) => {
                          if (typeof navigator !== "undefined" && !navigator.onLine) {
                            toast.error("Internet connection required to update security preferences.");
                            return;
                          }
                          const val = parseInt(e.target.value);
                          try {
                            await api.patch("/users/me", { autoTerminateMonths: val === 0 ? null : val });
                            if (setUser && user) {
                              setUser({ ...user, autoTerminateMonths: val === 0 ? undefined : val });
                            }
                            // Select dropdown reflects updated preference immediately
                          } catch (err: any) {
                            toast.error("Failed to update preference");
                          }
                        }}
                        className="bg-transparent text-[15px] text-[#2AABEE] font-medium outline-none cursor-pointer"
                      >
                        <option value={0} className="text-foreground">Never</option>
                        <option value={1} className="text-foreground">1 month</option>
                        <option value={3} className="text-foreground">3 months</option>
                        <option value={6} className="text-foreground">6 months</option>
                        <option value={12} className="text-foreground">1 year</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
