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
  const osLower = (os || "").toLowerCase();
  
  if (osLower.includes("android")) {
    return (
      <div className="w-11 h-11 rounded-full bg-[#5fcb45] flex items-center justify-center shrink-0">
        <svg className="w-6 h-6 text-white" viewBox="0 0 576 512" fill="currentColor">
          <path d="M420.55,301.93a24,24,0,1,1,24-24,24,24,0,0,1-24,24m-265.1,0a24,24,0,1,1,24-24,24,24,0,0,1-24,24m273.7-144.48,47.94-83a10,10,0,1,0-17.27-10h0l-48.54,84.07a301.25,301.25,0,0,0-246.56,0L116.18,64.45a10,10,0,1,0-17.27,10h0l48,83.24C73.16,207.9,24,297,24,400v20h528v-20c0-103-49.16-192.1-122.85-242.55"/>
        </svg>
      </div>
    );
  }
  
  if (osLower.includes("ios") || osLower.includes("mac")) {
    return (
      <div className="w-11 h-11 rounded-full bg-black dark:bg-white flex items-center justify-center shrink-0">
        <svg className="w-5 h-5 text-white dark:text-black" viewBox="0 0 384 512" fill="currentColor">
          <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
        </svg>
      </div>
    );
  }
  
  if (osLower.includes("windows")) {
    return (
      <div className="w-11 h-11 rounded-full bg-[#2AABEE] flex items-center justify-center shrink-0">
        <svg className="w-5 h-5 text-white" viewBox="0 0 448 512" fill="currentColor">
          <path d="M0 93.7l183.6-25.3v177.4H0V93.7zm0 324.6l183.6 25.3V268.4H0v149.9zm203.8 28L448 480V268.4H203.8v177.9zm0-380.6v180.1H448V32L203.8 65.7z"/>
        </svg>
      </div>
    );
  }
  
  const isBrowser = browser && browser !== "AttendX App" && browser !== "Unknown Browser";
  if (isBrowser) {
    return (
      <div className="w-11 h-11 rounded-full bg-violet-500 flex items-center justify-center shrink-0">
        <Globe className="w-5 h-5 text-white" />
      </div>
    );
  }
  
  return (
    <div className="w-11 h-11 rounded-full bg-[#2AABEE] flex items-center justify-center shrink-0">
      <Laptop className="w-5 h-5 text-white" />
    </div>
  );
}

function getSessionTitle(session: Session) {
  const os = session.os || "Unknown";
  const browser = session.browser || "Unknown";
  
  if (browser !== "AttendX App" && browser !== "Unknown Browser" && browser !== "Browser") {
    return `${browser} Browser`;
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
  
  if (browser === "AttendX App") {
    // Faking version 1.0.0 for native apps since we don't store it in the DB yet
    return `AttendX ${os} 1.0.0`;
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
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  const currentSession = sessions.find((s) => s.isCurrent);
  const otherSessions = sessions.filter((s) => !s.isCurrent);

  useEffect(() => {
    let interval: any;
    if (isOpen) {
      fetchSessions();
      interval = setInterval(fetchSessions, 5000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isOpen]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await api.get("/users/sessions");
      setSessions(res.data);
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to load devices");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (sessionId: string, isCurrent: boolean) => {
    if (isCurrent) {
      if (!window.confirm("You will be logged out of this device. Click OK to confirm.")) return;
    }
    try {
      await api.delete(`/users/sessions/${sessionId}`);
      toast.success("Device signed out successfully");
      if (isCurrent) { useAuthStore.getState().logout(); return; }
      setSessions((s) => s.filter((x) => x.id !== sessionId));
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to sign out");
    }
  };

  const handleSignOutAllOthers = async () => {
    if (!window.confirm("This will log you out of all other devices. Continue?")) return;
    try {
      await api.delete("/users/sessions");
      toast.success("Signed out of all other devices");
      await fetchSessions();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to sign out");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4 bg-background sm:bg-black/40 sm:backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-md bg-muted/30 sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl border-x-0 sm:border border-border"
          >
            {/* Header */}
            <div className="flex items-center gap-4 px-4 py-3 bg-card border-b border-border shrink-0">
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center -ml-1 rounded-full hover:bg-accent transition-colors">
                <X className="w-5 h-5 text-foreground" />
              </button>
              <h2 className="text-[19px] font-semibold text-foreground">Devices</h2>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto pb-8 custom-scrollbar">
              <div className="text-center px-8 py-6">
                <p className="text-[15px] text-foreground leading-relaxed">
                  Log into <span className="text-[#2AABEE]">AttendX Web</span> or <span className="text-[#2AABEE]">AttendX Mobile</span><br/>by entering your credentials.
                </p>
                <button
                  onClick={onClose}
                  className="mt-5 w-full bg-[#2AABEE] hover:bg-[#2AABEE]/90 text-white font-medium py-2.5 rounded-xl transition-colors"
                >
                  Link Desktop Device
                </button>
              </div>

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
                    The official AttendX app is available for Android, iPhone, iPad, Windows, macOS and Linux.
                  </p>

                  {/* Auto-terminate setting mock */}
                  <div className="bg-card sm:rounded-xl border-y sm:border border-border mx-0 sm:mx-4 overflow-hidden mb-6">
                    <p className="text-[13px] font-semibold text-[#2AABEE] px-4 pt-3 pb-1">
                      Automatically terminate old sessions
                    </p>
                    <div className="flex items-center justify-between px-4 py-3.5">
                      <span className="text-[15px] text-foreground">If inactive for</span>
                      <span className="text-[15px] text-[#2AABEE]">3 months</span>
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
