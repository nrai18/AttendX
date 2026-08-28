import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../stores/authStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Smartphone,
  Monitor,
  Globe,
  LogOut,
  CheckCircle2,
  Laptop,
  ShieldCheck,
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

export const LinkedDevicesModal: React.FC<LinkedDevicesProps> = ({
  isOpen,
  onClose,
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSignOutAllOthers = async () => {
    try {
      await api.delete("/users/sessions");
      toast.success("Signed out of all other devices");
      await fetchSessions();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to sign out");
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
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
      if (
        !window.confirm(
          "You will be logged out of this device. Click OK to confirm.",
        )
      ) {
        return;
      }
    }
    try {
      await api.delete(`/users/sessions/${sessionId}`);
      toast.success("Device signed out successfully");
      if (isCurrent) {
        useAuthStore.getState().logout();
        return;
      }
      setSessions((s) => s.filter((x) => x.id !== sessionId));
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to sign out");
    }
  };

  const DeviceIcon = ({
    type,
    os,
  }: {
    type: string | null;
    os: string | null;
  }) => {
    if (type === "mobile" || os?.includes("Android") || os?.includes("iOS"))
      return <Smartphone className="w-8 h-8 text-emerald-500" />;
    if (type === "desktop" || os?.includes("Windows") || os?.includes("Mac"))
      return <Monitor className="w-8 h-8 text-emerald-500" />;
    return <Laptop className="w-8 h-8 text-emerald-500" />;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "long" })} ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-[#0F172A] rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="flex items-center gap-4 p-4 border-b border-white/10 shrink-0">
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              <h2 className="text-xl font-medium text-white tracking-wide">
                Active sessions
              </h2>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div className="mb-2 flex justify-between items-end mt-2">
                <div>
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Device Status
                  </h3>
                  <p className="text-sm text-slate-300 mb-4">
                    Tap a device to log out.
                  </p>
                </div>
                {sessions.length > 1 && (
                  <button
                    onClick={handleSignOutAllOthers}
                    className="text-[13px] text-red-400 hover:text-red-300 mb-4 font-medium transition-colors"
                  >
                    Sign out all others
                  </button>
                )}
              </div>

              {loading ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full" />
                </div>
              ) : (
                <div className="space-y-1">
                  {sessions.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">
                      No linked devices found.
                    </p>
                  ) : (
                    sessions.map((session) => (
                      <div
                        key={session.id}
                        className="group flex flex-col p-3 rounded-xl hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center shrink-0">
                            <DeviceIcon
                              type={session.deviceType}
                              os={session.os}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-base font-medium text-white truncate">
                              {session.os || "Unknown OS"}{" "}
                              {session.browser &&
                              session.browser !== "Unknown Browser"
                                ? `(${session.browser})`
                                : ""}
                              {session.isCurrent && " (This Device)"}
                            </h4>
                            <div className="text-sm text-slate-400 truncate">
                              {session.location &&
                              session.location !== "Unknown Location"
                                ? session.location + " � "
                                : ""}
                              {session.isCurrent ? (
                                <span className="text-emerald-500">
                                  Active now
                                </span>
                              ) : (
                                `Last active ${formatDate(session.lastActive)}`
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() =>
                              handleRevoke(session.id, session.isCurrent)
                            }
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Log out"
                          >
                            <LogOut className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 text-center shrink-0">
              <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Your data is{" "}
                <span className="text-emerald-500 font-medium">
                  end-to-end encrypted
                </span>{" "}
                on all your devices.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
