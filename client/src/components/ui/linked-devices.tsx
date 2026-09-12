import { FaWindows, FaApple, FaLinux } from "react-icons/fa";
import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../stores/authStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Globe,
  Laptop,
} from "lucide-react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { useHardwareBack } from "../../hooks/useHardwareBack";

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
  const hardwareMatch = browser.match(/\((.*?)\)/);
  if (hardwareMatch) {
    return hardwareMatch[1];
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

function SessionRow({ session, onRevoke }: { session: Session; onRevoke: () => void }) {
  const locationText = session.location && session.location !== "Unknown Location" ? session.location : null;
  const subtitle = getSessionSubtitle(session);

  return (
    <button
      onClick={onRevoke}
      className="w-full flex items-center gap-3.5 px-4 py-3 hover:bg-accent/60 transition-colors text-left"
    >
      <DeviceAvatar os={session.os} browser={session.browser} />
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <p className="text-[15px] font-semibold text-foreground leading-tight">{getSessionTitle(session)}</p>
        <p className="text-[13px] text-muted-foreground leading-snug mt-0.5">{subtitle}</p>
        <p className="text-[13px] text-muted-foreground/80 leading-snug">
          {locationText && <span>{locationText}{" \u2022 "}</span>}
          {session.isCurrent
            ? <span className="text-muted-foreground/80">online</span>
            : <span>{formatShortDate(session.lastActive)}</span>
          }
        </p>
      </div>
    </button>
  );
}

export const LinkedDevicesModal: React.FC<LinkedDevicesProps> = ({ isOpen, onClose }) => {
  useHardwareBack(isOpen, onClose);
  const { user, setUser } = useAuthStore();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  const currentSession = sessions.find((s) => s.isCurrent);
  const otherSessions = sessions.filter((s) => !s.isCurrent);

  useEffect(() => {
    let timeout: any;
    let isMounted = true;
    
    const poll = async () => {
      if (!isMounted) return;
      await fetchSessions();
      if (isMounted) {
        timeout = setTimeout(poll, 5000);
      }
    };
    
    if (isOpen) {
      poll();
    }
    
    return () => { 
      isMounted = false;
      if (timeout) clearTimeout(timeout); 
    };
  }, [isOpen]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await api.get("/users/sessions");
      if (Array.isArray(res.data)) {
        setSessions(res.data);
      } else {
        setSessions([]);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to load devices");
    } finally {
      setLoading(false);
    }
  };

  const executeRevoke = async (sessionId: string, isCurrent: boolean) => {
    try {
      await api.delete(`/users/sessions/${sessionId}`);
      toast.success("Device signed out successfully");
      if (isCurrent) { useAuthStore.getState().logout(); return; }
      setSessions((s) => s.filter((x) => x.id !== sessionId));
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to sign out");
    }
  };

  const handleRevoke = (sessionId: string, isCurrent: boolean) => {
    if (isCurrent) {
      toast("You will be logged out of this device.", {
        action: { label: "Confirm", onClick: () => executeRevoke(sessionId, isCurrent) }
      });
      return;
    }
    executeRevoke(sessionId, isCurrent);
  };

  const executeSignOutAllOthers = async () => {
    try {
      await api.delete("/users/sessions");
      toast.success("Signed out of all other devices");
      await fetchSessions();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to sign out");
    }
  };

  const handleSignOutAllOthers = () => {
    toast("Terminate all other sessions?", {
      action: { label: "Terminate", onClick: () => executeSignOutAllOthers() }
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4 bg-background sm:bg-white/60 dark:sm:bg-black/60 sm:backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-md bg-muted/30 sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl border-x-0 sm:border border-border"
          >
            {/* Header */}
            <div className="flex items-center gap-4 px-4 pb-3 bg-card border-b border-border shrink-0" style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center -ml-1 rounded-full hover:bg-accent transition-colors">
                <X className="w-5 h-5 text-foreground" />
              </button>
              <h2 className="text-[19px] font-semibold text-foreground">Devices</h2>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto pb-8 custom-scrollbar">
              

              {loading && sessions.length === 0 ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* This Device */}
                  {currentSession && (
                    <div className="bg-card sm:rounded-xl border-y sm:border border-border mx-0 sm:mx-4 overflow-hidden">
                      <p className="text-[13px] font-semibold text-[#2AABEE] px-4 pt-3 pb-1">
                        This device
                      </p>
                      <SessionRow session={currentSession} onRevoke={() => handleRevoke(currentSession.id, true)} />
                      {otherSessions.length > 0 && (
                        <>
                          <div className="h-px bg-border mx-4" />
                          <button
                            onClick={handleSignOutAllOthers}
                            className="w-full flex items-center gap-4 px-4 py-3 hover:bg-accent/60 transition-colors text-left"
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
                          {idx > 0 && <div className="h-[0.5px] bg-border ml-[68px]" />}
                          <SessionRow session={session} onRevoke={() => handleRevoke(session.id, false)} />
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-[14px] text-muted-foreground px-4 text-center sm:text-left leading-relaxed">
                    The official AttendX app is currently available for Windows, macOS, and Android.
                  </p>

                  {/* Auto-terminate setting mock */}
                  <div className="bg-card sm:rounded-xl border-y sm:border border-border mx-0 sm:mx-4 overflow-hidden mb-6">
                    <p className="text-[13px] font-semibold text-[#2AABEE] px-4 pt-3 pb-1">
                      Automatically terminate old sessions
                    </p>
                    <div className="flex items-center justify-between px-4 py-3.5">
                      <span className="text-[15px] text-foreground">If inactive for</span>
                      <select 
    value={user?.autoTerminateMonths || 0}
    onChange={async (e) => {
      const val = parseInt(e.target.value);
      try {
        await api.patch("/users/me", { autoTerminateMonths: val === 0 ? null : val });
        if (setUser && user) {
          setUser({ ...user, autoTerminateMonths: val === 0 ? undefined : val });
        }
        toast.success("Preference updated");
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
    </AnimatePresence>
  );
};
