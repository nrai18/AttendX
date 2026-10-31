import React, { useState, useEffect, useMemo } from "react";
import { 
  Users, 
  X, 
  ShieldCheck, 
  Check, 
  Search, 
  Loader2, 
  Radio, 
  CheckSquare, 
  Square, 
  VolumeX, 
  Megaphone,
  UserCheck,
  AlertCircle
} from "lucide-react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { SoundFX } from "../../utils/soundEffects";
import { hapticLight, hapticMedium, hapticSuccess, hapticSelection } from "../../utils/haptics";
import { triggerDynamicHUD } from "../ui/dynamic-island-hud";

export interface ClassroomMemberItem {
  id: string;
  userId: string;
  role: "admin" | "member";
  joinedAt: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  rollNumber?: string | null;
  department?: string | null;
  batch?: string | null;
}

interface ClassroomRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  classroomId: string;
  classroomName: string;
  isCrOrAdmin: boolean;
  initialPermission?: "admins" | "everyone" | "only_selected" | "everyone_except";
  initialAllowedPosterIds?: string[];
  initialDeniedPosterIds?: string[];
  onPermissionsUpdated?: (newPerms: {
    broadcastPermission: "admins" | "everyone" | "only_selected" | "everyone_except";
    allowedPosterIds: string[];
    deniedPosterIds: string[];
  }) => void;
}

const AVATAR_COLORS = [
  "bg-blue-600/20 text-blue-400 border-blue-500/30",
  "bg-emerald-600/20 text-emerald-400 border-emerald-500/30",
  "bg-purple-600/20 text-purple-400 border-purple-500/30",
  "bg-amber-600/20 text-amber-400 border-amber-500/30",
  "bg-rose-600/20 text-rose-400 border-rose-500/30",
  "bg-teal-600/20 text-teal-400 border-teal-500/30",
  "bg-cyan-600/20 text-cyan-400 border-cyan-500/30",
  "bg-pink-600/20 text-pink-400 border-pink-500/30",
];

const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
};

export const ClassroomRosterModal: React.FC<ClassroomRosterModalProps> = ({
  isOpen,
  onClose,
  classroomId,
  classroomName,
  isCrOrAdmin,
  initialPermission = "admins",
  initialAllowedPosterIds = [],
  initialDeniedPosterIds = [],
  onPermissionsUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<"roster" | "permissions">("roster");
  const [members, setMembers] = useState<ClassroomMemberItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Permission management state
  const [permissionMode, setPermissionMode] = useState<"admins" | "everyone" | "only_selected" | "everyone_except">(initialPermission);
  const [selectedAllowedIds, setSelectedAllowedIds] = useState<string[]>(initialAllowedPosterIds);
  const [selectedDeniedIds, setSelectedDeniedIds] = useState<string[]>(initialDeniedPosterIds);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  useEffect(() => {
    if (isOpen && classroomId) {
      fetchMembers();
      setPermissionMode(initialPermission);
      setSelectedAllowedIds(initialAllowedPosterIds);
      setSelectedDeniedIds(initialDeniedPosterIds);
    }
  }, [isOpen, classroomId, initialPermission]);

  const fetchMembers = async () => {
    try {
      setIsLoading(true);
      const res = await api.get(`/classrooms/${classroomId}/members`);
      const data = Array.isArray(res.data?.members) ? res.data.members : [];
      setMembers(data);
    } catch (error) {
      console.error("Failed to fetch classroom members:", error);
      toast.error("Failed to load section classmates");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.email && m.email.toLowerCase().includes(q)) ||
        (m.rollNumber && m.rollNumber.toLowerCase().includes(q))
    );
  }, [members, searchQuery]);

  const toggleAllowedUser = (userId: string) => {
    hapticSelection();
    setSelectedAllowedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleDeniedUser = (userId: string) => {
    hapticSelection();
    setSelectedDeniedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSavePermissions = async () => {
    try {
      setIsSavingPermissions(true);
      SoundFX.playWhooshSound(0.24);
      hapticMedium();

      await api.patch(`/classrooms/${classroomId}/permissions`, {
        broadcastPermission: permissionMode,
        allowedPosterIds: permissionMode === "only_selected" ? selectedAllowedIds : [],
        deniedPosterIds: permissionMode === "everyone_except" ? selectedDeniedIds : [],
      });

      hapticSuccess();
      triggerDynamicHUD({
        type: "success",
        label: "Posting Access Updated",
        subtitle: `Policy: ${
          permissionMode === "everyone"
            ? "Open to all enrolled peers"
            : permissionMode === "only_selected"
            ? `${selectedAllowedIds.length} approved members`
            : permissionMode === "everyone_except"
            ? `${selectedDeniedIds.length} restricted peers`
            : "Strict CR Admin broadcast"
        }`,
        durationMs: 4200,
      });

      if (onPermissionsUpdated) {
        onPermissionsUpdated({
          broadcastPermission: permissionMode,
          allowedPosterIds: permissionMode === "only_selected" ? selectedAllowedIds : [],
          deniedPosterIds: permissionMode === "everyone_except" ? selectedDeniedIds : [],
        });
      }

      setActiveTab("roster");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update permissions");
    } finally {
      setIsSavingPermissions(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#0c0d0e] border border-neutral-200 dark:border-white/15 rounded-3xl w-full max-w-lg max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Top Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-border/40 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 flex items-center justify-center text-neutral-800 dark:text-neutral-200 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                Classroom Roster
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-400">
                  {members.length} {members.length === 1 ? "Peer" : "Peers"}
                </span>
              </h3>
              <p className="text-xs text-muted-foreground truncate max-w-[260px] sm:max-w-xs">
                {classroomName} • Synchronized Section Roster
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              hapticLight();
              onClose();
            }}
            className="w-8 h-8 rounded-full hover:bg-neutral-100 dark:hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher (Visible to CR/Admins) */}
        {isCrOrAdmin && (
          <div className="px-5 pt-3 border-b border-border/40 flex gap-2 bg-neutral-50/60 dark:bg-black/30 shrink-0">
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setActiveTab("roster");
              }}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === "roster"
                  ? "border-neutral-900 dark:border-white text-neutral-900 dark:text-white"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Classmates List ({members.length})
            </button>
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setActiveTab("permissions");
              }}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === "permissions"
                  ? "border-neutral-900 dark:border-white text-neutral-900 dark:text-white"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" />
              Broadcast Access
              {permissionMode !== "admins" && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>
          </div>
        )}

        {/* Main Tab Body */}
        {activeTab === "roster" ? (
          /* TAB 1: CLASSMATES ROSTER */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Search Filter Bar */}
            <div className="p-3 sm:px-5 border-b border-border/40 shrink-0 bg-white dark:bg-[#0c0d0e]">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter classmates by name or roll number..."
                  className="w-full bg-neutral-50 dark:bg-[#050507] border border-neutral-200 dark:border-white/10 rounded-xl pl-9 pr-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-neutral-900 dark:focus:border-white transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Members Scroll List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5 divide-y divide-border/20">
              {isLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-neutral-900 dark:text-white" />
                  <p className="text-xs text-muted-foreground font-mono">Loading section classmates...</p>
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {searchQuery ? "No matching classmates found" : "No enrolled members yet"}
                  </p>
                </div>
              ) : (
                filteredMembers.map((m) => {
                  const isAdmin = m.role === "admin";
                  const avatarColorClass = getAvatarColor(m.name);
                  const firstInitial = (m.name?.[0] || "U").toUpperCase();

                  return (
                    <div
                      key={m.id}
                      className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        {m.avatarUrl && m.avatarUrl !== "null" ? (
                          <img
                            src={m.avatarUrl}
                            alt={m.name}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.src = `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(
                                m.name
                              )}`;
                            }}
                            className="w-9 h-9 rounded-full object-cover shrink-0 border border-neutral-200 dark:border-white/10 shadow-xs"
                          />
                        ) : (
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 border shadow-xs ${avatarColorClass}`}
                          >
                            {firstInitial}
                          </div>
                        )}

                        {/* Name and Info */}
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-foreground truncate uppercase tracking-tight flex items-center gap-1.5">
                            {m.name}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground truncate">
                            {m.rollNumber ? (
                              <span>Roll: {m.rollNumber}</span>
                            ) : (
                              <span>{m.email}</span>
                            )}
                            {m.department && (
                              <>
                                <span>•</span>
                                <span>{m.department}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Role & Permissions Tag */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            CR / Admin
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-muted-foreground">
                            Classmate
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* TAB 2: BROADCAST PERMISSIONS CONFIGURATION (CR/Admin) */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border/40 space-y-3 bg-neutral-50/40 dark:bg-black/20 shrink-0">
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-2">
                  Select Who Can Post Announcements
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {/* Mode 1: Admins Only */}
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setPermissionMode("admins");
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      permissionMode === "admins"
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-black border-transparent shadow-sm"
                        : "bg-white dark:bg-[#0c0d0e] border-neutral-200 dark:border-white/10 text-foreground hover:bg-neutral-100 dark:hover:bg-white/5"
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      CR / Admins Only
                    </div>
                    <p className={`text-[10px] mt-1 ${permissionMode === "admins" ? "opacity-80" : "text-muted-foreground"}`}>
                      Strict academic broadcast
                    </p>
                  </button>

                  {/* Mode 2: Everyone */}
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setPermissionMode("everyone");
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      permissionMode === "everyone"
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-black border-transparent shadow-sm"
                        : "bg-white dark:bg-[#0c0d0e] border-neutral-200 dark:border-white/10 text-foreground hover:bg-neutral-100 dark:hover:bg-white/5"
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      Everyone
                    </div>
                    <p className={`text-[10px] mt-1 ${permissionMode === "everyone" ? "opacity-80" : "text-muted-foreground"}`}>
                      Open section stream
                    </p>
                  </button>

                  {/* Mode 3: A Few (Selected Peers) */}
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setPermissionMode("only_selected");
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      permissionMode === "only_selected"
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-black border-transparent shadow-sm"
                        : "bg-white dark:bg-[#0c0d0e] border-neutral-200 dark:border-white/10 text-foreground hover:bg-neutral-100 dark:hover:bg-white/5"
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5" />
                      A Few (Selected Peers)
                    </div>
                    <p className={`text-[10px] mt-1 ${permissionMode === "only_selected" ? "opacity-80" : "text-muted-foreground"}`}>
                      Only designated students
                    </p>
                  </button>

                  {/* Mode 4: Everyone Except a Few */}
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setPermissionMode("everyone_except");
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      permissionMode === "everyone_except"
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-black border-transparent shadow-sm"
                        : "bg-white dark:bg-[#0c0d0e] border-neutral-200 dark:border-white/10 text-foreground hover:bg-neutral-100 dark:hover:bg-white/5"
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <VolumeX className="w-3.5 h-3.5" />
                      Everyone Except A Few
                    </div>
                    <p className={`text-[10px] mt-1 ${permissionMode === "everyone_except" ? "opacity-80" : "text-muted-foreground"}`}>
                      Mute restricted students
                    </p>
                  </button>
                </div>
              </div>

              {/* Status Note */}
              <div className="p-2.5 rounded-xl bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-[11px] text-muted-foreground flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                <span>
                  {permissionMode === "admins" && "Only designated CRs and Admins can broadcast notices."}
                  {permissionMode === "everyone" && "All enrolled section classmates can publish announcements."}
                  {permissionMode === "only_selected" && `Select below which classmates can broadcast (${selectedAllowedIds.length} approved).`}
                  {permissionMode === "everyone_except" && `Select below which classmates are restricted from broadcasting (${selectedDeniedIds.length} restricted).`}
                </span>
              </div>
            </div>

            {/* Checklist of Peers (when "only_selected" or "everyone_except") */}
            {(permissionMode === "only_selected" || permissionMode === "everyone_except") && (
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                  {permissionMode === "only_selected"
                    ? "Check peers to grant posting access:"
                    : "Check peers to restrict / mute from posting:"}
                </p>

                {members
                  .filter((m) => m.role !== "admin")
                  .map((m) => {
                    const isSelected =
                      permissionMode === "only_selected"
                        ? selectedAllowedIds.includes(m.userId)
                        : selectedDeniedIds.includes(m.userId);
                    const avatarColorClass = getAvatarColor(m.name);
                    const firstInitial = (m.name?.[0] || "U").toUpperCase();

                    return (
                      <div
                        key={m.userId}
                        onClick={() => {
                          if (permissionMode === "only_selected") {
                            toggleAllowedUser(m.userId);
                          } else {
                            toggleDeniedUser(m.userId);
                          }
                        }}
                        className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? permissionMode === "only_selected"
                              ? "bg-emerald-500/10 border-emerald-500/40 text-foreground"
                              : "bg-rose-500/10 border-rose-500/40 text-foreground"
                            : "bg-white dark:bg-[#0c0d0e] border-neutral-200 dark:border-white/10 hover:border-neutral-300 dark:hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Avatar */}
                          {m.avatarUrl && m.avatarUrl !== "null" ? (
                            <img
                              src={m.avatarUrl}
                              alt={m.name}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-full object-cover shrink-0 border border-neutral-200 dark:border-white/10"
                            />
                          ) : (
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 border ${avatarColorClass}`}
                            >
                              {firstInitial}
                            </div>
                          )}

                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate uppercase">{m.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono truncate">
                              {m.rollNumber ? `Roll: ${m.rollNumber}` : m.email}
                            </p>
                          </div>
                        </div>

                        {/* Interactive Indicator */}
                        <div className="shrink-0">
                          {isSelected ? (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md ${
                                permissionMode === "only_selected"
                                  ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                  : "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              <Check className="w-3 h-3" />
                              {permissionMode === "only_selected" ? "Allowed" : "Muted"}
                            </span>
                          ) : (
                            <span className="w-5 h-5 rounded-md border border-neutral-300 dark:border-white/20 flex items-center justify-center text-transparent hover:border-neutral-400">
                              <Square className="w-3.5 h-3.5 text-transparent" />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* Modal Bottom Actions */}
        <div className="p-4 sm:p-5 border-t border-border/40 flex items-center justify-between gap-3 shrink-0 bg-neutral-50/60 dark:bg-black/40">
          <p className="text-[11px] font-mono text-muted-foreground">
            {activeTab === "roster"
              ? "All active enrolled section members"
              : `Selected mode: ${permissionMode}`}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                hapticLight();
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
            >
              {activeTab === "roster" ? "Close" : "Cancel"}
            </button>

            {activeTab === "permissions" && (
              <button
                type="button"
                disabled={isSavingPermissions}
                onClick={handleSavePermissions}
                className="px-5 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-100 text-xs font-semibold tracking-wide transition-all disabled:opacity-40 inline-flex items-center gap-1.5 active:scale-[0.98]"
              >
                {isSavingPermissions ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Save Policy
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
